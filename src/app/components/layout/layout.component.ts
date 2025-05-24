import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DataService } from '../../services/data.service';
import { WebSocketService } from '../../services/websocket.service';
import { NotificationStateService, Notification } from '../../services/notification-state.service';
import { Subscription } from 'rxjs';

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
  private userSubscription?: Subscription;
  unreadNotificationsCount: number = 0;

  constructor(
    private router: Router, 
    private dataService: DataService,
    private webSocketService: WebSocketService,
    private notificationState: NotificationStateService
  ) {
    this.currentUser = this.dataService.getCurrentUser();
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
        this.currentUser = user;
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
            const notification: Notification = {
              id: Date.now(),
              type: latestMessage.content.type,
              content: latestMessage.content.message,
              recipientId: this.currentUser.id,
              senderId: latestMessage.content.userId,
              postId: latestMessage.content.postId,
              createdAt: latestMessage.content.timestamp,
              read: false,
              commentId: latestMessage.content.commentId,
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

      // Load initial notifications
      this.loadNotifications();
    }

    // Set sidebar width and check view type based on current screen size
    this.adjustSidebarWidth(window.innerWidth);
    this.checkIfMobileView(window.innerWidth);
  }

  private loadNotifications() {
    if (this.currentUser) {
      this.dataService.getNotifications(this.currentUser.id).subscribe({
        next: (response: any) => {
          if (response.payload) {
            this.notificationState.setNotifications(response.payload);
          }
        },
        error: (error) => {
          console.error('Error loading notifications:', error);
        }
      });
    }
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
    this.webSocketService.disconnect();
    this.dataService.logout();
  }

  navigateToMyProfile(): void {
    if (this.currentUser) {
      this.router.navigate(['/profile', this.currentUser.id]);
    }
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
    this.webSocketService.disconnect();
  }
}
