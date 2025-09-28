import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, UserManagement } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';
import { getDeletionReasons } from '../../constants/deletion-reasons';

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
    const confirmResult = await this.sweetAlert.confirmDelete('user', 'This user will be soft deleted and can be restored within 60 days. After 60 days, the user will be permanently removed.');
    
    if (confirmResult.isConfirmed) {
      // Show dropdown with predefined reasons
      const reasonResult = await this.sweetAlert.selectWithOther(
        'Select Deletion Reason',
        getDeletionReasons('USER'),
        true
      );
      
      if (reasonResult.isConfirmed && reasonResult.value) {
        this.actionLoading = true;
        this.adminService.deleteUser(userId, reasonResult.value).subscribe({
          next: (response: any) => {
            if (response.status === 'success') {
              this.sweetAlert.success('Deleted!', 'The user has been soft deleted successfully.');
              this.loadUsers();
            }
            this.actionLoading = false;
          },
          error: (error: any) => {
            console.error('Error deleting user:', error);
            this.sweetAlert.error('Error', 'Failed to delete the user. Please try again.');
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
      'Created At': user.createdAt,
      'Last Login': user.lastLogin,
      'Posts Count': user.postsCount,
      'Followers Count': user.followersCount,
      Status: user.isActive ? 'Active' : 'Suspended'
    }));

    this.downloadCSV(csvData, 'users-export.csv');
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
