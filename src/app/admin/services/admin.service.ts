import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  totalListings: number;
  totalMessages: number;
  activeUsers: number;
  recentActivity: any[];
}

export interface UserManagement {
  id: number;
  name: string;
  username: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  lastLogin: string;
  postsCount: number;
  followersCount: number;
  profileImage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Dashboard Statistics
  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/dashboard/stats`).pipe(
      catchError(this.handleError)
    );
  }

  getRecentActivity(): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/dashboard/activity`).pipe(
      catchError(this.handleError)
    );
  }

  // User Management
  getAllUsers(page: number = 1, limit: number = 20, search?: string): Observable<any> {
    let url = `${this.apiUrl}admin/users?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    return this.http.get(url).pipe(
      catchError(this.handleError)
    );
  }

  getUserById(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/users/${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  updateUser(userId: number, userData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}admin/users/${userId}`, userData).pipe(
      catchError(this.handleError)
    );
  }

  suspendUser(userId: number, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/users/${userId}/suspend`, { reason }).pipe(
      catchError(this.handleError)
    );
  }

  unsuspendUser(userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/users/${userId}/unsuspend`, {}).pipe(
      catchError(this.handleError)
    );
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}admin/users/${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Post Management
  getAllPosts(page: number = 1, limit: number = 20, filter?: string): Observable<any> {
    let url = `${this.apiUrl}admin/posts?page=${page}&limit=${limit}`;
    if (filter) {
      url += `&filter=${filter}`;
    }
    return this.http.get(url).pipe(
      catchError(this.handleError)
    );
  }

  getPostById(postId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/posts/${postId}`).pipe(
      catchError(this.handleError)
    );
  }

  deletePost(postId: number, reason: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}admin/posts/${postId}`, { 
      body: { reason } 
    }).pipe(
      catchError(this.handleError)
    );
  }

  hidePost(postId: number, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/posts/${postId}/hide`, { reason }).pipe(
      catchError(this.handleError)
    );
  }

  unhidePost(postId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/posts/${postId}/unhide`, {}).pipe(
      catchError(this.handleError)
    );
  }

  // Listing Management
  getAllListings(page: number = 1, limit: number = 20, filter?: string): Observable<any> {
    let url = `${this.apiUrl}admin/listings?page=${page}&limit=${limit}`;
    if (filter) {
      url += `&filter=${filter}`;
    }
    return this.http.get(url).pipe(
      catchError(this.handleError)
    );
  }

  getListingById(listingId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/listings/${listingId}`).pipe(
      catchError(this.handleError)
    );
  }

  deleteListing(listingId: number, reason: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}admin/listings/${listingId}`, { 
      body: { reason } 
    }).pipe(
      catchError(this.handleError)
    );
  }

  approveListing(listingId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/listings/${listingId}/approve`, {}).pipe(
      catchError(this.handleError)
    );
  }

  flagListing(listingId: number, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/listings/${listingId}/flag`, { reason }).pipe(
      catchError(this.handleError)
    );
  }

  bulkListingAction(action: string, listingIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/listings/bulk-${action}`, { 
      listingIds 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Message Management
  getAllMessages(page: number = 1, limit: number = 20): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/messages?page=${page}&limit=${limit}`).pipe(
      catchError(this.handleError)
    );
  }

  deleteMessage(messageId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}admin/messages/${messageId}`).pipe(
      catchError(this.handleError)
    );
  }

  getAllConversations(page: number = 1, limit: number = 20): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/conversations?page=${page}&limit=${limit}`).pipe(
      catchError(this.handleError)
    );
  }

  getConversationMessages(conversationId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/conversations/${conversationId}/messages`).pipe(
      catchError(this.handleError)
    );
  }

  // Reports and Analytics
  getReports(dateRange?: { start: string; end: string }): Observable<any> {
    let url = `${this.apiUrl}admin/reports`;
    if (dateRange) {
      url += `?start=${dateRange.start}&end=${dateRange.end}`;
    }
    return this.http.get(url).pipe(
      catchError(this.handleError)
    );
  }

  getUserGrowthStats(period: string = '30days'): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/reports/users?period=${period}`).pipe(
      catchError(this.handleError)
    );
  }

  getContentStats(period: string = '30days'): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/reports/content?period=${period}`).pipe(
      catchError(this.handleError)
    );
  }

  // Notifications
  getAdminNotifications(): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/notifications`).pipe(
      catchError(this.handleError)
    );
  }

  markNotificationAsRead(notificationId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}admin/notifications/${notificationId}/read`, {}).pipe(
      catchError(this.handleError)
    );
  }

  // System Settings
  getSystemSettings(): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/settings`).pipe(
      catchError(this.handleError)
    );
  }

  updateSystemSettings(settings: any): Observable<any> {
    return this.http.put(`${this.apiUrl}admin/settings`, settings).pipe(
      catchError(this.handleError)
    );
  }

  // Bulk Operations
  bulkDeletePosts(postIds: number[], reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/posts/bulk-delete`, { 
      postIds, 
      reason 
    }).pipe(
      catchError(this.handleError)
    );
  }

  bulkSuspendUsers(userIds: number[], reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/users/bulk-suspend`, { 
      userIds, 
      reason 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Search functionality
  globalSearch(query: string, type?: string): Observable<any> {
    let url = `${this.apiUrl}admin/search?q=${encodeURIComponent(query)}`;
    if (type) {
      url += `&type=${type}`;
    }
    return this.http.get(url).pipe(
      catchError(this.handleError)
    );
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

  private handleError(error: any): Observable<never> {
    console.error('Admin service error:', error);
    throw error;
  }
}
