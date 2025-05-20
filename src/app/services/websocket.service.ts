import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface NotificationContent {
  type: string;
  message: string;
  userId: number;
  postId?: number;
  commentId?: number;
  timestamp: string;
  comment?: any; // Add the comment property to support passing full comment objects
  messageId?: number; // Support for message notifications
}

export interface WebSocketMessage {
  type: string;
  from?: number;
  to?: number;
  content?: string | NotificationContent;
  status?: string;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket!: WebSocket;
  private messagesSubject = new BehaviorSubject<WebSocketMessage[]>([]);
  private notificationsSubject = new BehaviorSubject<WebSocketMessage[]>([]);
  private deliverySubject = new BehaviorSubject<{[key: string]: boolean}>({});

  messages$ = this.messagesSubject.asObservable();
  notifications$ = this.notificationsSubject.asObservable();
  messageDelivery$ = this.deliverySubject.asObservable();

  constructor() {}

  connect(userId: number): void {
    const wsUrl = 'wss://artlink-f4jf.onrender.com';
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connection established');
      this.authenticate(userId);
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data) as WebSocketMessage;
      console.log('WebSocket message received:', data);
      
      switch (data.type) {
        case 'message':
          const currentMessages = this.messagesSubject.value;
          this.messagesSubject.next([...currentMessages, data]);
          break;
        
        case 'message_delivered':
          if (data.to) {
            const deliveryStatus = this.deliverySubject.value;
            deliveryStatus[`${data.to}_${data.timestamp}`] = true;
            this.deliverySubject.next(deliveryStatus);
          }
          break;
        
        case 'notification':
          const currentNotifications = this.notificationsSubject.value;
          this.notificationsSubject.next([...currentNotifications, data]);
          break;
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket connection closed');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connect(userId), 5000);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private authenticate(userId: number): void {
    this.send({
      type: 'auth',
      userId
    });
  }

  send(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  sendMessage(to: number, content: string): void {
    const timestamp = new Date().toISOString();
    this.send({
      type: 'message',
      to,
      content,
      timestamp
    });
  }

  sendNotification(to: number, content: NotificationContent): void {
    this.send({
      type: 'notification',
      to,
      content
    });
  }

  subscribeToChannel(channel: string): void {
    this.send({
      type: 'subscribe',
      channel
    });
  }

  initiateChat(userId: number): void {
    this.send({
      type: 'initiate_chat',
      to: userId
    });
  }

  clearMessages(): void {
    this.messagesSubject.next([]);
  }

  clearNotifications(): void {
    this.notificationsSubject.next([]);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
    }
  }
}