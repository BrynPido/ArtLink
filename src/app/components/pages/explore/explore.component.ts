import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.css']
})
export class ExploreComponent implements OnInit {
  searchForm: FormGroup;
  userResults: any[] = [];
  postResults: any[] = [];
  suggestedUsers: any[] = [];
  trendingPosts: any[] = [];
  isLoading = false;
  isSuggestionsLoading = false;
  error: string | null = null;
  hasSearched = false;

  constructor(
    private fb: FormBuilder,
    private dataService: DataService,
    private router: Router
  ) {
    this.searchForm = this.fb.group({
      query: ['']
    });
  }

  ngOnInit(): void {
    this.loadSuggestions();
  }

  loadSuggestions(): void {
    this.isSuggestionsLoading = true;
    
    // Load suggested users and trending posts
    Promise.all([
      this.dataService.getSuggestedUsers().toPromise(),
      this.dataService.getTrendingPosts().toPromise()
    ]).then(([usersResponse, postsResponse]) => {
      // Process suggested users
      if (usersResponse?.payload) {
        this.suggestedUsers = usersResponse.payload.slice(0, 5).map((user: any) => ({
          ...user,
          profilePictureUrl: user.profilePictureUrl ? this.getFullMediaUrl(user.profilePictureUrl) : null,
          followersCount: user.followersCount || 0,
          postsCount: user.postsCount || 0
        }));
      }

      // Process trending posts
      if (postsResponse?.payload) {
        this.trendingPosts = postsResponse.payload.slice(0, 6).map((post: any) => ({
          ...post,
          mediaUrls: (post.mediaUrls || []).map((url: string) => this.getFullMediaUrl(url)),
          authorProfilePicture: post.authorProfilePicture ? this.getFullMediaUrl(post.authorProfilePicture) : null,
          likesCount: post.likesCount || 0,
          commentsCount: post.commentsCount || 0
        }));
      }
    }).catch((err) => {
      console.error('Error loading suggestions:', err);
      // Fallback to empty suggestions rather than showing error
      this.suggestedUsers = [];
      this.trendingPosts = [];
    }).finally(() => {
      this.isSuggestionsLoading = false;
    });
  }

  onSearch(): void {
    const query = this.searchForm.value.query?.trim();
    if (!query) return;

    this.isLoading = true;
    this.error = null;
    this.hasSearched = true;
    this.userResults = [];
    this.postResults = [];

    this.dataService.search(query).subscribe({
      next: (response) => {
        // Process users
        if (response.payload?.users) {
          this.userResults = response.payload.users.map((user: any) => ({
            ...user,
            type: 'user',
            profilePictureUrl: user.profilePictureUrl ? this.getFullMediaUrl(user.profilePictureUrl) : null,
            followersCount: user.followersCount || 0,
            postsCount: user.postsCount || 0
          }));
        }

        // Process posts  
        if (response.payload?.posts) {
          this.postResults = response.payload.posts.map((post: any) => ({
            ...post,
            type: 'post',
            mediaUrls: (post.mediaUrls || []).map((url: string) => this.getFullMediaUrl(url)),
            likesCount: post.likesCount || 0,
            commentsCount: post.commentsCount || 0
          }));
        }
      },
      error: (err) => {
        this.error = 'Failed to perform search. Please check your connection and try again.';
        console.error('Search error:', err);
        this.userResults = [];
        this.postResults = [];
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  getFullMediaUrl(mediaPath: string): string {
    if (!mediaPath) return '';
    if (mediaPath.startsWith('http')) return mediaPath;
    
    // Remove leading slash if present to avoid double slashes
    const cleanPath = mediaPath.startsWith('/') ? mediaPath.substring(1) : mediaPath;
    return `http://localhost:3000/${cleanPath}`;
  }

  navigateToProfile(userId: number): void {
    this.router.navigate(['/profile', userId]);
  }

  navigateToPost(postId: number): void {
    this.router.navigate(['/post', postId]);
  }

  getSuggestionReasonText(user: any): string {
    if (user.suggestionType === 'friends_of_friends' && user.mutualFriendsNames) {
      const mutualFriends = user.mutualFriendsNames.split(',').slice(0, 2);
      let text = `Followed by ${mutualFriends.join(', ')}`;
      if (user.mutualConnectionsCount > 2) {
        text += ` +${user.mutualConnectionsCount - 2} more`;
      }
      return text;
    }
    return 'Popular creator';
  }
}
