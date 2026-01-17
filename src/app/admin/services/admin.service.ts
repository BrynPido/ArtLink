import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  pendingPosts: number;
  totalListings: number;
  totalMessages: number;
  activeUsers: number;
  totalTransactions?: number;
  totalRevenue?: number;
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
  // Simple in-memory cache for read-heavy admin endpoints
  private cache = new Map<string, { expiry: number; obs: Observable<any> }>();

  constructor(private http: HttpClient) {}

  private getWithCache(url: string, ttlMs: number = 10000): Observable<any> {
    const now = Date.now();
    const cached = this.cache.get(url);
    if (cached && cached.expiry > now) {
      return cached.obs;
    }
    const request$ = this.http.get(url).pipe(
      shareReplay(1),
      tap({
        error: () => {
          // Evict failed responses so subsequent attempts can retry
          this.cache.delete(url);
        }
      }),
      catchError(this.handleError)
    );
    this.cache.set(url, { expiry: now + ttlMs, obs: request$ });
    return request$;
  }

  // Dashboard Statistics
  getDashboardStats(): Observable<any> {
    return this.getWithCache(`${this.apiUrl}admin/dashboard/stats`, 15000);
  }

  getRecentActivity(): Observable<any> {
    return this.getWithCache(`${this.apiUrl}admin/dashboard/activity`, 15000);
  }

  getSalesStats(period: string = '30days'): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/dashboard/sales-stats?period=${period}`).pipe(
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

  deleteUser(userId: number, reason: string = 'User deleted by admin'): Observable<any> {
    return this.http.delete(`${this.apiUrl}admin/users/${userId}`, { 
      body: { reason } 
    }).pipe(
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

  approvePost(postId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/posts/review/${postId}/approve`, {}).pipe(
      catchError(this.handleError)
    );
  }

  declinePost(postId: number, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/posts/review/${postId}/decline`, { reason }).pipe(
      catchError(this.handleError)
    );
  }

  getPendingPosts(page: number = 1, limit: number = 20): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/posts/pending?page=${page}&limit=${limit}`).pipe(
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

  deleteMessage(messageId: number, reason: string = 'Message deleted by admin'): Observable<any> {
    return this.http.delete(`${this.apiUrl}admin/messages/${messageId}`, { 
      body: { reason } 
    }).pipe(
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
    let url = `${this.apiUrl}admin/reports/overview`;
    if (dateRange) {
      url += `?start=${dateRange.start}&end=${dateRange.end}`;
    }
    return this.getWithCache(url, 15000);
  }

  getUserGrowthStats(period: string = '30days'): Observable<any> {
    return this.getWithCache(`${this.apiUrl}admin/reports/users?period=${period}`, 60000);
  }

  getContentStats(period: string = '30days'): Observable<any> {
    return this.getWithCache(`${this.apiUrl}admin/reports/content?period=${period}`, 60000);
  }

  // Notifications
  getAdminNotifications(): Observable<any> {
    return this.getWithCache(`${this.apiUrl}admin/notifications`, 10000);
  }

  markNotificationAsRead(notificationId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}admin/notifications/${notificationId}/read`, {}).pipe(
      catchError(this.handleError)
    );
  }

  // System Settings
  getSystemSettings(): Observable<any> {
    return this.getWithCache(`${this.apiUrl}admin/settings`, 60000);
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

  // === SOFT DELETE FUNCTIONALITY ===

  // Restore deleted record
  restoreRecord(table: string, id: number, reason?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/${table}/${id}/restore`, { reason }).pipe(
      catchError(this.handleError)
    );
  }

  // Get deleted records for a table
  getDeletedRecords(table: string, page: number = 1, limit: number = 20): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/${table}/deleted?page=${page}&limit=${limit}`).pipe(
      catchError(this.handleError)
    );
  }

  // Permanently delete a record (bypass soft delete)
  permanentlyDeleteRecord(table: string, id: number, reason: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}admin/${table}/${id}/permanent`, { 
      body: { reason, confirmPermanent: true } 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Get admin action logs
  getAdminActionLogs(page: number = 1, limit: number = 50, table?: string, action?: string): Observable<any> {
    let url = `${this.apiUrl}admin/actions/logs?page=${page}&limit=${limit}`;
    if (table) url += `&table=${table}`;
    if (action) url += `&action=${action}`;
    
    return this.http.get(url).pipe(
      catchError(this.handleError)
    );
  }

  // === ARCHIVE CLEANUP FUNCTIONALITY ===

  // Get archive cleanup statistics
  getArchiveStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/archive/stats`).pipe(
      catchError(this.handleError)
    );
  }

  // === MESSAGE REPORTS (Admin) ===
  getMessageReports(status: string = 'all', page: number = 1, limit: number = 20): Observable<any> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return this.http.get(`${this.apiUrl}admin/message-reports/list?${params.toString()}`).pipe(
      catchError(this.handleError)
    );
  }

  updateMessageReportStatus(reportId: number, status: 'pending' | 'actioned' | 'dismissed', adminNote?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}admin/message-reports/${reportId}/status`, { status, adminNote }).pipe(
      catchError(this.handleError)
    );
  }

  deleteMessageReport(reportId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}admin/message-reports/${reportId}`).pipe(
      catchError(this.handleError)
    );
  }

  getMessageReportStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/message-reports/stats`).pipe(
      catchError(this.handleError)
    );
  }

  // Spam detection (privacy-safe: only flagged messages)
  getSpamDetectedMessages(page: number = 1, limit: number = 50): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/message-reports/spam-detection?page=${page}&limit=${limit}`).pipe(
      catchError(this.handleError)
    );
  }

  // Single report details (only the specific message, not whole conversation)
  getMessageReportDetails(reportId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/message-reports/${reportId}/details`).pipe(
      catchError(this.handleError)
    );
  }

  // Moderation summary for a user
  getUserModerationSummary(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}admin/users/${userId}/moderation-summary`).pipe(
      catchError(this.handleError)
    );
  }

  // Warn user
  warnUser(userId: number, reason: string, note?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/users/${userId}/warn`, { reason, note }).pipe(
      catchError(this.handleError)
    );
  }

  // Restrict messaging
  restrictMessaging(userId: number, durationMinutes: number, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/users/${userId}/restrict-messaging`, { durationMinutes, reason }).pipe(
      catchError(this.handleError)
    );
  }

  // Lift messaging restriction
  unrestrictMessaging(userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/users/${userId}/unrestrict-messaging`, {}).pipe(
      catchError(this.handleError)
    );
  }
  // Trigger manual archive cleanup
  triggerManualCleanup(reason?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}admin/archive/cleanup`, { reason }).pipe(
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
