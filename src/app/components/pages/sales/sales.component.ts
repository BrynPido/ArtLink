import { CommonModule } from '@angular/common';
import { Component, OnInit, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { TimeAgoPipe } from '../../../utils/time-ago.pipe';
import { NumberFormatPipe } from '../../../pipes/number-format.pipe';
import { CurrencyFormatPipe } from '../../../pipes/currency-format.pipe';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../services/toast.service';

interface Transaction {
  id: number;
  listingid: number;
  buyerid: number | null;
  sellerid: number;
  conversationid: number | null;
  finalprice: number;
  status: string;
  notes?: string;
  createdat: string;
  completedat?: string;
  listing_title: string;
  listing_content: string;
  listing_image?: string;
  seller_name: string;
  seller_username: string;
  buyer_name: string;
  buyer_username: string;
  source_type?: 'transaction' | 'sold_listing'; // New field to distinguish transaction types
}

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe, NumberFormatPipe, CurrencyFormatPipe],
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.css']
})
export class SalesComponent implements OnInit {
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  loading = true;
  error: string | null = null;
  activeTab: 'sales' | 'purchases' = 'sales';
  showExportMenu = false;
  showFilters = false;
  
  // Filter properties
  filters = {
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    priceMin: 0,
    priceMax: 10000,
    source: '' // 'transaction' or 'sold_listing'
  };
  
  // Summary statistics
  totalSales = 0;
  totalRevenue = 0;
  totalPurchases = 0;
  totalSpent = 0;

  // Filter options
  statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  sourceOptions = [
    { value: '', label: 'All Sources' },
    { value: 'transaction', label: 'Transaction' },
    { value: 'sold_listing', label: 'Direct Sale' }
  ];

