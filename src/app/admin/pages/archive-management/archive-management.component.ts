import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';
import { getCleanupReasons, getRestorationReasons, getDeletionReasons } from '../../constants/deletion-reasons';
import { Workbook } from 'exceljs';

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
  imports: [CommonModule, FormsModule],
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
  archivedSearchTerm = '';

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
    this.archivedSearchTerm = '';
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

  // Excel export for currently viewed deleted records
  async exportDeletedRecordsExcel() {
    if (!this.selectedTable || !this.deletedRecords) return;
    const wb = new Workbook();
    const ws = wb.addWorksheet('Deleted Records', {
      pageSetup: {
        orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
      },
      views: [{ showGridLines: false }]
    });

    await this.applyBrandingHeader(ws, wb, {
      title: `Deleted ${this.selectedTable} Records`,
      subtitle: `Total: ${this.deletedRecords.pagination.total} • Exported ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      mergeTo: 'G3'
    });

    ws.addRow(['ID', 'Name/Title', 'Deleted At', 'Days Ago', 'Can Restore', 'Status']);
    const header = ws.getRow(ws.lastRow!.number);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } } as any;
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } as any;

    this.deletedRecords.records.forEach(r => {
      ws.addRow([
        r.id,
        r.name || r.title || r.username || (r.content ? r.content.substring(0, 50) : ''),
        this.formatDateHuman(r.deletedAt),
        r.daysSinceDeleted,
        !r.cannotRestore ? 'Yes' : 'No',
        r.cannotRestore ? 'Expired' : 'Restorable'
      ]);
    });

    ws.columns = [
      { width: 8 }, { width: 32 }, { width: 22 }, { width: 12 }, { width: 14 }, { width: 16 }
    ] as any;

    const headerRowNum = header.number; const lastRowNum = ws.lastRow?.number || headerRowNum;
    for (let r = headerRowNum; r <= lastRowNum; r++) {
      for (let c = 1; c <= 6; c++) {
        ws.getCell(r, c).border = {
          top: { style: r === headerRowNum ? 'thin' : undefined },
          bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }
        } as any;
      }
    }

    ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
    (ws as any).autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: 6 } };
    ws.pageSetup.printArea = `A1:F${lastRowNum}`;
    ws.headerFooter.oddFooter = `&LArtLink Admin&CGenerated ${new Date().toLocaleDateString()}&RPage &P of &N`;

    const buf = await wb.xlsx.writeBuffer();
    this.downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `artlink-deleted-${this.selectedTable}.xlsx`);
  }

  // Filter archived records client-side by id, name/title/username/content substring
  getFilteredArchivedRecords() {
    if (!this.deletedRecords) return [];
    if (!this.archivedSearchTerm.trim()) return this.deletedRecords.records;
    const term = this.archivedSearchTerm.toLowerCase();
    return this.deletedRecords.records.filter(r => {
      return [r.id?.toString(), r.name, r.title, r.username, r.content]
        .filter(Boolean)
        .some((v: any) => v.toString().toLowerCase().includes(term));
    });
  }

  onArchivedSearch() {
    // No-op; template binding triggers change detection, method kept for clarity/extension
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
          img.onload = () => {
            const meta = { width: img.naturalWidth || 240, height: img.naturalHeight || 60 };
            URL.revokeObjectURL(url); resolve(meta);
          };
            img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
            img.src = url;
        })
      ]);
      return { base64, width: (dims as any).width, height: (dims as any).height };
    } catch { return null; }
  }

  private async applyBrandingHeader(ws: any, wb: Workbook, opts: { title: string; subtitle: string; mergeTo?: string }) {
    // Reserve columns A and B for logo placement and gutter
    ws.getColumn(1).width = 24;
    ws.getColumn(2).width = 4;
    const r1 = ws.getRow(1); const r2 = ws.getRow(2); const r3 = ws.getRow(3);
    let headerRowHeight = 35;
    const logo = await this.loadLogoMeta();
    if (logo) {
      const id = wb.addImage({ base64: logo.base64, extension: 'png' });
      const targetWidth = 150; const scale = targetWidth / (logo.width || targetWidth);
      const h = Math.round((logo.height || 60) * scale);
      ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: targetWidth, height: h } } as any);
      headerRowHeight = Math.max(38, Math.ceil(h / 3));
    }
    r1.height = headerRowHeight; r2.height = headerRowHeight; r3.height = headerRowHeight;
    const mergeTo = opts.mergeTo || 'F3';
    // Start text at column C to avoid logo overlap
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

  private formatDateHuman(raw: any): string {
    if (!raw) return '';
    const d = new Date(typeof raw === 'string' && raw.length === 10 ? raw + 'T00:00:00' : raw);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
  }
}