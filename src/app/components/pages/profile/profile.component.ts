import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { ToastService } from '../../../services/toast.service';
import { WebSocketService } from '../../../services/websocket.service';
import Swal from 'sweetalert2';
import { Listing } from '../../../types/listing';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, ImageCropperComponent, FormsModule]
})
export class ProfileComponent implements OnInit {
  user: any;
  currentUser: any;
  isFollowing: boolean = false;
  activeTab: 'posts' | 'saved' | 'liked' | 'listings' = 'posts';
  isLoading: boolean = true;
  error: string | null = null;
  // Tri-state: null (unknown/initial), true (own profile), false (someone else's)
  isOwnProfile: boolean | null = null;
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
    private webSocketService: WebSocketService,
  ) {
    this.currentUser = this.dataService.getCurrentUser();
  }

  // Helper method to construct full media URL
  getFullMediaUrl(mediaPath: string): string {
    if (!mediaPath) return '';
    // If it's already a full URL, return as is
    if (mediaPath.startsWith('http')) return mediaPath;
    // If it's a relative path, prepend the media base URL from environment
    return `${environment.mediaBaseUrl}${mediaPath}`;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const userId = params.get('id');
      if (userId) {
        // Immediately determine ownership from route param and current user to avoid UI flash
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
        console.log('Profile API Response:', response);
        if (response && response.payload) {
          // Map the API response structure to match template expectations
          const userData = response.payload.user || response.payload;
          
          this.user = {
            id: userData.id,
            name: userData.name,
            username: userData.username,
            email: userData.email,
            bio: userData.bio,
            profileImage: userData.profilePictureUrl ? this.getFullMediaUrl(userData.profilePictureUrl) : null,
            // Map count fields to match template expectations
            postCount: userData.postsCount || 0,
            followers: userData.followersCount || 0,
            following: userData.followingCount || 0,
            listingsCount: userData.listingsCount || 0,
            isFollowing: userData.isFollowing || false
          };
          
          this.isFollowing = this.user.isFollowing;
          
          // Process posts if they exist in the response
          if (response.payload.posts && Array.isArray(response.payload.posts)) {
            this.user.posts = response.payload.posts.map((post: any) => ({
              ...post,
              // Process media URLs for posts if needed
              media: post.mediaUrls ? post.mediaUrls.map((url: string) => ({
                url: this.getFullMediaUrl(url),
                mediaType: 'image'
              })) : []
            }));
          }
          
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
        console.log('Follow response:', response); // Debug log
        if (response && response.payload && typeof response.payload.following === 'boolean') {
          const isNowFollowing = response.payload.following;
          
          // Update the UI state based on server response
          this.isFollowing = isNowFollowing;
          this.user.followers = isNowFollowing ? 
            (previousFollowerCount || 0) + 1 : 
            Math.max((previousFollowerCount || 1) - 1, 0);
          
          this.toastService.showToast(
            `Successfully ${isNowFollowing ? 'followed' : 'unfollowed'} ${this.user.username}`,
            'success'
          );
        } else {
          console.error('Unexpected response format:', response);
          // Revert to previous state if response format is unexpected
          this.isFollowing = previousState;
          this.user.followers = previousFollowerCount;
          this.toastService.showToast('Unexpected response from server', 'error');
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
          // Process media URLs for saved posts
          this.user.savedPosts = response.payload.map((post: any) => ({
            ...post,
            media: post.mediaUrls ? post.mediaUrls.map((url: string) => ({
              url: this.getFullMediaUrl(url),
              mediaType: 'image'
            })) : []
          }));
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
          // Process media URLs for liked posts
          this.user.likedPosts = response.payload.map((post: any) => ({
            ...post,
            media: post.mediaUrls ? post.mediaUrls.map((url: string) => ({
              url: this.getFullMediaUrl(url),
              mediaType: 'image'
            })) : []
          }));
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
    // Prevent messaging yourself
    if (userId === this.currentUser.id) {
      this.toastService.showToast('You cannot message yourself', 'info');
      return;
    }

    // Allow messaging without follow restrictions (like most modern social platforms)
    this.dataService.createConversation(userId).subscribe({
      next: (convResponse) => {
        if (convResponse && convResponse.payload) {
          // Navigate to inbox with the conversation ID
          this.router.navigate(['/inbox'], { 
            queryParams: { 
              tab: 'messages',
              conversationId: convResponse.payload.id
            }
          });
        } else {
          this.toastService.showToast('Failed to start conversation', 'error');
        }
      },
      error: (error) => {
        console.error('Error creating conversation:', error);
        this.toastService.showToast('Failed to start conversation', 'error');
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
    
    // In newer versions of ngx-image-cropper, the event provides base64 directly
    if (event.base64) {
      this.croppedImage = event.base64;
      console.log('Using base64 from event');
    } else if (event.objectUrl) {
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
      console.error('No image data found in cropping event:', event);
    }
  }

  // Save/crop the image
  saveProfilePic(): void {
    console.log('Save button clicked');
    console.log('Cropped image:', this.croppedImage);
    
    if (!this.croppedImage) {
      this.toastService.showToast('No image to save. Please select and crop an image first.', 'error');
      return;
    }
    
    this.uploadingProfilePic = true;
    
    // If the cropped image is a blob URL, fetch the blob and convert to base64
    if (this.croppedImage.startsWith('blob:')) {
      console.log('Converting blob URL to base64...');
      fetch(this.croppedImage)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            console.log('Blob converted to base64, uploading...');
            this.uploadProfileImageData(base64data);
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error('Error converting blob to base64:', error);
          this.uploadingProfilePic = false;
          this.toastService.showToast('Failed to process image. Please try again.', 'error');
        });
    } else if (this.croppedImage.startsWith('data:')) {
      // It's already base64, send it directly
      console.log('Image is already base64, uploading...');
      this.uploadProfileImageData(this.croppedImage);
    } else {
      console.error('Unknown image format:', this.croppedImage);
      this.uploadingProfilePic = false;
      this.toastService.showToast('Invalid image format. Please try again.', 'error');
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
        console.log('Profile update response:', response);
        if (response && response.payload && response.payload.profilePictureUrl) {
          // Get the full URL for the new profile picture
          const newImageUrl = this.getFullMediaUrl(response.payload.profilePictureUrl);
          
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
        } else {
          console.error('Invalid response structure:', response);
          this.toastService.showToast('Profile picture updated but response was unexpected', 'warning');
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
