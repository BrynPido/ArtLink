import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, UserManagement } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';
import { getDeletionReasons } from '../../constants/deletion-reasons';
import { Workbook } from 'exceljs';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  users: UserManagement[] = [];
  loading = true;
  searchTerm = '';
  currentPage = 1;
  totalPages = 1;
  totalUsers = 0;
  pageSize = 20;
  selectedUsers: number[] = [];
  showUserModal = false;
  selectedUser: UserManagement | null = null;
  actionLoading = false;
  showUserExportMenu = false;

  // Filter options
  filterBy = 'all'; // all, active, suspended
  sortBy = 'createdAt'; // createdAt, name, email, lastLogin
  sortDirection = 'desc'; // asc, desc

  // Expose Math to template
  Math = Math;

  constructor(
    private adminService: AdminService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  // Helper method to get full image URL
  getFullImageUrl(imagePath: string | null | undefined): string {
    return this.adminService.getFullImageUrl(imagePath);
  }

  loadUsers() {
    this.loading = true;
    this.adminService.getAllUsers(
      this.currentPage, 
      this.pageSize, 
      this.searchTerm
    ).subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.users = response.payload.users;
          this.totalUsers = response.payload.total;
          this.totalPages = Math.ceil(this.totalUsers / this.pageSize);
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading users:', error);
        this.loading = false;
      }
    });
  }

  onSearch() {
    this.currentPage = 1;
    this.loadUsers();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadUsers();
  }

  selectUser(userId: number) {
    const index = this.selectedUsers.indexOf(userId);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(userId);
    }
  }

  selectAllUsers() {
    if (this.selectedUsers.length === this.users.length) {
      this.selectedUsers = [];
    } else {
      this.selectedUsers = this.users.map(user => user.id);
    }
  }

  viewUser(user: UserManagement) {
    this.selectedUser = user;
    this.showUserModal = true;
  }

  suspendUser(userId: number) {
    this.sweetAlert.input('Suspend User', 'Please provide a reason for suspension:', 'textarea')
      .then((result) => {
        if (result.isConfirmed && result.value) {
          this.actionLoading = true;
          this.adminService.suspendUser(userId, result.value).subscribe({
            next: (response: any) => {
              if (response.status === 'success') {
                this.sweetAlert.toast('success', 'User suspended successfully');
                this.loadUsers();
              }
              this.actionLoading = false;
            },
            error: (error: any) => {
              console.error('Error suspending user:', error);
              this.sweetAlert.toast('error', 'Failed to suspend user');
              this.actionLoading = false;
            }
          });
        }
      });
  }

  unsuspendUser(userId: number) {
    this.actionLoading = true;
    this.adminService.unsuspendUser(userId).subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.loadUsers();
        }
        this.actionLoading = false;
      },
      error: (error: any) => {
        console.error('Error unsuspending user:', error);
        this.actionLoading = false;
      }
    });
  }

  async deleteUser(userId: number) {
    // Archive = soft delete
    const confirmResult = await this.sweetAlert.confirmArchive('user', 'This user will be archived (soft deleted) and can be restored within 60 days. After 60 days, the user may be permanently removed.');
    
    if (confirmResult.isConfirmed) {
      // Show dropdown with predefined reasons
      const reasonResult = await this.sweetAlert.selectWithOther(
        'Select Archival Reason',
        getDeletionReasons('USER'),
        true
      );
      
      if (reasonResult.isConfirmed && reasonResult.value) {
        this.actionLoading = true;
        this.adminService.deleteUser(userId, reasonResult.value).subscribe({
          next: (response: any) => {
            if (response.status === 'success') {
              this.sweetAlert.success('Archived!', 'The user has been archived successfully.');
              this.loadUsers();
            }
            this.actionLoading = false;
          },
          error: (error: any) => {
            console.error('Error deleting user:', error);
            this.sweetAlert.error('Error', 'Failed to archive the user. Please try again.');
            this.actionLoading = false;
          }
        });
      }
    }
  }

  bulkSuspend() {
    if (this.selectedUsers.length === 0) return;
    
    const reason = prompt('Enter reason for bulk suspension:');
    if (reason) {
      this.actionLoading = true;
      this.adminService.bulkSuspendUsers(this.selectedUsers, reason).subscribe({
        next: (response: any) => {
          if (response.status === 'success') {
            this.selectedUsers = [];
            this.loadUsers();
          }
          this.actionLoading = false;
        },
        error: (error: any) => {
          console.error('Error bulk suspending users:', error);
          this.actionLoading = false;
        }
      });
    }
  }

  exportUsers() {
    // Implementation for exporting user data
    const csvData = this.users.map(user => ({
      ID: user.id,
      Name: user.name,
      Username: user.username,
      Email: user.email,
      'Created At': this.formatDateHuman(user.createdAt),
      'Last Login': this.formatDateHuman(user.lastLogin),
      'Posts Count': user.postsCount,
      'Followers Count': user.followersCount,
      Status: user.isActive ? 'Active' : 'Suspended'
    }));

    this.downloadCSV(csvData, 'users-export.csv');
  }

  // New: Excel export with branded header
  async exportUsersExcel() {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Users', {
      pageSetup: {
        orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        horizontalCentered: true
      },
      views: [{ showGridLines: false }]
    });

    await this.applyBrandingHeader(ws, wb, {
      title: 'Users Export',
      subtitle: `Exported ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • ${this.users.length} users`,
      mergeTo: 'H3'
    });

    ws.addRow(['ID', 'Name', 'Username', 'Email', 'Status', 'Posts', 'Followers', 'Joined', 'Last Login']);
    const header = ws.getRow(ws.lastRow!.number);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } } as any;
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } as any;

    this.users.forEach(u => {
      ws.addRow([
        u.id, u.name || '', `@${u.username || ''}`, u.email || '',
        u.isActive ? 'Active' : 'Suspended', u.postsCount || 0, u.followersCount || 0,
        this.formatDateHuman(u.createdAt), this.formatDateHuman(u.lastLogin)
      ]);
    });

    ws.columns = [
      { width: 8 }, { width: 22 }, { width: 18 }, { width: 26 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 18 }, { width: 18 }
    ] as any;

    const headerRowNum = header.number; const lastRowNum = ws.lastRow?.number || headerRowNum;
    for (let r = headerRowNum; r <= lastRowNum; r++) {
      for (let c = 1; c <= 9; c++) {
        ws.getCell(r, c).border = { top: { style: r === headerRowNum ? 'thin' : undefined }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } as any;
      }
    }
    ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
    (ws as any).autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: 9 } };
    ws.pageSetup.printArea = `A1:I${lastRowNum}`;
    ws.headerFooter.oddFooter = `&LArtLink Admin&CGenerated ${new Date().toLocaleDateString()}&RPage &P of &N`;

    const buf = await wb.xlsx.writeBuffer();
    this.downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'artlink-users.xlsx');
  }

  // Helpers duplicated locally for simplicity
  private async loadLogoMeta(): Promise<{ base64: string; width: number; height: number } | null> {
    try {
      const res = await fetch('/assets/images/Artlink_Logo.png');
      const blob = await res.blob();
      const [base64, dims] = await Promise.all([
        new Promise<string>((resolve, reject) => {
          const fr = new FileReader(); fr.onloadend = () => resolve((fr.result as string).split(',')[1]); fr.onerror = reject; fr.readAsDataURL(blob);
        }),
        new Promise<{ width: number; height: number }>((resolve, reject) => {
          const url = URL.createObjectURL(blob); const img = new Image();
          img.onload = () => { const meta = { width: img.naturalWidth || 240, height: img.naturalHeight || 60 }; URL.revokeObjectURL(url); resolve(meta); };
          img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
          img.src = url;
        })
      ]);
      return { base64, width: (dims as any).width, height: (dims as any).height };
    } catch { return null; }
  }

  private async applyBrandingHeader(ws: any, wb: Workbook, opts: { title: string; subtitle: string; mergeTo?: string }) {
    // Reserve columns A/B for logo + gutter to avoid text overlap
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

  getUserStatusClass(user: UserManagement): string {
    return user.isActive ? 'text-green-600' : 'text-red-600';
  }

  getUserStatusText(user: UserManagement): string {
    return user.isActive ? 'Active' : 'Suspended';
  }

  closeModal() {
    this.showUserModal = false;
    this.selectedUser = null;
  }

  trackByUserId(index: number, user: UserManagement): number {
    return user.id;
  }
}
