import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { NotificationsComponent } from './notifications/notifications.component';
import { MessagesComponent } from './messages/messages.component';
import { ActivatedRoute, Router } from '@angular/router';
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
  activeTab = 'messages'; // Set default tab
  unreadNotifications = 0;
  unreadMessages = 0;
  private notificationSubscription?: Subscription;
  private messageSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private notificationState: NotificationStateService,
    private dataService: DataService
  ) {}

  ngOnInit(): void {
    // Get query parameters and set the active tab based on the URL
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
      
      // If we have a conversationId, we need to pass it to the messages component
      // Store it as a property that the messages component can access
      if (params['conversationId']) {
        // Store the conversation ID for the messages component to pick up
        (window as any).selectedConversationId = params['conversationId'];
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

  // Method to change tabs
  setActiveTab(tab: string): void {
    this.activeTab = tab;
    
    // Update URL without reloading the page
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }
}
