import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { DataService } from '../../services/data.service';
import { AdminService } from '../services/admin.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { AdminBadgeComponent } from '../../components/ui/admin-badge/admin-badge.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ClickOutsideDirective, AdminBadgeComponent],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements OnInit {
  currentUser: any;
  isMenuOpen = false;
  isUserDropdownOpen = false;
  isNotificationsOpen = false;
  notifications: any[] = [];
  unreadCount = 0;
  // Feature flag to show/hide Settings across UI
  showSettings = false;

  menuItems = [
    {
      label: 'Dashboard',
      icon: 'dashboard',
      route: '/admin/dashboard',
      active: false
    },
    {
      label: 'Users',
      icon: 'people',
      route: '/admin/users',
      active: false
    },
    {
      label: 'Posts',
      icon: 'article',
      route: '/admin/posts',
      active: false
    },
    {
      label: 'Listings',
      icon: 'storefront',
      route: '/admin/listings',
      active: false
    },
    {
      label: 'Message Moderation',
      icon: 'shield',
      route: '/admin/messages',
      active: false
    },
    {
      label: 'Reports',
      icon: 'analytics',
      route: '/admin/reports',
      active: false
    },
    {
      label: 'Report Management',
      icon: 'report_problem',
      route: '/admin/report-management',
      active: false
    },
    {
      label: 'Archive Management',
      icon: 'archive',
      route: '/admin/archive',
      active: false
    },
    // Settings entry is controlled via showSettings flag; kept out by default
  ];

  constructor(
    private dataService: DataService,
    private adminService: AdminService,
    private router: Router
  ) {}

  ngOnInit() {
    this.currentUser = this.dataService.getCurrentUser();
    // Hide Settings from the sidebar unless explicitly enabled
    if (!this.showSettings) {
      this.menuItems = this.menuItems.filter(item => item.route !== '/admin/settings');
    }
    this.loadNotifications();
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }
  
  toggleUserDropdown() {
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
    if (this.isUserDropdownOpen) {
      this.isNotificationsOpen = false;
    }
  }
  
  toggleNotifications() {
    this.isNotificationsOpen = !this.isNotificationsOpen;
    if (this.isNotificationsOpen) {
      this.isUserDropdownOpen = false;
    }
  }

  loadNotifications() {
    this.adminService.getAdminNotifications().subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.notifications = response.payload.slice(0, 5); // Show latest 5
          this.unreadCount = response.payload.filter((n: any) => !n.read).length;
        }
      },
      error: (error: any) => {
        console.error('Error loading notifications:', error);
      }
    });
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.router.navigate(['/login']);
  }

  markAsRead(notificationId: number) {
    this.adminService.markNotificationAsRead(notificationId).subscribe({
      next: () => {
        this.loadNotifications();
      }
    });
  }

  isAdmin(): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.username === 'admin' || 
           this.currentUser.email === 'admin@artlink.com' || 
           this.currentUser.role === 'admin';
  }
}
