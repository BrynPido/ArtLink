import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';
import { getDeletionReasons } from '../../constants/deletion-reasons';
import { Workbook } from 'exceljs';

interface Post {
  id: number;
  title: string;
  content: string;
  published: boolean;
  status?: string;
  rejectionReason?: string;
  reviewedAt?: string;
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
  showPostExportMenu = false;

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
    // Archive = soft delete
    const confirmResult = await this.sweetAlert.confirmArchive('post', 'This post will be archived (soft deleted) and can be restored within 60 days. After 60 days, it may be permanently removed.');
    
    if (confirmResult.isConfirmed) {
      // Show dropdown with predefined reasons
      const reasonResult = await this.sweetAlert.selectWithOther(
        'Select Archival Reason',
        getDeletionReasons('POST'),
        true
      );
      
      if (reasonResult.isConfirmed && reasonResult.value) {
        this.actionLoading = true;
        this.adminService.deletePost(postId, reasonResult.value).subscribe({
          next: (response: any) => {
            if (response.status === 'success') {
              this.sweetAlert.success('Archived!', 'The post has been archived successfully.');
              this.loadPosts();
            }
            this.actionLoading = false;
          },
          error: (error: any) => {
            console.error('Error deleting post:', error);
            this.sweetAlert.error('Error', 'Failed to archive the post. Please try again.');
            this.actionLoading = false;
          }
        });
      }
    }
  }

  async bulkDelete() {
    if (this.selectedPosts.length === 0) return;
    // Bulk archive
    const confirmResult = await this.sweetAlert.confirmBulkArchive(this.selectedPosts.length, 'posts');
    
    if (confirmResult.isConfirmed) {
      // Show dropdown with predefined reasons
      const reasonResult = await this.sweetAlert.selectWithOther(
        'Select Bulk Archival Reason',
        getDeletionReasons('POST'),
        true
      );
      
      if (reasonResult.isConfirmed && reasonResult.value) {
        this.actionLoading = true;
        this.adminService.bulkDeletePosts(this.selectedPosts, reasonResult.value).subscribe({
          next: (response: any) => {
            if (response.status === 'success') {
              this.sweetAlert.success('Archived!', `${this.selectedPosts.length} posts have been archived successfully.`);
              this.selectedPosts = [];
              this.loadPosts();
            }
            this.actionLoading = false;
          },
          error: (error: any) => {
            console.error('Error bulk deleting posts:', error);
            this.sweetAlert.error('Error', 'Failed to archive the posts. Please try again.');
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
      'Created At': this.formatDateHuman(post.createdAt),
      Status: post.published ? 'Published' : 'Unpublished',
      Likes: post.likesCount,
      Comments: post.commentsCount,
      Content: this.truncateText(post.content, 100)
    }));

    this.downloadCSV(csvData, 'posts-export.csv');
  }

  // New: Excel export with branded header
  async exportPostsExcel() {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Posts', {
      pageSetup: {
        orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        horizontalCentered: true
      },
      views: [{ showGridLines: false }]
    });

    await this.applyBrandingHeader(ws, wb, {
      title: 'Posts Export',
      subtitle: `Exported ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • ${this.posts.length} posts`,
      mergeTo: 'I3'
    });

    ws.addRow(['ID', 'Title', 'Author', 'Username', 'Status', 'Likes', 'Comments', 'Created At', 'Content']);
    const header = ws.getRow(ws.lastRow!.number);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } } as any;
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } as any;

    this.posts.forEach(p => {
      ws.addRow([
        p.id,
        p.title || '',
        p.authorName || '',
        `@${p.authorUsername || ''}`,
        p.published ? 'Published' : 'Unpublished',
        p.likesCount || 0,
        p.commentsCount || 0,
        this.formatDateHuman(p.createdAt),
        this.truncateText(p.content, 100)
      ]);
    });

    ws.columns = [
      { width: 8 }, { width: 32 }, { width: 22 }, { width: 18 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 18 }, { width: 40 }
    ] as any;

    const headerRowNum = header.number;
    const lastRowNum = ws.lastRow?.number || headerRowNum;
    for (let r = headerRowNum; r <= lastRowNum; r++) {
      for (let c = 1; c <= 9; c++) {
        ws.getCell(r, c).border = {
          top: { style: r === headerRowNum ? 'thin' : undefined },
          bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }
        } as any;
      }
    }

    ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
    (ws as any).autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: 9 } };
    ws.pageSetup.printArea = `A1:I${lastRowNum}`;
    ws.headerFooter.oddFooter = `&LArtLink Admin&CGenerated ${new Date().toLocaleDateString()}&RPage &P of &N`;

    const buf = await wb.xlsx.writeBuffer();
    this.downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'artlink-posts.xlsx');
  }

  private async loadLogoMeta(): Promise<{ base64: string; width: number; height: number } | null> {
    try {
      const res = await fetch('/assets/images/Artlink_Logo.png');
      const blob = await res.blob();
      const [base64, dims] = await Promise.all([
        new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () => resolve((fr.result as string).split(',')[1]);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        }),
        new Promise<{ width: number; height: number }>((resolve, reject) => {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => { const meta = { width: img.naturalWidth || 240, height: img.naturalHeight || 60 }; URL.revokeObjectURL(url); resolve(meta); };
          img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
          img.src = url;
        })
      ]);
      return { base64, width: (dims as any).width, height: (dims as any).height };
    } catch (e) {
      console.warn('Failed to load logo for Excel export:', e);
      return null;
    }
  }

  private async applyBrandingHeader(ws: any, wb: Workbook, opts: { title: string; subtitle: string; mergeTo?: string }) {
    // Reserve columns A/B for logo and gutter so title never overlaps
    ws.getColumn(1).width = 24;
    ws.getColumn(2).width = 4;
    const r1 = ws.getRow(1); const r2 = ws.getRow(2); const r3 = ws.getRow(3);
    let headerRowHeight = 35;
    const logoMeta = await this.loadLogoMeta();
    if (logoMeta) {
      const imageId = wb.addImage({ base64: logoMeta.base64, extension: 'png' });
      const targetWidth = 150; const scale = targetWidth / (logoMeta.width || targetWidth);
      const height = Math.round((logoMeta.height || 60) * scale);
      ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: targetWidth, height } } as any);
      headerRowHeight = Math.max(38, Math.ceil(height / 3));
    }
    r1.height = headerRowHeight; r2.height = headerRowHeight; r3.height = headerRowHeight;
    const mergeTo = opts.mergeTo || 'F3';
    ws.mergeCells(`C1:${mergeTo}`);
    const cell = ws.getCell('C1');
    cell.value = { richText: [
      { text: opts.title + '\n', font: { size: 16, bold: true, color: { argb: 'FF111827' } } },
      { text: opts.subtitle, font: { size: 11, color: { argb: 'FF6B7280' } } }
    ] } as any;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true } as any;
    ws.pageSetup.printTitlesRow = '1:3';
    while ((ws.lastRow?.number ?? 0) < 3) { ws.addRow([]); }
    ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
  }

  private formatDateHuman(raw: string | undefined | null): string {
    if (!raw) return '';
    const d = new Date(raw.length === 10 ? raw + 'T00:00:00' : raw);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
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
    return post.published ? 'Published' : 'Unpublished';
  }

  getStatusText(status?: string): string {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  }

  getStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'approved': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'rejected': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300';
    }
  }

  approvePost(postId: number) {
    this.sweetAlert.confirm(
      'Approve Post',
      'Are you sure you want to approve this post? It will be visible to all users.',
      'Yes, approve it'
    ).then((result) => {
      if (result.isConfirmed) {
        this.actionLoading = true;
        this.adminService.approvePost(postId).subscribe({
          next: (response) => {
            this.sweetAlert.success('Post approved successfully!');
            this.loadPosts();
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

  rejectPost(postId: number) {
    this.sweetAlert.showRejectionReasonInput({
      title: 'Reject Post',
      inputLabel: 'Rejection Reason',
      inputPlaceholder: 'Enter reason for rejection...',
      confirmButtonText: 'Reject Post',
      showCancelButton: true
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.actionLoading = true;
        this.adminService.rejectPost(postId, result.value).subscribe({
          next: (response) => {
            this.sweetAlert.success('Post rejected successfully!');
            this.loadPosts();
            this.actionLoading = false;
          },
          error: (error) => {
            console.error('Error rejecting post:', error);
            this.sweetAlert.error('Failed to reject post');
            this.actionLoading = false;
          }
        });
      }
    });
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
