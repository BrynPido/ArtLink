import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, Observable, of, tap, map, BehaviorSubject, forkJoin } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  // Old PHP API URLs
  // private apiUrl = 'http://localhost/artlink/artlink_api/api/';
  // private apiUrl = 'https://api.art-link.site/routes.php?request=';
  private apiUrl = environment.apiUrl;

  private currentUserSubject = new BehaviorSubject<any>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      // Normalize user data structure for consistent access
      const normalizedUser = {
        ...user,
        profileImage: user.profilePictureUrl || user.profileImage
      };
      this.currentUserSubject.next(normalizedUser);
    }
  }

  // Method for login with error handling and saving JWT token
  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}auth/login`, credentials).pipe(
      tap((response: any) => {
        if (response && response.payload) {
          const { token, user } = response.payload;
          if (token) {
            // Store the JWT token in localStorage
            localStorage.setItem('token', token);
          }
          if (user) {
            // Normalize user data structure for consistent access
            const normalizedUser = {
              ...user,
              profileImage: user.profilePictureUrl || user.profileImage
            };
            // Use updateCurrentUser instead of direct localStorage
            this.updateCurrentUser(normalizedUser);
          }
          this.router.navigate(['/home']); // Redirect to home on success
        }
      }),
      catchError(this.handleError)
    );
  }

  // Method for registration with error handling
  register(data: {
    name: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}auth/register`, data).pipe(
      catchError(this.handleError)
    );
  }

  // OTP verification methods
  verifyOTP(email: string, otpCode: string, purpose: string = 'registration'): Observable<any> {
    const data = { email, otpCode, purpose };
    return this.http.post(`${this.apiUrl}auth/verify-otp`, data).pipe(
      tap((response: any) => {
        // If verification successful and includes token, store it
        if (response && response.payload && response.payload.token) {
          const { token, user } = response.payload;
          localStorage.setItem('token', token);
          if (user) {
            const normalizedUser = {
              ...user,
              profileImage: user.profilePictureUrl || user.profileImage
            };
            this.updateCurrentUser(normalizedUser);
          }
        }
      }),
      catchError(this.handleError)
    );
  }

  resendOTP(email: string, purpose: string = 'registration'): Observable<any> {
    const data = { email, purpose };
    return this.http.post(`${this.apiUrl}auth/resend-otp`, data).pipe(
      catchError(this.handleError)
    );
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  updateCurrentUser(userData: any): void {
    localStorage.setItem('currentUser', JSON.stringify(userData));
    this.currentUserSubject.next(userData);
  }

  createPost(postData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}posts/createPost`, postData).pipe(
      catchError(this.handleError)
    );
  }

  // Fetch posts from the backend
  getPosts(): Observable<any> {
    return this.http.get(`${this.apiUrl}posts/getPosts`).pipe(
      catchError(this.handleError)
    );
  }

  likePost(postId: number, userId: number): Observable<any> {
    const data = { postId, userId };
    return this.http.post(`${this.apiUrl}posts/likePost`, data).pipe(
      catchError(this.handleError)
    );
  }

  savePost(postId: number, userId: number): Observable<any> {
    const data = { postId, userId };
    return this.http.post(`${this.apiUrl}posts/savePost`, data).pipe(
      catchError(this.handleError)
    );
  }

  deletePost(postId: number, userId: number): Observable<any> {
    const data = { postId, userId };
    return this.http.post(`${this.apiUrl}posts/deletePost`, data).pipe(
      catchError(this.handleError)
    );
  }

  getSavedPosts(): Observable<any> {
    return this.http.get(`${this.apiUrl}posts/getSavedPosts`).pipe(
      catchError(this.handleError)
    );
  }

  getLikedPosts(): Observable<any> {
    return this.http.get(`${this.apiUrl}posts/getLikedPosts`).pipe(
      catchError(this.handleError)
    );
  }

  search(query: string): Observable<any> {
    const postsSearch = this.http.get(`${this.apiUrl}posts/search?query=${encodeURIComponent(query)}`);
    const usersSearch = this.http.get(`${this.apiUrl}users/search?query=${encodeURIComponent(query)}`);

    return forkJoin({
      posts: postsSearch,
      users: usersSearch
    }).pipe(
      map((results: any) => ({
        status: 'success',
        payload: {
          posts: results.posts?.payload || [],
          users: results.users?.payload || []
        }
      })),
      catchError(error => {
        console.error('Search error:', error);
        // If one fails, still return the other if possible
        return of({
          status: 'error',
          payload: {
            posts: [],
            users: []
          },
          message: 'Search failed'
        });
      })
    );
  }

  // Separate methods for individual search types
  searchUsers(query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}users/search?query=${encodeURIComponent(query)}`);
  }

  searchPosts(query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}posts/search?query=${encodeURIComponent(query)}`);
  }

  // Get suggested users for explore page
  getSuggestedUsers(): Observable<any> {
    return this.http.get(`${this.apiUrl}users/suggested`).pipe(
      catchError(error => {
        console.error('Error fetching suggested users:', error);
        // Return a fallback response with empty payload
        return of({
          status: 'success',
          payload: []
        });
      })
    );
  }

  // Get trending posts for explore page
  getTrendingPosts(): Observable<any> {
    return this.http.get(`${this.apiUrl}posts/trending`).pipe(
      catchError(error => {
        console.error('Error fetching trending posts:', error);
        // Return a fallback response with empty payload
        return of({
          status: 'success',
          payload: []
        });
      })
    );
  }

  // Consolidated method to fetch user profile by ID
  getUserProfile(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}users/user/${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Get post details
  getPost(postId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}posts/post/${postId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Get post by ID
  getPostById(postId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}posts/post/${postId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Add comment to a post
  addComment(postId: number, content: string, parentId?: number): Observable<any> {
    const data = {
      content,
      postId: Number(postId), // Ensure postId is a number
      ...(parentId && { parentId: Number(parentId) }) // Only include parentId if it exists
    };
    return this.http.post(`${this.apiUrl}posts/addComment`, data, {
      responseType: 'json'
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Like/unlike a comment
  likeComment(commentId: number): Observable<any> {
    const data = {
      commentId,
      userId: this.getCurrentUser().id
    };
    return this.http.post(`${this.apiUrl}posts/likeComment`, data).pipe(
      catchError(this.handleError)
    );
  }

  // Delete a comment
  deleteComment(commentId: number): Observable<any> {
    const data = {
      commentId,
      userId: this.getCurrentUser().id
    };
    return this.http.post(`${this.apiUrl}posts/deleteComment`, data).pipe(
      catchError(this.handleError)
    );
  }

  // Toggle follow user
  toggleFollow(followingId: number): Observable<any> {
    const data = {
      followingId: followingId
    };
    return this.http.post(`${this.apiUrl}users/toggleFollow`, data).pipe(
      catchError(this.handleError)
    );
  }

  // Check follow status - followerId is the user doing the following, userId is being followed
  isFollowing(userId: number, followerId?: number): Observable<{ status: any, payload: { following: boolean } }> {
    const currentUser = this.getCurrentUser()?.id;
    // If followerId is provided, use it to check if that user is following userId
    // Otherwise check if current user is following userId
    const follower = followerId || currentUser;
    return this.http.get<{ status: any, payload: { following: boolean } }>(
      `${this.apiUrl}users/following/${userId}${follower ? `?userId=${follower}` : ''}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Toggle follow/unfollow
  toggleFollowStatus(userId: number): Observable<{ following: boolean }> {
    return this.http.post<{ following: boolean }>(`${this.apiUrl}users/follow`, { userId }).pipe(
      catchError(this.handleError)
    );
  }

  // Get notifications
  getNotifications(userId: number): Observable<any> {
    if (!userId) {
      return throwError(() => new Error('User ID is required'));
    }
    return this.http.get(`${this.apiUrl}notifications/getNotifications?userId=${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Mark notification as read
  markNotificationAsRead(notificationId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}notifications/${notificationId}/read`, {
      userId: this.getCurrentUser()?.id
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Delete notification
  deleteNotification(notificationId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}notifications/${notificationId}/delete`, {
      userId: this.getCurrentUser()?.id
    }).pipe(
      catchError(this.handleError)
    );
  }

  getUnreadMessagesCount(): Observable<number> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return of(0);
    }

    return this.http.get<any>(`${this.apiUrl}messages/unread-count/${currentUser.id}`).pipe(
      map(response => response.payload?.count || 0),
      catchError(error => {
        console.error('Error getting unread messages count:', error);
        return of(0);
      })
    );
  }

  // Get all conversations for the current user
  getConversations(): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('User is not logged in'));
    }
    
    return this.http.get(`${this.apiUrl}messages/conversations/${currentUser.id}`).pipe(
      catchError(this.handleError)
    );
  }

  // Get messages for a specific conversation
  getConversationMessages(conversationId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}messages/conversations/${conversationId}/messages`).pipe(
      catchError(this.handleError)
    );
  }

  // Create a new conversation with another user
  createConversation(userId: number, listingId?: number): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('User is not logged in'));
    }
    
    const payload: any = {
      user1Id: currentUser.id,
      recipientId: userId
    };
    
    // Include listingId if provided
    if (listingId) {
      payload.listingId = listingId;
    }
    
    return this.http.post(`${this.apiUrl}messages/conversations/create`, payload).pipe(
      catchError(this.handleError)
    );
  }

  // Mark all messages in a conversation as read
  markConversationAsRead(conversationId: number): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('User is not logged in'));
    }
    
    const data = {
      userId: currentUser.id,
      conversationId: conversationId
    };
    
    return this.http.post(`${this.apiUrl}messages/conversations/${conversationId}/read`, data).pipe(
      catchError(this.handleError)
    );
  }

  // Send a message (this is a fallback for when WebSocket is not available)
  sendMessage(receiverId: number, content: string, conversationId?: number): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('User is not logged in'));
    }
    
    const data = {
      senderId: currentUser.id,
      receiverId: receiverId,
      content: content,
      conversationId: conversationId // Add this parameter
    };
    
    return this.http.post(`${this.apiUrl}messages/send`, data).pipe(
      catchError(this.handleError)
    );
  }

  // Delete a conversation
  deleteConversation(conversationId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}messages/conversations/${conversationId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Delete a message
  deleteMessage(messageId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}messages/${messageId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Fetch the list of users the current user is following
  getFollowingUsers(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}users/${userId}/following`).pipe(
      catchError(this.handleError)
    );
  }

  // Create a new listing
  createListing(listingData: any): Observable<any> {
    const formData = new FormData();
    
    // Add basic fields
    formData.append('title', listingData.title);
    formData.append('content', listingData.content || '');
    
    // Add listing details as JSON string
    formData.append('listingDetails', JSON.stringify(listingData.listingDetails));
    
    // Add media files - convert base64 back to files if needed
    if (listingData.media && Array.isArray(listingData.media)) {
      listingData.media.forEach((mediaItem: any, index: number) => {
        if (mediaItem.url && mediaItem.url.startsWith('data:')) {
          // Convert base64 back to file
          const base64Data = mediaItem.url.split(',')[1];
          const mimeType = mediaItem.url.split(';')[0].split(':')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const file = new File([byteArray], `media-${index}.jpg`, { type: mimeType });
          formData.append('media', file);
        }
      });
    }
    
    return this.http.post(`${this.apiUrl}listings/create`, formData).pipe(
      catchError(this.handleError)
    );
  }

  // Get all listings
  getListings(): Observable<any> {
    return this.http.get(`${this.apiUrl}listings`).pipe(
      catchError(this.handleError)
    );
  }

  // Get current user's listings
  getMyListings(): Observable<any> {
    return this.http.get(`${this.apiUrl}listings?myListings=true`).pipe(
      catchError(this.handleError)
    );
  }

  // Get a specific listing by ID
  getListingById(listingId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}listings/${listingId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Get listings for a specific user
  getUserListings(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}listings/user/${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Delete a listing
  deleteListing(listingId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}listings/${listingId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Update an existing listing
  updateListing(listingId: string, listingData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}listings/${listingId}/update`, listingData).pipe(
      catchError(this.handleError)
    );
  }

  // Profile Update
  updateProfile(profileData: {userId: number, imageData: string}): Observable<any> {
    return this.http.post(`${this.apiUrl}users/updateProfile`, profileData).pipe(
      catchError(this.handleError) 
    );
  }

  // Bio Update
  updateBio(bioData: {userId: number, bio: string}): Observable<any> {
    return this.http.post(`${this.apiUrl}users/updateBio`, bioData).pipe(
      catchError(this.handleError)
    );
  }

  // Centralized error handling method
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      console.error('Server error details:', error);
      
      // Check for authentication errors (401/403)
      if (error.status === 401 || error.status === 403) {
        // Check if it's a token-related error
        const errorBody = error.error;
        if (errorBody && typeof errorBody === 'object' && 
            (errorBody.message?.includes('token') || errorBody.message?.includes('expired') || errorBody.message?.includes('Invalid'))) {
          console.log('Token expired or invalid, logging out user');
          this.logout(); // This will clear tokens and redirect to login
          errorMessage = 'Your session has expired. Please log in again.';
        } else {
          errorMessage = 'Access denied. Please log in.';
        }
      }
      // If the server returned a JSON error response
      else if (error.error && typeof error.error === 'object') {
        errorMessage = error.error.message || `Server Error: ${error.status}`;
      } else {
        errorMessage = `Server Error: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    console.error('Error details:', {
      status: error.status,
      statusText: error.statusText,
      error: error.error,
      message: errorMessage
    });
    
    return throwError(() => error.error || new Error(errorMessage));
  }

  // Check if the user is logged in by verifying the JWT token
  isLoggedIn(): Observable<boolean> {
    const token = localStorage.getItem('token');
    if (!token) {
      return of(false);
    }

    // Check if token is expired (basic client-side check)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Date.now() / 1000;
      
      // Check if token expires within the next 5 minutes (300 seconds)
      const timeUntilExpiry = payload.exp - now;
      
      if (payload.exp && payload.exp < now) {
        console.log('Token expired, clearing storage');
        this.logout();
        return of(false);
      }
      
      // If token expires within 5 minutes, try to refresh it
      if (timeUntilExpiry < 300 && timeUntilExpiry > 0) {
        console.log('Token expiring soon, attempting refresh');
        this.refreshToken().subscribe({
          next: () => console.log('Token refreshed successfully'),
          error: (error) => {
            console.error('Token refresh failed:', error);
            this.logout();
          }
        });
      }
      
      return of(true);
    } catch (error) {
      console.error('Invalid token format, clearing storage');
      this.logout();
      return of(false);
    }
  }

  // Add token refresh method
  private refreshToken(): Observable<any> {
    return this.http.get(`${this.apiUrl}auth/verify`).pipe(
      tap((response: any) => {
        if (response && response.payload && response.payload.token) {
          localStorage.setItem('token', response.payload.token);
        }
      }),
      catchError((error) => {
        console.error('Token refresh failed:', error);
        this.logout();
        return throwError(() => error);
      })
    );
  }

  // Check if current user has valid authentication
  hasValidAuth(): boolean {
    const token = localStorage.getItem('token');
    const user = this.getCurrentUser();
    
    if (!token || !user) {
      return false;
    }

    // Basic token expiration check
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Date.now() / 1000;
      return payload.exp && payload.exp > now;
    } catch (error) {
      return false;
    }
  }

  // Helper method to construct full image URLs
  getFullImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) {
      return '/assets/images/default-avatar.svg';
    }
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // If it starts with /, it's a relative path from the server root
    if (imagePath.startsWith('/')) {
      return `${environment.mediaBaseUrl}${imagePath}`;
    }
    
    // Otherwise, assume it's a relative path that needs /uploads/ prefix
    return `${environment.mediaBaseUrl}/uploads/${imagePath}`;
  }

  // Logout method
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  // Report a post
  reportPost(postId: number, reason: string, description?: string): Observable<any> {
    const data = { postId, reason, description };
    return this.http.post(`${this.apiUrl}posts/reportPost`, data).pipe(
      catchError(this.handleError)
    );
  }

  // Check if current user has reported a specific post
  checkPostReport(postId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}posts/checkReport/${postId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Admin: Get all reports
  getReports(status?: string, page: number = 1, limit: number = 20): Observable<any> {
    let params = `?page=${page}&limit=${limit}`;
    if (status && status !== 'all') {
      params += `&status=${status}`;
    }
    return this.http.get(`${this.apiUrl}admin/reports/list${params}`).pipe(
      catchError(this.handleError)
    );
  }

  // Admin: Update report status
  updateReportStatus(reportId: number, status: string, adminNote?: string): Observable<any> {
    const data = { status, adminNote };
    return this.http.patch(`${this.apiUrl}admin/reports/${reportId}/status`, data).pipe(
      catchError(this.handleError)
    );
  }

  // Admin: Delete a report
  deleteReport(reportId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}admin/reports/${reportId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Admin: Get report statistics
  getReportStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/reports/stats`).pipe(
      catchError(this.handleError)
    );
  }

  // Listing Transaction Management
  markListingAsSold(listingId: number, buyerId: number, conversationId: number, finalPrice?: number): Observable<any> {
    const data = { 
      listingId, 
      buyerId, 
      conversationId, 
      finalPrice,
      status: 'sold' 
    };
    return this.http.post(`${this.apiUrl}listings/${listingId}/mark-sold`, data).pipe(
      catchError(this.handleError)
    );
  }

  reserveListing(listingId: number): Observable<any> {
    const data = { status: 'reserved' };
    return this.http.patch(`${this.apiUrl}listings/${listingId}/status`, data).pipe(
      catchError(this.handleError)
    );
  }

  markListingAsAvailable(listingId: number): Observable<any> {
    const data = { status: 'available' };
    return this.http.patch(`${this.apiUrl}listings/${listingId}/status`, data).pipe(
      catchError(this.handleError)
    );
  }

  // Get seller transactions
  getSellerTransactions(sellerId?: number): Observable<any> {
    const params = sellerId ? `?sellerId=${sellerId}` : '';
    return this.http.get(`${this.apiUrl}transactions${params}`).pipe(
      catchError(this.handleError)
    );
  }

  // Get buyer transactions  
  getBuyerTransactions(buyerId?: number): Observable<any> {
    const params = buyerId ? `?buyerId=${buyerId}` : '';
    return this.http.get(`${this.apiUrl}transactions${params}`).pipe(
      catchError(this.handleError)
    );
  }

}
