import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SiteStats {
  totalVisits: number;
  uniqueVisitors: number;
  visitsToday: number;
  visitsThisWeek: number;
  visitsThisMonth: number;
}

export interface VisitResponse {
  success: boolean;
  totalVisits: number;
  uniqueVisitors: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private apiUrl = environment.apiUrl + 'analytics';
  private statsSubject = new BehaviorSubject<SiteStats | null>(null);
  public stats$ = this.statsSubject.asObservable();

  constructor(private http: HttpClient) { }

  /**
   * Track a site visit
   */
  trackVisit(): Observable<VisitResponse> {
    return this.http.post<VisitResponse>(`${this.apiUrl}/visit`, {}).pipe(
      tap(response => {
        // Update stats after tracking visit
        if (response.success) {
          this.getStats().subscribe();
        }
      })
    );
  }

  /**
   * Get site statistics
   */
  getStats(): Observable<{ success: boolean; stats: SiteStats }> {
    return this.http.get<{ success: boolean; stats: SiteStats }>(`${this.apiUrl}/stats`).pipe(
      tap(response => {
        if (response.success) {
          this.statsSubject.next(response.stats);
        }
      })
    );
  }

  /**
   * Get current stats value
   */
  getCurrentStats(): SiteStats | null {
    return this.statsSubject.value;
  }
}
