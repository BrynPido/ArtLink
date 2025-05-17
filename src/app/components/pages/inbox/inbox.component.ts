import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { NotificationsComponent } from './notifications/notifications.component';
import { MessagesComponent } from './messages/messages.component';
import { ActivatedRoute } from '@angular/router';
import { NotificationStateService } from '../../../services/notification-state.service';
import { DataService } from '../../../services/data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [CommonModule, MatTabsModule, NotificationsComponent, MessagesComponent],
  templateUrl: './inbox.component.html',
  styleUrls: ['./inbox.component.css']
})
export class InboxComponent implements OnInit, OnDestroy {
  selectedTabIndex = 0;
  unreadNotifications = 0;
  unreadMessages = 0;
  private notificationSubscription?: Subscription;
  private messageSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private notificationState: NotificationStateService,
    private dataService: DataService
  ) {
    // Check if we should open a specific tab based on route parameters
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'messages') {
        this.selectedTabIndex = 1;
      } else if (params['tab'] === 'notifications') {
        this.selectedTabIndex = 0;
      }
    });
  }

  ngOnInit() {
    // Subscribe to query parameters
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'messages') {
        this.selectedTabIndex = 1;
        // If a userId is provided, create a conversation with that user
        if (params['userId']) {
          this.dataService.createConversation(parseInt(params['userId'], 10)).subscribe({
            next: () => {
              // Conversation created or already exists
              // MessagesComponent will handle showing the conversation
            },
            error: (error) => {
              console.error('Error creating conversation:', error);
            }
          });
        }
      } else if (params['tab'] === 'notifications') {
        this.selectedTabIndex = 0;
      }
    });

    // Subscribe to unread notifications count
    this.notificationSubscription = this.notificationState.unreadCount$.subscribe(
      count => this.unreadNotifications = count
    );

    // Subscribe to unread messages count
    this.messageSubscription = this.dataService.getUnreadMessagesCount().subscribe(
      count => this.unreadMessages = count
    );
  }

  ngOnDestroy() {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
  }
}
