import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit {
  loading = false;
  dateRange = {
    start: '',
    end: ''
  };
  
  // Statistics
  userGrowthStats: any = {};
  contentStats: any = {};
  generalReports: any = {};
  
  // Chart data placeholders
  userGrowthChartData: any = null;
  contentChartData: any = null;
  
  selectedPeriod = '30days';
  periods = [
    { value: '7days', label: '7 Days' },
    { value: '30days', label: '30 Days' },
    { value: '3months', label: '3 Months' },
    { value: '6months', label: '6 Months' },
    { value: '1year', label: '1 Year' }
  ];

  // Expose Math to template
  Math = Math;

  constructor(private adminService: AdminService) {
    this.initializeDateRange();
  }

  ngOnInit() {
    this.loadReports();
    this.loadUserGrowthStats();
    this.loadContentStats();
  }

  initializeDateRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    
    this.dateRange.end = end.toISOString().split('T')[0];
    this.dateRange.start = start.toISOString().split('T')[0];
  }

  loadReports() {
    this.loading = true;
    this.adminService.getReports(this.dateRange).subscribe({
      next: (response: any) => {
        // console.log('Reports API response:', response); // Debug log
        // Map the API response to match template expectations
        if (response.status === 'success' && response.data) {
          this.generalReports = {
            data: response.data,
            summary: {
              totalUsers: this.getSafeNumber(response.data.overview?.totalUsers),
              previousTotalUsers: this.getSafeNumber(response.data.overview?.previousTotalUsers),
              totalPosts: this.getSafeNumber(response.data.overview?.totalPosts),
              previousTotalPosts: this.getSafeNumber(response.data.overview?.previousTotalPosts),
              totalListings: this.getSafeNumber(response.data.overview?.totalListings),
              previousTotalListings: this.getSafeNumber(response.data.overview?.previousTotalListings),
              activeUsers: this.getSafeNumber(response.data.overview?.activeUsers)
            }
          };
        } else {
          // Fallback with safe defaults
          this.generalReports = {
            summary: {
              totalUsers: 0,
              previousTotalUsers: 0,
              totalPosts: 0,
              previousTotalPosts: 0,
              totalListings: 0,
              previousTotalListings: 0,
              activeUsers: 0
            }
          };
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading reports:', error);
        // Set safe defaults on error
        this.generalReports = {
          summary: {
            totalUsers: 0,
            previousTotalUsers: 0,
            totalPosts: 0,
            previousTotalPosts: 0,
            totalListings: 0,
            previousTotalListings: 0,
            activeUsers: 0
          }
        };
        this.loading = false;
      }
    });
  }

  loadUserGrowthStats() {
    this.adminService.getUserGrowthStats(this.selectedPeriod).subscribe({
      next: (response: any) => {
        console.log('User growth API response:', response); // Debug log
        // Handle the actual API response structure
        if (response.status === 'success' && response.payload) {
          this.userGrowthStats = {
            labels: response.payload.labels,
            values: response.payload.values,
            hasData: response.payload.labels && response.payload.labels.length > 0
          };
          this.prepareUserGrowthChart(this.userGrowthStats);
        } else {
          this.userGrowthStats = { hasData: false };
        }
      },
      error: (error: any) => {
        console.error('Error loading user growth stats:', error);
        this.userGrowthStats = { hasData: false };
      }
    });
  }

  loadContentStats() {
    this.adminService.getContentStats(this.selectedPeriod).subscribe({
      next: (response: any) => {
        console.log('Content stats API response:', response); // Debug log
        // Handle the actual API response structure  
        if (response.status === 'success' && response.payload) {
          this.contentStats = {
            posts: response.payload.posts,
            listings: response.payload.listings,
            comments: response.payload.comments,
            hasData: true
          };
          this.prepareContentChart(this.contentStats);
        } else {
          this.contentStats = { hasData: false };
        }
      },
      error: (error: any) => {
        console.error('Error loading content stats:', error);
        this.contentStats = { hasData: false };
      }
    });
  }

  onPeriodChange() {
    this.loadUserGrowthStats();
    this.loadContentStats();
  }

  onDateRangeChange() {
    this.loadReports();
  }

  prepareUserGrowthChart(data: any) {
    if (!data || !data.labels || !data.values) return;
    
    // Convert dates to more readable format
    const formattedLabels = data.labels.map((dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    this.userGrowthChartData = {
      labels: formattedLabels,
      datasets: [
        {
          label: 'New Users',
          data: data.values,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  }

  prepareContentChart(data: any) {
    if (!data || !data.hasData) return;
    
    // Create a simple bar chart for content statistics
    this.contentChartData = {
      labels: ['Posts', 'Listings', 'Comments'],
      datasets: [
        {
          label: 'Content Count',
          data: [data.posts || 0, data.listings || 0, data.comments || 0],
          backgroundColor: [
            'rgba(139, 92, 246, 0.6)',
            'rgba(245, 158, 11, 0.6)', 
            'rgba(34, 197, 94, 0.6)'
          ],
          borderColor: [
            '#8b5cf6',
            '#f59e0b',
            '#22c55e'
          ],
          borderWidth: 2
        }
      ]
    };
  }

  getUserGrowthLatest(): number {
    if (this.userGrowthStats.values && this.userGrowthStats.values.length > 0) {
      return this.userGrowthStats.values[this.userGrowthStats.values.length - 1];
    }
    return 0;
  }

  getUserGrowthTotal(): number {
    if (this.userGrowthStats.values && this.userGrowthStats.values.length > 0) {
      return this.userGrowthStats.values.reduce((a: number, b: number) => a + b, 0);
    }
    return 0;
  }

  getSafeNumber(value: any): number {
    return Number(value) || 0;
  }

  getActiveUserPercentage(): string {
    if (!this.generalReports?.summary) return '0.0';
    
    const activeUsers = this.getSafeNumber(this.generalReports.summary.activeUsers);
    const totalUsers = this.getSafeNumber(this.generalReports.summary.totalUsers);
    
    if (totalUsers === 0) return '0.0';
    
    const percentage = (activeUsers / totalUsers) * 100;
    return percentage.toFixed(1);
  }

  exportReport(type: string) {
    let data: any[] = [];
    let filename = '';
    
    switch (type) {
      case 'users':
        data = this.prepareUserReportData();
        filename = 'user-growth-report.csv';
        break;
      case 'content':
        data = this.prepareContentReportData();
        filename = 'content-report.csv';
        break;
      case 'general':
        data = this.prepareGeneralReportData();
        filename = 'general-report.csv';
        break;
    }
    
    if (data.length > 0) {
      const csvContent = this.convertToCSV(data);
      this.downloadCSV(csvContent, filename);
    }
  }

  prepareUserReportData(): any[] {
    if (!this.userGrowthStats.timeline) return [];
    
    return this.userGrowthStats.timeline.map((item: any) => ({
      Date: item.date,
      'New Users': item.newUsers,
      'Active Users': item.activeUsers,
      'Total Users': item.totalUsers,
      'Retention Rate': item.retentionRate + '%'
    }));
  }

  prepareContentReportData(): any[] {
    if (!this.contentStats.timeline) return [];
    
    return this.contentStats.timeline.map((item: any) => ({
      Date: item.date,
      'New Posts': item.newPosts,
      'New Listings': item.newListings,
      'Total Posts': item.totalPosts,
      'Total Listings': item.totalListings,
      'Engagement Rate': item.engagementRate + '%'
    }));
  }

  prepareGeneralReportData(): any[] {
    const data = [];
    
    if (this.generalReports.summary) {
      data.push({
        Metric: 'Total Users',
        Value: this.generalReports.summary.totalUsers,
        'Previous Period': this.generalReports.summary.previousTotalUsers,
        'Growth %': this.calculateGrowthPercentage(
          this.generalReports.summary.totalUsers,
          this.generalReports.summary.previousTotalUsers
        )
      });
      
      data.push({
        Metric: 'Total Posts',
        Value: this.generalReports.summary.totalPosts,
        'Previous Period': this.generalReports.summary.previousTotalPosts,
        'Growth %': this.calculateGrowthPercentage(
          this.generalReports.summary.totalPosts,
          this.generalReports.summary.previousTotalPosts
        )
      });
      
      data.push({
        Metric: 'Total Listings',
        Value: this.generalReports.summary.totalListings,
        'Previous Period': this.generalReports.summary.previousTotalListings,
        'Growth %': this.calculateGrowthPercentage(
          this.generalReports.summary.totalListings,
          this.generalReports.summary.previousTotalListings
        )
      });
    }
    
    return data;
  }

  calculateGrowthPercentage(current: number, previous: number): string {
    const currentValue = this.getSafeNumber(current);
    const previousValue = this.getSafeNumber(previous);
    
    if (previousValue === 0) return currentValue > 0 ? '100.0%' : '0.0%';
    const growth = ((currentValue - previousValue) / previousValue) * 100;
    return growth.toFixed(1) + '%';
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

  getGrowthIndicator(current: number, previous: number): string {
    const currentValue = this.getSafeNumber(current);
    const previousValue = this.getSafeNumber(previous);
    
    if (previousValue === 0) return currentValue > 0 ? 'up' : 'neutral';
    return currentValue > previousValue ? 'up' : currentValue < previousValue ? 'down' : 'neutral';
  }

  getGrowthColor(current: number, previous: number): string {
    const indicator = this.getGrowthIndicator(current, previous);
    switch (indicator) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }
}
