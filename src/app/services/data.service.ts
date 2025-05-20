import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, Observable, of, tap, map, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  // private apiUrl = 'http://localhost/artlink/artlink_api/api/';
  private apiUrl = 'https://api.art-link.site/routes.php?request=';

  private currentUserSubject = new BehaviorSubject<any>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  // Method for login with error handling and saving JWT token
  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}login`, credentials).pipe(
      tap((response: any) => {
        if (response && response.payload) {
          const { token, user } = response.payload;
          if (token) {
            // Store the JWT token in localStorage
            localStorage.setItem('token', token);
          }
          if (user) {
            // Use updateCurrentUser instead of direct localStorage
            this.updateCurrentUser(user);
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
    return this.http.post(`${this.apiUrl}register`, data).pipe(
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
    return this.http.post(`${this.apiUrl}createPost`, postData).pipe(
      catchError(this.handleError)
    );
  }

  // Fetch posts from the backend
  getPosts(): Observable<any> {
    const currentUser = this.getCurrentUser();
    const userId = currentUser ? currentUser.id : null;
    return this.http.get(`${this.apiUrl}getPosts?userId=${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  likePost(postId: number, userId: number): Observable<any> {
    const data = { postId, userId };
    return this.http.post(`${this.apiUrl}likePost`, data).pipe(
      catchError(this.handleError)
    );
  }

  savePost(postId: number, userId: number): Observable<any> {
    const data = { postId, userId };
    return this.http.post(`${this.apiUrl}savePost`, data).pipe(
      catchError(this.handleError)
    );
  }

  deletePost(postId: number, userId: number): Observable<any> {
    const data = { postId, userId };
    return this.http.post(`${this.apiUrl}deletePost`, data).pipe(
      catchError(this.handleError)
    );
  }

  getSavedPosts(): Observable<any> {
    const currentUser = this.getCurrentUser();
    const userId = currentUser ? currentUser.id : null; // Get user ID from local storage
    return this.http.get(`${this.apiUrl}getSavedPosts?userId=${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  getLikedPosts(): Observable<any> {
    const currentUser = this.getCurrentUser();
    const userId = currentUser ? currentUser.id : null; // Get user ID from local storage
    return this.http.get(`${this.apiUrl}getLikedPosts?userId=${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  search(query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}search?query=${encodeURIComponent(query)}`).pipe(
      catchError(this.handleError)
    );
  }

  // Consolidated method to fetch user profile by ID
  getUserProfile(userId: string): Observable<any> {
    const currentUser = this.getCurrentUser();
    const currentUserId = currentUser ? currentUser.id : null;
    return this.http.get(`${this.apiUrl}user/${userId}?userId=${currentUserId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Get post details
  getPost(postId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}post/${postId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Get post by ID
  getPostById(postId: string): Observable<any> {
    const currentUser = this.getCurrentUser();
    const userId = currentUser ? currentUser.id : null;
    return this.http.get(`${this.apiUrl}post/${postId}?userId=${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Add comment to a post
  addComment(postId: number, content: string, parentId?: number): Observable<any> {
    const data = {
      content,
      postId,
      authorId: this.getCurrentUser().id,
      parentId
    };
    return this.http.post(`${this.apiUrl}addComment`, data, {
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
    return this.http.post(`${this.apiUrl}likeComment`, data).pipe(
      catchError(this.handleError)
    );
  }

  // Delete a comment
  deleteComment(commentId: number): Observable<any> {
    const data = {
      commentId,
      userId: this.getCurrentUser().id
    };
    return this.http.post(`${this.apiUrl}deleteComment`, data).pipe(
      catchError(this.handleError)
    );
  }

  // Toggle follow user
  toggleFollow(followingId: number): Observable<any> {
    const currentUser = this.getCurrentUser();
    const data = {
      userId: currentUser.id,
      followingId: followingId
    };
    return this.http.post(`${this.apiUrl}toggleFollow`, data).pipe(
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
      `${this.apiUrl}following/${userId}?userId=${follower}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Toggle follow/unfollow
  toggleFollowStatus(userId: number): Observable<{ following: boolean }> {
    return this.http.post<{ following: boolean }>(`${this.apiUrl}follow`, { userId }).pipe(
      catchError(this.handleError)
    );
  }

  // Get notifications
  getNotifications(userId: number): Observable<any> {
    if (!userId) {
      return throwError(() => new Error('User ID is required'));
    }
    return this.http.get(`${this.apiUrl}getNotifications?userId=${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Mark notification as read
  markNotificationAsRead(notificationId: number): Observable<any> {
    const cleanUrl = `${this.apiUrl}notifications/${notificationId}/read`.replace(/([^:]\/)\/+/g, "$1");
    return this.http.post(cleanUrl, {
      userId: this.getCurrentUser()?.id
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Delete notification
  deleteNotification(notificationId: number): Observable<any> {
    const cleanUrl = `${this.apiUrl}notifications/${notificationId}/delete`.replace(/([^:]\/)\/+/g, "$1");
    return this.http.post(cleanUrl, {
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
    
    return this.http.get(`${this.apiUrl}conversations/${currentUser.id}`).pipe(
      catchError(this.handleError)
    );
  }

  // Get messages for a specific conversation
  getConversationMessages(conversationId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}conversations/${conversationId}/messages`).pipe(
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
    
    return this.http.post(`${this.apiUrl}conversations/create`, payload).pipe(
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
    
    return this.http.post(`${this.apiUrl}conversations/${conversationId}/read`, data).pipe(
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
    return this.http.delete(`${this.apiUrl}conversations/${conversationId}`).pipe(
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
    return this.http.post(`${this.apiUrl}listings/create`, listingData).pipe(
      catchError(this.handleError)
    );
  }

  // Get all listings
  getListings(): Observable<any> {
    return this.http.get(`${this.apiUrl}listings`).pipe(
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
    return this.http.post(`${this.apiUrl}updateProfile`, profileData).pipe(
    catchError(this.handleError) 
    );
  }

  // Bio Update
  updateBio(bioData: {userId: number, bio: string}): Observable<any> {
    return this.http.post(`${this.apiUrl}updateBio`, bioData).pipe(
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
      errorMessage = `Server Error: ${error.status}\nMessage: ${error.message}`;
    }
    return throwError(() => new Error(errorMessage));
  }

  // Check if the user is logged in by verifying the JWT token
  isLoggedIn(): Observable<boolean> {
    const token = localStorage.getItem('token'); // Assume token is stored in localStorage
    return of(!!token); // Return true if token exists, false otherwise
  }

  // Logout method
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

}