  // Date preset options for export
  datePresets = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'last_week', label: 'Last Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_year', label: 'This Year' },
    { value: 'last_year', label: 'Last Year' },
    { value: 'all_time', label: 'All Time' },
    { value: 'custom', label: 'Custom Range' }
  ];

  // Export filter state
  exportFilters = {
    datePreset: 'all_time',
    customFromDate: '',
    customToDate: '',
    status: '',
    source: '',
    priceMin: 0,
    priceMax: 999999
  };

  showExportFilters = false;

  constructor(
    private dataService: DataService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.filteredTransactions = [...this.transactions];
    this.loadTransactions();
  }

  setActiveTab(tab: 'sales' | 'purchases') {
    this.activeTab = tab;
    this.loadTransactions();
  }

  loadTransactions() {
    this.loading = true;
    this.error = null;

    const type = this.activeTab === 'sales' ? 'seller' : 'buyer';
    
    this.dataService.getTransactions(type).subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.transactions = response.payload || [];
          this.applyFilters();
          this.calculateSummary();
        } else {
          this.error = response.message || 'Failed to load transactions';
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading transactions:', error);
        this.error = error.error?.message || 'Failed to load transactions';
        this.loading = false;
        this.toastService.showToast('Failed to load transactions', 'error');
      }
    });
  }

  calculateSummary() {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      this.totalSales = 0;
      this.totalRevenue = 0;
      this.totalPurchases = 0;
      this.totalSpent = 0;
      return;
    }

    if (this.activeTab === 'sales') {
      // For sales tab, calculate from filtered transactions
      this.totalSales = this.filteredTransactions.length;
      this.totalRevenue = this.filteredTransactions.reduce((sum, t) => sum + (t.finalprice || 0), 0);
      this.totalPurchases = 0;
      this.totalSpent = 0;
    } else {
      // For purchases tab, calculate from filtered transactions
      this.totalSales = 0;
      this.totalRevenue = 0;
      this.totalPurchases = this.filteredTransactions.length;
      this.totalSpent = this.filteredTransactions.reduce((sum, t) => sum + (t.finalprice || 0), 0);
    }
  }

  // Filter functionality
  applyFilters() {
    let filtered = [...this.transactions];

    // Search filter
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        t.listing_title.toLowerCase().includes(searchTerm) ||
        t.buyer_name.toLowerCase().includes(searchTerm) ||
        t.seller_name.toLowerCase().includes(searchTerm) ||
        (t.notes && t.notes.toLowerCase().includes(searchTerm))
      );
    }

    // Status filter
    if (this.filters.status) {
      filtered = filtered.filter(t => t.status.toLowerCase() === this.filters.status.toLowerCase());
    }

    // Source filter
    if (this.filters.source) {
      filtered = filtered.filter(t => t.source_type === this.filters.source);
    }

    // Date range filter
    if (this.filters.dateFrom) {
      const fromDate = new Date(this.filters.dateFrom);
      filtered = filtered.filter(t => new Date(t.createdat) >= fromDate);
    }

    if (this.filters.dateTo) {
      const toDate = new Date(this.filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(t => new Date(t.createdat) <= toDate);
    }

    // Price range filter
    filtered = filtered.filter(t => {
      const price = t.finalprice || 0;
      return price >= this.filters.priceMin && price <= this.filters.priceMax;
    });

    this.filteredTransactions = filtered;
    this.calculateSummary();
  }

  clearFilters() {
    this.filters = {
      search: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      priceMin: 0,
      priceMax: 10000,
      source: ''
    };
    this.applyFilters();
    this.toastService.showToast('Filters cleared', 'info');
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  // Date preset handling
  getDateRange(preset: string): { start: Date | null, end: Date | null } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) };
      
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { start: yesterday, end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1) };
      
      case 'this_week':
        const startOfWeek = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
        const endOfWeek = new Date(startOfWeek.getTime() + (6 * 24 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000 - 1));
        return { start: startOfWeek, end: endOfWeek };
      
      case 'last_week':
        const lastWeekStart = new Date(today.getTime() - ((today.getDay() + 7) * 24 * 60 * 60 * 1000));
        const lastWeekEnd = new Date(lastWeekStart.getTime() + (6 * 24 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000 - 1));
        return { start: lastWeekStart, end: lastWeekEnd };
      
      case 'this_month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
      
      case 'last_month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start: lastMonthStart, end: lastMonthEnd };
      
      case 'this_quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59, 999);
        return { start: quarterStart, end: quarterEnd };
      
      case 'this_year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start: yearStart, end: yearEnd };
      
      case 'last_year':
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        return { start: lastYearStart, end: lastYearEnd };
      
      case 'custom':
        const customStart = this.exportFilters.customFromDate ? new Date(this.exportFilters.customFromDate) : null;
        const customEnd = this.exportFilters.customToDate ? new Date(this.exportFilters.customToDate + 'T23:59:59') : null;
        return { start: customStart, end: customEnd };
      
      case 'all_time':
      default:
        return { start: null, end: null };
    }
  }

  // Apply export filters to get filtered data
  getExportFilteredData(): Transaction[] {
    let filtered = [...this.transactions];

    // Apply date preset filter
    if (this.exportFilters.datePreset !== 'all_time') {
      const { start, end } = this.getDateRange(this.exportFilters.datePreset);
      
      if (start) {
        filtered = filtered.filter(t => new Date(t.createdat) >= start);
      }
      if (end) {
        filtered = filtered.filter(t => new Date(t.createdat) <= end);
      }
    }

    // Apply status filter
    if (this.exportFilters.status) {
      filtered = filtered.filter(t => t.status.toLowerCase() === this.exportFilters.status.toLowerCase());
    }

    // Apply source filter
    if (this.exportFilters.source) {
      filtered = filtered.filter(t => t.source_type === this.exportFilters.source);
    }

    // Apply price range filter
    filtered = filtered.filter(t => {
      const price = t.finalprice || 0;
      return price >= this.exportFilters.priceMin && price <= this.exportFilters.priceMax;
    });

    return filtered;
  }

  // Reset export filters
  resetExportFilters() {
    this.exportFilters = {
      datePreset: 'all_time',
      customFromDate: '',
      customToDate: '',
      status: '',
      source: '',
      priceMin: 0,
      priceMax: 999999
    };
  }

  getCurrentUserId(): number {
    const user = this.dataService.getCurrentUser();
    return user?.id || 0;
  }

  getFullMediaUrl(mediaPath: string): string {
    if (!mediaPath) return '/assets/images/default-avatar.svg';
    if (mediaPath.startsWith('http')) return mediaPath;
    return `${environment.mediaBaseUrl}${mediaPath}`;
  }

  getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

  viewListing(listingId: number) {
    this.router.navigate(['/listing', listingId]);
  }

  contactUser(transaction: Transaction) {
    if (this.activeTab === 'sales') {
      // For sales, contact the buyer (if exists)
      if (transaction.buyerid && transaction.buyerid > 0) {
        this.router.navigate(['/messages', transaction.buyerid]);
      } else {
        this.toastService.showToast('No buyer information available for this sale', 'info');
      }
    } else {
      // For purchases, contact the seller
      this.router.navigate(['/messages', transaction.sellerid]);
    }
  }

  goToListings() {
    this.router.navigate(['/listings']);
  }

  // Close export menu when clicking outside
  @HostListener('document:click', ['$event'])
  closeExportMenu(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.export-dropdown')) {
      this.showExportMenu = false;
      this.showExportFilters = false;
    }
  }

  // Export functionality
  exportData() {
    const dataToExport = this.getExportFilteredData();
    
    if (dataToExport.length === 0) {
      this.toastService.showToast('No data to export with current filters', 'info');
      return;
    }

    const exportData = dataToExport.map(transaction => ({
      'Transaction ID': transaction.id || 'N/A',
      'Listing Title': transaction.listing_title,
      'Type': this.activeTab === 'sales' ? 'Sale' : 'Purchase',
      [this.activeTab === 'sales' ? 'Buyer' : 'Seller']: 
        this.activeTab === 'sales' 
          ? (transaction.buyer_name || 'Direct Sale')
          : transaction.seller_name,
      'Price (₱)': transaction.finalprice || 0,
      'Status': this.capitalizeFirst(transaction.status),
      'Date': this.formatDate(transaction.createdat),
      'Notes': transaction.notes || '',
      'Source': transaction.source_type === 'sold_listing' ? 'Direct Sale' : 'Transaction'
    }));

    const presetLabel = this.datePresets.find(p => p.value === this.exportFilters.datePreset)?.label || 'filtered';
    const filename = `${this.activeTab === 'sales' ? 'sales' : 'purchases'}-${presetLabel.toLowerCase().replace(/ /g, '-')}-${this.getDateString()}.csv`;
    this.downloadCSV(exportData, filename);
    
    this.toastService.showToast(`${dataToExport.length} ${this.activeTab === 'sales' ? 'sales' : 'purchases'} exported successfully`, 'success');
    this.showExportMenu = false;
    this.showExportFilters = false;
  }

  private downloadCSV(data: any[], filename: string) {
    const csvContent = this.convertToCSV(data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => 
      headers.map(header => `"${this.escapeCSV(row[header] || '')}"`).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
  }

  private escapeCSV(value: any): string {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // Escape quotes by doubling them and wrap in quotes if contains comma, quote, or newline
    return stringValue.replace(/"/g, '""');
  }

  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private capitalizeFirst(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // Export summary data
  exportSummary() {
    const summaryData = [
      {
        'Metric': 'Total Sales',
        'Value': this.totalSales,
        'Type': 'Count'
      },
      {
        'Metric': 'Total Revenue',
        'Value': `₱${this.totalRevenue.toFixed(2)}`,
        'Type': 'Currency'
      },
      {
        'Metric': 'Total Purchases',
        'Value': this.totalPurchases,
        'Type': 'Count'
      },
      {
        'Metric': 'Total Spent',
        'Value': `₱${this.totalSpent.toFixed(2)}`,
        'Type': 'Currency'
      },
      {
        'Metric': 'Export Date',
        'Value': new Date().toLocaleDateString(),
        'Type': 'Date'
      }
    ];

    const filename = `sales-summary-${this.getDateString()}.csv`;
    this.downloadCSV(summaryData, filename);
    this.toastService.showToast('Summary exported successfully', 'success');
  }
}
