import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';
import { getDeletionReasons } from '../../constants/deletion-reasons';

interface Post {
  id: number;
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorUsername: string;
  likesCount: number;
  commentsCount: number;
  mediaUrl?: string;
  media?: { mediaUrl: string; mediaType: string }[];
}

@Component({
  selector: 'app-post-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-management.component.html',
  styleUrls: ['./post-management.component.css']
})
export class PostManagementComponent implements OnInit, OnDestroy {
  posts: Post[] = [];
  loading = true;
  searchTerm = '';
  currentPage = 1;
  totalPages = 1;
  totalPosts = 0;
  pageSize = 20;
  selectedPosts: number[] = [];
  showPostModal = false;
  selectedPost: Post | null = null;
  actionLoading = false;

  // Image viewer properties
  showImageViewer = false;
  currentImageIndex = 0;
  currentImages: { mediaUrl: string; mediaType: string }[] = [];

  // Filter options
  filterBy = 'all'; // all, published, hidden
  sortBy = 'createdAt'; // createdAt, title, likesCount, commentsCount
  sortDirection = 'desc'; // asc, desc

  constructor(
    private adminService: AdminService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit() {
    this.loadPosts();
    // Add keyboard listener for image viewer
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  ngOnDestroy() {
    // Remove keyboard listener
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.showImageViewer) return;
    
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.previousImage();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nextImage();
        break;
      case 'Escape':
        event.preventDefault();
        this.closeImageViewer();
        break;
    }
  }

  // Helper method to get full image URL
  getFullImageUrl(imagePath: string | null | undefined): string {
    return this.adminService.getFullImageUrl(imagePath);
  }

