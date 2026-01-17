import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { ToastService } from '../../../services/toast.service';
import Cropper from 'cropperjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-createpost',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './createpost.component.html',
  styleUrls: ['./createpost.component.css']
})
export class CreatePostComponent implements OnDestroy {
  isListingMode = false;
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
  imagePreviewUrls: string[] = [];
  imageFiles: File[] = [];
  imageCaptions: string[] = [];
  cropper?: Cropper;
  currentUser: any;

  constructor(
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

  ngOnDestroy() {
    if (this.cropper) {
      this.cropper.destroy();
    }
  }

  toggleMode() {
    this.isListingMode = !this.isListingMode;
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          this.imageFiles.push(file);
          this.imageCaptions.push('');
          const reader = new FileReader();
          reader.onload = (e: any) => {
            this.imagePreviewUrls.push(e.target.result);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }

  removeImage(index: number) {
    this.imagePreviewUrls.splice(index, 1);
    this.imageFiles.splice(index, 1);
    this.imageCaptions.splice(index, 1);
  }

  editImage(index: number) {
    // Image editing functionality using Cropper.js
    // ... (existing image editing code)
  }

  onSubmit() {
    if (!this.currentUser) {
      this.toastService.showToast('Please log in to create a post', 'error');
      return;
    }

    // For listings, require at least one image; for posts, images are optional
    if (this.isListingMode && this.imageFiles.length === 0) {
      this.toastService.showToast('Please add at least one image for a listing', 'error');
      return;
    }

    // Convert images to base64
    const promises = this.imageFiles.map(file => this.fileToBase64(file));
    
    Promise.all(promises).then(base64Array => {
      const mediaArray = base64Array.map((base64, index) => ({
        url: base64,
        mediaType: 'image',
        caption: this.imageCaptions[index] || ''
      }));

      if (this.isListingMode) {
        // For listings, structure the data according to what the API expects
        const listingData = {
          title: this.formData.title,
          content: this.formData.content,
          listingDetails: this.formData.listingDetails,
          media: mediaArray
        };

        this.dataService.createListing(listingData).subscribe({
          next: (response) => {
            this.toastService.showToast('Listing created successfully', 'success');
            this.router.navigate(['/listings']);
          },
          error: (error) => {
            console.error('Error creating listing:', error);
            this.toastService.showToast('Error creating listing', 'error');
          }
        });
      } else {
        // For posts, images are optional; if none provided, send without media
        const postData = {
          ...this.formData,
          media: mediaArray // can be empty []
        };

        this.dataService.createPost(postData).subscribe({
          next: (response) => {
            this.toastService.showToast('Post created successfully', 'success');
            this.router.navigate(['/post', response.payload.postId]);
          },
          error: (error) => {
            console.error('Error creating post:', error);
            this.toastService.showToast('Error creating post', 'error');
          }
        });
      }
    });
  }

  discardPost() {
    Swal.fire({
      title: 'Discard ' + (this.isListingMode ? 'Listing' : 'Post') + '?',
      text: 'Are you sure you want to discard this? All your work will be lost.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, discard it',
      cancelButtonText: 'No, keep editing'
    }).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/home']);
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