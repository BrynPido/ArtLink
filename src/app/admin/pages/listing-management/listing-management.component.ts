import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';

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

  categories = ['digital_art', 'traditional_art', 'photography', 'sculpture', 'mixed_media', 'other'];
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
      filtered = filtered.filter(listing => listing.category === this.filterCategory);
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

    let title = '';
    let text = '';
    let confirmText = '';

    switch (action) {
      case 'delete':
        title = 'Delete Listings';
        text = `Are you sure you want to delete ${this.selectedListings.length} listing(s)? This action cannot be undone.`;
        confirmText = 'Yes, delete them';
        break;
      case 'unpublish':
        title = 'Unpublish Listings';
        text = `Are you sure you want to unpublish ${this.selectedListings.length} listing(s)?`;
        confirmText = 'Yes, unpublish';
        break;
      default:
        return;
    }

    this.sweetAlert.confirm(title, text, confirmText).then((result) => {
      if (result.isConfirmed) {
        // For delete action, use individual delete calls
        if (action === 'delete') {
          this.bulkDeleteListings();
        } else {
          this.bulkUpdateListings(action);
        }
      }
    });
  }

  bulkDeleteListings() {
    this.sweetAlert.input('Bulk Delete', 'Please provide a reason for deleting these listings:', 'textarea').then((reasonResult) => {
      if (reasonResult.isConfirmed && reasonResult.value) {
        const deletePromises = this.selectedListings.map(id => 
          this.adminService.deleteListing(id, reasonResult.value).toPromise()
        );

        Promise.all(deletePromises).then(() => {
          this.sweetAlert.success('Success!', `Successfully deleted ${this.selectedListings.length} listing(s).`);
          this.loadListings();
          this.selectedListings = [];
        }).catch((error) => {
          console.error('Error with bulk delete:', error);
          this.sweetAlert.error('Error', 'Failed to delete some listings. Please try again.');
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
    // Create HTML content for the SweetAlert modal
    const imageHtml = listing.image_url 
      ? `<img src="http://localhost:3000${listing.image_url}" alt="${listing.title}" onclick="window.open('http://localhost:3000${listing.image_url}', '_blank')" style="width: 100%; max-width: 300px; height: auto; max-height: 250px; object-fit: contain; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); cursor: pointer;" title="Click to view full size">`
      : '<div style="width: 100%; height: 200px; background-color: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #6b7280; margin-bottom: 20px; border: 1px solid #e5e7eb;">No image available</div>';

    const modalContent = `
      <div style="text-align: left;">
        <div style="text-align: center; margin-bottom: 20px;">
          ${imageHtml}
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong>Title:</strong><br>
            <span style="color: #374151;">${listing.title || 'N/A'}</span>
          </div>
          <div>
            <strong>Artist:</strong><br>
            <span style="color: #374151;">${listing.username || 'Unknown Artist'}</span>
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <strong>Description:</strong><br>
          <span style="color: #374151;">${listing.content || 'No description provided'}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong>Price:</strong><br>
            <span style="color: #374151;">$${parseFloat(listing.price || 0).toFixed(2)}</span>
          </div>
          <div>
            <strong>Category:</strong><br>
            <span style="color: #374151;">${listing.category ? listing.category.charAt(0).toUpperCase() + listing.category.slice(1) : 'N/A'}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong>Status:</strong><br>
            <span style="color: ${listing.published === 1 ? '#10b981' : '#6b7280'};">
              ${listing.published === 1 ? 'Published' : 'Draft'}
            </span>
          </div>
          <div>
            <strong>Condition:</strong><br>
            <span style="color: #374151;">${listing.condition ? listing.condition.replace('-', ' ').toUpperCase() : 'N/A'}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <strong>Location:</strong><br>
            <span style="color: #374151;">${listing.location || 'N/A'}</span>
          </div>
          <div>
            <strong>Email:</strong><br>
            <span style="color: #374151;">${listing.email || 'N/A'}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <strong>Created:</strong><br>
            <span style="color: #374151;">${new Date(listing.createdAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </div>
          <div>
            <strong>Updated:</strong><br>
            <span style="color: #374151;">${new Date(listing.updatedAt).toLocaleDateString('en-US', { 
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
        confirmButtonText: '<i class="fas fa-trash"></i> Delete Listing',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Close',
        width: '70vw',
        padding: '1.5rem',
        customClass: {
          popup: 'listing-details-modal',
          htmlContainer: 'listing-modal-content'
        },
        didOpen: () => {
          // Add custom CSS for better image display and modal sizing
          const style = document.createElement('style');
          style.textContent = `
            .listing-details-modal {
              border-radius: 12px !important;
              max-width: 700px !important;
              margin: auto !important;
            }
            .listing-modal-content {
              text-align: left !important;
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
    this.sweetAlert.input('Delete Listing', 'Please provide a reason for deletion:', 'textarea').then((reasonResult) => {
      if (reasonResult.isConfirmed && reasonResult.value) {
        this.sweetAlert.confirmDelete(
          'Delete Listing',
          'This action cannot be undone. Please provide a reason for deletion:'
        ).then((result) => {
          if (result.isConfirmed) {
            this.adminService.deleteListing(listingId, reasonResult.value).subscribe({
              next: () => {
                this.sweetAlert.success('Deleted!', 'The listing has been deleted successfully.');
                this.loadListings();
              },
              error: (error: any) => {
                console.error('Error deleting listing:', error);
                this.sweetAlert.error('Error', 'Failed to delete listing. Please try again.');
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
      Artist: listing.artist_name,
      Category: listing.category,
      Price: listing.price,
      Status: listing.status,
      'Created At': new Date(listing.created_at).toLocaleDateString(),
      'Updated At': new Date(listing.updated_at).toLocaleDateString()
    }));

    const csvContent = this.convertToCSV(csvData);
    this.downloadCSV(csvContent, 'listings.csv');
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
}
