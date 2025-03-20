import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, signal } from '@angular/core';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './post-card.component.html',
  styleUrls: ['./post-card.component.css']
})
export class PostCardComponent implements OnInit {
  currentUser: any;
  posts: any[] = []; // Array to store fetched posts
  currentImageIndex: { [key: number]: number } = {}; // Store current image index for each post
  showModal: boolean = false;
  modalImageUrl: string = '';

  // Post-specific state tracking
  likedPosts: { [key: number]: boolean } = {};
  savedPosts: { [key: number]: boolean } = {};
  likesCountMap: { [key: number]: number } = {};


  constructor(private dataService: DataService) {
    this.currentUser = this.dataService.getCurrentUser();
  }

  ngOnInit(): void {
    this.fetchPosts(); // Fetch posts when the component initializes
  }

  // Fetch posts from the backend
  fetchPosts(): void {
    this.dataService.getPosts().subscribe({
      next: (response) => {
        this.posts = response.payload;
        // Initialize state for each post
        this.posts.forEach(post => {
          this.currentImageIndex[post.id] = 0;
          this.likedPosts[post.id] = false;
          this.savedPosts[post.id] = false;
          this.likesCountMap[post.id] = post.likesCount || 0;
        });
      },
      error: (err) => {
        console.error('Error fetching posts:', err);
      }
    });
  }

  // Move to the previous image
  prevImage(postId: number): void {
    if (this.currentImageIndex[postId] > 0) {
      this.currentImageIndex[postId]--;
    }
  }

  // Move to the next image
  nextImage(postId: number, mediaLength: number): void {
    if (this.currentImageIndex[postId] < mediaLength - 1) {
      this.currentImageIndex[postId]++;
    }
  }

  isLiked(postId: number): boolean {
    return this.likedPosts[postId] || false;
  }

  isSaved(postId: number): boolean {
    return this.savedPosts[postId] || false;
  }

  likesCount(postId: number): number {
    return this.likesCountMap[postId] || 0;
  }

  toggleLike(postId: number): void {
    const userId = this.currentUser.id;
    this.dataService.likePost(postId, userId).subscribe({
      next: (response) => {
        this.likedPosts[postId] = !this.likedPosts[postId];
        this.likesCountMap[postId] += this.likedPosts[postId] ? 1 : -1;
      },
      error: (err) => {
        console.error('Error toggling like:', err);
      }
    });
  }

  toggleSave(postId: number): void {
    const userId = this.currentUser.id;
    this.dataService.savePost(postId, userId).subscribe({
      next: (response) => {
        this.savedPosts[postId] = !this.savedPosts[postId];
      },
      error: (err) => {
        console.error('Error toggling save:', err);
      }
    });
  }

  // Open the modal with the selected image
  openModal(imageUrl: string) {
    this.modalImageUrl = imageUrl;
    this.showModal = true;
  }

  // Close the modal
  closeModal() {
    this.showModal = false;
    this.modalImageUrl = '';
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.closeModal();
    }
  }
}