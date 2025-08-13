import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { TimeAgoPipe } from '../../../utils/time-ago.pipe';
import { environment } from '../../../../environments/environment';

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
    private router: Router
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
    
    if (this.viewMode === 'all') {
      this.dataService.getListings().subscribe({
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
    } else {
      // Get current user
      const currentUser = this.dataService.getCurrentUser();
      if (!currentUser) {
        this.error = 'You must be logged in to view your listings';
        this.loading = false;
        return;
      }
      
      this.dataService.getUserListings(currentUser.id).subscribe({
        next: (response) => {
          console.log('User Listings API Response:', response); // Log the API response
          
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
          
          console.log('Original User Listings:', this.originalListings); // Log the processed listings
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading your listings:', error);
          this.error = 'Failed to load your listings. Please try again later.';
          this.loading = false;
        }
      });
    }
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
      this.loadListings();
    }
  }

  viewListing(listingId: number): void {
    this.router.navigate(['/listing', listingId]);
  }

  createListing(): void {
    this.router.navigate(['/create'], { state: { isListing: true } });
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
}
