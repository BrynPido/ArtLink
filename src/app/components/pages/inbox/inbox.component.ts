import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {MatTabsModule} from '@angular/material/tabs';
import { NotificationsComponent } from './notifications/notifications.component';
import { MessagesComponent } from './messages/messages.component';

@Component({
  selector: 'app-inbox',
  imports: [CommonModule, MatTabsModule, NotificationsComponent, MessagesComponent],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.css'
})
export class InboxComponent {
  selectedTab: string = 'messages';

  selectTab(tab: string) {
    this.selectedTab = tab;
  }
}
