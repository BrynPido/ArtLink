import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DebugService {
  constructor(private http: HttpClient) {}

  checkTokenValidity(): boolean {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('🔍 DEBUG: No token found in localStorage');
      return false;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Date.now() / 1000;
      const expiry = payload.exp;
      const timeUntilExpiry = expiry - now;

      console.log('🔍 DEBUG: Token info:', {
        tokenExists: true,
        issuedAt: new Date(payload.iat * 1000).toISOString(),
        expiresAt: new Date(expiry * 1000).toISOString(),
        currentTime: new Date(now * 1000).toISOString(),
        timeUntilExpiry: Math.round(timeUntilExpiry),
        timeUntilExpiryHours: Math.round(timeUntilExpiry / 3600 * 10) / 10,
        isExpired: expiry < now,
        userId: payload.userId,
        email: payload.email,
        issuer: payload.iss
      });

      return expiry > now;
    } catch (error) {
      console.error('🔍 DEBUG: Invalid token format:', error);
      return false;
    }
  }

  checkEnvironment(): void {
    console.log('🔍 DEBUG: Environment info:', {
      production: environment.production,
      apiUrl: environment.apiUrl,
      mediaBaseUrl: environment.mediaBaseUrl,
      wsUrl: environment.wsUrl
    });
  }

  async testApiConnectivity(): Promise<void> {
    try {
      console.log('🔍 DEBUG: Testing API connectivity...');
      const response = await this.http.get(`${environment.apiUrl}auth/test`, {
        headers: { 'Cache-Control': 'no-cache' }
      }).toPromise();
      console.log('🔍 DEBUG: API connectivity test successful:', response);
    } catch (error) {
      console.error('🔍 DEBUG: API connectivity test failed:', error);
    }
  }

  logCurrentUser(): void {
    const currentUser = localStorage.getItem('currentUser');
    console.log('🔍 DEBUG: Current user in localStorage:', currentUser ? JSON.parse(currentUser) : null);
  }

  runFullDiagnostics(): void {
    console.log('🔍 DEBUG: Running full diagnostics...');
    this.checkEnvironment();
    this.logCurrentUser();
    this.checkTokenValidity();
    this.testApiConnectivity();
  }
}
