import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { TimeAgoPipe } from '../../../utils/time-ago.pipe';

interface Listing {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  authorId: number;
  listingDetails?: {
    price: string; // Change to string since API sends it as string
    category: string;
    condition: string;
    location: string;
  };
  media: Array<{
    url: string;
    mediaType: string;
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
          this.originalListings = response.payload;
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
          this.originalListings = response.payload;
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

  getActiveFilterCount(): number {
    let count = 0;
    if (this.selectedCategory) count++;
    if (this.selectedCondition) count++;
    if (this.priceRange.min > 0 || (this.priceRange.max > 0 && this.priceRange.max < 10000)) count++;
    return count;
  }

  applyFilters(): void {
    let filteredListings = [...this.originalListings];

    // Apply category filter
    if (this.selectedCategory) {
      filteredListings = filteredListings.filter(listing => 
        listing.listingDetails?.category === this.selectedCategory
      );
    }

    // Apply condition filter
    if (this.selectedCondition) {
      filteredListings = filteredListings.filter(listing => 
        listing.listingDetails?.condition === this.selectedCondition
      );
    }

    // Apply price range filter
    if (this.priceRange.min > 0) {
      filteredListings = filteredListings.filter(listing => {
        const price = listing.listingDetails?.price ? parseFloat(listing.listingDetails.price) : 0;
        return price >= this.priceRange.min;
      });
    }
    if (this.priceRange.max > 0 && this.priceRange.max < 10000) {
      filteredListings = filteredListings.filter(listing => {
        const price = listing.listingDetails?.price ? parseFloat(listing.listingDetails.price) : 0;
        return price <= this.priceRange.max;
      });
    }

    // Apply search term
    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filteredListings = filteredListings.filter(listing =>
        listing.title.toLowerCase().includes(searchLower) ||
        listing.content.toLowerCase().includes(searchLower) ||
        listing.listingDetails?.location?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    switch (this.sortBy) {
      case 'price-low-high':
        filteredListings.sort((a, b) => {
          const priceA = a.listingDetails?.price ? parseFloat(a.listingDetails.price) : 0;
          const priceB = b.listingDetails?.price ? parseFloat(b.listingDetails.price) : 0;
          return priceA - priceB;
        });
        break;
      case 'price-high-low':
        filteredListings.sort((a, b) => {
          const priceA = a.listingDetails?.price ? parseFloat(a.listingDetails.price) : 0;
          const priceB = b.listingDetails?.price ? parseFloat(b.listingDetails.price) : 0;
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
