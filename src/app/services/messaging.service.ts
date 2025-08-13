import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { MessageStateService } from './message-state.service';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';

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
  listingId?: number;
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

  constructor(private dataService: DataService, private messageState: MessageStateService) { }

  // Connect to the WebSocket server
  connect(userId: number): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Already connected
      return;
    }

    this.userId = userId;
    // Always use secure WebSocket connection for production server
    const wsUrl = 'wss://artlink-f4jf.onrender.com';
    
    try {
      console.log(`Connecting to WebSocket server at: ${wsUrl}`);
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

  // Load messages for a specific conversation
  private loadMessagesForConversation(conversationId: number): void {
    this.dataService.getConversationMessages(conversationId).subscribe({
      next: (response: any) => {
        if (response && response.payload) {
          this.messagesSubject.next(response.payload);
        } else {
          this.messagesSubject.next([]);
        }
      },
      error: (error) => {
        console.error('Error loading messages for conversation:', error);
        this.messagesSubject.next([]);
      }
    });
  }

  // Set the active conversation and load its messages
  setActiveConversation(conversation: Conversation): void {
    this.activeConversationSubject.next(conversation);
    
    // Load messages for this conversation
    this.loadMessagesForConversation(conversation.id);
    
    // Mark conversation as read if there are unread messages
    if (conversation.unreadCount && conversation.unreadCount > 0) {
      this.dataService.markConversationAsRead(conversation.id).subscribe({
        next: () => {
          // Update the unread count in the conversations list
          const updatedConversations = this.conversationsSubject.value.map(c => {
            if (c.id === conversation.id) {
              return { ...c, unreadCount: 0 };
            }
            return c;
          });
          
          this.conversationsSubject.next(updatedConversations);
          
          // Refresh unread count from server to get accurate count
          this.refreshUnreadCount();
        },
        error: (error) => {
          console.error('Error marking conversation as read:', error);
        }
      });
    }
  }

  // Start a new conversation with another user
  startNewConversation(otherUserId: number): Observable<Conversation | null> {
    const currentUser = this.dataService.getCurrentUser();
    
    if (!currentUser) {
      return throwError(() => new Error('User is not logged in'));
    }

    return this.dataService.createConversation(otherUserId).pipe(
      tap((response: any) => {
        if (response && response.payload) {
          const conversation = response.payload;
          console.log('New conversation created:', conversation);
          
          // Add to conversations list
          const currentConversations = this.conversationsSubject.value;
          if (!currentConversations.find(c => c.id === conversation.id)) {
            this.conversationsSubject.next([conversation, ...currentConversations]);
          }
          
          // Set as active conversation
          this.activeConversationSubject.next(conversation);
          
          // Clear messages for this new conversation and load fresh messages
          this.messagesSubject.next([]);
          this.loadMessagesForConversation(conversation.id);
        }
      }),
      map((response: any) => response?.payload || null),
      catchError(error => {
        console.error('Error starting conversation:', error);
        return throwError(() => error);
      })
    );
  }

  // Send a message via WebSocket
  // sendChatMessage(toUserId: number, content: string, conversationId?: number, listingId?: number): void {
  //   console.log('[FRONTEND SEND]', { toUserId, content, conversationId, listingId });
  //   if (!content.trim()) {
  //     return;
  //   }

  //   const messageData = {
  //     type: 'message',
  //     to: toUserId,
  //     content: content,
  //     conversationId: conversationId, // Add this parameter
  //     listingId: listingId
  //   };

  //   if (this.socket && this.socket.readyState === WebSocket.OPEN) {
  //     // Send via WebSocket
  //     this.socket.send(JSON.stringify(messageData));
  //   } else {
  //     // Fallback to HTTP API
  //     const activeConversation = this.activeConversationSubject.value;
      
  //     if (!activeConversation) {
  //       console.error('No active conversation to send message to');
  //       return;
  //     }

  //     // Use the conversation ID parameter or active conversation ID
  //     const targetConversationId = conversationId || activeConversation.id;

  //     this.dataService.sendMessage(toUserId, content, targetConversationId).subscribe({
  //       next: (response: any) => {
  //         if (response && response.payload) {
  //           const message = response.payload;
            
  //           // Add message to the current message list
  //           const currentMessages = this.messagesSubject.value;
  //           this.messagesSubject.next([...currentMessages, message]);
            
  //           // Update conversation in the list with the last message
  //           this.updateConversationWithLastMessage(targetConversationId, content);
  //         }
  //       },
  //       error: (error) => {
  //         console.error('Error sending message via HTTP:', error);
  //       }
  //     });
  //   }
  // }

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
    
    // Only process messages from other users, not from ourselves
    if (data.from === this.userId) {
      console.log('Ignoring message from self');
      return;
    }
    
    // Notify about new message
    this.newMessageSubject.next(message);
    
    // If it's for the active conversation, add it to the messages list
    if (activeConversation && activeConversation.id === data.conversationId) {
      const currentMessages = this.messagesSubject.value;
      this.messagesSubject.next([...currentMessages, message]);
      
      // Mark as read if it's the active conversation
      this.dataService.markConversationAsRead(data.conversationId).subscribe({
        next: () => {
          // Refresh unread count after marking as read
          this.refreshUnreadCount();
        }
      });
    } else {
      // If it's not the active conversation, refresh unread count from server
      this.refreshUnreadCount();
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

  sendMessage(message: string, recipientId: number, conversationId: number, listingId: number | null = null): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }
  
    const messageData = {
      type: 'message',
      to: recipientId,
      content: message,
      conversationId: conversationId,  // Make sure this is being sent
      listingId: listingId
    };
  
    console.log('Sending message with data:', messageData);
    this.socket.send(JSON.stringify(messageData));
  }

  sendChatMessage(receiverId: number, content: string, conversationId: number, listingId?: number): void {
    // First, send via HTTP API to ensure it's saved to the database
    this.dataService.sendMessage(receiverId, content, conversationId).subscribe({
      next: (response) => {
        console.log('Message saved to database:', response);
        
        // Add message to the current message list immediately
        if (response && response.payload) {
          const currentMessages = this.messagesSubject.value;
          this.messagesSubject.next([...currentMessages, response.payload]);
        }
        
        // Don't increment unread count for sender - only receivers get unread badges
        // The unread count will be updated for the receiver when they receive the message via WebSocket
        
        // Then send via WebSocket for real-time delivery (if connected)
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          console.log('Sending WebSocket message:', {
            type: 'message',
            to: receiverId,
            content: content,
            conversationId: conversationId,
            listingId: listingId
          });
        
          this.socket.send(JSON.stringify({
            type: 'message',
            to: receiverId,
            content: content,
            conversationId: conversationId,
            listingId: listingId
          }));
        } else {
          console.log('WebSocket not connected, message saved to database only');
        }
      },
      error: (error) => {
        console.error('Failed to send message via HTTP:', error);
      }
    });
  }

  // Refresh unread count from server
  private refreshUnreadCount(): void {
    this.dataService.getUnreadMessagesCount().subscribe({
      next: (count) => {
        this.messageState.setUnreadCount(count);
      },
      error: (error) => {
        console.error('Error refreshing unread count:', error);
      }
    });
  }
}