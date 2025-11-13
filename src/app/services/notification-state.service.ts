import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { DataService } from './data.service';
import { tap, catchError } from 'rxjs/operators';

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

  private normalize(notification: Notification): Notification {
    return {
      ...notification,
      id: Number(notification.id),
      recipientId: Number(notification.recipientId),
      senderId: Number(notification.senderId),
      postId: notification.postId !== undefined ? Number(notification.postId) : undefined,
      commentId: notification.commentId !== undefined ? Number(notification.commentId) : undefined,
      followId: notification.followId !== undefined ? Number(notification.followId) : undefined,
      messageId: notification.messageId !== undefined ? Number(notification.messageId) : undefined,
      read: Boolean(notification.read)
    } as Notification;
  }

  addNotification(notification: Notification) {
    const normalized = this.normalize(notification);
    const current = this.notificationsSubject.value || [];
    const existsIndex = current.findIndex(n => Number(n.id) === normalized.id);
    if (existsIndex >= 0) {
      const updated = [...current];
      updated[existsIndex] = { ...updated[existsIndex], ...normalized };
      this.notificationsSubject.next(updated);
    } else {
      this.notificationsSubject.next([normalized, ...current]);
    }
    this.updateUnreadCount();
  }

  setNotifications(notifications: Notification[]) {
    // Ensure notifications is always an array and normalize + dedupe by id
    const notificationsArray = Array.isArray(notifications) ? notifications : [];
    const mapById = new Map<number, Notification>();
    for (const n of notificationsArray) {
      const norm = this.normalize(n as Notification);
      mapById.set(norm.id, { ...(mapById.get(norm.id) || {} as Notification), ...norm });
    }
    const deduped = Array.from(mapById.values()).sort((a, b) => {
      // Newest first by createdAt
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    this.notificationsSubject.next(deduped);
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

  markAsRead(notificationId: number): Observable<boolean> {
    const currentUser = this.dataService.getCurrentUser();
    if (!currentUser) return of(false);

    // Optimistic update
    const before = this.notificationsSubject.value || [];
    const hadItem = before.some(n => n.id === notificationId);
    if (hadItem) {
      const optimistic = before.map(n => n.id === notificationId ? { ...n, read: true } : n);
      this.notificationsSubject.next(optimistic);
      this.updateUnreadCount();
    }

    return this.dataService.markNotificationAsRead(notificationId).pipe(
      tap(() => {
        // Ensure state is read after server ack (already set optimistically)
        const notifications = (this.notificationsSubject.value || []).map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        );
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount();
      }),
      catchError(err => {
        // Revert optimistic update on error
        const reverted = (this.notificationsSubject.value || []).map(n => 
          n.id === notificationId ? { ...n, read: false } : n
        );
        this.notificationsSubject.next(reverted);
        this.updateUnreadCount();
        return throwError(() => err);
      }),
      tap(() => true)
    );
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