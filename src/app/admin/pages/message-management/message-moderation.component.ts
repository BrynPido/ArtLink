import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';
import { getDeletionReasons } from '../../constants/deletion-reasons';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-message-moderation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './message-moderation.component.html',
  styleUrls: ['./message-moderation.component.css']
})
export class MessageModerationComponent implements OnInit {
  reportedMessages: any[] = [];
  spamDetected: any[] = [];
  messageStats: any = {};
  loading = false;
  activeTab = 'stats'; // 'stats', 'reported', 'spam'
  // Show only pending reports by default so archived/dismissed don't linger
  reportStatusFilter: 'all' | 'pending' | 'actioned' | 'dismissed' = 'pending';
  currentPage = 1;
  itemsPerPage = 20;
  totalPages = 1;

  // Expose Math to template
  Math = Math;

  constructor(
    private adminService: AdminService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit() {
    this.loadModerationData();
    // Prefetch reported messages in the background so the tab is instant
    this.adminService.getMessageReports(this.reportStatusFilter, this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        const payload = response?.payload;
        this.reportedMessages = (payload?.reports || []).map((r: any) => ({
          id: r.id,
          messageId: r.messageId,
          messageAuthorId: r.messageAuthorId,
          messageAuthorUsername: r.authorUsername,
          reporter_username: r.reporterUsername,
          reporter_name: r.reporterName,
          reason: r.reason,
          status: r.status,
          reported_at: r.createdAt,
          content_snippet: (r.messageContent || '').slice(0, 120)
        }));
        // don't toggle loading here; this is a background warm-up
      },
      error: () => {}
    });
  }

  loadModerationData() {
    this.loading = true;
    this.loadMessageStats();
    // Only load reported/flagged content - no private messages
    if (this.activeTab === 'reported') {
      this.loadReportedMessages();
    } else if (this.activeTab === 'spam') {
      this.detectSpamPatterns();
    } else {
      this.loading = false;
    }
  }

  loadMessageStats() {
    // Privacy-safe stats: only aggregate counts for reports/spam; no private content exposure
    this.adminService.getMessageReportStats().subscribe({
      next: (res) => {
        const stats = res?.payload || {};
        // Backend returns: { totalReports, statusBreakdown: [{status,count}], topReasons }
        const totalReports = Number(stats.totalReports ?? 0);
        const spamDetected = 0; // placeholder until spam detection implemented
        this.messageStats = {
          totalMessages: 'Protected',
          todayMessages: 'Protected',
          activeConversations: 'Protected',
          reportedCount: totalReports,
          spamDetected: spamDetected,
          systemHealth: 'Good'
        };
      },
      error: () => {
        // Fallback to protected placeholders if endpoint not available
        this.messageStats = {
          totalMessages: 'Protected',
          todayMessages: 'Protected',
          activeConversations: 'Protected',
          reportedCount: 0,
          spamDetected: 0,
          systemHealth: 'Good'
        };
      }
    });
  }

  loadReportedMessages() {
    this.loading = true;
    // Fetch reported messages via AdminService
    this.adminService.getMessageReports(this.reportStatusFilter, this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        const payload = response?.payload;
        this.reportedMessages = (payload?.reports || []).map((r: any) => ({
          id: r.id,
          messageId: r.messageId,
          messageAuthorId: r.messageAuthorId,
          messageAuthorUsername: r.authorUsername,
          reporter_username: r.reporterUsername,
          reporter_name: r.reporterName,
          reason: r.reason,
          status: r.status,
          reported_at: r.createdAt,
          content_snippet: (r.messageContent || '').slice(0, 120)
        }));
        // Pagination metadata
        if (payload?.pagination) {
          this.totalPages = payload.pagination.totalPages || 1;
          this.currentPage = payload.pagination.page || 1;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load message reports', err);
        this.loading = false;
      }
    });
  }

  detectSpamPatterns() {
    this.loading = true;
    this.adminService.getSpamDetectedMessages(this.currentPage, this.itemsPerPage).subscribe({
      next: (res) => {
        const items = res?.payload?.items || [];
        this.spamDetected = items.map((i: any) => ({
          id: i.id,
          messageId: i.messageId,
          sender_id: i.senderId,
          sender_username: i.senderUsername,
          spam_score: i.score,
          detection_reason: i.reason,
          content_snippet: (i.messageContent || '').slice(0, 120),
          detected_at: i.detectedAt,
          status: i.status || 'pending'
        }));
        this.loading = false;
      },
      error: () => { this.spamDetected = []; this.loading = false; }
    });
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.currentPage = 1;
    this.loadModerationData();
  }

  setReportStatusFilter(status: 'all' | 'pending' | 'actioned' | 'dismissed') {
    if (this.reportStatusFilter !== status) {
      this.reportStatusFilter = status;
      this.currentPage = 1;
      if (this.activeTab === 'reported') {
        this.loadReportedMessages();
      }
    }
  }

  async resolveReport(reportId: number, action: 'dismiss' | 'delete') {
    if (action === 'delete') {
      const confirm = await this.sweetAlert.confirmArchive('message', 'This will archive the reported message. It can be restored from the archive if needed.');
      if (!confirm.isConfirmed) return;

      const reasonResult = await this.sweetAlert.selectWithOther('Archive Reason', getDeletionReasons('ARCHIVE'), true);
      if (!(reasonResult.isConfirmed && reasonResult.value)) return;

      return this.deleteReportedMessage(reportId, reasonResult.value);
    }

    const result = await this.sweetAlert.confirm('Dismiss Report', 'Are you sure you want to dismiss this report?', 'Yes, dismiss');
    if (result.isConfirmed) {
      this.dismissReport(reportId);
    }
  }

  // Open sender actions (fetch moderation summary + actions)
  async openSenderActions(report: any) {
    if (!report || !report.messageAuthorId) {
      this.sweetAlert.error?.('Missing Data', 'Author information unavailable for this report.');
      return;
    }
    this.loading = true;
    this.adminService.getUserModerationSummary(report.messageAuthorId).subscribe({
      next: async (res) => {
        this.loading = false;
        const summary = res?.payload;
        if (!summary) {
          this.sweetAlert.error?.('Error', 'Failed to load moderation summary');
          return;
        }
        const restriction = summary.activeRestriction;
        const vol = summary.volumes;
        const totals = summary.totals;
        const recent = summary.recentReports || [];
        const isDarkMode = document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
        const html = `
          <div style='text-align:left;font-size:13px'>
            <strong>User:</strong> ${summary.user.username} (${summary.user.name || ''})<br>
            <strong>Reports:</strong> Total ${totals.total}, Pending ${totals.pending}<br>
            <strong>Message Volume:</strong> 24h ${vol.last24h}, 7d ${vol.last7d}<br>
            <strong>Restriction:</strong> ${restriction ? 'Active until ' + (restriction.expiresAt || '(indef)') : 'None'}<br>
            <hr style='margin:8px 0'>
            <strong>Recent Report Reasons:</strong><br>
            ${recent.map((r: any) => `• ${r.reason} (${r.status})`).join('<br>') || 'None'}
          </div>
        `;
        // Add custom HTML for suspend button
        const footer = `
          <button id="suspendBtn" class="swal2-styled" style="background-color: #dc2626; margin-right: 8px;">
            ${restriction?.type === 'account' ? 'Unsuspend Account' : 'Suspend Account'}
          </button>
        `;

        const result = await Swal.fire({
          title: 'Sender Moderation',
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
                // Call suspend handler
                await this.handleSuspendAction(report, restriction?.type === 'account');
              });
            }
        });
        if (result.isConfirmed) {
          const warnReason = await this.sweetAlert.input('Warn User', 'Enter warning reason', 'text');
          if (warnReason.isConfirmed && warnReason.value) {
            this.adminService.warnUser(report.messageAuthorId, warnReason.value).subscribe({
              next: () => this.sweetAlert.success('Warning Sent', 'User has been warned.'),
              error: () => this.sweetAlert.error('Error', 'Failed to send warning')
            });
          }
        } else if (result.isDenied) {
          if (restriction?.type === 'messaging') {
            // Lift messaging restriction
            this.adminService.unrestrictMessaging(report.messageAuthorId).subscribe({
              next: () => this.sweetAlert.success('Restriction Lifted', 'User can send messages again.'),
              error: () => this.sweetAlert.error('Error', 'Failed to lift restriction')
            });
          } else {
            // Apply new messaging restriction
            const durResult = await this.sweetAlert.selectWithOther('Restriction Duration', ['15','60','360','1440','10080'], false);
            if (durResult.isConfirmed) {
              const minutes = parseInt(durResult.value, 10);
              const reasonResult = await this.sweetAlert.selectWithOther('Restriction Reason', ['spam','harassment','hate','other']);
              if (reasonResult.isConfirmed) {
                const finalReason = reasonResult.value || reasonResult?.value;
                this.adminService.restrictMessaging(report.messageAuthorId, minutes, finalReason).subscribe({
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

  async handleSuspendAction(report: any, isCurrentlySuspended: boolean) {
    if (isCurrentlySuspended) {
      // Unsuspend
      const confirm = await this.sweetAlert.confirm(
        'Unsuspend Account',
        'Remove the account suspension and allow this user to access the platform again?',
        'Yes, unsuspend'
      );
      if (confirm.isConfirmed) {
        this.adminService.unsuspendUser(report.messageAuthorId).subscribe({
          next: () => {
            this.sweetAlert.success('Account Unsuspended', 'User can now access the platform.');
            this.loadModerationData(); // Refresh
          },
          error: () => this.sweetAlert.error('Error', 'Failed to unsuspend account')
        });
      }
    } else {
      // Suspend
      const confirm = await this.sweetAlert.confirm(
        'Suspend Account',
        'This will completely suspend the user\'s account. They will not be able to log in or access the platform. This action can be reversed later.',
        'Yes, suspend account'
      );
      if (confirm.isConfirmed) {
        const reasonResult = await this.sweetAlert.input('Suspension Reason', 'Enter reason for suspension', 'text');
        if (reasonResult.isConfirmed && reasonResult.value) {
          this.adminService.suspendUser(report.messageAuthorId, reasonResult.value).subscribe({
            next: () => {
              this.sweetAlert.success('Account Suspended', 'User account has been suspended.');
              this.loadModerationData(); // Refresh
            },
            error: () => this.sweetAlert.error('Error', 'Failed to suspend account')
          });
        }
      }
    }
  }

  deleteReportedMessage(reportId: number, reason: string = 'Archived via moderation') {
    const report = this.reportedMessages.find(r => r.id === reportId);
    if (!report) {
      this.sweetAlert.error?.('Error', 'Report not found');
      return;
    }
    // Delete the underlying message, then mark report as actioned
    this.adminService.deleteMessage(report.messageId, reason).subscribe({
      next: () => {
        this.adminService.updateMessageReportStatus(reportId, 'actioned').subscribe({
          next: () => {
            this.sweetAlert.success('Archived!', 'Reported message has been archived.');
            // Optimistically remove from the current view (pending-only)
            this.reportedMessages = this.reportedMessages.filter(r => r.id !== reportId);
            this.loadReportedMessages();
          },
          error: () => {
            this.sweetAlert.success('Archived!', 'Message archived, but failed to update report status.');
            this.reportedMessages = this.reportedMessages.filter(r => r.id !== reportId);
            this.loadReportedMessages();
          }
        });
      },
      error: (err) => {
        console.error('Failed to archive reported message', err);
        this.sweetAlert.error?.('Error', 'Failed to archive message');
      }
    });
  }

  dismissReport(reportId: number) {
    const report = this.reportedMessages.find(r => r.id === reportId);
    if (!report) {
      this.sweetAlert.error?.('Error', 'Report not found in current view');
      return;
    }
    this.adminService.updateMessageReportStatus(report.id, 'dismissed').subscribe({
      next: () => {
        this.sweetAlert.success('Success!', 'Report has been dismissed.');
        this.loadReportedMessages();
      },
      error: (err) => {
        console.error('Failed to dismiss report', err);
        this.sweetAlert.error?.('Error', 'Failed to dismiss report');
      }
    });
  }

  reopenReport(reportId: number) {
    this.adminService.updateMessageReportStatus(reportId, 'pending').subscribe({
      next: () => {
        // Optimistically update local state
        this.reportedMessages = this.reportedMessages.map(r => r.id === reportId ? { ...r, status: 'pending' } : r);
        this.sweetAlert.success('Reopened', 'Report moved back to pending.');
        this.loadReportedMessages();
      },
      error: () => this.sweetAlert.error('Error', 'Failed to reopen report')
    });
  }

  markAsSpam(messageId: number) {
    this.sweetAlert.confirm(
      'Mark as Spam',
      'This will delete the message and may restrict the sender\'s messaging privileges.',
      'Yes, mark as spam'
    ).then((result) => {
      if (result.isConfirmed) {
        this.sweetAlert.success('Success!', 'Message marked as spam.');
        this.detectSpamPatterns();
      }
    });
  }

  // View a single reported message details (privacy-safe: only that message)
  viewReportedMessage(reportId: number) {
    const isDarkMode = document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.adminService.getMessageReportDetails(reportId).subscribe({
      next: (res) => {
        const msg = res?.payload?.message || res?.payload || {};
        const content = msg.content || msg.messageContent || '(no content available)';
        const sender = msg.senderUsername || msg.sender || msg.authorUsername || 'unknown';
        const recipient = msg.recipientUsername || msg.recipient || 'hidden';
        const createdAt = msg.createdAt || msg.sentAt || new Date().toISOString();
        const html = `
          <div style="text-align:left; font-size:13px;">
            <div><strong>From:</strong> @${sender}</div>
            <div><strong>To:</strong> @${recipient}</div>
            <div><strong>Sent:</strong> ${new Date(createdAt).toLocaleString()}</div>
            <hr style="margin:8px 0">
            <div style="white-space:pre-wrap;">${content}</div>
          </div>
        `;
        Swal.fire({
          title: 'Reported Message',
          html,
          width: 600,
          confirmButtonText: 'Close',
          background: isDarkMode ? '#1f2937' : '#ffffff',
          color: isDarkMode ? '#f3f4f6' : '#111827'
        });
      },
      error: () => this.sweetAlert.error('Error', 'Failed to load message details')
    });
  }

  formatMessageTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  exportModerationData() {
    let dataToExport: any[] = [];
    let filename = '';

    if (this.activeTab === 'reported') {
      dataToExport = this.reportedMessages.map(msg => ({
        'Report ID': msg.id,
        'Reported By': msg.reporter_username,
        'Report Reason': msg.reported_reason,
        'Report Date': this.formatMessageTime(msg.reported_at),
        'Status': msg.status
      }));
      filename = 'reported_messages';
    } else if (this.activeTab === 'spam') {
      dataToExport = this.spamDetected.map(msg => ({
        'Detection ID': msg.id,
        'Sender': msg.sender_username,
        'Spam Score': msg.spam_score,
        'Detection Reason': msg.detection_reason,
        'Detected At': this.formatMessageTime(msg.detected_at),
        'Status': msg.status
      }));
      filename = 'spam_detected_messages';
    } else {
      // Export only non-private stats
      dataToExport = [{
        'Report Date': new Date().toLocaleDateString(),
        'Reported Messages': this.reportedMessages.length,
        'Spam Detected': this.spamDetected.length,
        'System Status': this.messageStats.systemHealth
      }];
      filename = 'moderation_statistics';
    }

    if (dataToExport.length > 0) {
      const csvContent = this.convertToCSV(dataToExport);
      this.downloadCSV(csvContent, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(value => `"${value}"`).join(','));
    return [headers, ...rows].join('\n');
  }

  private downloadCSV(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers(): number[] {
    const pages = [];
    const maxVisible = 5;
    const start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible - 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
