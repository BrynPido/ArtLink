import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { DataService } from '../../../services/data.service';

interface MediaItem {
  url: SafeUrl; // This is a SafeUrl object
  originalFile: File;
  filter: string;
  name: string;
  size: string;
  mediaType: string;
}

@Component({
  selector: 'app-createpost',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './createpost.component.html',
  styleUrls: ['./createpost.component.css']
})
export class CreatePostComponent implements OnInit {
  postForm: FormGroup;
  mediaItems: MediaItem[] = [];
  currentMediaIndex = 0;
  isLoading = false;
  error: string | null = null;
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
  maxFileSize = 10 * 1024 * 1024; // 10MB
  availableFilters = [
    { value: 'none', label: 'None' },
    { value: 'grayscale(100%)', label: 'Grayscale' },
    { value: 'sepia(100%)', label: 'Sepia' },
    { value: 'blur(3px)', label: 'Blur' },
    { value: 'brightness(1.2)', label: 'Brighten' },
    { value: 'contrast(1.5)', label: 'High Contrast' }
  ];
  submitting = false;

  constructor(
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private dataService: DataService // Inject DataService
  ) {
    this.postForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      content: ['', Validators.maxLength(2000)],
      published: [false]
    });
  }

  ngOnInit(): void { }

  onFileSelected(event: Event): void {
    this.error = null;
    this.isLoading = true;

    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      this.isLoading = false;
      return;
    }

    const filesToProcess = Array.from(input.files);
    const validFiles = this.validateFiles(filesToProcess);

    validFiles.forEach(file => this.processFile(file));

    // Reset input to allow selecting the same file again
    input.value = '';
    this.isLoading = false;
  }

  validateFiles(files: File[]): File[] {
    return files.filter(file => {
      // Check file type
      if (!this.allowedTypes.includes(file.type)) {
        this.error = `File "${file.name}" is not a supported media type. Please use JPG, PNG, GIF, WebP, MP4, or WebM.`;
        return false;
      }

      // Check file size
      if (file.size > this.maxFileSize) {
        this.error = `File "${file.name}" exceeds the maximum size of 10MB.`;
        return false;
      }

      return true;
    });
  }

  processFile(file: File): void {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target?.result) {
        // Sanitize URL for security
        const safeUrl = this.sanitizer.bypassSecurityTrustUrl(e.target.result as string);

        // Format file size
        const size = this.formatFileSize(file.size);

        // Determine media type
        const mediaType = file.type.startsWith('image/') ? 'image' : 'video';

        this.mediaItems.push({
          url: safeUrl,
          originalFile: file,
          filter: 'none',
          name: file.name,
          size,
          mediaType
        });

        // If this is the first media item, set it as current
        if (this.mediaItems.length === 1) {
          this.currentMediaIndex = 0;
        }
      }
    };

    reader.onerror = () => {
      this.error = `Failed to read file "${file.name}". Please try again.`;
    };

    reader.readAsDataURL(file);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }

  previousMedia(): void {
    if (this.currentMediaIndex > 0) {
      this.currentMediaIndex--;
    }
  }

  nextMedia(): void {
    if (this.currentMediaIndex < this.mediaItems.length - 1) {
      this.currentMediaIndex++;
    }
  }

  applyFilter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (this.mediaItems.length > 0 && this.currentMediaIndex >= 0) {
      this.mediaItems[this.currentMediaIndex].filter = select.value;
    }
  }

  removeCurrentMedia(): void {
    if (this.mediaItems.length === 0) return;

    this.mediaItems.splice(this.currentMediaIndex, 1);

    // Adjust current index if needed
    if (this.mediaItems.length === 0) {
      this.currentMediaIndex = -1;
    } else if (this.currentMediaIndex >= this.mediaItems.length) {
      this.currentMediaIndex = this.mediaItems.length - 1;
    }
  }

  removeAllMedia(): void {
    this.mediaItems = [];
    this.currentMediaIndex = -1;
  }

  getAriaLabel(index: number): string {
    if (this.mediaItems[index]) {
      return `Media ${index + 1} of ${this.mediaItems.length}: ${this.mediaItems[index].name}`;
    }
    return `Media ${index + 1} of ${this.mediaItems.length}`;
  }

  async submitPost(): Promise<void> {
    if (this.postForm.invalid) {
      Object.keys(this.postForm.controls).forEach(key => {
        const control = this.postForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
  
    if (this.mediaItems.length === 0) {
      this.error = 'Please add at least one image or video to your post.';
      return;
    }
  
    this.submitting = true;
  
    try {
      const currentUser = this.dataService.getCurrentUser();
      if (!currentUser || !currentUser.id) {
        throw new Error('Author ID not found in localStorage');
      }
  
      const postData = {
        title: this.postForm.get('title')?.value,
        content: this.postForm.get('content')?.value,
        published: this.postForm.get('published')?.value,
        authorId: currentUser.id,
        media: this.mediaItems.map(item => ({
          url: this.sanitizer.sanitize(4, item.url) || '', // Extract and sanitize the URL
          mediaType: item.mediaType,
        })),
      };
  
      this.dataService.createPost(postData).subscribe({
        next: (response) => {
          console.log('Post created successfully:', response);
          this.resetForm();
          alert('Post created successfully!');
        },
        error: (err) => {
          this.error = 'Failed to create post. Please try again.';
          console.error('Error creating post:', err);
        },
        complete: () => {
          this.submitting = false;
        }
      });
    } catch (err) {
      this.error = 'Failed to create post. Please try again.';
      console.error('Error creating post:', err);
      this.submitting = false;
    }
  }
  

  // Helper method to extract the raw URL from a SafeValue object
  private extractUrlFromSafeValue(safeUrl: SafeUrl): string {
    // Use toString() to get the raw URL
    return safeUrl.toString();
  }

  resetForm(): void {
    this.postForm.reset({
      title: '',
      content: '',
      published: false
    });
    this.removeAllMedia();
    this.error = null;
  }

  // Helper method to check if control is invalid and touched
  isInvalid(controlName: string): boolean {
    const control = this.postForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}