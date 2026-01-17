import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';

interface PendingPost {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  review_status: string;
  decline_reason?: string;
  authorId: number;
  authorName: string;
  authorUsername: string;
  authorEmail: string;
  authorProfilePicture?: string;
  media: { url: string; mediaType: string; caption: string }[];
}

@Component({
  selector: 'app-post-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-review.component.html',
  styleUrls: ['./post-review.component.css']
})
export class PostReviewComponent implements OnInit, OnDestroy {
  pendingPosts: PendingPost[] = [];
  loading = true;
  currentPage = 1;
  totalPages = 1;
  totalPending = 0;
  pageSize = 12;
  selectedPost: PendingPost | null = null;
  showDeclineModal = false;
  declineReason = '';
  actionLoading = false;
  autoRefreshInterval: any;

  // Image viewer
  showImageViewer = false;
  currentImageIndex = 0;
  currentPostImages: { url: string; mediaType: string; caption: string }[] = [];

  constructor(
    private adminService: AdminService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.loadPendingPosts();
    // Auto-refresh every 30 seconds to catch new posts
    this.autoRefreshInterval = setInterval(() => {
      this.loadPendingPosts(true);
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
  }

  loadPendingPosts(silent: boolean = false): void {
    if (!silent) {
      this.loading = true;
    }

    this.adminService.getPendingPosts(this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.pendingPosts = response.payload.posts;
          this.totalPending = response.payload.pagination.total;
          this.totalPages = Math.ceil(this.totalPending / this.pageSize);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading pending posts:', error);
        this.sweetAlert.error('Failed to load pending posts');
        this.loading = false;
      }
    });
  }

  approvePost(post: PendingPost): void {
    this.sweetAlert.confirm(
      'Approve Post',
      `Are you sure you want to approve "${post.title}"? It will be visible to all users.`,
      'Yes, Approve'
    ).then((result: any) => {
      if (result.isConfirmed) {
        this.actionLoading = true;
        this.adminService.approvePost(post.id).subscribe({
          next: (response) => {
            if (response.status === 'success') {
              this.sweetAlert.success('Post approved successfully');
              // Remove from list
              this.pendingPosts = this.pendingPosts.filter(p => p.id !== post.id);
              this.totalPending--;
            }
            this.actionLoading = false;
          },
          error: (error) => {
            console.error('Error approving post:', error);
            this.sweetAlert.error('Failed to approve post');
            this.actionLoading = false;
          }
        });
      }
    });
  }

  openDeclineModal(post: PendingPost): void {
    this.selectedPost = post;
    this.declineReason = '';
    this.showDeclineModal = true;
  }

  closeDeclineModal(): void {
    this.showDeclineModal = false;
    this.selectedPost = null;
    this.declineReason = '';
  }

  confirmDecline(): void {
    if (!this.selectedPost) return;

    if (!this.declineReason.trim()) {
      this.sweetAlert.error('Please provide a reason for declining');
      return;
    }

    this.actionLoading = true;
    this.adminService.declinePost(this.selectedPost.id, this.declineReason).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.sweetAlert.success('Post declined successfully');
          // Remove from list
          this.pendingPosts = this.pendingPosts.filter(p => p.id !== this.selectedPost!.id);
          this.totalPending--;
          this.closeDeclineModal();
        }
        this.actionLoading = false;
      },
      error: (error) => {
        console.error('Error declining post:', error);
        this.sweetAlert.error('Failed to decline post');
        this.actionLoading = false;
      }
    });
  }

  openImageViewer(post: PendingPost, startIndex: number = 0): void {
    this.currentPostImages = post.media;
    this.currentImageIndex = startIndex;
    this.showImageViewer = true;
  }

  closeImageViewer(): void {
    this.showImageViewer = false;
    this.currentImageIndex = 0;
    this.currentPostImages = [];
  }

  nextImage(): void {
    if (this.currentImageIndex < this.currentPostImages.length - 1) {
      this.currentImageIndex++;
    }
  }

  previousImage(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    }
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPendingPosts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  }

  truncateContent(content: string, maxLength: number = 150): string {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }
}
