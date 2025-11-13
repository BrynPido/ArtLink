import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { TimeAgoPipe } from '../../../utils/time-ago.pipe';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../services/toast.service';
import Swal from 'sweetalert2';

interface Listing {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  authorId: number;
  authorName?: string;
  authorUsername?: string;
  authorProfilePicture?: string;
  price?: number;
  category?: string;
  condition?: string;
  location?: string;
  status?: string; // Add status field
  mediaUrls?: string[];
  media?: Array<{
    url: string;
    mediaType?: string;
  }>;
}

@Component({
  selector: 'app-listings',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe],
  templateUrl: './listings.component.html',
  styleUrls: ['./listings.component.css']
})
export class ListingsComponent implements OnInit {
  // Add viewMode property
  viewMode: 'all' | 'my' = 'all';
  displayMode: 'grid' | 'table' = 'grid'; // New property for display mode
  
  originalListings: Listing[] = []; // Store original unfiltered listings
  listings: Listing[] = []; // Filtered listings to display
  loading = true;
  error: string | null = null;
  selectedCategory = '';
  selectedCondition = '';
  searchTerm = '';
  priceRange = {
    min: 0,
    max: 10000
  };
  sortBy = 'newest';

  categories = [
    { value: '', label: 'All Categories' },
    { value: 'art', label: 'Art' },
    { value: 'commission', label: 'Commission' },
    { value: 'supplies', label: 'Art Supplies' },
    { value: 'tools', label: 'Tools' },
    { value: 'other', label: 'Other' }
  ];

  conditions = [
    { value: '', label: 'All Conditions' },
    { value: 'new', label: 'New' },
    { value: 'like-new', label: 'Like New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' }
  ];

  showFilters: boolean = false;
  showDebug: boolean = true; // Set to false in production

  constructor(
    private dataService: DataService,
    private router: Router,
    private toastService: ToastService
  ) {
    this.selectedCategory = '';
    this.selectedCondition = '';
    this.searchTerm = '';
    this.priceRange = {
      min: 0,
      max: 10000
    };
    this.sortBy = 'newest';
  }

  // Helper method to construct full media URL
  getFullMediaUrl(mediaPath: string): string {
    if (!mediaPath) return '';
    // If it's already a full URL, return as is
    if (mediaPath.startsWith('http')) return mediaPath;
    // If it's a relative path, prepend the media base URL from environment
    return `${environment.mediaBaseUrl}${mediaPath}`;
  }

  // Handle image loading errors
  onImageError(event: any): void {
    console.log('Image failed to load:', event.target.src);
    // Set a fallback image
    event.target.src = 'assets/images/default-avatar.svg';
  }

  ngOnInit(): void {
    this.loadListings();
  }

  // Updated to handle different view modes
  loadListings(): void {
    this.loading = true;
    this.error = null;
    
    const listingsObservable = this.viewMode === 'my' 
      ? this.dataService.getMyListings() 
      : this.dataService.getListings();
    
    listingsObservable.subscribe({
      next: (response) => {
        console.log('Listings API Response:', response); // Log the API response
        
        // Handle response structure - check if it has payload.listings or just payload
        if (response && response.payload) {
          if (Array.isArray(response.payload)) {
            this.originalListings = response.payload;
          } else if (response.payload.listings && Array.isArray(response.payload.listings)) {
            this.originalListings = response.payload.listings;
          } else {
            this.originalListings = [];
          }
        } else {
          this.originalListings = [];
        }
        
        // Process listings data
        this.processListingsData();
        
        console.log('Original Listings:', this.originalListings); // Log the processed listings
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading listings:', error);
        this.error = 'Failed to load listings. Please try again later.';
        this.loading = false;
      }
    });
  }

