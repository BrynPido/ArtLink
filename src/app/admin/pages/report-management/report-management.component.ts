import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../services/data.service';
import { SweetAlertService } from '../../services/sweetalert.service';

interface Report {
  id: number;
  postId: number;
  reporterId: number;
  reason: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  postTitle?: string;
  postContent?: string;
  postAuthorId: number;
  postAuthorName: string;
  postAuthorUsername: string;
  reporterName: string;
  reporterUsername: string;
}

interface ReportStats {
  totalReports: number;
  recentReports: number;
  statusBreakdown: Array<{ status: string; count: number }>;
  topReasons: Array<{ reason: string; count: number }>;
}

@Component({
  selector: 'app-report-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-management.component.html',
  styleUrls: ['./report-management.component.css']
})
export class ReportManagementComponent implements OnInit {
  reports: Report[] = [];
  filteredReports: Report[] = [];
  paginatedReports: Report[] = [];
  stats: ReportStats | null = null;
  loading = true;
  
  // Filters
  selectedStatus = 'all';
  searchTerm = '';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  
  // Modal
  showDetailsModal = false;
  selectedReport: Report | null = null;

  constructor(private dataService: DataService, private sweetAlert: SweetAlertService) {}

  ngOnInit(): void {
    this.loadReports();
    this.loadStats();
  }

  loadReports(): void {
    this.loading = true;
    console.log('🔍 Loading reports with status:', this.selectedStatus);
    
    this.dataService.getReports(this.selectedStatus === 'all' ? undefined : this.selectedStatus).subscribe({
      next: (response) => {
        console.log('✅ Reports API response:', response);
        if (response && response.status === 'success') {
          this.reports = response.payload?.reports || [];
          this.filterReports();
        } else {
          console.error('❌ Unexpected response structure:', response);
          this.reports = [];
          this.filterReports();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error loading reports:', error);
        this.reports = [];
        this.filterReports();
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    console.log('🔍 Loading report stats...');
    this.dataService.getReportStats().subscribe({
      next: (response) => {
        console.log('✅ Stats API response:', response);
        if (response && response.status === 'success') {
          this.stats = response.payload;
        } else {
          console.error('❌ Unexpected stats response structure:', response);
          this.stats = null;
        }
      },
      error: (error) => {
        console.error('❌ Error loading report stats:', error);
        this.stats = null;
      }
    });
  }

  filterReports(): void {
    let filtered = [...this.reports];
    
    // Filter by status
    if (this.selectedStatus !== 'all') {
      filtered = filtered.filter(report => report.status === this.selectedStatus);
    }
    
    // Filter by search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(report => 
        report.postTitle?.toLowerCase().includes(term) ||
        report.reporterName.toLowerCase().includes(term) ||
        report.reporterUsername.toLowerCase().includes(term) ||
        report.postAuthorName.toLowerCase().includes(term) ||
        report.postAuthorUsername.toLowerCase().includes(term) ||
        report.reason.toLowerCase().includes(term)
      );
    }
    
    this.filteredReports = filtered;
    this.totalPages = Math.ceil(this.filteredReports.length / this.itemsPerPage);
    this.currentPage = 1;
    this.updatePaginatedReports();
  }

  updatePaginatedReports(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedReports = this.filteredReports.slice(startIndex, endIndex);
  }

  onFilterChange(): void {
    this.filterReports();
  }

  onSearchChange(): void {
    this.filterReports();
  }

  refreshReports(): void {
    this.loadReports();
    this.loadStats();
  }

  // Pagination methods
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedReports();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedReports();
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.updatePaginatedReports();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    const halfMax = Math.floor(maxPagesToShow / 2);
    
    let startPage = Math.max(1, this.currentPage - halfMax);
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  // Report status methods
  updateReportStatus(reportId: number, status: string): void {
    this.dataService.updateReportStatus(reportId, status).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          // Update the report in the local array
          const report = this.reports.find(r => r.id === reportId);
          if (report) {
            report.status = status;
            report.updatedAt = new Date().toISOString();
          }
          
          this.filterReports();
          this.loadStats(); // Refresh stats
          
          if (this.selectedReport && this.selectedReport.id === reportId) {
            this.selectedReport.status = status;
          }
          
          // Show success message using SweetAlert
          this.sweetAlert.success('Success!', `Report status updated to ${status}`);
        }
      },
      error: (error) => {
        console.error('Error updating report status:', error);
        this.sweetAlert.error('Error!', 'Failed to update report status. Please try again.');
      }
    });
  }

  deleteReport(reportId: number): void {
    this.sweetAlert.confirmDelete('report', 'This action cannot be undone.').then((result: any) => {
      if (result.isConfirmed) {
        this.dataService.deleteReport(reportId).subscribe({
          next: (response) => {
            if (response.status === 'success') {
              // Remove the report from the local array
              this.reports = this.reports.filter(r => r.id !== reportId);
              this.filterReports();
              this.loadStats(); // Refresh stats
              
              if (this.selectedReport && this.selectedReport.id === reportId) {
                this.closeDetailsModal();
              }
              
              this.sweetAlert.success('Success!', 'Report deleted successfully');
            }
          },
          error: (error) => {
            console.error('Error deleting report:', error);
            this.sweetAlert.error('Error!', 'Failed to delete report. Please try again.');
          }
        });
      }
    });
  }

  // Modal methods
  viewReportDetails(report: Report): void {
    this.selectedReport = report;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedReport = null;
  }

  // Utility methods
  formatReason(reason: string): string {
    const reasonMap: { [key: string]: string } = {
      'spam': 'Spam',
      'harassment': 'Harassment',
      'hate_speech': 'Hate Speech',
      'nudity': 'Nudity/Sexual Content',
      'violence': 'Violence',
      'copyright': 'Copyright',
      'misinformation': 'Misinformation',
      'other': 'Other'
    };
    
    return reasonMap[reason] || reason;
  }

  getPendingCount(): number {
    if (!this.stats || !this.stats.statusBreakdown) return 0;
    const pendingStatus = this.stats.statusBreakdown.find((s: any) => s.status === 'pending');
    return pendingStatus ? (typeof pendingStatus.count === 'string' ? parseInt(pendingStatus.count) : pendingStatus.count) || 0 : 0;
  }

  getResolvedCount(): number {
    if (!this.stats || !this.stats.statusBreakdown) return 0;
    const resolvedStatus = this.stats.statusBreakdown.find((s: any) => s.status === 'resolved');
    const approvedStatus = this.stats.statusBreakdown.find((s: any) => s.status === 'approved');
    
    const resolvedCount = resolvedStatus ? (typeof resolvedStatus.count === 'string' ? parseInt(resolvedStatus.count) : resolvedStatus.count) || 0 : 0;
    const approvedCount = approvedStatus ? (typeof approvedStatus.count === 'string' ? parseInt(approvedStatus.count) : approvedStatus.count) || 0 : 0;
    
    return resolvedCount + approvedCount;
  }

  Math = Math; // Make Math available in template
}
