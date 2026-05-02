import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagingService, Conversation, Message } from '../../../../services/messaging.service';
import { DataService } from '../../../../services/data.service';
import { Router, RouterModule } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { TimeAgoPipe } from '../../../../utils/time-ago.pipe';
import { ToastService } from '../../../../services/toast.service';
import { SweetAlertService } from '../../../../admin/services/sweetalert.service';


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
  @Output() mobileConversationModeChange = new EventEmitter<boolean>();

  currentUser: any;
  conversations: Conversation[] = [];
  messages: Message[] = [];
  activeConversation: Conversation | null = null;
  newMessage: string = '';
  uploadingAttachment: boolean = false;
  
  loading: boolean = true;
  connectionStatus: boolean = false;
  searchTerm: string = '';
  filteredConversations: Conversation[] = [];
  followingUsers: any[] = []; // List of users the current user is following
  listingDetails: any = null;

  // Separated conversation lists
  listingConversations: Conversation[] = [];
  regularConversations: Conversation[] = [];
  isMobileViewport: boolean = false;
  mobileShowConversation: boolean = false;

  private subscriptions: Subscription[] = [];
  private pendingAutoSelectConversationId: number | null = null;

  activeTab: 'listings' | 'direct' = 'direct'; // Default to direct messages tab

  // Report modal state
  showReportModal: boolean = false;
  reportReason: string = '';
  reportDescription: string = '';
  reportTargetMessageId: number | null = null;
  submittingReport: boolean = false;
  selectedAttachmentUrls: string[] = [];
  selectedAttachmentIndex: number = 0;

  constructor(
    private messagingService: MessagingService,
    private dataService: DataService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.updateViewportState();

    this.currentUser = this.dataService.getCurrentUser();
    
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    const selectedConversationId = Number((window as any).selectedConversationId);
    this.pendingAutoSelectConversationId = Number.isFinite(selectedConversationId) && selectedConversationId > 0
      ? selectedConversationId
      : null;

    // Avoid carrying old selected chats into a fresh inbox open.
    if (!this.pendingAutoSelectConversationId) {
      this.messagingService.clearActiveConversation();
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
        if (this.pendingAutoSelectConversationId && conversations.length > 0) {
          const conversation = conversations.find(c => c.id === this.pendingAutoSelectConversationId);
          if (conversation) {
            console.log('Auto-selecting conversation:', conversation);
            this.selectConversation(conversation);
            // Clear the stored ID so it doesn't interfere later
            delete (window as any).selectedConversationId;
            this.pendingAutoSelectConversationId = null;
          }
        }

        this.syncActiveConversationForCurrentTab();
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
        if (!conversation) {
          this.mobileShowConversation = false;
        }
        this.emitMobileConversationState();
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

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateViewportState();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (!this.selectedAttachmentUrls.length) return;

    if (event.key === 'Escape') {
      this.closeAttachmentPreview();
    } else if (event.key === 'ArrowLeft') {
      this.showPreviousAttachment();
    } else if (event.key === 'ArrowRight') {
      this.showNextAttachment();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.messagingService.cleanup();
  }

  selectConversation(conversation: Conversation): void {
    this.activeTab = conversation.listingId ? 'listings' : 'direct';
    this.messagingService.setActiveConversation(conversation);
    if (this.isMobileViewport) {
      this.mobileShowConversation = true;
    }
    this.emitMobileConversationState();

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
      ).subscribe({
        next: () => {
          this.newMessage = '';
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Failed to send message', err);
          this.toast.showToast('Failed to send message', 'error');
        }
      });
    } else {
      // console.log(
      //   `[MESSAGES] Sending message in REGULAR conversation (conversationId=${this.activeConversation.id}): "${this.newMessage}"`
      // );
      
      // Regular conversation - no listingId needed
      this.messagingService.sendChatMessage(
        otherUserId,
        this.newMessage,
        this.activeConversation.id
      ).subscribe({
        next: () => {
          this.newMessage = '';
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Failed to send message', err);
          this.toast.showToast('Failed to send message', 'error');
        }
      });
    }

    // Clear the input - the messaging service will handle adding the message to the UI
    this.cdr.markForCheck();
  }

  // Handle file selection and upload
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.activeConversation) return;

    const files = Array.from(input.files);
    // Validate
    const nonImages = files.filter(f => !f.type.startsWith('image/'));
    if (nonImages.length > 0) {
      this.toast.showToast('Only image files are allowed', 'warning');
      return;
    }

    // Create a temporary pending message showing previews
    const tempId = -(Date.now());
    const previewUrls = files.map(f => URL.createObjectURL(f));
    const tempMessage: any = {
      id: tempId,
      content: JSON.stringify({ text: this.newMessage || null, attachments: previewUrls }),
      conversationId: this.activeConversation.id,
      authorId: this.currentUser.id,
      receiverId: this.activeConversation.user1Id === this.currentUser.id ? this.activeConversation.user2Id : this.activeConversation.user1Id,
      createdAt: new Date().toISOString(),
      pending: true
    };

    // Show temp message immediately
    this.messages = [...this.messages, tempMessage];
    this.scrollToBottom();
    this.cdr.markForCheck();

    this.uploadingAttachment = true;

    // Upload all files in parallel
    const uploads = files.map(f => this.dataService.uploadMessageAttachment(f));
    forkJoin(uploads).subscribe({
      next: (results: any[]) => {
        // Collect URLs
        const uploadedUrls = results.map(r => r?.payload?.url || r?.url || (r && r.payload && r.payload.url)).filter(Boolean);

        // Send a single message with all attachments
        const otherUserId = this.currentUser.id === this.activeConversation!.user1Id
          ? this.activeConversation!.user2Id
          : this.activeConversation!.user1Id;

        this.messagingService.sendChatMessage(otherUserId, this.newMessage || '', this.activeConversation!.id, this.activeConversation!.listingId, uploadedUrls).subscribe({
          next: () => {
            // Revoke preview object URLs
            previewUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
            // Remove temp message after server returns (messagingService will push the real message)
            this.messages = this.messages.filter(m => m.id !== tempId);
            this.newMessage = '';
            this.uploadingAttachment = false;
            this.cdr.markForCheck();
          },
          error: (err: any) => {
            console.error('Sending message failed', err);
            this.toast.showToast('Failed to send message with attachments', 'error');
            this.uploadingAttachment = false;
            // Keep temp message so user can retry or see failure
            this.cdr.markForCheck();
          }
        });
      },
      error: (err: any) => {
        console.error('Upload failed', err);
        this.toast.showToast('Failed to upload images', 'error');
        this.uploadingAttachment = false;
        // Remove temp previews and revoke object URLs
        previewUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
        this.messages = this.messages.filter(m => m.id !== tempId);
        this.cdr.markForCheck();
      }
    });
  }

  private sendMessageWithAttachment(attachmentUrl: string): void {
    if (!this.activeConversation) return;

    const otherUserId = this.currentUser.id === this.activeConversation.user1Id 
      ? this.activeConversation.user2Id 
      : this.activeConversation.user1Id;

    this.messagingService.sendChatMessage(
      otherUserId,
      this.newMessage || '',
      this.activeConversation.id,
      this.activeConversation.listingId,
      [attachmentUrl]
    ).subscribe({
      next: () => {
        this.newMessage = '';
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('Failed to send attachment message', err);
        this.toast.showToast('Failed to send image', 'error');
      }
    });

    // Clear text input after sending
    this.newMessage = '';
    this.cdr.markForCheck();
  }

  // Parse message content - supports plain text, JSON {text, attachment} and {text, attachments: []}
  parseMessageContent(message: any): { text?: string | null, attachment?: string | null, attachments?: string[] | null } {
    if (!message || !message.content) return { text: null, attachment: null, attachments: null };
    try {
      const parsed = JSON.parse(message.content);
      if (parsed) {
        if (Array.isArray(parsed.attachments)) {
          return { text: parsed.text || null, attachments: parsed.attachments };
        }
        if (parsed.attachment || parsed.text !== undefined) {
          return { text: parsed.text || null, attachment: parsed.attachment || null };
        }
      }
    } catch (e) {
      // Not JSON, fall through
    }
    // If content is a URL only
    if (typeof message.content === 'string' && message.content.startsWith('http')) {
      return { text: null, attachment: message.content, attachments: null };
    }
    return { text: message.content, attachment: null, attachments: null };
  }

  getAttachmentPreviewMode(attachments: string[] | null | undefined): 'single' | 'two' | 'three' | 'four-plus' {
    const count = attachments?.length || 0;
    if (count <= 1) return 'single';
    if (count === 2) return 'two';
    if (count === 3) return 'three';
    return 'four-plus';
  }

  getAttachmentPreviewItems(attachments: string[] | null | undefined): string[] {
    return Array.isArray(attachments) ? attachments.slice(0, 4) : [];
  }

  getAttachmentOverflowCount(attachments: string[] | null | undefined): number {
    return Math.max(0, (attachments?.length || 0) - 4);
  }

  openAttachmentPreview(urls: string[] | string, index = 0): void {
    const attachmentUrls = Array.isArray(urls) ? urls : [urls];
    if (!attachmentUrls.length) return;

    this.selectedAttachmentUrls = attachmentUrls;
    this.selectedAttachmentIndex = Math.min(Math.max(index, 0), attachmentUrls.length - 1);
    this.cdr.markForCheck();
  }

  closeAttachmentPreview(): void {
    this.selectedAttachmentUrls = [];
    this.selectedAttachmentIndex = 0;
    this.cdr.markForCheck();
  }

  showPreviousAttachment(): void {
    if (!this.selectedAttachmentUrls.length) return;
    this.selectedAttachmentIndex = (this.selectedAttachmentIndex - 1 + this.selectedAttachmentUrls.length) % this.selectedAttachmentUrls.length;
    this.cdr.markForCheck();
  }

  showNextAttachment(): void {
    if (!this.selectedAttachmentUrls.length) return;
    this.selectedAttachmentIndex = (this.selectedAttachmentIndex + 1) % this.selectedAttachmentUrls.length;
    this.cdr.markForCheck();
  }

  get selectedAttachmentUrl(): string | null {
    return this.selectedAttachmentUrls[this.selectedAttachmentIndex] || null;
  }

  canDeleteAttachmentMessage(message: Message): boolean {
    if (!message || !this.isOwnMessage(message) || !message.id) {
      return false;
    }

    const parsed = this.parseMessageContent(message);
    return !!(parsed.attachment || (parsed.attachments && parsed.attachments.length));
  }

  deleteAttachmentMessage(message: Message, event?: Event): void {
    event?.stopPropagation();

    if (!message.id) {
      return;
    }

    this.sweetAlert.confirmDelete('image message', 'Delete this image message?').then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.dataService.deleteMessage(Number(message.id)).subscribe({
        next: () => {
          this.messages = this.messages.filter(m => m.id !== message.id);
          if (this.selectedAttachmentUrls.length) {
            this.closeAttachmentPreview();
          }
          this.messagingService.refreshActiveConversationMessages();
          this.messagingService.refreshConversations();
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Failed to delete message', err);
          this.toast.showToast('Failed to delete image', 'error');
        }
      });
    });
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
        this.messageContainer.nativeElement.scrollLeft = 0;
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

  getUnreadCount(conversation: Conversation): number {
    const count = Number(conversation?.unreadCount ?? 0);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }

  hasUnread(conversation: Conversation): boolean {
    return this.getUnreadCount(conversation) > 0;
  }

  getDirectUnreadTotal(): number {
    return this.regularConversations.reduce((total, conversation) => {
      return total + this.getUnreadCount(conversation);
    }, 0);
  }

  getListingUnreadTotal(): number {
    return this.listingConversations.reduce((total, conversation) => {
      return total + this.getUnreadCount(conversation);
    }, 0);
  }

  setActiveTab(tab: 'listings' | 'direct'): void {
    this.activeTab = tab;
    this.syncActiveConversationForCurrentTab();
  }

  get showSidebarPane(): boolean {
    return !this.isMobileViewport || !this.mobileShowConversation;
  }

  get showMessagesPane(): boolean {
    return !this.isMobileViewport || this.mobileShowConversation;
  }

  backToConversationList(): void {
    this.mobileShowConversation = false;
    this.emitMobileConversationState();
  }

  private updateViewportState(): void {
    this.isMobileViewport = window.innerWidth <= 768;
    if (!this.isMobileViewport) {
      this.mobileShowConversation = false;
    }
    this.emitMobileConversationState();
  }

  private syncActiveConversationForCurrentTab(): void {
    if (!this.activeConversation) {
      return;
    }

    const isListingConversation = !!this.activeConversation.listingId;
    const matchesTab = this.activeTab === 'listings' ? isListingConversation : !isListingConversation;

    if (!matchesTab) {
      this.listingDetails = null;
      this.mobileShowConversation = false;
      this.messagingService.clearActiveConversation();
      this.emitMobileConversationState();
    }
  }

  private emitMobileConversationState(): void {
    const isConversationOpen = !!this.activeConversation && this.isMobileViewport && this.mobileShowConversation;
    this.mobileConversationModeChange.emit(isConversationOpen);
  }

  // Seller control methods
  isSellerOfListing(): boolean {
    return this.listingDetails && 
           this.currentUser && 
           this.listingDetails.authorId === this.currentUser.id;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'available':
        return 'text-green-600 dark:text-green-400 font-medium';
      case 'sold':
        return 'text-red-600 dark:text-red-400 font-medium';
      case 'reserved':
        return 'text-yellow-600 dark:text-yellow-400 font-medium';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  }

  markAsSold(): void {
    if (!this.activeConversation || !this.listingDetails) return;
    
    const otherUserId = this.activeConversation.user1Id === this.currentUser.id 
      ? this.activeConversation.user2Id 
      : this.activeConversation.user1Id;

    this.dataService.markListingAsSold(
      this.listingDetails.id, 
      otherUserId, 
      this.activeConversation.id
    ).subscribe({
      next: (response: any) => {
        console.log('Listing marked as sold:', response);
        // Update local listing details
        this.listingDetails = { ...this.listingDetails, status: 'sold' };
        // Send system message to conversation
        this.sendSystemMessage(`🎉 This item has been marked as sold!`);
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        console.error('Error marking as sold:', error);
      }
    });
  }

  reserveListing(): void {
    if (!this.listingDetails) return;

    this.dataService.reserveListing(this.listingDetails.id).subscribe({
      next: (response: any) => {
        console.log('Listing reserved:', response);
        this.listingDetails = { ...this.listingDetails, status: 'reserved' };
        this.sendSystemMessage(`🔒 This item has been reserved for you!`);
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        console.error('Error reserving listing:', error);
      }
    });
  }

  markAsAvailable(): void {
    if (!this.listingDetails) return;

    this.dataService.markListingAsAvailable(this.listingDetails.id).subscribe({
      next: (response: any) => {
        console.log('Listing marked as available:', response);
        this.listingDetails = { ...this.listingDetails, status: 'available' };
        this.sendSystemMessage(`✅ This item is now available again!`);
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        console.error('Error marking as available:', error);
      }
    });
  }

  private sendSystemMessage(content: string): void {
    if (!this.activeConversation) return;
    
    // Add a system message to the conversation
    const systemMessage: Message = {
      id: Date.now(),
      content,
      authorId: -1, // System message
      receiverId: this.activeConversation.user1Id === this.currentUser.id 
        ? this.activeConversation.user2Id 
        : this.activeConversation.user1Id,
      conversationId: this.activeConversation.id,
      createdAt: new Date().toISOString()
    };
    
    this.messages.push(systemMessage);
    this.scrollToBottom();
  }

  private getOtherUser(conversation: Conversation): any {
    // This method is no longer needed since we use IDs directly
    return conversation.user1Id === this.currentUser.id 
      ? conversation.user2Id 
      : conversation.user1Id;
  }

  // === Reporting ===
  canReport(message: Message): boolean {
    // Users cannot report their own messages
    return this.currentUser && message.authorId !== this.currentUser.id;
  }

  openReportModal(message: Message): void {
    if (!this.canReport(message)) return;
    this.reportTargetMessageId = Number(message.id);
    this.reportReason = '';
    this.reportDescription = '';
    this.showReportModal = true;
    this.cdr.markForCheck();
  }

  closeReportModal(): void {
    this.showReportModal = false;
    this.reportTargetMessageId = null;
    this.reportReason = '';
    this.reportDescription = '';
    this.submittingReport = false;
    this.cdr.markForCheck();
  }

  submitReport(): void {
    if (!this.reportTargetMessageId || !this.reportReason.trim()) {
      this.toast.showToast('Please select a reason', 'warning');
      return;
    }
    this.submittingReport = true;
    this.dataService.reportMessage(this.reportTargetMessageId, this.reportReason, this.reportDescription).subscribe({
      next: () => {
        this.toast.showToast('Report submitted. Thank you for keeping ArtLink safe.', 'success');
        this.closeReportModal();
      },
      error: (err) => {
        const msg = err?.message || 'Failed to submit report';
        this.toast.showToast(msg, 'error');
        this.submittingReport = false;
        this.cdr.markForCheck();
      }
    });
  }
}
