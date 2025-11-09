import { Component, OnInit } from '@angular/core';
import { Workbook } from 'exceljs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { ClickOutsideDirective } from '../../../directives/click-outside.directive';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, ClickOutsideDirective],
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

  // Export range selector for Excel export
  exportRange: 'day' | 'week' | 'month' | 'year' | 'custom' = 'month';
  exportRanges = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  // Export menu state
  showExportMenu = false;

  // Expose Math to template
  Math = Math;

  // Inline SVG logo (fallback) encoded as data URI so export doesn't depend on external files
  private readonly logoDataUri =
    'data:image/svg+xml;base64,' +
    btoa(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="160" height="32" viewBox="0 0 160 32"><rect rx="6" ry="6" width="160" height="32" fill="#111827"/><text x="16" y="22" font-family="Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="16" fill="#8b5cf6">Art</text><text x="54" y="22" font-family="Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="16" fill="#22c55e">Link</text></svg>`);

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
              // Prefer all-time totals for headline cards if present
              totalUsers: this.getSafeNumber(
                response.data.overview?.totalUsersAllTime ?? response.data.overview?.totalUsers
              ),
              previousTotalUsers: this.getSafeNumber(response.data.overview?.previousTotalUsers),
              totalPosts: this.getSafeNumber(
                response.data.overview?.totalPostsAllTime ?? response.data.overview?.totalPosts
              ),
              previousTotalPosts: this.getSafeNumber(response.data.overview?.previousTotalPosts),
              totalListings: this.getSafeNumber(
                response.data.overview?.totalListingsAllTime ?? response.data.overview?.totalListings
              ),
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
            newUsers: (response.payload.newUsers || []).map((v: any) => Number(v) || 0),
            totalUsers: (response.payload.totalUsers || []).map((v: any) => Number(v) || 0),
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
            posts: Number(response.payload.posts) || 0,
            listings: Number(response.payload.listings) || 0,
            comments: Number(response.payload.comments) || 0,
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

  // Export menu controls
  toggleExportMenu() {
    this.showExportMenu = !this.showExportMenu;
  }

  closeExportMenu() {
    this.showExportMenu = false;
  }

  prepareUserGrowthChart(data: any) {
    if (!data || !data.labels || !data.newUsers || !data.totalUsers) return;
    
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
          data: data.newUsers,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          label: 'Total Users',
          data: data.totalUsers,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          tension: 0.25,
          yAxisID: 'y'
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
    if (this.userGrowthStats.newUsers && this.userGrowthStats.newUsers.length > 0) {
      return this.userGrowthStats.newUsers[this.userGrowthStats.newUsers.length - 1];
    }
    return 0;
  }

  getUserGrowthTotal(): number {
    if (this.userGrowthStats.newUsers && this.userGrowthStats.newUsers.length > 0) {
      return this.userGrowthStats.newUsers.reduce((a: number, b: number) => a + b, 0);
    }
    return 0;
  }

  getUserTotalLatest(): number {
    if (this.userGrowthStats.totalUsers && this.userGrowthStats.totalUsers.length > 0) {
      return this.userGrowthStats.totalUsers[this.userGrowthStats.totalUsers.length - 1];
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

  // New: Single-sheet Excel summary (one printable page)
  async exportSummaryExcel() {
    const summary = this.generalReports?.summary || {};
    const content = this.contentStats || {};
    const latestNew = this.getUserGrowthLatest();
    const totalNew = this.getUserGrowthTotal();
    const totalUsersNow = this.getUserTotalLatest() || summary.totalUsers || 0;
    const { postsPct, listingsPct, commentsPct } = this.computeContentPercentages();

    // Prepare workbook & sheet with page setup for single page
    const wb = new Workbook();
    const sheet = wb.addWorksheet('Summary', {
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        horizontalCentered: true,
        verticalCentered: false
      },
      views: [{ showGridLines: false }]
    });
    // Apply standardized header (branding & title) with metrics starting at row 4
    await this.applyBrandingHeader(sheet, wb, {
      title: 'ArtLink Admin Summary',
      subtitle: `Range: ${this.getExportRangeLabel()} (Period New Users: ${this.formatNumber(totalNew)})`
    });

    // Headline metrics block
  sheet.addRow(['Metric', 'Value', 'Previous', 'Growth %', 'Notes', '']);
  const dataHeaderRow = sheet.lastRow!;
  dataHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dataHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } as any;

    const rows = [
      ['Total Users', totalUsersNow, summary.previousTotalUsers || 0, this.calculateGrowthPercentage(totalUsersNow, summary.previousTotalUsers || 0), '', ''],
      ['Total Posts', summary.totalPosts || 0, summary.previousTotalPosts || 0, this.calculateGrowthPercentage(summary.totalPosts || 0, summary.previousTotalPosts || 0), '', ''],
      ['Total Listings', summary.totalListings || 0, summary.previousTotalListings || 0, this.calculateGrowthPercentage(summary.totalListings || 0, summary.previousTotalListings || 0), '', ''],
      ['Active Users (24h)', summary.activeUsers || 0, '', '', 'Engagement snapshot', '']
    ];
    rows.forEach(r => sheet.addRow(r));

    // Content distribution block
    sheet.addRow([]);
    sheet.addRow(['Content Type', 'Count', 'Percent']);
    sheet.lastRow!.font = { bold: true };
    const posts = Number(content.posts || 0);
    const listings = Number(content.listings || 0);
    const comments = Number(content.comments || 0);
    sheet.addRow(['Posts', posts, postsPct]);
    sheet.addRow(['Listings', listings, listingsPct]);
    sheet.addRow(['Comments', comments, commentsPct]);
    sheet.addRow(['Total Content', posts + listings + comments, '100%']);

    // Styling: column widths
    sheet.columns = [
      { key: 'c1', width: 20 },
      { key: 'c2', width: 14 },
      { key: 'c3', width: 12 },
      { key: 'c4', width: 12 },
      { key: 'c5', width: 22 },
      { key: 'c6', width: 4 }
    ] as any;

    // Borders for data area
    const applyBorder = (row: number) => {
      const r = sheet.getRow(row);
      r.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        } as any;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
    };
  for (let r =  dataHeaderRow.number; r <= sheet.lastRow!.number; r++) applyBorder(r);

  // Freeze below the branding (keep rows 1-3)
  sheet.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];

    // Define print area (covers all used rows/cols)
    sheet.pageSetup.printArea = `A1:F${sheet.lastRow?.number}`;

    // Footer via headerFooter (text only – images not supported here)
    sheet.headerFooter.oddFooter = `&LArtLink Admin&CGenerated ${new Date().toLocaleDateString()}&RPage &P of &N`;

    const buffer = await wb.xlsx.writeBuffer();
    this.downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'artlink-summary.xlsx');
  }

  // Convert public logo asset to base64 for embedding in Excel (raw base64 string without data URI)
  private async loadLogoBase64(): Promise<string | null> {
    try {
      const res = await fetch('/assets/images/Artlink_Logo.png');
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // result is data URL: data:image/png;base64,XXXX
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Failed to load logo for Excel export:', e);
      return null;
    }
  }

  // Load logo with natural dimensions to preserve aspect ratio in the sheet header band
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
            URL.revokeObjectURL(url);
            resolve(meta);
          };
          img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
          img.src = url;
        })
  ]);

      const { width, height } = dims as { width: number; height: number };
      return { base64: base64 as string, width, height };
    } catch (e) {
      console.warn('Failed to load logo/meta for Excel export:', e);
      // Fallback to base64 only
      const b64 = await this.loadLogoBase64();
      if (!b64) return null;
      return { base64: b64, width: 240, height: 60 };
    }
  }

  // Export to Excel with filtering by range
  async exportToExcel(range: 'day' | 'week' | 'month' | 'year' | 'custom' = this.exportRange) {
    // Prepare filtered user data based on selected range
    const users = this.getFilteredUserData(range);
    const posts = Number(this.contentStats?.posts || 0);
    const listings = Number(this.contentStats?.listings || 0);
    const comments = Number(this.contentStats?.comments || 0);
    const totalContent = posts + listings + comments;

    const summary = this.generalReports?.summary || {};
    const totalUsersNow = this.getUserTotalLatest() || summary.totalUsers || 0;

    const workbook = new Workbook();
    workbook.creator = 'ArtLink Admin';
    workbook.created = new Date();

    // Add Summary sheet with standardized header
    const wsSummary = workbook.addWorksheet('Summary');
    wsSummary.properties.defaultRowHeight = 18;
    const dateRangeText = range === 'custom'
      ? `${this.formatDateHuman(this.dateRange.start)} to ${this.formatDateHuman(this.dateRange.end)}`
      : this.describeRange(range);
    await this.applyBrandingHeader(wsSummary, workbook, {
      title: 'Reports Summary',
      subtitle: `Range: ${dateRangeText}`,
      mergeTo: 'D3'
    });

    // Headline metrics
  wsSummary.addRow(['Metric', 'Value']);
    wsSummary.getRow(wsSummary.lastRow!.number).font = { bold: true };
    const metrics = [
      ['Total Users', totalUsersNow],
      ['Active Users (24h)', Number(summary.activeUsers || 0)],
      ['Total Posts', Number(summary.totalPosts || 0)],
      ['Total Listings', Number(summary.totalListings || 0)]
    ];
    metrics.forEach(m => wsSummary.addRow(m));
    wsSummary.columns = [
      { key: 'metric', width: 26 },
      { key: 'value', width: 18 }
    ] as any;

    // Content sheet with header
    const wsContent = workbook.addWorksheet('Content');
    await this.applyBrandingHeader(wsContent, workbook, {
      title: 'Content Summary',
      subtitle: `Range: ${dateRangeText}`,
      mergeTo: 'E3'
    });
    wsContent.addRow(['Posts', 'Listings', 'Comments', 'Total Content']);
    wsContent.getRow(wsContent.lastRow!.number).font = { bold: true };
    wsContent.addRow([posts, listings, comments, totalContent]);

    // Users sheet with header
    const wsUsers = workbook.addWorksheet('Users');
    await this.applyBrandingHeader(wsUsers, workbook, {
      title: 'User Growth',
      subtitle: `Range: ${dateRangeText}`,
      mergeTo: 'E3'
    });
    wsUsers.addRow(['Date', 'New Users', 'Total Users']);
    wsUsers.getRow(wsUsers.lastRow!.number).font = { bold: true };
  users.forEach(u => wsUsers.addRow([this.formatDateHuman(u.date), u.newUsers, u.totalUsers]));

    // Overview sheet with header
    const wsOverview = workbook.addWorksheet('Overview');
    await this.applyBrandingHeader(wsOverview, workbook, {
      title: 'Period Overview',
      subtitle: `Range: ${dateRangeText}`,
      mergeTo: 'E3'
    });
    wsOverview.addRow(['Metric', 'Current', 'Previous', 'Growth %']);
    wsOverview.getRow(wsOverview.lastRow!.number).font = { bold: true };
    const rows = [
      ['Total Users', summary.totalUsers || totalUsersNow, summary.previousTotalUsers || 0, this.calculateGrowthPercentage(summary.totalUsers || totalUsersNow, summary.previousTotalUsers || 0)],
      ['Total Posts', summary.totalPosts || 0, summary.previousTotalPosts || 0, this.calculateGrowthPercentage(summary.totalPosts || 0, summary.previousTotalPosts || 0)],
      ['Total Listings', summary.totalListings || 0, summary.previousTotalListings || 0, this.calculateGrowthPercentage(summary.totalListings || 0, summary.previousTotalListings || 0)]
    ];
    rows.forEach(r => wsOverview.addRow(r));

    // Auto filter and style headers
    [wsContent, wsUsers, wsOverview].forEach(ws => {
      const header = ws.getRow(1);
      header.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } } as any;
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } as any;
      });
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columnCount }
      } as any;
      ws.columns?.forEach(col => { (col as any).width = Math.max(12, (col as any).header?.toString().length || 12); });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    this.downloadBlob(blob, `artlink-report-${range}.xlsx`);
  }

  private describeRange(r: 'day'|'week'|'month'|'year'): string {
    switch (r) {
      case 'day': return 'Last Day';
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case 'year': return 'Last 365 Days';
    }
  }

  // Unified range label generator (period if set, otherwise explicit dateRange)
  private getExportRangeLabel(): string {
    const fmt = (d: string) => {
      if (!d) return 'N/A';
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };
    if (this.exportRange === 'custom' && this.dateRange.start && this.dateRange.end) {
      return `${fmt(this.dateRange.start)} to ${fmt(this.dateRange.end)}`;
    }
    if (this.dateRange.start && this.dateRange.end) {
      return `${fmt(this.dateRange.start)} to ${fmt(this.dateRange.end)}`;
    }
    // Fallback descriptive periods (no explicit dates)
    switch (this.selectedPeriod) {
      case '7days': return 'Last 7 Days';
      case '30days': return 'Last 30 Days';
      case '3months': return 'Last 3 Months';
      case '6months': return 'Last 6 Months';
      case '1year': return 'Last 1 Year';
      default: return 'Range Unspecified';
    }
  }

  // Format a YYYY-MM-DD (or ISO) date string to 'Month Day, Year'
  private formatDateHuman(raw: string | undefined | null): string {
    if (!raw) return 'N/A';
    const d = new Date(raw.length === 10 ? raw + 'T00:00:00' : raw);
    if (isNaN(d.getTime())) return raw || 'N/A';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  // Helper to apply standardized branding header to any worksheet.
  // Ensures rows 1-3 are reserved for logo + merged title area, data starts at row 4.
  private async applyBrandingHeader(ws: any, wb: Workbook, opts: { title: string; subtitle: string; mergeTo?: string }) {
    // Reserve columns A/B for logo + gutter to prevent overlap with title
    ws.getColumn(1).width = 24; // logo band
    ws.getColumn(2).width = 4;  // gutter
    const r1 = ws.getRow(1); const r2 = ws.getRow(2); const r3 = ws.getRow(3);
    let headerRowHeight = 35;
    const logoMeta = await this.loadLogoMeta();
    if (logoMeta) {
      const targetWidth = 150;
      const scale = targetWidth / (logoMeta.width || targetWidth);
      const height = Math.round((logoMeta.height || 60) * scale);
      const imgId = wb.addImage({ base64: logoMeta.base64, extension: 'png' });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: targetWidth, height }, editAs: 'oneCell' } as any);
      headerRowHeight = Math.max(38, Math.ceil(height / 3));
    }
    r1.height = headerRowHeight; r2.height = headerRowHeight; r3.height = headerRowHeight;
    const mergeTarget = opts.mergeTo || 'F3';
    ws.mergeCells(`C1:${mergeTarget}`); // Start at column C instead of B
    const cell = ws.getCell('C1');
    cell.value = {
      richText: [
        { text: opts.title + '\n', font: { size: 16, bold: true, color: { argb: 'FF111827' } } },
        { text: opts.subtitle, font: { size: 11, color: { argb: 'FF6B7280' } } }
      ]
    } as any;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true } as any;
    ws.pageSetup.printTitlesRow = '1:3';
    while ((ws.lastRow?.number ?? 0) < 3) { ws.addRow([]); }
    ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
  }

  // Excel export: General
  async exportGeneralExcel() {
    const wb = new Workbook();
    const ws = wb.addWorksheet('General', {
      pageSetup: {
        orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        horizontalCentered: true
      },
      views: [{ showGridLines: false }]
    });

    const summary = this.generalReports?.summary || {};
    const totalUsersNow = this.getUserTotalLatest() || summary.totalUsers || 0;
    await this.applyBrandingHeader(ws, wb, {
      title: 'General Report',
      subtitle: `Range: ${this.getExportRangeLabel()}`,
      mergeTo: 'F3'
    });

    ws.addRow(['Metric', 'Value', 'Previous', 'Growth %', 'Notes']);
    const headerRow = ws.getRow(ws.lastRow!.number);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } } as any;
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } as any;

    const rows = [
      ['Total Users', totalUsersNow, summary.previousTotalUsers || 0, this.calculateGrowthPercentage(totalUsersNow, summary.previousTotalUsers || 0), ''],
      ['Total Posts', summary.totalPosts || 0, summary.previousTotalPosts || 0, this.calculateGrowthPercentage(summary.totalPosts || 0, summary.previousTotalPosts || 0), ''],
      ['Total Listings', summary.totalListings || 0, summary.previousTotalListings || 0, this.calculateGrowthPercentage(summary.totalListings || 0, summary.previousTotalListings || 0), ''],
      ['Active Users (24h)', summary.activeUsers || 0, '', '', 'Engagement snapshot']
    ];
    rows.forEach(r => ws.addRow(r));

    ws.columns = [
      { key: 'm', width: 24 }, { key: 'v', width: 16 }, { key: 'p', width: 16 }, { key: 'g', width: 12 }, { key: 'n', width: 24 }
    ] as any;

    ws.pageSetup.printArea = `A1:E${ws.lastRow?.number}`;
    ws.headerFooter.oddFooter = `&LArtLink Admin&CGenerated ${new Date().toLocaleDateString()}&RPage &P of &N`;

    const buf = await wb.xlsx.writeBuffer();
    this.downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'artlink-general.xlsx');
  }

  // Excel export: Users
  async exportUsersExcel() {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Users', {
      pageSetup: {
        orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
      },
      views: [{ showGridLines: false }]
    });

    await this.applyBrandingHeader(ws, wb, {
      title: 'Users Report',
      subtitle: `Range: ${this.getExportRangeLabel()}`,
      mergeTo: 'E3'
    });

    ws.addRow(['Date', 'New Users', 'Total Users']);
    ws.getRow(ws.lastRow!.number).font = { bold: true };
    const labels: string[] = this.userGrowthStats?.labels || [];
    const newUsers: number[] = this.userGrowthStats?.newUsers || [];
    const totals: number[] = this.userGrowthStats?.totalUsers || [];
  labels.forEach((d, i) => ws.addRow([this.formatDateHuman(d), newUsers[i] ?? 0, totals[i] ?? 0]));

    ws.columns = [ { key: 'd', width: 16 }, { key: 'n', width: 14 }, { key: 't', width: 14 } ] as any;
    ws.pageSetup.printArea = `A1:C${ws.lastRow?.number}`;
    ws.headerFooter.oddFooter = `&LArtLink Admin&CGenerated ${new Date().toLocaleDateString()}&RPage &P of &N`;

    const buf = await wb.xlsx.writeBuffer();
    this.downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'artlink-users.xlsx');
  }

  // Excel export: Content
  async exportContentExcel() {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Content', {
      pageSetup: {
        orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
      },
      views: [{ showGridLines: false }]
    });

    await this.applyBrandingHeader(ws, wb, {
      title: 'Content Report',
      subtitle: `Range: ${this.getExportRangeLabel()}`,
      mergeTo: 'E3'
    });

    const posts = Number(this.contentStats?.posts || 0);
    const listings = Number(this.contentStats?.listings || 0);
    const comments = Number(this.contentStats?.comments || 0);
    const total = posts + listings + comments;
    const pct = (v: number) => total === 0 ? '0%' : ((v / total) * 100).toFixed(1) + '%';

    ws.addRow(['Content Type', 'Count', 'Percent']);
    ws.getRow(ws.lastRow!.number).font = { bold: true };
    ws.addRow(['Posts', posts, pct(posts)]);
    ws.addRow(['Listings', listings, pct(listings)]);
    ws.addRow(['Comments', comments, pct(comments)]);
    ws.addRow(['Total Content', total, '100%']);

    ws.columns = [ { key: 't', width: 20 }, { key: 'c', width: 14 }, { key: 'p', width: 12 } ] as any;
    ws.pageSetup.printArea = `A1:C${ws.lastRow?.number}`;
    ws.headerFooter.oddFooter = `&LArtLink Admin&CGenerated ${new Date().toLocaleDateString()}&RPage &P of &N`;

    const buf = await wb.xlsx.writeBuffer();
    this.downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'artlink-content.xlsx');
  }

  private getFilteredUserData(range: 'day'|'week'|'month'|'year'|'custom') {
    const labels: string[] = this.userGrowthStats?.labels || [];
    const newUsers: number[] = this.userGrowthStats?.newUsers || [];
    const totalUsers: number[] = this.userGrowthStats?.totalUsers || [];
    const items = labels.map((d, i) => ({ date: d, newUsers: newUsers[i] ?? 0, totalUsers: totalUsers[i] ?? 0 }));
    if (items.length === 0) return [] as Array<{date: string; newUsers: number; totalUsers: number}>;

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (range === 'custom') {
      startDate = this.dateRange.start ? new Date(this.dateRange.start) : null;
      endDate = this.dateRange.end ? new Date(this.dateRange.end) : null;
    } else {
      endDate = new Date(items[items.length - 1].date);
      startDate = new Date(endDate);
      const delta = range === 'day' ? 1 : range === 'week' ? 7 : range === 'month' ? 30 : 365;
      startDate.setDate(endDate.getDate() - (delta - 1));
    }

    return items.filter(it => {
      const d = new Date(it.date);
      const afterStart = !startDate || d >= startDate;
      const beforeEnd = !endDate || d <= endDate;
      return afterStart && beforeEnd;
    });
  }

  prepareUserReportData(): any[] {
    const labels: string[] = this.userGrowthStats?.labels || [];
    const newUsers: number[] = this.userGrowthStats?.newUsers || [];
    const totalUsers: number[] = this.userGrowthStats?.totalUsers || [];
    if (labels.length === 0) return [];
    return labels.map((date: string, idx: number) => ({
      Date: this.formatDateHuman(date),
      'New Users': newUsers[idx] ?? 0,
      'Total Users': totalUsers[idx] ?? 0
    }));
  }

  prepareContentReportData(): any[] {
    const posts = Number(this.contentStats?.posts || 0);
    const listings = Number(this.contentStats?.listings || 0);
    const comments = Number(this.contentStats?.comments || 0);
    return [{
      Posts: posts,
      Listings: listings,
      Comments: comments,
      'Total Content': posts + listings + comments
    }];
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
    this.downloadBlob(blob, filename);
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private computeContentPercentages() {
    const posts = Number(this.contentStats?.posts || 0);
    const listings = Number(this.contentStats?.listings || 0);
    const comments = Number(this.contentStats?.comments || 0);
    const total = posts + listings + comments;
    if (total === 0) {
      return { postsPct: '0%', listingsPct: '0%', commentsPct: '0%' };
    }
    const toPct = (v: number) => (v / total * 100).toFixed(1) + '%';
    return { postsPct: toPct(posts), listingsPct: toPct(listings), commentsPct: toPct(comments) };
  }

  private formatNumber(n: number): string {
    try { return new Intl.NumberFormat().format(Number(n) || 0); } catch { return String(n); }
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
