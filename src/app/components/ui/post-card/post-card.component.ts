import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { ToastService } from '../../../services/toast.service';
import { WebSocketService } from '../../../services/websocket.service';
import { TimeAgoPipe } from '../../../utils/time-ago.pipe';
import { environment } from '../../../../environments/environment';
// Import SweetAlert2
import Swal from 'sweetalert2';

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

  // Helper method to construct full media URL
  getFullMediaUrl(mediaPath: string): string {
    if (!mediaPath) return '';
    // If it's already a full URL, return as is
    if (mediaPath.startsWith('http')) return mediaPath;
    // If it's a relative path, prepend the media base URL from environment
    return `${environment.mediaBaseUrl}${mediaPath}`;
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
        
        // Extract posts array from the response payload
        if (response && response.payload && response.payload.posts) {
          this.posts = response.payload.posts;
        } else {
          this.posts = [];
        }
        
        console.log('Posts Array:', this.posts); // Log the posts array

        // Sort posts in descending order based on createdAt
        if (Array.isArray(this.posts)) {
          this.posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          // Process and initialize state for each post
          this.posts.forEach(post => {
            // Convert mediaUrls array to media objects with full URLs for template compatibility
            post.media = (post.mediaUrls || []).map((url: string) => ({ 
              url: this.getFullMediaUrl(url) 
            }));
            
            // Process author profile picture URL
            if (post.authorProfilePicture) {
              post.authorProfilePicture = this.getFullMediaUrl(post.authorProfilePicture);
            }
            
            this.currentImageIndex[post.id] = 0;
            this.likedPosts[post.id] = post.isLiked || false;
            this.savedPosts[post.id] = post.isSaved || false;
            this.likesCountMap[post.id] = post.likesCount || 0;
          });
        }

        this.cdr.detectChanges(); // Trigger change detection manually
      },
      error: (err) => {
        console.error('Error fetching posts:', err);
        this.posts = []; // Set to empty array on error
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
        // Update local state based on server response
        if (response && response.payload) {
          this.likedPosts[postId] = response.payload.liked;
          
          // Update likes count from server response
          if (response.payload.likesCount !== undefined) {
            this.likesCountMap[postId] = response.payload.likesCount;
          }
          
          // If the post was liked (not unliked) and it's not the user's own post
          if (response.payload.liked && authorId !== userId) {
            // Send real-time notification through WebSocket
            this.webSocketService.sendNotification(authorId, {
              type: 'LIKE',
              message: `${this.currentUser.username} liked your post`,
              userId: userId,
              postId: postId,
              timestamp: new Date().toISOString()
            });
          }
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
        // Update local state based on server response
        if (response && response.payload) {
          this.savedPosts[postId] = response.payload.saved;
        }
        this.cdr.markForCheck(); // Trigger change detection
      },
      error: (err) => {
        console.error('Error toggling save:', err);
        this.toastService.showToast('Failed to save post', 'error');
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

  // Replace the openConfirmationModal method with SweetAlert2
  openConfirmationModal(postId: number): void {
    // Prevent post navigation when clicking delete button
    event?.stopPropagation();
    
    Swal.fire({
      title: 'Delete Post?',
      text: 'This action cannot be undone. Are you sure you want to delete this post?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      backdrop: true,
      customClass: {
        container: 'swal-container',
        popup: 'swal-popup',
      },
    }).then((result) => {
      if (result.isConfirmed) {
        this.deletePost(postId);
      }
      // Close the dropdown menu after the action is completed
      this.menuOpenPostId = null;
    });
  }

  // Delete original closeConfirmationModal and confirmDelete methods
  // as they are no longer needed with SweetAlert2

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