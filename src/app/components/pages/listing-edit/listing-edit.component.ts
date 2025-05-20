import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { ToastService } from '../../../services/toast.service';
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
    this.existingMedia.splice(index, 1);
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

    if (this.existingMedia.length === 0 && this.imageFiles.length === 0) {
      this.toastService.showToast('Please add at least one image', 'error');
      return;
    }

    // Create a copy of the form data for submission
    const updateData = {...this.formData};
    
    // First, include existing media
    updateData.media = [...this.existingMedia];
    
    // Then process new images if any
    if (this.imageFiles.length > 0) {
      // Convert new images to base64
      const promises = this.imageFiles.map(file => this.fileToBase64(file));
      
      Promise.all(promises).then(base64Array => {
        const newMedia = base64Array.map(base64 => ({
          url: base64,
          mediaType: 'image'
        }));

        // Combine existing and new media
        updateData.media = [...updateData.media, ...newMedia];
        
        this.submitUpdate(updateData);
      });
    } else {
      // No new images, just update with existing media
      this.submitUpdate(updateData);
    }
  }

  submitUpdate(updateData: any) {
    this.dataService.updateListing(this.listingId, updateData).subscribe({
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