import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MessageStateService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor() { }

  setUnreadCount(count: number): void {
    this.unreadCountSubject.next(count);
  }

  decrementUnreadCount(amount: number = 1): void {
    const currentCount = this.unreadCountSubject.value;
    const newCount = Math.max(0, currentCount - amount);
    this.unreadCountSubject.next(newCount);
  }

  incrementUnreadCount(amount: number = 1): void {
    const currentCount = this.unreadCountSubject.value;
    this.unreadCountSubject.next(currentCount + amount);
  }

  getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }
}
