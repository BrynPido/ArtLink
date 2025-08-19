import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { DataService } from '../../services/data.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(
    private dataService: DataService,
    private router: Router
  ) {}

  canActivate(): boolean {
    const currentUser = this.dataService.getCurrentUser();
    
    // Check if user is logged in and has admin privileges
    if (currentUser && (
      currentUser.email === 'admin@artlink.com' || 
      currentUser.username === 'admin' ||
      currentUser.role === 'admin' ||
      currentUser.isAdmin === true
    )) {
      return true;
    }
    
    // Redirect to home if not authenticated or not admin
    this.router.navigate(['/home']);
    return false;
  }
}
