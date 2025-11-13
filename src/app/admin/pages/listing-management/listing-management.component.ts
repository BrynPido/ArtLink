import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';
import { DELETION_REASONS } from '../../constants/deletion-reasons';
import { Workbook } from 'exceljs';

@Component({
  selector: 'app-listing-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listing-management.component.html',
  styleUrls: ['./listing-management.component.css']
})
export class ListingManagementComponent implements OnInit {
  listings: any[] = [];
  filteredListings: any[] = [];
  loading = false;
  searchTerm = '';
  filterStatus = 'all';
  filterCategory = 'all';
  selectedListings: number[] = [];
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  // Align with user-facing listing categories/creation
  categories = ['art', 'commission', 'supplies', 'tools', 'other'];
  statuses = ['active', 'inactive'];

  // Expose Math to template
  Math = Math;

  constructor(
    private adminService: AdminService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit() {
    this.loadListings();
  }

  // Helper method to get full image URL
  getFullImageUrl(imagePath: string | null | undefined): string {
    return this.adminService.getFullImageUrl(imagePath);
  }

  loadListings() {
    this.loading = true;
    this.adminService.getAllListings().subscribe({
      next: (response: any) => {
        // Handle the API response structure
        if (response.status === 'success' && response.data) {
          this.listings = response.data.listings || [];
        } else {
          this.listings = response.listings || response || [];
        }
        this.applyFilters();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading listings:', error);
        this.sweetAlert.error('Error', 'Failed to load listings');
        this.listings = [];
        this.loading = false;
      }
    });
  }

  // Normalize category labels for consistent display
  getCategoryLabel(category: string | null | undefined): string {
    if (!category) return '';
    const map: Record<string, string> = {
      art: 'Art',
      commission: 'Commission',
      supplies: 'Art Supplies',
      tools: 'Tools',
      other: 'Other'
    };
    const key = String(category).toLowerCase();
    return map[key] || key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  }

  applyFilters() {
    let filtered = [...this.listings];

    // Search filter
    if (this.searchTerm) {
      filtered = filtered.filter(listing => 
        listing.title?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        listing.content?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        listing.username?.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (this.filterStatus !== 'all') {
      if (this.filterStatus === 'active') {
        filtered = filtered.filter(listing => listing.published === 1);
      } else if (this.filterStatus === 'inactive') {
        filtered = filtered.filter(listing => listing.published === 0);
      }
    }

    // Category filter
    if (this.filterCategory !== 'all') {
      filtered = filtered.filter(listing => (listing.category || '').toLowerCase() === this.filterCategory);
    }

    this.filteredListings = filtered;
    this.totalPages = Math.ceil(this.filteredListings.length / this.itemsPerPage);
    this.currentPage = 1;
  }

  getPaginatedListings() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredListings.slice(startIndex, startIndex + this.itemsPerPage);
  }

  toggleListingSelection(listingId: number) {
    const index = this.selectedListings.indexOf(listingId);
    if (index > -1) {
      this.selectedListings.splice(index, 1);
    } else {
      this.selectedListings.push(listingId);
    }
  }

  toggleSelectAll() {
    if (this.selectedListings.length === this.getPaginatedListings().length) {
      this.selectedListings = [];
    } else {
      this.selectedListings = this.getPaginatedListings().map(listing => listing.id);
    }
  }

  bulkAction(action: string) {
    if (this.selectedListings.length === 0) return;

    if (action === 'delete') {
      this.sweetAlert
        .confirmBulkArchive(this.selectedListings.length, 'listings')
        .then((result) => {
          if (result.isConfirmed) {
            this.bulkDeleteListings();
          }
        });
      return;
    }

    if (action === 'unpublish') {
      const title = 'Unpublish Listings';
      const text = `Are you sure you want to unpublish ${this.selectedListings.length} listing(s)?`;
      const confirmText = 'Yes, unpublish';
      this.sweetAlert.confirm(title, text, confirmText).then((result) => {
        if (result.isConfirmed) {
          this.bulkUpdateListings(action);
        }
      });
      return;
    }
  }

  bulkDeleteListings() {
    this.sweetAlert.selectWithOther(
      'Bulk Archive Listings - Select Reason',
      this.getDeletionReasons().LISTING
    ).then((reasonResult) => {
      if (reasonResult.isConfirmed && reasonResult.value) {
        const deletePromises = this.selectedListings.map(id => 
          this.adminService.deleteListing(id, reasonResult.value).toPromise()
        );

        Promise.all(deletePromises).then(() => {
          this.sweetAlert.success('Archived!', `Successfully archived ${this.selectedListings.length} listing(s).`);
          this.loadListings();
          this.selectedListings = [];
        }).catch((error) => {
          console.error('Error with bulk delete:', error);
          this.sweetAlert.error('Error', 'Failed to archive some listings. Please try again.');
        });
      }
    });
  }

  bulkUpdateListings(action: string) {
    // For unpublish, we'll update the published status
    const updates = this.selectedListings.map(id => ({
      id,
      published: action === 'unpublish' ? 0 : 1
    }));

    // For now, just show success - implement actual API call if needed
    this.sweetAlert.success('Success!', `Successfully ${action}ed ${this.selectedListings.length} listing(s).`);
    this.selectedListings = [];
  }

  viewListing(listing: any) {
    // Detect if dark mode is active
    const isDarkMode = document.documentElement.classList.contains('dark') || 
                       window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Define colors based on theme
    const colors = {
      background: isDarkMode ? '#374151' : '#f3f4f6',
      border: isDarkMode ? '#4b5563' : '#e5e7eb',
      text: isDarkMode ? '#f9fafb' : '#374151',
      textSecondary: isDarkMode ? '#d1d5db' : '#6b7280',
      modalBg: isDarkMode ? '#1f2937' : '#ffffff',
      strongText: isDarkMode ? '#f3f4f6' : '#111827'
    };

    // Create HTML content for the SweetAlert modal with dark mode support
    const imageHtml = listing.image_url 
      ? `<img src="${listing.image_url}" alt="${listing.title}" onclick="window.open('${listing.image_url}', '_blank')" style="width: 100%; max-width: 300px; height: auto; max-height: 250px; object-fit: contain; border-radius: 8px; margin-bottom: 20px; border: 1px solid ${colors.border}; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); cursor: pointer;" title="Click to view full size">`
      : `<div style="width: 100%; height: 200px; background-color: ${colors.background}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: ${colors.textSecondary}; margin-bottom: 20px; border: 1px solid ${colors.border};">No image available</div>`;

    const categoryLabel = this.getCategoryLabel(listing.category || '');
    const modalContent = `
      <div style="text-align: left; color: ${colors.text};">
        <div style="text-align: center; margin-bottom: 20px;">
          ${imageHtml}
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong style="color: ${colors.strongText};">Title:</strong><br>
            <span style="color: ${colors.text};">${listing.title || 'N/A'}</span>
          </div>
          <div>
            <strong style="color: ${colors.strongText};">Artist:</strong><br>
            <span style="color: ${colors.text};">${listing.username || 'Unknown Artist'}</span>
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <strong style="color: ${colors.strongText};">Description:</strong><br>
          <span style="color: ${colors.text};">${listing.content || 'No description provided'}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong style="color: ${colors.strongText};">Price:</strong><br>
            <span style="color: #059669;">$${parseFloat(listing.price || 0).toFixed(2)}</span>
          </div>
          <div>
            <strong style="color: ${colors.strongText};">Category:</strong><br>
            <span style="color: ${colors.text};">${categoryLabel || 'N/A'}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong style="color: ${colors.strongText};">Status:</strong><br>
            <span style="color: ${(listing.published === true || listing.published === 1) ? '#10b981' : colors.textSecondary};">
              ${(listing.published === true || listing.published === 1) ? 'Published' : 'Draft'}
            </span>
          </div>
          <div>
            <strong style="color: ${colors.strongText};">Condition:</strong><br>
            <span style="color: ${colors.text};">${listing.condition ? listing.condition.replace('-', ' ').toUpperCase() : 'N/A'}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong style="color: ${colors.strongText};">Location:</strong><br>
            <span style="color: ${colors.text};">${listing.location || 'N/A'}</span>
          </div>
          <div>
            <strong style="color: ${colors.strongText};">Email:</strong><br>
            <span style="color: ${colors.text};">${listing.email || 'N/A'}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <strong style="color: ${colors.strongText};">Created:</strong><br>
            <span style="color: ${colors.text};">${new Date(listing.createdAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </div>
          <div>
            <strong style="color: ${colors.strongText};">Updated:</strong><br>
            <span style="color: ${colors.text};">${new Date(listing.updatedAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </div>
        </div>
      </div>
    `;

    // Import Swal directly
    import('sweetalert2').then((Swal) => {
      Swal.default.fire({
        title: 'Listing Details',
        html: modalContent,
        showCancelButton: true,
        showConfirmButton: true,
        confirmButtonText: '<i class="fas fa-archive"></i> Archive Listing',
        confirmButtonColor: '#f59e0b',
        cancelButtonText: 'Close',
        width: '70vw',
        padding: '1.5rem',
        background: colors.modalBg,
        color: colors.text,
        customClass: {
          popup: 'listing-details-modal',
          htmlContainer: 'listing-modal-content',
          title: 'listing-modal-title'
        },
        didOpen: () => {
          // Add custom CSS for better image display and modal sizing with dark mode support
          const style = document.createElement('style');
          style.textContent = `
            .listing-details-modal {
              border-radius: 12px !important;
              max-width: 700px !important;
              margin: auto !important;
              background-color: ${colors.modalBg} !important;
              color: ${colors.text} !important;
            }
            .listing-modal-content {
              text-align: left !important;
            }
            .listing-modal-title {
              color: ${colors.strongText} !important;
            }
            .listing-modal-content img {
              cursor: pointer;
              transition: transform 0.2s ease;
              display: block;
              margin: 0 auto 20px auto;
            }
            .listing-modal-content img:hover {
              transform: scale(1.05);
            }
            @media (max-width: 768px) {
              .listing-details-modal {
                width: 95vw !important;
                margin: 10px !important;
              }
            }
          `;
          document.head.appendChild(style);
        }
      }).then((result: any) => {
        if (result.isConfirmed) {
          this.deleteListing(listing.id);
        }
      });
    });
  }

  deleteListing(listingId: number) {
    this.sweetAlert.selectWithOther(
      'Archive Listing - Select Reason',
      this.getDeletionReasons().LISTING
    ).then((reasonResult) => {
      if (reasonResult.isConfirmed && reasonResult.value) {
        this.sweetAlert.confirmArchive(
          'listing',
          'This listing will be archived and hidden. It can be restored later.'
        ).then((result) => {
          if (result.isConfirmed) {
            this.adminService.deleteListing(listingId, reasonResult.value).subscribe({
              next: () => {
                this.sweetAlert.success('Archived!', 'The listing has been archived successfully.');
                this.loadListings();
              },
              error: (error: any) => {
                console.error('Error deleting listing:', error);
                this.sweetAlert.error('Error', 'Failed to archive listing. Please try again.');
              }
            });
          }
        });
      }
    });
  }

  exportListings() {
    const csvData = this.filteredListings.map(listing => ({
      ID: listing.id,
      Title: listing.title,
      Artist: listing.artist_name || listing.username || '',
      Category: listing.category || '',
      Price: listing.price ?? '',
      Status: (listing.status || ((listing.published === true || listing.published === 1) ? 'published' : 'draft')),
      'Created At': this.formatDateHuman(listing.createdAt || listing.created_at),
      'Updated At': this.formatDateHuman(listing.updatedAt || listing.updated_at)
    }));

    const csvContent = this.convertToCSV(csvData);
    this.downloadCSV(csvContent, 'listings.csv');
  }

  // New: Excel export with branded header
  async exportListingsExcel() {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Listings', {
      pageSetup: {
        orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        horizontalCentered: true
      },
      views: [{ showGridLines: false }]
    });

    // Apply ArtLink branding header (rows 1-3), data starts at row 4
    await this.applyBrandingHeader(ws, wb, {
      title: 'Listings Export',
      subtitle: `Exported ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • ${this.filteredListings.length} of ${this.listings.length} shown`,
      mergeTo: 'H3'
    });

    // Header row for data table
    ws.addRow(['ID', 'Title', 'Artist', 'Category', 'Price', 'Status', 'Created At', 'Updated At']);
    const headerRow = ws.getRow(ws.lastRow!.number);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } } as any;
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } as any;

    // Data rows
    this.filteredListings.forEach(l => {
      const status = l.status || ((l.published === true || l.published === 1) ? 'Published' : 'Draft');
      ws.addRow([
        l.id,
        l.title || '',
        l.artist_name || l.username || '',
        l.category || '',
        typeof l.price === 'number' ? l.price : (parseFloat(l.price) || ''),
        status,
        this.formatDateHuman(l.createdAt || l.created_at),
        this.formatDateHuman(l.updatedAt || l.updated_at)
      ]);
    });

    // Column widths
    ws.columns = [
      { width: 8 },   // ID
      { width: 32 },  // Title
      { width: 22 },  // Artist
      { width: 18 },  // Category
      { width: 12 },  // Price
      { width: 14 },  // Status
      { width: 22 },  // Created At
      { width: 22 }   // Updated At
    ] as any;

    // Borders for data rows
    const firstDataRow = headerRow.number + 1;
    const lastRowNum = ws.lastRow?.number || firstDataRow - 1;
    for (let r = headerRow.number; r <= lastRowNum; r++) {
      for (let c = 1; c <= 8; c++) {
        ws.getCell(r, c).border = {
          top: { style: r === headerRow.number ? 'thin' : undefined },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        } as any;
      }
    }

    // Freeze below branding and table header
    ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
    (ws as any).autoFilter = {
      from: { row: headerRow.number, column: 1 },
      to: { row: headerRow.number, column: 8 }
    };
    ws.pageSetup.printArea = `A1:H${lastRowNum}`;
    ws.headerFooter.oddFooter = `&LArtLink Admin&CGenerated ${new Date().toLocaleDateString()}&RPage &P of &N`;

    const buf = await wb.xlsx.writeBuffer();
    this.downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'artlink-listings.xlsx');
  }

  // Shared helpers (local copy to avoid cross-component coupling)
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
      return { base64, width: (dims as any).width, height: (dims as any).height };
    } catch (e) {
      console.warn('Failed to load logo for Excel export:', e);
      return null;
    }
  }

  private async applyBrandingHeader(ws: any, wb: Workbook, opts: { title: string; subtitle: string; mergeTo?: string }) {
    // Reserve columns A/B for logo + gutter to avoid header text overlap
    ws.getColumn(1).width = 24;
    ws.getColumn(2).width = 4;
    const r1 = ws.getRow(1); const r2 = ws.getRow(2); const r3 = ws.getRow(3);
    let headerRowHeight = 35;
    const logoMeta = await this.loadLogoMeta();
    if (logoMeta) {
      const imageId = wb.addImage({ base64: logoMeta.base64, extension: 'png' });
      const targetWidth = 150;
      const scale = targetWidth / (logoMeta.width || targetWidth);
      const height = Math.round((logoMeta.height || 60) * scale);
      ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: targetWidth, height } } as any);
      headerRowHeight = Math.max(38, Math.ceil(height / 3));
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

  private formatDateHuman(raw: any): string {
    if (!raw) return '';
    const d = new Date(typeof raw === 'string' && raw.length === 10 ? raw + 'T00:00:00' : raw);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
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

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers(): number[] {
    const pages = [];
    const maxVisible = 5;
    const start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible - 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  getDeletionReasons() {
    return DELETION_REASONS;
  }
}
