import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface Message {
  id?: number;
  content: string;
  conversationId: number;
  authorId: number;
  receiverId: number;
  createdAt: string;
  updatedAt?: string;
  readAt?: string;
  author?: any;
  receiver?: any;
}

export interface Conversation {
  id: number;
  user1Id: number;
  user2Id: number;
  createdAt: string;
  updatedAt: string;
  otherUserId?: number;
  otherUser?: any;
  lastMessage?: string;
  unreadCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MessagingService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 3000; // 3 seconds
  private userId: number | null = null;

  // Observable sources
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  private activeConversationSubject = new BehaviorSubject<Conversation | null>(null);
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  private newMessageSubject = new Subject<Message>();

  // Observable streams
  connectionStatus$ = this.connectionStatusSubject.asObservable();
  conversations$ = this.conversationsSubject.asObservable();
  activeConversation$ = this.activeConversationSubject.asObservable();
  messages$ = this.messagesSubject.asObservable();
  newMessage$ = this.newMessageSubject.asObservable();

  constructor(private dataService: DataService) { }

  // Connect to the WebSocket server
  connect(userId: number): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Already connected
      return;
    }

    this.userId = userId;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//localhost:8080`;
    
    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.connectionStatusSubject.next(true);
        this.reconnectAttempts = 0;
        
        // Authenticate after connection
        this.authenticate(userId);
        
        // Load initial data
        this.loadConversations();
      };

      this.socket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket connection closed', event);
        this.connectionStatusSubject.next(false);
        
        // Try to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.connect(userId);
          }, this.reconnectTimeout);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      // Fall back to HTTP for initial data loading
      this.loadConversations();
    }
  }

  // Authenticate with the WebSocket server
  private authenticate(userId: number): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'auth',
        userId: userId
      }));
    }
  }

  // Load user conversations from the HTTP API
  private loadConversations(): void {
    this.dataService.getConversations().subscribe({
      next: (response: any) => {
        if (response && response.payload) {
          this.conversationsSubject.next(response.payload);
        }
      },
      error: (error) => {
        console.error('Error loading conversations:', error);
      }
    });
  }

  // Set the active conversation and load its messages
  setActiveConversation(conversation: Conversation): void {
    this.activeConversationSubject.next(conversation);
    
    // Load messages for this conversation
    this.dataService.getConversationMessages(conversation.id).subscribe({
      next: (response: any) => {
        if (response && response.payload) {
          this.messagesSubject.next(response.payload);
        } else {
          this.messagesSubject.next([]);
        }
      },
      error: (error) => {
        console.error('Error loading messages:', error);
        this.messagesSubject.next([]);
      }
    });
    
    // Mark conversation as read if there are unread messages
    if (conversation.unreadCount && conversation.unreadCount > 0) {
      this.dataService.markConversationAsRead(conversation.id).subscribe();
      
      // Update the unread count in the conversations list
      const updatedConversations = this.conversationsSubject.value.map(c => {
        if (c.id === conversation.id) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      });
      
      this.conversationsSubject.next(updatedConversations);
    }
  }

  // Start a new conversation with another user
  startNewConversation(otherUserId: number): Observable<Conversation | null> {
    const currentUser = this.dataService.getCurrentUser();
    
    if (!currentUser) {
      return throwError(() => new Error('User is not logged in'));
    }

    const data = {
      user1Id: currentUser.id,
      user2Id: otherUserId
    };

    return this.dataService.createConversation(otherUserId).pipe(
      tap((response: any) => {
        if (response && response.payload) {
          const conversation = response.payload;
          
          // Add to conversations list
          const currentConversations = this.conversationsSubject.value;
          if (!currentConversations.find(c => c.id === conversation.id)) {
            this.conversationsSubject.next([conversation, ...currentConversations]);
          }
          
          // Set as active conversation
          this.activeConversationSubject.next(conversation);
          
          // Clear messages for this new conversation
          this.messagesSubject.next([]);
        }
      }),
      catchError(error => {
        console.error('Error starting conversation:', error);
        return throwError(() => error);
      })
    );
  }

  // Send a message via WebSocket
  sendChatMessage(toUserId: number, content: string): void {
    if (!content.trim()) {
      return;
    }

    const messageData = {
      type: 'message',
      to: toUserId,
      content: content
    };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Send via WebSocket
      this.socket.send(JSON.stringify(messageData));
    } else {
      // Fallback to HTTP API
      const activeConversation = this.activeConversationSubject.value;
      
      if (!activeConversation) {
        console.error('No active conversation to send message to');
        return;
      }

      this.dataService.sendMessage(toUserId, content).subscribe({
        next: (response: any) => {
          if (response && response.payload) {
            const message = response.payload;
            
            // Add message to the current message list
            const currentMessages = this.messagesSubject.value;
            this.messagesSubject.next([...currentMessages, message]);
            
            // Update conversation in the list with the last message
            this.updateConversationWithLastMessage(activeConversation.id, content);
          }
        },
        error: (error) => {
          console.error('Error sending message via HTTP:', error);
        }
      });
    }
  }

  // Handle incoming WebSocket messages
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'message':
          this.handleIncomingMessage(data);
          break;
          
        case 'message_delivered':
          console.log('Message delivered:', data);
          break;
          
        case 'notification':
          this.handleNotification(data);
          break;
          
        case 'auth':
          console.log('Authentication response:', data);
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  // Handle incoming chat messages
  private handleIncomingMessage(data: any): void {
    const activeConversation = this.activeConversationSubject.value;
    
    const message: Message = {
      id: data.id,
      content: data.content,
      conversationId: data.conversationId,
      authorId: data.from,
      receiverId: this.userId!,
      createdAt: data.timestamp
    };
    
    // Notify about new message
    this.newMessageSubject.next(message);
    
    // If it's for the active conversation, add it to the messages list
    if (activeConversation && activeConversation.id === data.conversationId) {
      const currentMessages = this.messagesSubject.value;
      this.messagesSubject.next([...currentMessages, message]);
      
      // Mark as read if it's the active conversation
      this.dataService.markConversationAsRead(data.conversationId).subscribe();
    }
    
    // Update conversation in the list with the last message
    this.updateConversationWithLastMessage(data.conversationId, data.content, true);
    
    // Refresh conversations list to update unread counts
    this.loadConversations();
  }

  // Handle notification messages
  private handleNotification(data: any): void {
    // For this implementation, we're not doing anything special with notifications
    console.log('Received notification:', data);
  }

  // Update a conversation with the last message content
  private updateConversationWithLastMessage(conversationId: number, lastMessage: string, isIncoming = false): void {
    const currentConversations = this.conversationsSubject.value;
    const updatedConversations = currentConversations.map(conversation => {
      if (conversation.id === conversationId) {
        const updates: any = {
          lastMessage,
          updatedAt: new Date().toISOString()
        };
        
        // If it's an incoming message and not the active conversation, increment unread count
        if (isIncoming && this.activeConversationSubject.value?.id !== conversationId) {
          updates.unreadCount = (conversation.unreadCount || 0) + 1;
        }
        
        return { ...conversation, ...updates };
      }
      return conversation;
    });
    
    // Move the updated conversation to the top of the list
    const updatedConversation = updatedConversations.find(c => c.id === conversationId);
    if (updatedConversation) {
      const filteredConversations = updatedConversations.filter(c => c.id !== conversationId);
      this.conversationsSubject.next([updatedConversation, ...filteredConversations]);
    } else {
      this.conversationsSubject.next(updatedConversations);
    }
  }

  // Cleanup resources when service is no longer needed
  cleanup(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.connectionStatusSubject.next(false);
    this.userId = null;
  }
}