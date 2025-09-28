import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';
import { getCleanupReasons, getRestorationReasons, getDeletionReasons } from '../../constants/deletion-reasons';

interface ArchiveStats {
  stats: {
    [tableName: string]: {
      totalDeleted: number;
      withinRetention: number;
      readyForCleanup: number;
    };
  };
  lastCleanupTime: string | null;
  nextScheduledCleanup: string;
  isRunning: boolean;
}

interface DeletedRecordsResponse {
  records: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

@Component({
  selector: 'app-archive-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './archive-management.component.html',
  styleUrl: './archive-management.component.css'
})
export class ArchiveManagementComponent implements OnInit {
  archiveStats: ArchiveStats | null = null;
  deletedRecords: DeletedRecordsResponse | null = null;
  selectedTable: string | null = null;
  isLoading = false;
  isCleanupRunning = false;
  loadingMessage = '';

  constructor(
    private adminService: AdminService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit() {
    this.loadArchiveStats();
  }

  loadArchiveStats() {
    this.isLoading = true;
    this.loadingMessage = 'Loading archive statistics...';

    this.adminService.getArchiveStats().subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.archiveStats = response.payload;
          this.isCleanupRunning = this.archiveStats?.isRunning || false;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading archive stats:', error);
        this.sweetAlert.error('Error', 'Failed to load archive statistics');
        this.isLoading = false;
      }
    });
  }

  refreshStats() {
    this.loadArchiveStats();
  }

  getTotalDeleted(): number {
    if (!this.archiveStats) return 0;
    return Object.values(this.archiveStats.stats).reduce((sum, stat) => sum + stat.totalDeleted, 0);
  }

  getTotalWithinRetention(): number {
    if (!this.archiveStats) return 0;
    return Object.values(this.archiveStats.stats).reduce((sum, stat) => sum + stat.withinRetention, 0);
  }

  getTotalReadyForCleanup(): number {
    if (!this.archiveStats) return 0;
    return Object.values(this.archiveStats.stats).reduce((sum, stat) => sum + stat.readyForCleanup, 0);
  }

  getTableStats() {
    if (!this.archiveStats) return [];
    return Object.entries(this.archiveStats.stats).map(([name, stats]) => ({ name, stats }));
  }

  getDaysSinceDeleted(daysSinceDeleted: number): number {
    return Math.floor(daysSinceDeleted);
  }

  getPaginationStart(): number {
    if (!this.deletedRecords) return 0;
    return (this.deletedRecords.pagination.page - 1) * this.deletedRecords.pagination.limit + 1;
  }

  getPaginationEnd(): number {
    if (!this.deletedRecords) return 0;
    const { page, limit, total } = this.deletedRecords.pagination;
    return Math.min(page * limit, total);
  }

  async triggerManualCleanup() {
    const result = await this.sweetAlert.confirm(
      'Trigger Manual Cleanup',
      'This will permanently delete all records that have been soft-deleted for more than 60 days. This action cannot be undone. Are you sure?',
      'warning'
    );

    if (result.isConfirmed) {
      // Show dropdown with predefined reasons
      const reasonResult = await this.sweetAlert.selectWithOther(
        'Select Cleanup Reason',
        getCleanupReasons(),
        true
      );

      if (reasonResult.isConfirmed && reasonResult.value) {
        this.isLoading = true;
        this.isCleanupRunning = true;
        this.loadingMessage = 'Starting cleanup process...';

        this.adminService.triggerManualCleanup(reasonResult.value).subscribe({
          next: (response) => {
            if (response.status === 'success') {
              this.sweetAlert.success('Success', 'Manual cleanup process has been started. This may take several minutes to complete.');
              // Refresh stats after a short delay
              setTimeout(() => {
                this.loadArchiveStats();
              }, 2000);
            }
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error triggering cleanup:', error);
            this.sweetAlert.error('Error', 'Failed to start cleanup process');
            this.isLoading = false;
            this.isCleanupRunning = false;
          }
        });
      }
    }
  }

  viewDeletedRecords(tableName: string) {
    this.selectedTable = tableName;
    this.loadDeletedRecords(1);
  }

  loadDeletedRecords(page: number) {
    if (!this.selectedTable) return;

    this.isLoading = true;
    this.loadingMessage = `Loading deleted ${this.selectedTable} records...`;

    this.adminService.getDeletedRecords(this.selectedTable, page, 20).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.deletedRecords = response.payload;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading deleted records:', error);
        this.sweetAlert.error('Error', `Failed to load deleted ${this.selectedTable} records`);
        this.isLoading = false;
      }
    });
  }

  closeDeletedRecordsView() {
    this.selectedTable = null;
    this.deletedRecords = null;
  }

  async restoreRecord(recordId: number) {
    if (!this.selectedTable) return;

    const result = await this.sweetAlert.confirm(
      'Restore Record',
      `Are you sure you want to restore this ${this.selectedTable} record? It will be made available again.`,
      'Yes, Restore'
    );

    if (result.isConfirmed) {
      // Show dropdown with predefined reasons
      const reasonResult = await this.sweetAlert.selectWithOther(
        'Select Restoration Reason',
        getRestorationReasons(),
        true
      );

      if (reasonResult.isConfirmed && reasonResult.value) {
        this.isLoading = true;
        this.loadingMessage = 'Restoring record...';

        this.adminService.restoreRecord(this.selectedTable, recordId, reasonResult.value).subscribe({
          next: (response) => {
            console.log('Restore response:', response); // Debug log
            if (response && response.status === 'success') {
              this.sweetAlert.success('Success', 'Record restored successfully');
              this.loadDeletedRecords(this.deletedRecords?.pagination.page || 1);
              this.loadArchiveStats(); // Refresh stats
            } else {
              console.log('Unexpected response format:', response);
              this.sweetAlert.error('Error', response?.message || 'Unexpected response format');
            }
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error restoring record:', error);
            console.log('Error details:', error.error);
            this.sweetAlert.error('Error', error.error?.message || 'Failed to restore record');
            this.isLoading = false;
          }
        });
      }
    }
  }

  async permanentlyDeleteRecord(recordId: number) {
    if (!this.selectedTable) return;

    const result = await this.sweetAlert.confirm(
      'Permanently Delete Record',
      `Are you sure you want to permanently delete this ${this.selectedTable} record? This action cannot be undone and the data will be lost forever.`,
      'Yes, Delete Forever'
    );

    if (result.isConfirmed) {
      // Show dropdown with predefined reasons
      const reasonResult = await this.sweetAlert.selectWithOther(
        'Select Permanent Deletion Reason',
        getDeletionReasons(this.selectedTable.toUpperCase() as any) || ['Policy violation', 'Security concern', 'Data cleanup'],
        true
      );

      if (reasonResult.isConfirmed && reasonResult.value) {
        this.isLoading = true;
        this.loadingMessage = 'Permanently deleting record...';

        this.adminService.permanentlyDeleteRecord(this.selectedTable, recordId, reasonResult.value).subscribe({
          next: (response) => {
            if (response.status === 'success') {
              this.sweetAlert.success('Success', 'Record permanently deleted');
              this.loadDeletedRecords(this.deletedRecords?.pagination.page || 1);
              this.loadArchiveStats(); // Refresh stats
            }
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error permanently deleting record:', error);
            this.sweetAlert.error('Error', error.error?.message || 'Failed to permanently delete record');
            this.isLoading = false;
          }
        });
      }
    }
  }
}