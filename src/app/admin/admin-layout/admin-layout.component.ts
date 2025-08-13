import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { DataService } from '../../services/data.service';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements OnInit {
  currentUser: any;
  isMenuOpen = false;
  notifications: any[] = [];
  unreadCount = 0;

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
      label: 'Settings',
      icon: 'settings',
      route: '/admin/settings',
      active: false
    }
  ];

  constructor(
    private dataService: DataService,
    private adminService: AdminService,
    private router: Router
  ) {}

  ngOnInit() {
    this.currentUser = this.dataService.getCurrentUser();
    this.loadNotifications();
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
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
}
