import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../../services/data.service';
import { NotificationStateService, Notification } from '../../../../services/notification-state.service';
import { TimeAgoPipe } from '../../../../utils/time-ago.pipe';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { ToastService } from '../../../../services/toast.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  currentUser: any;
  private stateSubscription?: Subscription;
  private notificationState: NotificationStateService;

  constructor(
    private dataService: DataService,
    notificationState: NotificationStateService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private toastService: ToastService
  ) {
    this.notificationState = notificationState!;
    this.currentUser = this.dataService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }
  }

  ngOnInit() {
    // Subscribe to notifications from the state service
    this.stateSubscription = this.notificationState.notifications$.subscribe(notifications => {
      this.notifications = notifications;
      this.cdr.markForCheck();
    });

    // Load existing notifications if none exist in state
    if (this.notificationState.getNotifications().length === 0) {
      this.loadNotifications();
    }
  }

  loadNotifications() {
    this.dataService.getNotifications(this.currentUser.id).subscribe({
      next: (response: any) => {
        if (response.payload) {
          this.notificationState.setNotifications(response.payload);
        }
      },
      error: (error: Error) => {
        console.error('Error loading notifications:', error);
      }
    });
  }

  handleNotificationClick(notification: Notification) {
    // Mark the notification as read first
    if (!notification.read) {
      this.notificationState.markAsRead(notification.id);
    }

    // Then navigate based on notification type
    switch (notification.type) {
      case 'LIKE':
      case 'COMMENT':
        if (notification.postId) {
          this.router.navigate(['/post', notification.postId]);
        }
        break;
      case 'FOLLOW':
        if (notification.senderId) {
          this.router.navigate(['/profile', notification.senderId]);
        }
        break;
      case 'MESSAGE':
        if (notification.messageId) {
          this.router.navigate(['/inbox'], { queryParams: { tab: 'messages', chat: notification.senderId } });
        }
        break;
    }
  }

  deleteNotification(event: Event, notification: Notification) {
    event.stopPropagation(); // Prevent notification click event

    Swal.fire({
      title: 'Delete Notification',
      text: 'Are you sure you want to delete this notification?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.notificationState?.deleteNotification(notification.id)?.subscribe({
          next: () => {
            this.toastService.showToast('Notification deleted successfully', 'success');
            this.cdr.markForCheck();
          },
          error: (error) => {
            console.error('Error deleting notification:', error);
            this.toastService.showToast('Failed to delete notification', 'error');
            this.cdr.markForCheck();
          }
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
  }
}