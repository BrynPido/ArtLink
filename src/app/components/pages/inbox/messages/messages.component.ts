import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagingService, Conversation, Message } from '../../../../services/messaging.service';
import { DataService } from '../../../../services/data.service';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { TimeAgoPipe } from '../../../../utils/time-ago.pipe';


@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe, RouterModule],
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
  listingDetails: any = null;

  // Separated conversation lists
  listingConversations: Conversation[] = [];
  regularConversations: Conversation[] = [];

  private subscriptions: Subscription[] = [];

  activeTab: 'listings' | 'direct' = 'direct'; // Default to direct messages tab

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
        console.log('Received conversations:', conversations);
        this.conversations = conversations;
        this.filterConversations();
        this.loading = false;
        this.cdr.markForCheck();
        
        // Check if there's a conversation ID to auto-select
        const selectedConversationId = (window as any).selectedConversationId;
        if (selectedConversationId && conversations.length > 0) {
          const conversation = conversations.find(c => c.id == selectedConversationId);
          if (conversation) {
            console.log('Auto-selecting conversation:', conversation);
            this.selectConversation(conversation);
            // Clear the stored ID so it doesn't interfere later
            delete (window as any).selectedConversationId;
          }
        }
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

    // Set default active tab based on available conversations
    if (this.listingConversations.length > 0 && this.regularConversations.length === 0) {
      this.activeTab = 'listings';
    }
    
    // If there's any unread listing conversation, switch to listings tab
    const hasUnreadListingConversation = this.listingConversations.some(c => (c.unreadCount ?? 0) > 0);
    if (hasUnreadListingConversation) {
      this.activeTab = 'listings';
    }
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

    // // Log selection and type
    // if (conversation.listingId) {
    //   console.log(
    //     `[MESSAGES] Selected LISTING conversation (listingId=${conversation.listingId}, conversationId=${conversation.id})`
    //   );
    // } else {
    //   console.log(
    //     `[MESSAGES] Selected REGULAR conversation (conversationId=${conversation.id})`
    //   );
    // }

    // If this conversation is about a listing, get the listing details
    if (conversation.listingId) {
      this.dataService.getListingById(conversation.listingId.toString()).subscribe({
        next: (response) => {
          this.listingDetails = response.payload;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error fetching listing details:', error);
          this.listingDetails = null;
          this.cdr.markForCheck();
        }
      });
    } else {
      this.listingDetails = null;
    }
  }

  getConversationName(conversation: Conversation): string {
    if (!conversation.otherUser) {
      console.warn('No otherUser data for conversation:', conversation);
      return 'Unknown User';
    }
    return conversation.otherUser.name || conversation.otherUser.username || 'Unknown User';
  }

  getConversationImage(conversation: Conversation): string {
    if (!conversation.otherUser) {
      console.warn('No otherUser data for conversation image:', conversation);
      return 'assets/images/default-avatar.svg';
    }
    
    // Handle direct imageProfile from API response
    if (conversation.otherUser.imageProfile) {
      return conversation.otherUser.imageProfile;
    }
    
    // Fall back to profile.imageProfile if exists
    if (conversation.otherUser.profile && conversation.otherUser.profile.imageProfile) {
      return conversation.otherUser.profile.imageProfile;
    }
    
    return 'assets/images/default-avatar.svg';
  }

  sendMessage(): void {
    if (!this.activeConversation || !this.newMessage.trim()) {
      return;
    }

    const otherUserId = this.currentUser.id === this.activeConversation.user1Id 
      ? this.activeConversation.user2Id 
      : this.activeConversation.user1Id;

    // Log which type of conversation is being used
    if (this.activeConversation.listingId) {
      // console.log(
      //   `[MESSAGES] Sending message in LISTING conversation (listingId=${this.activeConversation.listingId}, conversationId=${this.activeConversation.id}): "${this.newMessage}"`
      // );
      
      // Send via WebSocket with listingId parameter
      this.messagingService.sendChatMessage(
        otherUserId,
        this.newMessage,
        this.activeConversation.id,
        this.activeConversation.listingId // Pass the listingId
      );
    } else {
      // console.log(
      //   `[MESSAGES] Sending message in REGULAR conversation (conversationId=${this.activeConversation.id}): "${this.newMessage}"`
      // );
      
      // Regular conversation - no listingId needed
      this.messagingService.sendChatMessage(
        otherUserId,
        this.newMessage,
        this.activeConversation.id
      );
    }

    // Clear the input - the messaging service will handle adding the message to the UI
    this.newMessage = '';
    this.cdr.markForCheck();
  }

  startNewConversation(userId: number): void {
    this.loading = true;
    this.messagingService.startNewConversation(userId).subscribe({
      next: (conversation) => {
        if (conversation) {
          // Set active tab to direct messages
          this.activeTab = 'direct';
          this.selectConversation(conversation);
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error starting conversation:', error);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  startConversationWithUser(userId: number): void {
    // Prevent messaging yourself
    if (userId === this.currentUser.id) {
      console.warn('Cannot start conversation with yourself');
      return;
    }

    // First check if we already have a conversation with this user
    const existingConversation = this.conversations.find(c => 
      ((c.user1Id === userId && c.user2Id === this.currentUser.id) || 
      (c.user1Id === this.currentUser.id && c.user2Id === userId)) &&
      !c.listingId // Make sure it's not a listing conversation
    );
    
    if (existingConversation) {
      // Set active tab to direct messages
      this.activeTab = 'direct';
      // If we already have a conversation, just select it
      this.selectConversation(existingConversation);
    } else {
      // Set active tab to direct messages
      this.activeTab = 'direct';
      // Start a new direct message conversation
      this.startNewConversation(userId);
    }
  }

  onSearchChange(): void {
    this.filterConversations();
  }

  filterConversations(): void {
    if (!this.searchTerm.trim()) {
      this.filteredConversations = this.conversations;
      
      // Separate conversations into listings and direct messages
      this.listingConversations = this.conversations.filter(c => c.listingId);
      this.regularConversations = this.conversations.filter(c => !c.listingId);
    } else {
      // Filter conversations by search term
      const searchLower = this.searchTerm.toLowerCase();
      this.filteredConversations = this.conversations.filter(conversation => {
        const name = this.getConversationName(conversation).toLowerCase();
        return name.includes(searchLower);
      });
    }
    this.cdr.markForCheck();
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

  setActiveTab(tab: 'listings' | 'direct'): void {
    this.activeTab = tab;
  }
}
