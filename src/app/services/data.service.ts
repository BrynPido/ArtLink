import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, Observable, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private apiUrl = 'http://localhost/ARTLINK/ArtLink_API/api/';

  constructor(private http: HttpClient, private router: Router) { }

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
            // Store user data in localStorage (or sessionStorage if needed)
            localStorage.setItem('currentUser', JSON.stringify(user));
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
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }

  createPost(postData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}createPost`, postData).pipe(
      catchError(this.handleError)
    );
  }

  // Fetch posts from the backend
  getPosts(): Observable<any> {
    return this.http.get(`${this.apiUrl}getPosts`).pipe(
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
    this.router.navigate(['/login']);
  }

}
