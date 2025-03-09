import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'app-post-card',
  imports: [CommonModule],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.css'
})
export class PostCardComponent {
  currentUser: any;

  // State to keep track of whether the post is liked and saved
  isLiked = signal(false);
  isSaved = signal(false);

  // Counter for likes (model approach using reactive state management)
  likesCount = signal(0);  // Initial like count, can be fetched dynamically

  constructor(private dataService: DataService) {
    this.currentUser = this.dataService.getCurrentUser();
  }

  // Update the likes count reactively
  updateCount(amount: number): void {
    this.likesCount.update(currentCount => currentCount + amount);
  }

  // Toggle the 'like' state and update likesCount
  toggleLike(): void {
    this.isLiked.update(isLiked => !isLiked);

    // Increment or decrement the like counter based on the current state
    if (this.isLiked()) {
      this.updateCount(1);
    } else {
      this.updateCount(-1);
    }
  }

  // Toggle the 'save' state
  toggleSave(): void {
    this.isSaved.update(isSaved => !isSaved);
  }
}
