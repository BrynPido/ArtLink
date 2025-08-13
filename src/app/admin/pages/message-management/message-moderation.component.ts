import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';

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
    // Load general statistics about messaging activity (no private content)
    // For now, we'll create mock stats since this respects privacy
    this.messageStats = {
      totalMessages: 'Protected', // Don't show actual count to protect privacy
      todayMessages: 'Protected',
      activeConversations: 'Protected',
      reportedCount: 0, // Only show reports
      spamDetected: 0, // Only show spam detection
      systemHealth: 'Good'
    };
    
    // You could implement this to call a privacy-safe stats endpoint
    // this.adminService.getMessageStatistics().subscribe({...});
  }

  loadReportedMessages() {
    // Only load messages that have been explicitly reported by users
    // This is the only case where admins should see message content
    this.reportedMessages = [
      // Mock data - replace with actual reported messages from API
      // {
      //   id: 1,
      //   reporter_username: 'user123',
      //   reported_reason: 'Harassment',
      //   reported_at: new Date().toISOString(),
      //   status: 'pending',
      //   content_snippet: 'First 50 chars only for context...'
      // }
    ];
    this.loading = false;
  }

  detectSpamPatterns() {
    // Load messages flagged by automated spam detection
    this.spamDetected = [
      // Mock data - replace with actual spam detection from API
      // {
      //   id: 1,
      //   sender_username: 'spammer123',
      //   spam_score: 95,
      //   detection_reason: 'Repeated identical messages',
      //   detected_at: new Date().toISOString(),
      //   status: 'pending'
      // }
    ];
    this.loading = false;
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.currentPage = 1;
    this.loadModerationData();
  }

  resolveReport(messageId: number, action: 'dismiss' | 'delete') {
    const actionText = action === 'delete' ? 'delete this reported message' : 'dismiss this report';
    
    this.sweetAlert.confirm(
      'Confirm Action',
      `Are you sure you want to ${actionText}?`,
      'Yes, proceed'
    ).then((result) => {
      if (result.isConfirmed) {
        if (action === 'delete') {
          this.deleteReportedMessage(messageId);
        } else {
          this.dismissReport(messageId);
        }
      }
    });
  }

  deleteReportedMessage(messageId: number) {
    // Only delete messages that were reported - never browse private messages
    this.sweetAlert.success('Success!', 'Reported message has been deleted.');
    this.loadReportedMessages();
  }

  dismissReport(messageId: number) {
    this.sweetAlert.success('Success!', 'Report has been dismissed.');
    this.loadReportedMessages();
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
