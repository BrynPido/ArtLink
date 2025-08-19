import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../services/data.service';

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

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.loadReports();
    this.loadStats();
  }

  loadReports(): void {
    this.loading = true;
    this.dataService.getReports(this.selectedStatus === 'all' ? undefined : this.selectedStatus).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.reports = response.payload.reports || [];
          this.filterReports();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading reports:', error);
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    this.dataService.getReportStats().subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.stats = response.payload;
        }
      },
      error: (error) => {
        console.error('Error loading report stats:', error);
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
          
          // Show success message or toast
          console.log('Report status updated successfully');
        }
      },
      error: (error) => {
        console.error('Error updating report status:', error);
      }
    });
  }

  deleteReport(reportId: number): void {
    if (confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
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
            
            console.log('Report deleted successfully');
          }
        },
        error: (error) => {
          console.error('Error deleting report:', error);
        }
      });
    }
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
    if (!this.stats) return 0;
    const pendingStatus = this.stats.statusBreakdown.find(s => s.status === 'pending');
    return pendingStatus ? pendingStatus.count : 0;
  }

  getResolvedCount(): number {
    if (!this.stats) return 0;
    const resolvedStatus = this.stats.statusBreakdown.find(s => s.status === 'resolved');
    const approvedStatus = this.stats.statusBreakdown.find(s => s.status === 'approved');
    return (resolvedStatus?.count || 0) + (approvedStatus?.count || 0);
  }

  Math = Math; // Make Math available in template
}
