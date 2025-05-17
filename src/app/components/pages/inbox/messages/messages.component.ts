import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagingService, Conversation, Message } from '../../../../services/messaging.service';
import { DataService } from '../../../../services/data.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TimeAgoPipe } from '../../../../utils/time-ago.pipe';


@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessagesComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageContainer') private messageContainer?: ElementRef;

  currentUser: any;
  conversations: Conversation[] = [];
  messages: Message[] = [];
  activeConversation: Conversation | null = null;
  newMessage: string = '';
  
  loading: boolean = true;
  connectionStatus: boolean = false;
  searchTerm: string = '';
  filteredConversations: Conversation[] = [];
  followingUsers: any[] = []; // List of users the current user is following

  private subscriptions: Subscription[] = [];

  constructor(
    private messagingService: MessagingService,
    private dataService: DataService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUser = this.dataService.getCurrentUser();
    
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    // Fetch the list of users the current user is following
    this.dataService.getFollowingUsers(this.currentUser.id).subscribe({
      next: (users) => {
        this.followingUsers = users.payload || [];
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error fetching following users:', error);
      }
    });

    // Connect to WebSocket
    this.messagingService.connect(this.currentUser.id);
    
    // Subscribe to connection status
    this.subscriptions.push(
      this.messagingService.connectionStatus$.subscribe(status => {
        this.connectionStatus = status;
        this.cdr.markForCheck();
      })
    );
    
    // Subscribe to conversations
    this.subscriptions.push(
      this.messagingService.conversations$.subscribe(conversations => {
        this.conversations = conversations;
        this.filterConversations();
        this.loading = false;
        this.cdr.markForCheck();
      })
    );
    
    // Subscribe to messages for the active conversation
    this.subscriptions.push(
      this.messagingService.messages$.subscribe(messages => {
        this.messages = messages;
        this.cdr.markForCheck();
        this.scrollToBottom();
      })
    );
    
    // Subscribe to active conversation changes
    this.subscriptions.push(
      this.messagingService.activeConversation$.subscribe(conversation => {
        this.activeConversation = conversation;
        this.cdr.markForCheck();
      })
    );
    
    // Subscribe to new messages
    this.subscriptions.push(
      this.messagingService.newMessage$.subscribe(() => {
        this.scrollToBottom();
      })
    );
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.messagingService.cleanup();
  }

  selectConversation(conversation: Conversation): void {
    this.messagingService.setActiveConversation(conversation);
  }

  getConversationName(conversation: Conversation): string {
    if (!conversation.otherUser) return 'Unknown User';
    return conversation.otherUser.name || conversation.otherUser.username || 'Unknown User';
  }

  getConversationImage(conversation: Conversation): string {
    if (!conversation.otherUser || !conversation.otherUser.profile) return 'assets/images/default-avatar.svg';
    return conversation.otherUser.profile.imageProfile || 'assets/images/default-avatar.svg';
  }

  sendMessage(): void {
    if (!this.activeConversation || !this.newMessage.trim()) {
      return;
    }

    // Get the other user's ID from the active conversation
    const otherUserId = this.currentUser.id === this.activeConversation.user1Id 
      ? this.activeConversation.user2Id 
      : this.activeConversation.user1Id;

    // Send message via WebSocket
    this.messagingService.sendChatMessage(otherUserId, this.newMessage);
    
    // Add message to the current conversation (optimistic update)
    const message: Message = {
      content: this.newMessage,
      conversationId: this.activeConversation.id,
      authorId: this.currentUser.id,
      receiverId: otherUserId,
      createdAt: new Date().toISOString()
    };
    
    this.messages = [...this.messages, message];
    this.newMessage = ''; // Clear the input field
    this.cdr.markForCheck();
    this.scrollToBottom();
  }

  startNewConversation(userId: number): void {
    this.loading = true;
    this.messagingService.startNewConversation(userId).subscribe({
      next: (conversation) => {
        if (conversation) {
          this.activeConversation = conversation;
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('Error starting conversation:', error);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  startConversationWithUser(userId: number): void {
    this.startNewConversation(userId);
  }

  onSearchChange(): void {
    this.filterConversations();
  }

  filterConversations(): void {
    if (!this.searchTerm.trim()) {
      this.filteredConversations = this.conversations;
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredConversations = this.conversations.filter(conversation => {
      const name = this.getConversationName(conversation).toLowerCase();
      return name.includes(term);
    });
  }

  private scrollToBottom(): void {
    try {
      if (this.messageContainer) {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  isOwnMessage(message: Message): boolean {
    return message.authorId === this.currentUser.id;
  }

  trackByConversationId(index: number, conversation: Conversation): number {
    return conversation.id;
  }

  trackByMessageId(index: number, message: Message): number | string {
    return message.id || index;
  }
}
