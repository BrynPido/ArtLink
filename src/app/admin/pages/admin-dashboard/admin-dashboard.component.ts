import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService, AdminStats } from '../../services/admin.service';
import { Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  stats: AdminStats | null = null;
  recentActivity: any[] = [];
  loading = true;
  userGrowthChart: Chart | null = null;
  contentChart: Chart | null = null;

  constructor(private adminService: AdminService) {
    Chart.register(...registerables);
  }

  ngOnInit() {
    this.loadDashboardData();
    this.loadCharts();
  }

  loadDashboardData() {
    this.loading = true;
    
    this.adminService.getDashboardStats().subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.stats = response.payload;
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading dashboard stats:', error);
        this.loading = false;
      }
    });

    this.adminService.getRecentActivity().subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.recentActivity = response.payload;
        }
      },
      error: (error: any) => {
        console.error('Error loading recent activity:', error);
      }
    });
  }

  loadCharts() {
    // User Growth Chart
    this.adminService.getUserGrowthStats('30days').subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.createUserGrowthChart(response.payload);
        }
      },
      error: (error: any) => {
        console.error('Error loading user growth stats:', error);
      }
    });

    // Content Stats Chart
    this.adminService.getContentStats('30days').subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.createContentChart(response.payload);
        }
      },
      error: (error: any) => {
        console.error('Error loading content stats:', error);
      }
    });
  }

  createUserGrowthChart(data: any) {
    const ctx = document.getElementById('userGrowthChart') as HTMLCanvasElement;
    if (ctx) {
      this.userGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'New Users',
            data: data.values,
            borderColor: 'rgb(99, 102, 241)',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            tension: 0.1,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'User Growth (Last 30 Days)'
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  }

  createContentChart(data: any) {
    const ctx = document.getElementById('contentChart') as HTMLCanvasElement;
    if (ctx) {
      this.contentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Posts', 'Listings', 'Comments'],
          datasets: [{
            data: [data.posts, data.listings, data.comments],
            backgroundColor: [
              'rgba(34, 197, 94, 0.8)',
              'rgba(59, 130, 246, 0.8)',
              'rgba(249, 115, 22, 0.8)'
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Content Distribution'
            },
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'user_registered':
        return 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z';
      case 'post_created':
        return 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
      case 'listing_created':
        return 'M16 11V7a4 4 0 00-8 0v4M8 11v6a2 2 0 002 2h4a2 2 0 002-2v-6M8 11h8';
      case 'message_sent':
        return 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z';
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  getActivityColor(type: string): string {
    switch (type) {
      case 'user_registered':
        return 'bg-green-100 text-green-600';
      case 'post_created':
        return 'bg-blue-100 text-blue-600';
      case 'listing_created':
        return 'bg-purple-100 text-purple-600';
      case 'message_sent':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  refreshDashboard() {
    this.loadDashboardData();
    this.loadCharts();
  }

  // Add missing Math property for template
  // Add missing Math property for template
  Math = Math;

  // TrackBy function for ngFor optimization
  trackActivity(index: number, item: any): any {
    return item.id || index;
  }

  ngOnDestroy() {
    if (this.userGrowthChart) {
      this.userGrowthChart.destroy();
    }
    if (this.contentChart) {
      this.contentChart.destroy();
    }
  }
}
