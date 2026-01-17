import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { ToastService } from '../../../services/toast.service';
import { LISTING_CATEGORIES, CATEGORY_GROUPS, getCategoryLabel } from '../../../constants/listing-categories';
import Cropper from 'cropperjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-listing-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listing-edit.component.html',
  styleUrl: './listing-edit.component.css'
})
export class ListingEditComponent implements OnInit, OnDestroy {
  listingId!: string;
  isLoading = true;
  formData = {
    title: '',
    content: '',
    published: true,
    authorId: 0,
    media: [] as any[],
    listingDetails: {
      price: 0,
      category: '',
      condition: '',
      location: ''
    }
  };
  
  // Category data
  categories = LISTING_CATEGORIES;
  categoryGroups = CATEGORY_GROUPS;
  getCategoryLabel = getCategoryLabel;
  
  // For tracking existing and new images
  existingMedia: any[] = [];
  imagePreviewUrls: string[] = [];
  imageFiles: File[] = [];
  cropper?: Cropper;
  currentUser: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: DataService,
    private toastService: ToastService
  ) {
    this.currentUser = this.dataService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }
    this.formData.authorId = this.currentUser.id;
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.listingId = id;
        this.loadListing(id);
      } else {
        this.toastService.showToast('Listing ID not found', 'error');
        this.router.navigate(['/home']);
      }
    });
  }

  ngOnDestroy() {
    if (this.cropper) {
      this.cropper.destroy();
    }
  }

  loadListing(id: string) {
    this.isLoading = true;
    this.dataService.getListingById(id).subscribe({
      next: (response) => {
        if (response && response.payload) {
          const listing = response.payload;
          
          // Check if user is authorized to edit this listing
          if (listing.authorId !== this.currentUser.id) {
            this.toastService.showToast('You are not authorized to edit this listing', 'error');
            this.router.navigate(['/listing', id]);
            return;
          }
          
          // Populate form data with listing details
          this.formData.title = listing.title;
          this.formData.content = listing.content;
          this.formData.published = listing.published;
          
          if (listing.listingDetails) {
            this.formData.listingDetails.price = listing.listingDetails.price;
            this.formData.listingDetails.category = listing.listingDetails.category;
            this.formData.listingDetails.condition = listing.listingDetails.condition;
            this.formData.listingDetails.location = listing.listingDetails.location;
          }
          
          // Handle existing media
          if (listing.media && listing.media.length > 0) {
            this.existingMedia = listing.media.map((media: any) => ({
              id: media.id,
              url: media.url,
              mediaType: media.mediaType
            }));
          }
          
          this.isLoading = false;
        } else {
          this.toastService.showToast('Error loading listing', 'error');
          this.router.navigate(['/home']);
        }
      },
      error: (error) => {
        console.error('Error loading listing:', error);
        this.toastService.showToast('Error loading listing', 'error');
        this.router.navigate(['/home']);
      }
    });
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          this.imageFiles.push(file);
          const reader = new FileReader();
          reader.onload = (e: any) => {
            this.imagePreviewUrls.push(e.target.result);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }

  removeExistingImage(index: number) {
    const media = this.existingMedia[index];
    
    // Confirm before deleting
    Swal.fire({
      title: 'Delete Image?',
      text: 'This will permanently delete this image from your listing.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Check if this is the last image
        if (this.existingMedia.length === 1 && this.imageFiles.length === 0) {
          this.toastService.showToast('Cannot delete the last image. Listings must have at least one image.', 'error');
          return;
        }

        // Call API to delete the media
        this.dataService.deleteListingMedia(this.listingId, media.id).subscribe({
          next: () => {
            this.existingMedia.splice(index, 1);
            this.toastService.showToast('Image deleted successfully', 'success');
          },
          error: (error) => {
            console.error('Error deleting media:', error);
            this.toastService.showToast(error.message || 'Failed to delete image', 'error');
          }
        });
      }
    });
  }

  removeNewImage(index: number) {
    this.imagePreviewUrls.splice(index, 1);
    this.imageFiles.splice(index, 1);
  }

  editImage(index: number) {
    // Image editing functionality using Cropper.js
    // This would be the same as in createpost.component.ts
  }

  onSubmit() {
    if (!this.currentUser) {
      this.toastService.showToast('Please log in to update this listing', 'error');
      return;
    }

    // Allow update without new images if existing media exists
    if (this.existingMedia.length === 0 && this.imageFiles.length === 0) {
      this.toastService.showToast('Please keep at least one image', 'error');
      return;
    }

    // Create FormData for the update
    const formData = new FormData();
    formData.append('title', this.formData.title);
    formData.append('content', this.formData.content);
    formData.append('listingDetails', JSON.stringify(this.formData.listingDetails));

    // Append new image files if any
    if (this.imageFiles.length > 0) {
      this.imageFiles.forEach(file => {
        formData.append('media', file);
      });
    }

    // Submit the update
    this.dataService.updateListing(this.listingId, formData).subscribe({
      next: (response) => {
        this.toastService.showToast('Listing updated successfully', 'success');
        this.router.navigate(['/listing', this.listingId]);
      },
      error: (error) => {
        console.error('Error updating listing:', error);
        this.toastService.showToast('Error updating listing', 'error');
      }
    });
  }

  cancelEdit() {
    Swal.fire({
      title: 'Cancel Editing?',
      text: 'Are you sure you want to cancel? All unsaved changes will be lost.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, discard changes',
      cancelButtonText: 'Continue editing'
    }).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/listing', this.listingId]);
      }
    });
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
}