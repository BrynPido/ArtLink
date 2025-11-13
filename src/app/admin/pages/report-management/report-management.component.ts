import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../services/data.service';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';
import { Workbook } from 'exceljs';
import { getDeletionReasons } from '../../constants/deletion-reasons';
import Swal from 'sweetalert2';

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
  selectedPostMedia: Array<{ mediaUrl: string; mediaType?: string }> = [];
  selectedPostImageUrl: string | null = null;

  constructor(private dataService: DataService, private sweetAlert: SweetAlertService, private adminService: AdminService) {}

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

  async deleteReport(reportId: number): Promise<void> {
    // Archive semantics (soft delete) with reason capture
    const confirm = await this.sweetAlert.confirmArchive('report', 'This report will be archived for audit and removed from the active queue.');
    if (!confirm.isConfirmed) return;

    const reasonResult = await this.sweetAlert.selectWithOther('Select Archive Reason', getDeletionReasons('ARCHIVE'), true);
    if (!(reasonResult.isConfirmed && reasonResult.value)) return;

    const reason = reasonResult.value;

    // Store reason into report status as admin note before archiving
    this.dataService.updateReportStatus(reportId, 'resolved', reason).subscribe({
      next: () => {
        this.dataService.deleteReport(reportId).subscribe({
          next: (response) => {
            if (response.status === 'success') {
              this.reports = this.reports.filter(r => r.id !== reportId);
              this.filterReports();
              this.loadStats();
              if (this.selectedReport && this.selectedReport.id === reportId) {
                this.closeDetailsModal();
              }
              this.sweetAlert.success('Archived!', 'Report archived with reason recorded.');
            }
          },
          error: (error) => {
            console.error('Error archiving report:', error);
            this.sweetAlert.error('Error!', 'Failed to archive report. Please try again.');
          }
        });
      },
      error: (error) => {
        console.error('Error saving archive reason:', error);
        this.sweetAlert.error('Error!', 'Failed to save archive reason. Please try again.');
      }
    });
  }

  // Modal methods
  viewReportDetails(report: Report): void {
    this.selectedReport = report;
    this.showDetailsModal = true;
    this.selectedPostMedia = [];
    this.selectedPostImageUrl = null;
    if (report?.postId) {
      this.dataService.getPostById(String(report.postId)).subscribe({
        next: (res) => {
          const post = res?.payload || res;
          const mediaUrls: string[] = post?.mediaUrls || [];
          if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
            // Take the first media URL as preview
            const first = mediaUrls[0];
            this.selectedPostImageUrl = first.startsWith('http') ? first : this.dataService.getFullImageUrl(first);
          }
        },
        error: (err) => {
          console.error('Failed to load post media for report', report.id, err);
        }
      });
    }
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedReport = null;
    this.selectedPostMedia = [];
    this.selectedPostImageUrl = null;
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

  // Export: Excel with branding
  async exportReportsExcel() {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Reports', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }, views: [{ showGridLines: false }] });
    const count = this.filteredReports.length;
    await this.applyBrandingHeader(ws, wb, { title: 'Reports Export', subtitle: `Exported ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • ${count} reports`, mergeTo: 'H3' });

    ws.addRow(['ID', 'Post Title', 'Post Author', 'Reporter', 'Reason', 'Status', 'Created At']);
    const header = ws.getRow(ws.lastRow!.number);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } } as any;
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } as any;

    this.filteredReports.forEach(r => {
      ws.addRow([
        r.id,
        r.postTitle || '',
        `@${r.postAuthorUsername || ''}`,
        `${r.reporterName || ''} (@${r.reporterUsername || ''})`,
        r.reason || '',
        (r.status || '').toString().toUpperCase(),
        this.formatDateHuman(r.createdAt)
      ]);
    });

    ws.columns = [ { width: 8 }, { width: 32 }, { width: 20 }, { width: 26 }, { width: 16 }, { width: 14 }, { width: 20 } ] as any;
    const headerRowNum = header.number; const lastRowNum = ws.lastRow?.number || headerRowNum;
    for (let r = headerRowNum; r <= lastRowNum; r++) { for (let c = 1; c <= 7; c++) { ws.getCell(r, c).border = { top: { style: r === headerRowNum ? 'thin' : undefined }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } as any; } }
    ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }]; (ws as any).autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: 7 } };
    ws.pageSetup.printArea = `A1:G${lastRowNum}`; ws.headerFooter.oddFooter = `&LArtLink Admin&CGenerated ${new Date().toLocaleDateString()}&RPage &P of &N`;

    const buf = await wb.xlsx.writeBuffer();
    this.downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'artlink-reports.xlsx');
  }

  private async loadLogoMeta(): Promise<{ base64: string; width: number; height: number } | null> {
    try {
      const res = await fetch('/assets/images/Artlink_Logo.png'); const blob = await res.blob();
      const [base64, dims] = await Promise.all([
        new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onloadend = () => resolve((fr.result as string).split(',')[1]); fr.onerror = reject; fr.readAsDataURL(blob); }),
        new Promise<{ width: number; height: number }>((resolve, reject) => { const url = URL.createObjectURL(blob); const img = new Image(); img.onload = () => { const meta = { width: img.naturalWidth || 240, height: img.naturalHeight || 60 }; URL.revokeObjectURL(url); resolve(meta); }; img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); }; img.src = url; })
      ]);
      return { base64, width: (dims as any).width, height: (dims as any).height };
    } catch { return null; }
  }
  private async applyBrandingHeader(ws: any, wb: Workbook, opts: { title: string; subtitle: string; mergeTo?: string }) {
    // Reserve columns A and B for the logo and start title at column C to avoid overlap
    ws.getColumn(1).width = 24; // wider band for logo (~150px)
    ws.getColumn(2).width = 4;  // small gutter

    // Compute header row heights based on logo height so the image fits within rows 1-3
    const r1 = ws.getRow(1); const r2 = ws.getRow(2); const r3 = ws.getRow(3);
    let headerRowHeight = 35;
    const logo = await this.loadLogoMeta();
    if (logo) {
      const id = wb.addImage({ base64: logo.base64, extension: 'png' });
      const targetWidth = 150;
      const scale = targetWidth / (logo.width || targetWidth);
      const h = Math.round((logo.height || 60) * scale);
      // Place logo at top-left spanning columns A/B area
      ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: targetWidth, height: h } } as any);
      headerRowHeight = Math.max(38, Math.ceil(h / 3));
    }

    r1.height = headerRowHeight; r2.height = headerRowHeight; r3.height = headerRowHeight;

    const mergeTo = opts.mergeTo || 'F3';
    // Start merged title block at C1 instead of B1 to stay clear of the logo area
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
  private formatDateHuman(raw: any): string { if (!raw) return ''; const d = new Date(typeof raw === 'string' && raw.length === 10 ? raw + 'T00:00:00' : raw); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  private downloadBlob(blob: Blob, filename: string) { const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); window.URL.revokeObjectURL(url); }

  // Open moderation summary/actions for the reported user (post author)
  async reviewReportedUser() {
    const report = this.selectedReport;
    if (!report || !report.postAuthorId) {
      this.sweetAlert.error?.('Missing Data', 'Reported user information is unavailable.');
      return;
    }
    this.loading = true;
    this.adminService.getUserModerationSummary(report.postAuthorId).subscribe({
      next: async (res) => {
        this.loading = false;
        const summary = res?.payload;
        if (!summary) {
          this.sweetAlert.error?.('Error', 'Failed to load moderation summary');
          return;
        }
        const restriction = summary.activeRestriction;
        const vol = summary.volumes || {};
        const totals = summary.totals || {};
        const recent = summary.recentReports || [];
        const isDarkMode = document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
        const html = `
          <div style='text-align:left;font-size:13px'>
            <strong>User:</strong> ${summary.user?.username || ''} (${summary.user?.name || ''})<br>
            <strong>Reports:</strong> Total ${totals.total || 0}, Pending ${totals.pending || 0}<br>
            <strong>Message Volume:</strong> 24h ${vol.last24h || 0}, 7d ${vol.last7d || 0}<br>
            <strong>Restriction:</strong> ${restriction ? 'Active until ' + (restriction.expiresAt || '(indef)') : 'None'}<br>
            <hr style='margin:8px 0'>
            <strong>Recent Report Reasons:</strong><br>
            ${recent.map((r: any) => `• ${r.reason} (${r.status})`).join('<br>') || 'None'}
          </div>
        `;
        const footer = `
          <button id="suspendBtn" class="swal2-styled" style="background-color: #dc2626; margin-right: 8px;">
            ${restriction?.type === 'account' ? 'Unsuspend Account' : 'Suspend Account'}
          </button>
        `;

        const result = await Swal.fire({
          title: 'User Moderation',
          html,
          footer,
          width: 600,
          showCancelButton: true,
          cancelButtonText: 'Close',
          showDenyButton: true,
          denyButtonText: restriction?.type === 'messaging' ? 'Lift Messaging Restriction' : 'Restrict Messaging',
          showConfirmButton: true,
          confirmButtonText: 'Warn User',
          showLoaderOnConfirm: false,
          background: isDarkMode ? '#1f2937' : '#ffffff',
          color: isDarkMode ? '#f3f4f6' : '#111827',
          customClass: {
            popup: isDarkMode ? 'border border-gray-700' : 'border border-gray-200',
            title: 'text-indigo-600 dark:text-indigo-400',
            confirmButton: 'bg-green-600 hover:bg-green-700',
            denyButton: 'bg-yellow-600 hover:bg-yellow-700',
            cancelButton: 'bg-gray-500 hover:bg-gray-600',
            footer: 'border-t border-gray-200 dark:border-gray-700 pt-3'
          },
          didOpen: () => {
            const suspendBtn = document.getElementById('suspendBtn');
            suspendBtn?.addEventListener('click', async () => {
              Swal.close();
              await this.handleSuspendActionForUser(report.postAuthorId, restriction?.type === 'account');
            });
          }
        });
        if (result.isConfirmed) {
          const warnReason = await this.sweetAlert.input('Warn User', 'Enter warning reason', 'text');
          if (warnReason.isConfirmed && warnReason.value) {
            this.adminService.warnUser(report.postAuthorId, warnReason.value).subscribe({
              next: () => this.sweetAlert.success('Warning Sent', 'User has been warned.'),
              error: () => this.sweetAlert.error('Error', 'Failed to send warning')
            });
          }
        } else if (result.isDenied) {
          if (restriction?.type === 'messaging') {
            this.adminService.unrestrictMessaging(report.postAuthorId).subscribe({
              next: () => this.sweetAlert.success('Restriction Lifted', 'User can send messages again.'),
              error: () => this.sweetAlert.error('Error', 'Failed to lift restriction')
            });
          } else {
            const durResult = await this.sweetAlert.selectWithOther('Restriction Duration', ['15','60','360','1440','10080'], false);
            if (durResult.isConfirmed) {
              const minutes = parseInt(durResult.value, 10);
              const reasonResult = await this.sweetAlert.selectWithOther('Restriction Reason', ['spam','harassment','hate','other']);
              if (reasonResult.isConfirmed) {
                const finalReason = reasonResult.value || reasonResult?.value;
                this.adminService.restrictMessaging(report.postAuthorId, minutes, finalReason).subscribe({
                  next: () => this.sweetAlert.success('Restriction Applied', `Messaging blocked for ${minutes} min.`),
                  error: () => this.sweetAlert.error('Error', 'Failed to apply restriction')
                });
              }
            }
          }
        }
      },
      error: () => {
        this.loading = false;
        this.sweetAlert.error?.('Error', 'Failed to load moderation summary');
      }
    });
  }

  private async handleSuspendActionForUser(userId: number, isCurrentlySuspended: boolean) {
    if (isCurrentlySuspended) {
      const confirm = await this.sweetAlert.confirm(
        'Unsuspend Account',
        'Remove the account suspension and allow this user to access the platform again?',
        'Yes, unsuspend'
      );
      if (confirm.isConfirmed) {
        this.adminService.unsuspendUser(userId).subscribe({
          next: () => this.sweetAlert.success('Account Unsuspended', 'User can now access the platform.'),
          error: () => this.sweetAlert.error('Error', 'Failed to unsuspend account')
        });
      }
    } else {
      const confirm = await this.sweetAlert.confirm(
        'Suspend Account',
        'This will completely suspend the user\'s account. They will not be able to log in or access the platform. This action can be reversed later.',
        'Yes, suspend account'
      );
      if (confirm.isConfirmed) {
        const reasonResult = await this.sweetAlert.input('Suspension Reason', 'Enter reason for suspension', 'text');
        if (reasonResult.isConfirmed && reasonResult.value) {
          this.adminService.suspendUser(userId, reasonResult.value).subscribe({
            next: () => this.sweetAlert.success('Account Suspended', 'User account has been suspended.'),
            error: () => this.sweetAlert.error('Error', 'Failed to suspend account')
          });
        }
      }
    }
  }
}
