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
        
        // If we have a conversationId and we're on the messages tab,
        // pass it to the messages component
        if (params['conversationId'] && this.activeTab === 'messages') {
          // This approach requires the messages component to listen for router events
          // or you need to use a shared service to communicate between components
        }
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
