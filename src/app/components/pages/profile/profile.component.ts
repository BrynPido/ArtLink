import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { ToastService } from '../../../services/toast.service';
import Swal from 'sweetalert2';
import { TimeAgoPipe } from '../../../utils/time-ago.pipe';
import { Listing } from '../../../types/listing';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, TimeAgoPipe, ImageCropperComponent, FormsModule]
})
export class ProfileComponent implements OnInit {
  user: any;
  currentUser: any;
  isFollowing: boolean = false;
  activeTab: 'posts' | 'saved' | 'liked' | 'listings' = 'posts';
  isLoading: boolean = true;
  error: string | null = null;
  isOwnProfile: boolean = false;
  listings: Listing[] = [];
  showProfilePicModal = false;
  imageChangedEvent: any = '';
  croppedImage: any = '';
  uploadingProfilePic = false;
  cropperFormat: 'png' | 'jpeg' | 'webp' | 'bmp' = 'jpeg';
  editingBio: boolean = false;
  editableBio: string = '';
  updatingBio: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: DataService,
    private toastService: ToastService,
  ) {
    this.currentUser = this.dataService.getCurrentUser();
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const userId = params.get('id');
      if (userId) {
        this.isOwnProfile = this.currentUser?.id === parseInt(userId, 10);
        this.loadUserProfile(userId);
      }
    });
  }

  loadUserProfile(userId: string): void {
    console.log('Loading profile for user:', userId);
    this.isLoading = true;

    this.dataService.getUserProfile(userId).subscribe({
      next: (response: any) => {
        if (response && response.payload) {
          this.user = response.payload;
          this.isFollowing = response.payload.isFollowing;
          this.loadUserListings(userId);
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        this.error = 'Failed to load user profile. Please try again later.';
        console.error('Error fetching user profile:', error);
        this.isLoading = false;
      }
    });
  }

  loadUserListings(userId: string): void {
    this.dataService.getUserListings(userId).subscribe({
      next: (response) => {
        this.listings = response.payload;
      },
      error: (error) => {
        console.error('Error loading listings:', error);
        this.toastService.showToast('Failed to load user listings', 'error');
      }
    });
  }

  toggleFollow(): void {
    if (!this.user?.id) return;
    
    // If already following, show confirmation dialog
    if (this.isFollowing) {
      Swal.fire({
        title: 'Unfollow',
        text: `Are you sure you want to unfollow ${this.user.username}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, unfollow'
      }).then((result) => {
        if (result.isConfirmed) {
          this.performToggleFollow();
        }
      });
    } else {
      // If not following, follow immediately without confirmation
      this.performToggleFollow();
    }
  }

  private performToggleFollow(): void {
    if (!this.user?.id) return;
    
    const previousState = this.isFollowing;
    const previousFollowerCount = this.user.followers;

    // Optimistically update UI
    this.isFollowing = !this.isFollowing;
    this.user.followers = this.isFollowing ? 
      (previousFollowerCount || 0) + 1 : 
      (previousFollowerCount || 1) - 1;

    this.dataService.toggleFollow(this.user.id).subscribe({
      next: (response) => {
        if (response && typeof response.following === 'boolean') {
          // Server confirmed the state, no need to update again
          this.toastService.showToast(
            `Successfully ${response.following ? 'followed' : 'unfollowed'} ${this.user.username}`,
            'success'
          );
        }
      },
      error: (error) => {
        // Revert to previous state on error
        this.isFollowing = previousState;
        this.user.followers = previousFollowerCount;
        console.error('Error toggling follow:', error);
        this.toastService.showToast('Failed to update follow status', 'error');
      }
    });
  }

  switchTab(tab: 'posts' | 'saved' | 'liked' | 'listings'): void {
    this.activeTab = tab;
    if (tab === 'saved' && !this.user.savedPosts) {
      this.loadSavedPosts();
    } else if (tab === 'liked' && !this.user.likedPosts) {
      this.loadLikedPosts();
    } else if (tab === 'listings') {
      this.loadUserListings(this.user.id);
    }
  }

  loadSavedPosts(): void {
    if (!this.user?.id) return;

    this.dataService.getSavedPosts().subscribe({
      next: (response: any) => {
        if (response && response.payload) {
          this.user.savedPosts = response.payload;
        }
      },
      error: (error: any) => {
        console.error('Error fetching saved posts:', error);
      }
    });
  }

  loadLikedPosts(): void {
    if (!this.user?.id) return;

    this.dataService.getLikedPosts().subscribe({
      next: (response: any) => {
        if (response && response.payload) {
          this.user.likedPosts = response.payload;
        }
      },
      error: (error: any) => {
        console.error('Error fetching liked posts:', error);
      }
    });
  }

  viewPost(postId: number): void {
    this.router.navigate(['/post', postId]);
  }

  viewListing(listingId: number): void {
    this.router.navigate(['/listing', listingId]);
  }

  navigateToMyProfile(): void {
    this.router.navigate(['/profile', this.currentUser.id]).then(() => {
      this.isOwnProfile = true;
      this.loadUserProfile(this.currentUser.id.toString());
    });
  }

  goToChat(userId: number): void {
    // First check if we are following them
    this.dataService.isFollowing(userId).subscribe({
      next: (response) => {
        if (response?.payload?.following) {
          // Now check if they are following us back
          // Here userId is the follower, and currentUser.id is being followed
          this.dataService.isFollowing(this.currentUser.id, userId).subscribe({
            next: (mutualResponse) => {
              if (mutualResponse?.payload?.following) {
                // If mutual follow, navigate to inbox with messages tab
                this.router.navigate(['/inbox'], { 
                  queryParams: { 
                    tab: 'messages',
                    userId: userId
                  }
                });
              } else {
                this.toastService.showToast('You need to follow each other to start a conversation', 'info');
              }
            }
          });
        } else {
          this.toastService.showToast('You need to follow each other to start a conversation', 'info');
        }
      },
      error: (error) => {
        console.error('Error checking follow status:', error);
        this.toastService.showToast('Unable to check follow status', 'error');
      }
    });
  }

  // Triggered when user clicks the profile image
  onProfilePicClick(): void {
    if (!this.isOwnProfile) return;
    this.showProfilePicModal = true;
    this.imageChangedEvent = '';
    this.croppedImage = '';
  }

  // Handle file input change
  fileChangeEvent(event: any): void {
    this.imageChangedEvent = event;
    
    // Try to determine the format from the selected file
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const fileType = file.type;
      
      // Set appropriate format based on mime type
      if (fileType.includes('png')) {
        this.cropperFormat = 'png';
      } else if (fileType.includes('webp')) {
        this.cropperFormat = 'webp';
      } else if (fileType.includes('bmp')) {
        this.cropperFormat = 'bmp';
      } else {
        this.cropperFormat = 'jpeg'; // Default to jpeg for jpg and other formats
      }
      
      console.log(`Detected image format: ${this.cropperFormat}`);
    }
  }

  // Handle cropping
  imageCropped(event: ImageCroppedEvent) {
    console.log('Cropping event received:', event);
    
    // In newer versions, the event provides objectUrl or blob instead of base64
    if (event.objectUrl) {
      // Use the objectUrl directly
      this.croppedImage = event.objectUrl;
      console.log('Using objectUrl for cropped image');
    } else if (event.blob) {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.croppedImage = e.target.result;
        console.log('Converted blob to base64');
      };
      reader.readAsDataURL(event.blob);
    } else {
      console.error('No image data found in cropping event');
    }
  }

  // Save/crop the image
  saveProfilePic(): void {
    console.log('Save button clicked');
    
    if (!this.croppedImage) {
      this.toastService.showToast('No image to save. Please select and crop an image first.', 'error');
      return;
    }
    
    this.uploadingProfilePic = true;
    
    // If the cropped image is a blob URL, fetch the blob and convert to base64
    if (this.croppedImage.startsWith('blob:')) {
      fetch(this.croppedImage)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            this.uploadProfileImageData(base64data);
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error('Error converting blob to base64:', error);
          this.uploadingProfilePic = false;
          this.toastService.showToast('Failed to process image. Please try again.', 'error');
        });
    } else {
      // It's already base64, send it directly
      this.uploadProfileImageData(this.croppedImage);
    }
  }

  // Helper method to upload the actual data
  private uploadProfileImageData(base64data: string): void {
    const profileData = {
      userId: this.currentUser.id,
      imageData: base64data
    };
    
    this.dataService.updateProfile(profileData).subscribe({
      next: (response) => {
        if (response && response.payload && response.payload.imageProfile) {
          const newImageUrl = response.payload.imageProfile;
          
          // 1. Update the user's profile image in the UI
          if (this.user) {
            this.user.profileImage = newImageUrl;
          }
          
          // 2. Update current user using the new reactive method
          const userData = this.dataService.getCurrentUser();
          if (userData) {
            userData.profileImage = newImageUrl;
            this.dataService.updateCurrentUser(userData);
            this.currentUser = userData;
          }
          
          this.toastService.showToast('Profile picture updated successfully!', 'success');
        }
        this.showProfilePicModal = false;
        this.uploadingProfilePic = false;
      },
      error: (error) => {
        console.error('Error updating profile picture:', error);
        this.toastService.showToast('Failed to update profile picture. Please try again.', 'error');
        this.uploadingProfilePic = false;
      }
    });
  }

  closeProfilePicModal(): void {
    this.showProfilePicModal = false;
    this.imageChangedEvent = '';
    this.croppedImage = '';
  }

  startEditingBio(): void {
  this.editingBio = true;
  this.editableBio = this.user?.bio || '';
  }

  cancelEditBio(): void {
    this.editingBio = false;
  }

  saveBio(): void {
    if (!this.editableBio || this.updatingBio) return;
    
    this.updatingBio = true;
    
    const bioData = {
      userId: this.currentUser.id,
      bio: this.editableBio
    };
    
    this.dataService.updateBio(bioData).subscribe({
      next: () => {
        // Update the UI
        if (this.user) {
          this.user.bio = this.editableBio;
        }
        this.editingBio = false;
        this.updatingBio = false;
        this.toastService.showToast('Bio updated successfully!', 'success');
      },
      error: (error) => {
        console.error('Error updating bio:', error);
        this.updatingBio = false;
        this.toastService.showToast('Failed to update bio. Please try again.', 'error');
      }
    });
  }
}
