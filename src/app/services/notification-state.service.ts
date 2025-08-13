import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DataService } from './data.service';
import { tap } from 'rxjs/operators';

export interface Notification {
  id: number;
  type: string;
  content: string;
  recipientId: number;
  senderId: number;
  postId?: number;
  commentId?: number;
  followId?: number;
  messageId?: number;
  createdAt: string;
  senderName?: string;
  senderUsername?: string;
  read: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationStateService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  
  notifications$ = this.notificationsSubject.asObservable();
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private dataService: DataService) {}

  addNotification(notification: Notification) {
    const current = this.notificationsSubject.value;
    this.notificationsSubject.next([notification, ...current]);
    this.updateUnreadCount();
  }

  setNotifications(notifications: Notification[]) {
    // Ensure notifications is always an array
    const notificationsArray = Array.isArray(notifications) ? notifications : [];
    this.notificationsSubject.next(notificationsArray);
    this.updateUnreadCount();
  }

  getNotifications(): Notification[] {
    return this.notificationsSubject.value || [];
  }

  private updateUnreadCount() {
    const notifications = this.notificationsSubject.value || [];
    // Ensure notifications is an array before filtering
    if (Array.isArray(notifications)) {
      const unreadCount = notifications.filter(n => !n.read).length;
      this.unreadCountSubject.next(unreadCount);
    } else {
      this.unreadCountSubject.next(0);
    }
  }

  markAsRead(notificationId: number) {
    const currentUser = this.dataService.getCurrentUser();
    if (!currentUser) return;

    this.dataService.markNotificationAsRead(notificationId).subscribe({
      next: () => {
        const notifications = (this.notificationsSubject.value || []).map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        );
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount();
      }
    });
  }

  deleteNotification(notificationId: number) {
    const currentUser = this.dataService.getCurrentUser();
    if (!currentUser) return;

    return this.dataService.deleteNotification(notificationId).pipe(
      tap(() => {
        const notifications = this.notificationsSubject.value.filter(n => n.id !== notificationId);
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount();
      })
    );
  }
}