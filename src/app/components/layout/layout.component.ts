import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { DataService } from '../../services/data.service';
import { WebSocketService } from '../../services/websocket.service';
import { NotificationStateService, Notification } from '../../services/notification-state.service';
import { MessageStateService } from '../../services/message-state.service';
import { DebugService } from '../../utils/debug.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

// Type guard function
function isNotificationContent(content: any): content is NotificationContent {
  return content && typeof content === 'object' && 'type' in content;
}

interface NotificationContent {
  type: string;
  message: string;
  userId: number;
  postId?: number;
  commentId?: number;
  timestamp: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit, OnDestroy {
  currentUser: any;
  sidebarWidth: string = '25rem';
  isMobileView: boolean = false;
  private notificationSubscription?: Subscription;
  private unreadCountSubscription?: Subscription;
  private unreadMessagesSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private userSubscription?: Subscription;
  unreadNotificationsCount: number = 0;
  unreadMessagesCount: number = 0;

  constructor(
    private router: Router, 
    private dataService: DataService,
    private webSocketService: WebSocketService,
    private notificationState: NotificationStateService,
    private messageState: MessageStateService,
    private debugService: DebugService
  ) {
    const user = this.dataService.getCurrentUser();
    this.currentUser = user ? {
      ...user,
      profileImage: user.profileImage ? this.getFullMediaUrl(user.profileImage) : null
    } : user;
    
    // Run diagnostics on production to help debug token issues
    if (environment.production) {
      console.log('🚀 Running production diagnostics...');
      this.debugService.runFullDiagnostics();
    }
  }

  // Helper method to construct full media URL
  getFullMediaUrl(mediaPath: string): string {
    if (!mediaPath) return '';
    // If it's already a full URL, return as is
    if (mediaPath.startsWith('http')) return mediaPath;
    // If it's a relative path, prepend the media base URL from environment
    return `${environment.mediaBaseUrl}${mediaPath}`;
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.adjustSidebarWidth(window.innerWidth);
    this.checkIfMobileView(window.innerWidth);
  }

  ngOnInit(): void {
    // Subscribe to user changes
    this.userSubscription = this.dataService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser = {
          ...user,
          profileImage: user.profileImage ? this.getFullMediaUrl(user.profileImage) : null
        };
      }
    });

    // Initialize WebSocket connection
    if (this.currentUser) {
      this.webSocketService.connect(this.currentUser.id);
      
      // Subscribe to WebSocket notifications
      this.notificationSubscription = this.webSocketService.notifications$.subscribe(messages => {
        if (messages.length > 0) {
          const latestMessage = messages[messages.length - 1];
          if (latestMessage?.content && isNotificationContent(latestMessage.content)) {
            const raw = (latestMessage as any).content as any;
            const wsId = Number(raw.id);
            // Guard: ignore realtime notifications without a valid DB id to avoid duplicates
            if (!Number.isFinite(wsId) || wsId <= 0) {
              return;
            }
            const notification: Notification = {
              id: wsId,
              type: latestMessage.content.type,
              content: latestMessage.content.message,
              recipientId: Number(this.currentUser.id),
              senderId: Number(latestMessage.content.userId),
              senderName: raw.senderName,
              senderUsername: raw.senderUsername,
              postId: latestMessage.content.postId !== undefined ? Number(latestMessage.content.postId) : undefined,
              createdAt: latestMessage.content.timestamp,
              read: false,
              commentId: latestMessage.content.commentId !== undefined ? Number(latestMessage.content.commentId) : undefined,
              followId: undefined,
              messageId: undefined
            };
            this.notificationState.addNotification(notification);
          }
        }
      });

      // Subscribe to unread count
      this.unreadCountSubscription = this.notificationState.unreadCount$.subscribe(count => {
        this.unreadNotificationsCount = count;
      });

      // Subscribe to unread messages count from message state service
      this.unreadMessagesSubscription = this.messageState.unreadCount$.subscribe(count => {
        this.unreadMessagesCount = count;
      });

      // Load initial notifications
      this.loadNotifications();
      
      // Load unread messages count initially and refresh every 30 seconds
      this.loadUnreadMessagesCount();
      setInterval(() => {
        this.loadUnreadMessagesCount();
      }, 30000); // Refresh every 30 seconds
      
      // Subscribe to router events to refresh unread count when navigating to inbox
      this.routerSubscription = this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: NavigationEnd) => {
        if (event.url.includes('/inbox')) {
          // Refresh unread count when navigating to inbox
          setTimeout(() => {
            this.loadUnreadMessagesCount();
          }, 500); // Small delay to ensure messages are loaded
        }
      });
    }

    // Set sidebar width and check view type based on current screen size
    this.adjustSidebarWidth(window.innerWidth);
    this.checkIfMobileView(window.innerWidth);
  }

  private loadNotifications() {
    if (this.currentUser) {
      this.dataService.getNotifications(this.currentUser.id).subscribe({
        next: (response: any) => {
          console.log('Notifications response:', response);
          if (response && response.payload) {
            // The API returns payload.notifications, not just payload
            const notifications = response.payload.notifications || response.payload;
            // Ensure notifications is an array
            const notificationsArray = Array.isArray(notifications) ? notifications : [];
            this.notificationState.setNotifications(notificationsArray);
          } else {
            // Set empty array if no valid payload
            this.notificationState.setNotifications([]);
          }
        },
        error: (error) => {
          console.error('Error loading notifications:', error);
          // Set empty array on error to prevent further issues
          this.notificationState.setNotifications([]);
        }
      });
    }
  }

  private loadUnreadMessagesCount() {
    if (this.currentUser) {
      this.dataService.getUnreadMessagesCount().subscribe({
        next: (count) => {
          this.messageState.setUnreadCount(count);
        },
        error: (error) => {
          console.error('Error loading unread messages count:', error);
          this.messageState.setUnreadCount(0);
        }
      });
    }
  }

  // Public method to refresh unread messages count (can be called from other components)
  refreshUnreadMessagesCount() {
    this.loadUnreadMessagesCount();
  }

  // Improve the adjustSidebarWidth method
  adjustSidebarWidth(screenWidth: number) {
    if (screenWidth >= 1280) {
      // XL screen
      this.sidebarWidth = '18rem';  // 72px
    } else if (screenWidth >= 1024) {
      // Large screen (lg)
      this.sidebarWidth = '16rem';  // 64px
    } else if (screenWidth >= 768) {
      // Medium screen (md)
      this.sidebarWidth = '14rem';  // 56px
    } else {
      // Small screen (default)
      this.sidebarWidth = '0px';
    }
  }

  checkIfMobileView(screenWidth: number) {
    this.isMobileView = screenWidth < 768; // Set mobile view if the screen is smaller than 768px
  }

  logout() {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will be logged out of your account.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-lg',
        confirmButton: 'rounded-lg',
        cancelButton: 'rounded-lg'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.webSocketService.disconnect();
        this.dataService.logout();
        
        // Show success message
        Swal.fire({
          title: 'Logged out!',
          text: 'You have been successfully logged out.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          customClass: {
            popup: 'rounded-lg'
          }
        });
      }
    });
  }

  navigateToMyProfile(): void {
    if (this.currentUser) {
      this.router.navigate(['/profile', this.currentUser.id]);
    }
  }

  isAdmin(): boolean {
    return this.currentUser && 
           (this.currentUser.email === 'admin@artlink.com' || 
            this.currentUser.username === 'admin');
  }

  ngOnDestroy() {
    // Also unsubscribe from user changes
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
    if (this.unreadCountSubscription) {
      this.unreadCountSubscription.unsubscribe();
    }
    if (this.unreadMessagesSubscription) {
      this.unreadMessagesSubscription.unsubscribe();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    this.webSocketService.disconnect();
  }
}
