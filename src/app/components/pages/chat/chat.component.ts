import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit {
  messages: { userName: string } | null = null; // Renamed property

  constructor(
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) {
      this.startMessagesWithUser(+userId);
    }
  }

  startMessagesWithUser(userId: number): void {
    // Simulate fetching messages details for the user
    this.messages = { userName: `User ${userId}` }; // Replace with actual logic
    console.log('Starting messages with user:', userId);
  }
}