  loadPosts() {
    this.loading = true;
    this.adminService.getAllPosts(
      this.currentPage, 
      this.pageSize, 
      this.filterBy
    ).subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.posts = response.payload.posts;
          this.totalPosts = response.payload.total;
          this.totalPages = Math.ceil(this.totalPosts / this.pageSize);
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading posts:', error);
        this.loading = false;
      }
    });
  }

  onSearch() {
    this.currentPage = 1;
    this.loadPosts();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadPosts();
  }

  selectPost(postId: number) {
    const index = this.selectedPosts.indexOf(postId);
    if (index > -1) {
      this.selectedPosts.splice(index, 1);
    } else {
      this.selectedPosts.push(postId);
    }
  }

  selectAllPosts() {
    if (this.selectedPosts.length === this.posts.length) {
      this.selectedPosts = [];
    } else {
      this.selectedPosts = this.posts.map(post => post.id);
    }
  }

  viewPost(post: Post) {
    this.selectedPost = post;
    this.showPostModal = true;
  }

  hidePost(postId: number) {
    const reason = prompt('Enter reason for hiding this post:');
    if (reason) {
      this.actionLoading = true;
      this.adminService.hidePost(postId, reason).subscribe({
        next: (response: any) => {
          if (response.status === 'success') {
            this.sweetAlert.toast('success', 'Post hidden successfully');
            this.loadPosts();
          }
          this.actionLoading = false;
        },
        error: (error: any) => {
          console.error('Error hiding post:', error);
          this.sweetAlert.toast('error', 'Failed to hide post');
          this.actionLoading = false;
        }
      });
    }
  }

  unhidePost(postId: number) {
    this.actionLoading = true;
    this.adminService.unhidePost(postId).subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.sweetAlert.toast('success', 'Post unhidden successfully');
          this.loadPosts();
        }
        this.actionLoading = false;
      },
      error: (error: any) => {
        console.error('Error unhiding post:', error);
        this.sweetAlert.toast('error', 'Failed to unhide post');
        this.actionLoading = false;
      }
    });
  }

  async deletePost(postId: number) {
    const confirmResult = await this.sweetAlert.confirmDelete('post', 'This post will be soft deleted and can be restored within 60 days. After 60 days, it will be permanently removed.');
    
    if (confirmResult.isConfirmed) {
      // Show dropdown with predefined reasons
      const reasonResult = await this.sweetAlert.selectWithOther(
        'Select Deletion Reason',
        getDeletionReasons('POST'),
        true
      );
      
      if (reasonResult.isConfirmed && reasonResult.value) {
        this.actionLoading = true;
        this.adminService.deletePost(postId, reasonResult.value).subscribe({
          next: (response: any) => {
            if (response.status === 'success') {
              this.sweetAlert.success('Deleted!', 'The post has been soft deleted successfully.');
              this.loadPosts();
            }
            this.actionLoading = false;
          },
          error: (error: any) => {
            console.error('Error deleting post:', error);
            this.sweetAlert.error('Error', 'Failed to delete the post. Please try again.');
            this.actionLoading = false;
          }
        });
      }
    }
  }

  async bulkDelete() {
    if (this.selectedPosts.length === 0) return;
    
    const confirmResult = await this.sweetAlert.confirmBulkDelete(this.selectedPosts.length, 'posts');
    
    if (confirmResult.isConfirmed) {
      // Show dropdown with predefined reasons
      const reasonResult = await this.sweetAlert.selectWithOther(
        'Select Bulk Deletion Reason',
        getDeletionReasons('POST'),
        true
      );
      
      if (reasonResult.isConfirmed && reasonResult.value) {
        this.actionLoading = true;
        this.adminService.bulkDeletePosts(this.selectedPosts, reasonResult.value).subscribe({
          next: (response: any) => {
            if (response.status === 'success') {
              this.sweetAlert.success('Deleted!', `${this.selectedPosts.length} posts have been soft deleted successfully.`);
              this.selectedPosts = [];
              this.loadPosts();
            }
            this.actionLoading = false;
          },
          error: (error: any) => {
            console.error('Error bulk deleting posts:', error);
            this.sweetAlert.error('Error', 'Failed to delete the posts. Please try again.');
            this.actionLoading = false;
          }
        });
      }
    }
  }

  exportPosts() {
    const csvData = this.posts.map(post => ({
      ID: post.id,
      Title: post.title,
      Author: post.authorName,
      Username: `@${post.authorUsername}`,
      'Created At': post.createdAt,
      Status: post.published ? 'Published' : 'Hidden',
      Likes: post.likesCount,
      Comments: post.commentsCount,
      Content: this.truncateText(post.content, 100)
    }));

    this.downloadCSV(csvData, 'posts-export.csv');
  }

  private downloadCSV(data: any[], filename: string) {
    const csvContent = this.convertToCSV(data);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => 
      headers.map(header => `"${row[header] || ''}"`).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
  }

  getPostStatusClass(post: Post): string {
    return post.published ? 'text-green-600' : 'text-red-600';
  }

  getPostStatusText(post: Post): string {
    return post.published ? 'Published' : 'Hidden';
  }

  truncateText(text: string, length: number): string {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  closeModal() {
    this.showPostModal = false;
    this.selectedPost = null;
  }

  // Image viewer methods
  openImageViewer(imageIndex: number) {
    if (this.selectedPost?.media && this.selectedPost.media.length > 0) {
      this.currentImages = this.selectedPost.media;
      this.currentImageIndex = imageIndex;
      this.showImageViewer = true;
    }
  }

  closeImageViewer() {
    this.showImageViewer = false;
    this.currentImages = [];
    this.currentImageIndex = 0;
  }

  previousImage() {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    } else {
      this.currentImageIndex = this.currentImages.length - 1;
    }
  }

  nextImage() {
    if (this.currentImageIndex < this.currentImages.length - 1) {
      this.currentImageIndex++;
    } else {
      this.currentImageIndex = 0;
    }
  }

  trackByPostId(index: number, post: Post): number {
    return post.id;
  }

  // Add missing Math property for template
  Math = Math;
}
