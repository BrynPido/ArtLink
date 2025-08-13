import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  
  // Get the auth token from localStorage
  const authToken = localStorage.getItem('token');

  // Log request details in production for debugging
  if (environment.production && req.url.includes('/api/')) {
    console.log('🔍 API Request:', {
      url: req.url,
      method: req.method,
      hasToken: !!authToken,
      timestamp: new Date().toISOString()
    });
  }

  // Check if token is expired before making the request
  if (authToken) {
    try {
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      const now = Date.now() / 1000;
      
      // If token is expired, clear it and redirect to login
      if (payload.exp && payload.exp < now) {
        console.log('🔍 Token expired before request, clearing storage');
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        router.navigate(['/login']);
        return next(req);
      }
    } catch (error) {
      console.error('🔍 Invalid token format, clearing storage:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      router.navigate(['/login']);
      return next(req);
    }

    // Clone the request and add the authorization header
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Enhanced error logging for production debugging
        if (environment.production) {
          console.error('🔍 API Error Response:', {
            url: error.url,
            status: error.status,
            statusText: error.statusText,
            message: error.error?.message || error.message,
            timestamp: new Date().toISOString()
          });
        }
        
        // Handle token-related errors
        if (error.status === 401 || error.status === 403) {
          const errorBody = error.error;
          if (errorBody && typeof errorBody === 'object' && 
              (errorBody.message?.includes('token') || 
               errorBody.message?.includes('expired') || 
               errorBody.message?.includes('Invalid'))) {
            console.log('🔍 Token invalid/expired from server response, clearing storage');
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
            router.navigate(['/login']);
          }
        }
        return throwError(() => error);
      })
    );
  }

  // If no token, proceed with the original request
  return next(req);
};