  // Process listings data to convert mediaUrls to media objects and handle profile pictures
  processListingsData(): void {
    if (!this.originalListings || !Array.isArray(this.originalListings)) {
      console.log('No valid listings array to process');
      return;
    }

    console.log('Processing listings data for', this.originalListings.length, 'listings');

    this.originalListings.forEach((listing, index) => {
      console.log(`Processing listing ${index}:`, listing);
      
      // Convert mediaUrls array to media objects with full URLs
      if (listing.mediaUrls && Array.isArray(listing.mediaUrls)) {
        listing.media = listing.mediaUrls.map((url: string) => ({
          url: this.getFullMediaUrl(url),
          mediaType: 'image' // Default to image, could be enhanced later
        }));
        console.log(`Listing ${index} media:`, listing.media);
      } else {
        listing.media = [];
        console.log(`Listing ${index} has no mediaUrls, setting empty media array`);
      }

      // Process author profile picture URL if it exists
      if (listing.authorProfilePicture) {
        listing.authorProfilePicture = this.getFullMediaUrl(listing.authorProfilePicture);
      }
    });
    
    console.log('Finished processing listings data');
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.selectedCategory) count++;
    if (this.selectedCondition) count++;
    if (this.priceRange.min > 0 || (this.priceRange.max > 0 && this.priceRange.max < 10000)) count++;
    return count;
  }

  applyFilters(): void {
    // Check if originalListings is properly initialized and is an array
    if (!this.originalListings || !Array.isArray(this.originalListings)) {
      console.warn('originalListings is not a valid array:', this.originalListings);
      this.listings = [];
      return;
    }

    let filteredListings = [...this.originalListings];

    // Apply category filter
    if (this.selectedCategory) {
      filteredListings = filteredListings.filter(listing => 
        listing.category === this.selectedCategory
      );
    }

    // Apply condition filter
    if (this.selectedCondition) {
      filteredListings = filteredListings.filter(listing => 
        listing.condition === this.selectedCondition
      );
    }

    // Apply price range filter
    if (this.priceRange.min > 0) {
      filteredListings = filteredListings.filter(listing => {
        const price = listing.price || 0;
        return price >= this.priceRange.min;
      });
    }
    if (this.priceRange.max > 0 && this.priceRange.max < 10000) {
      filteredListings = filteredListings.filter(listing => {
        const price = listing.price || 0;
        return price <= this.priceRange.max;
      });
    }

    // Apply search term
    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filteredListings = filteredListings.filter(listing =>
        listing.title.toLowerCase().includes(searchLower) ||
        listing.content.toLowerCase().includes(searchLower) ||
        listing.location?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    switch (this.sortBy) {
      case 'price-low-high':
        filteredListings.sort((a, b) => {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return priceA - priceB;
        });
        break;
      case 'price-high-low':
        filteredListings.sort((a, b) => {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return priceB - priceA;
        });
        break;
      case 'newest':
        filteredListings.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'oldest':
        filteredListings.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
    }

    // Update the filtered listings
    this.listings = filteredListings;
  }

  // Add this method to toggle between views
  setViewMode(mode: 'all' | 'my'): void {
    if (this.viewMode !== mode) {
      this.viewMode = mode;
      // Force grid view for "All Listings", keep current display mode for "My Listings"
      if (mode === 'all') {
        this.displayMode = 'grid';
      }
      this.loadListings();
    }
  }

  setDisplayMode(mode: 'grid' | 'table'): void {
    this.displayMode = mode;
  }

  viewListing(listingId: number): void {
    this.router.navigate(['/listing', listingId]);
  }

  createListing(): void {
    this.router.navigate(['/create'], { state: { isListing: true } });
  }

  goToSales(): void {
    this.router.navigate(['/sales']);
  }

  clearCategory() {
  this.selectedCategory = '';
  this.applyFilters();
  }

  clearCondition() {
    this.selectedCondition = '';
    this.applyFilters();
  }

  clearPriceRange() {
    this.priceRange = { min: 0, max: 10000 };
    this.applyFilters();
  }

  isRecentListing(listing: any): boolean {
    const now = new Date();
    const listingDate = new Date(listing.createdAt);
    
    // Calculate difference in days
    const diffTime = Math.abs(now.getTime() - listingDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Consider listings less than 3 days old as "recent"
    return diffDays <= 3;
  }

  // Status management methods
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'sold':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'available':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'sold':
        return 'check_circle';
      case 'reserved':
        return 'lock';
      case 'available':
        return 'check_circle_outline';
      default:
        return 'help_outline';
    }
  }

  isMyListing(listing: Listing): boolean {
    const currentUser = this.dataService.getCurrentUser();
    return currentUser && listing.authorId === currentUser.id;
  }

  // Quick action methods
  quickMarkAsSold(listing: Listing, event: Event): void {
    event.stopPropagation(); // Prevent card click
    
    // Show confirmation dialog
    Swal.fire({
      title: 'Mark as Sold?',
      text: `Are you sure you want to mark "${listing.title}" as sold?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, mark as sold',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Proceed with marking as sold
        this.dataService.markListingAsSold(listing.id, 0, 0).subscribe({
          next: (response: any) => {
            console.log('Listing marked as sold:', response);
            listing.status = 'sold';
            this.toastService.showToast('Listing marked as sold successfully!', 'success');
          },
          error: (error: any) => {
            console.error('Error marking as sold:', error);
            this.toastService.showToast('Failed to mark listing as sold', 'error');
          }
        });
      }
    });
  }

  quickReserve(listing: Listing, event: Event): void {
    event.stopPropagation();
    
    // Show confirmation dialog
    Swal.fire({
      title: 'Reserve Listing?',
      text: `Are you sure you want to reserve "${listing.title}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#eab308',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, reserve it',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Proceed with reserving
        this.dataService.reserveListing(listing.id).subscribe({
          next: (response: any) => {
            console.log('Listing reserved:', response);
            listing.status = 'reserved';
            this.toastService.showToast('Listing reserved successfully!', 'success');
          },
          error: (error: any) => {
            console.error('Error reserving listing:', error);
            this.toastService.showToast('Failed to reserve listing', 'error');
          }
        });
      }
    });
  }

  quickMarkAvailable(listing: Listing, event: Event): void {
    event.stopPropagation();
    
    // Show confirmation dialog
    Swal.fire({
      title: 'Mark as Available?',
      text: `Are you sure you want to mark "${listing.title}" as available again?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, make available',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Proceed with marking as available
        this.dataService.markListingAsAvailable(listing.id).subscribe({
          next: (response: any) => {
            console.log('Listing marked as available:', response);
            listing.status = 'available';
            this.toastService.showToast('Listing is now available!', 'success');
          },
          error: (error: any) => {
            console.error('Error marking as available:', error);
            this.toastService.showToast('Failed to update listing status', 'error');
          }
        });
      }
    });
  }

  editListing(listing: Listing, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/edit-listing', listing.id]);
  }
}
