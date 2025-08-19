import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';

interface PostReport {
  id: number;
  postId: number;
  reporterId: number;
  reason: string;
  description: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  updatedAt: string;
  reporter: {
    id: number;
    name: string;
    email: string;
    username: string;
  };
  post: {
    id: number;
    title: string;
    content: string;
    authorId: number;
    author: {
      id: number;
      name: string;
      username: string;
    };
    mediaUrls: string[];
  };
}

@Component({
  selector: 'app-report-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-management.component.html',
  styleUrls: ['./report-management.component.css']
})
export class ReportManagementComponent implements OnInit {
  reports: PostReport[] = [];
  loading = false;
  actionLoading = false;

  // Filters
  statusFilter = 'all';
  searchTerm = '';
  sortBy = 'createdAt';
  sortOrder = 'desc';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalReports = 0;
  totalPages = 0;

  // Modal state
  selectedReport: PostReport | null = null;
  showReportModal = false;
  showPostPreview = false;

  // Status options
  statusOptions = [
    { value: 'all', label: 'All Reports' },
    { value: 'pending', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'dismissed', label: 'Dismissed' }
  ];

  // Expose Math to template
  Math = Math;

  constructor(
    private adminService: AdminService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit() {
    this.loadReports();
  }

  loadReports() {
    this.loading = true;
    
    const params = {
      page: this.currentPage,
      limit: this.pageSize,
      status: this.statusFilter === 'all' ? undefined : this.statusFilter,
      search: this.searchTerm || undefined,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    };

    this.adminService.getPostReports(params).subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.reports = response.payload.reports;
          this.totalReports = response.payload.total;
          this.totalPages = Math.ceil(this.totalReports / this.pageSize);
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading reports:', error);
        this.sweetAlert.toast('error', 'Failed to load reports');
        this.loading = false;
      }
    });
  }

  onSearch() {
    this.currentPage = 1;
    this.loadReports();
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadReports();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadReports();
  }

  viewReport(report: PostReport) {
    this.selectedReport = report;
    this.showReportModal = true;
  }

  resolveReport(reportId: number, action: 'hide_post' | 'warn_user' | 'dismiss') {
    this.sweetAlert.input(
      'Resolve Report', 
      'Please provide a reason for your action:', 
      'textarea'
    ).then((reasonResult) => {
      if (reasonResult.isConfirmed && reasonResult.value) {
        this.actionLoading = true;
        
        this.adminService.resolvePostReport(reportId, action, reasonResult.value).subscribe({
          next: (response: any) => {
            if (response.status === 'success') {
              this.sweetAlert.success('Success!', 'Report resolved successfully.');
              this.loadReports();
              this.closeModal();
            }
            this.actionLoading = false;
          },
          error: (error: any) => {
            console.error('Error resolving report:', error);
            this.sweetAlert.error('Error', 'Failed to resolve report.');
            this.actionLoading = false;
          }
        });
      }
    });
  }

  dismissReport(reportId: number) {
    this.sweetAlert.confirmDelete('report', 'This will mark the report as dismissed.')
      .then((result) => {
        if (result.isConfirmed) {
          this.actionLoading = true;
          
          this.adminService.dismissPostReport(reportId).subscribe({
            next: (response: any) => {
              if (response.status === 'success') {
                this.sweetAlert.success('Success!', 'Report dismissed successfully.');
                this.loadReports();
                this.closeModal();
              }
              this.actionLoading = false;
            },
            error: (error: any) => {
              console.error('Error dismissing report:', error);
              this.sweetAlert.error('Error', 'Failed to dismiss report.');
              this.actionLoading = false;
            }
          });
        }
      });
  }

  viewPost(post: any) {
    // Open post in new tab or modal
    window.open(`/post/${post.id}`, '_blank');
  }

  closeModal() {
    this.showReportModal = false;
    this.showPostPreview = false;
    this.selectedReport = null;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pending Review';
      case 'resolved':
        return 'Resolved';
      case 'dismissed':
        return 'Dismissed';
      default:
        return status;
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  truncateText(text: string, length: number): string {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }
}
