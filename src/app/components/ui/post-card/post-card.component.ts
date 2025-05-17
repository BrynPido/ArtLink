import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { ToastService } from '../../../services/toast.service';
import { WebSocketService } from '../../../services/websocket.service';
import { TimeAgoPipe } from '../../../utils/time-ago.pipe';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe],
  templateUrl: './post-card.component.html',
  styleUrls: ['./post-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCardComponent implements OnInit {
  currentUser: any;
  posts: any[] = []; 
  currentImageIndex: { [key: number]: number } = {}; 
  showModal: boolean = false;
  modalImageUrl: string = '';
  menuOpenPostId: number | null = null; 

  // Post-specific state tracking
  likedPosts: { [key: number]: boolean } = {};
  savedPosts: { [key: number]: boolean } = {};
  likesCountMap: { [key: number]: number } = {};

  showConfirmationModal: boolean = false; // Track if the confirmation modal is open
  postToDeleteId: number | null = null; // Track which post is to be deleted

  loading: boolean = true; // Track loading state

  imageLoaded: { [key: string]: boolean } = {}; // Track which images have loaded
  modalImageLoaded: boolean = false;
  modalZoom: number = 1.0;

  constructor(
    private dataService: DataService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private webSocketService: WebSocketService
  ) {
    this.currentUser = this.dataService.getCurrentUser();
  }

  ngOnInit(): void {
    console.log('PostCardComponent initialized');
    this.fetchPosts(); // Fetch posts when the component initializes
  }

  // Fetch posts from the backend
  fetchPosts(): void {
    if (this.posts.length > 0) {
      this.loading = false; // Stop loading if posts are already fetched
      return;
    }

    this.loading = true; // Set loading to true when fetching starts
    this.dataService.getPosts().subscribe({
      next: (response) => {
        console.log('API Response:', response); // Log the API response
        this.posts = response.payload;
        console.log('Posts Array:', this.posts); // Log the posts array

        // Sort posts in descending order based on a property (e.g., createdAt)
        this.posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Initialize state for each post
        this.posts.forEach(post => {
          this.currentImageIndex[post.id] = 0;
          this.likedPosts[post.id] = post.likedByUser; // ← Set from API
          this.savedPosts[post.id] = post.savedByUser; // ← Set from API
          this.likesCountMap[post.id] = post.likeCount || 0;
        });

        this.cdr.detectChanges(); // Trigger change detection manually
      },
      error: (err) => {
        console.error('Error fetching posts:', err);
      },
      complete: () => {
        this.loading = false; // Ensure loading is set to false when fetching is complete
        this.cdr.detectChanges(); // Trigger change detection manually
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

  toggleLike(postId: number, authorId: number): void {
    const userId = this.currentUser.id;
    this.dataService.likePost(postId, userId).subscribe({
      next: (response) => {
        // Update local state
        this.likedPosts[postId] = !this.likedPosts[postId];
        this.likesCountMap[postId] += this.likedPosts[postId] ? 1 : -1;
        
        // If the post was liked (not unliked) and it's not the user's own post
        if (this.likedPosts[postId] && authorId !== userId) {
          // Send real-time notification through WebSocket
          this.webSocketService.sendNotification(authorId, {
            type: 'LIKE',
            message: `${this.currentUser.username} liked your post`,
            userId: userId,
            postId: postId,
            timestamp: new Date().toISOString()
          });
        }
        
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error toggling like:', err);
        this.toastService.showToast('Failed to like post', 'error');
      }
    });
  }

  toggleSave(postId: number): void {
    const userId = this.currentUser.id;
    this.dataService.savePost(postId, userId).subscribe({
      next: (response) => {
        this.savedPosts[postId] = !this.savedPosts[postId];
        this.cdr.markForCheck(); // Trigger change detection
      },
      error: (err) => {
        console.error('Error toggling save:', err);
      }
    });
  }

  deletePost(postId: number): void {
    const userId = this.currentUser.id;
    this.dataService.deletePost(postId, userId).subscribe({
      next: (response) => {
        if (response.success) {
          this.posts = this.posts.filter(post => post.id !== postId); // Remove post from UI
          this.toastService.showToast('Post deleted successfully!', 'success');
        } else {
          console.error('Error deleting post:', response.message);
          this.toastService.showToast('Failed to delete post!', 'error');
        }
      },
      error: (err) => {
        console.error('Error deleting post:', err);
        this.toastService.showToast('Failed to delete post!', 'error');
      }
    });
  }

  toggleMenu(postId: number): void {
    this.menuOpenPostId = this.menuOpenPostId === postId ? null : postId; // Toggle the menu
  }

  isMenuOpen(postId: number): boolean {
    return this.menuOpenPostId === postId; // Check if the menu for this post is open
  }

  // Open the modal with the selected image
  openModal(imageUrl: string) {
    this.modalImageUrl = imageUrl;
    this.showModal = true;
    this.modalImageLoaded = false;
    this.modalZoom = 1.0;
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

  // Function to open the confirmation modal
  openConfirmationModal(postId: number): void {
    this.postToDeleteId = postId; // Set the post ID to delete
    this.showConfirmationModal = true; // Show the confirmation modal
  }

  // Function to close the confirmation modal
  closeConfirmationModal(): void {
    this.showConfirmationModal = false; // Hide the confirmation modal
    this.postToDeleteId = null; // Reset the post ID
  }

  // Function to confirm deletion
  confirmDelete(): void {
    if (this.postToDeleteId !== null) {
      this.deletePost(this.postToDeleteId); // Call the delete function
    }
    this.closeConfirmationModal(); // Close the modal after confirming
  }

  // Method to handle clicks outside the menu
  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const menuButton = document.querySelector('.menu-button'); // Adjust selector as needed
    const dropdownMenu = document.querySelector('.dropdown-menu'); // Adjust selector as needed

    if (menuButton && !menuButton.contains(target) && dropdownMenu && !dropdownMenu.contains(target)) {
      this.menuOpenPostId = null; // Close the menu
    }
  }

  goToAuthorProfile(authorId: number): void {
    this.router.navigate(['/profile', authorId]);
  }

  navigateToPost(postId: number): void {
    this.router.navigate(['/post', postId]);
  }

  onImageLoad(postId: number, url: string): void {
    this.imageLoaded[postId + '-' + url] = true;
    this.cdr.detectChanges(); // If you're using ChangeDetectorRef
  }

  setCurrentImage(postId: number, index: number): void {
    this.currentImageIndex[postId] = index;
  }

  zoomIn(): void {
    if (this.modalZoom < 3.0) {
      this.modalZoom += 0.25;
    }
  }

  zoomOut(): void {
    if (this.modalZoom > 0.5) {
      this.modalZoom -= 0.25;
    }
  }

  resetZoom(): void {
    this.modalZoom = 1.0;
  }
}