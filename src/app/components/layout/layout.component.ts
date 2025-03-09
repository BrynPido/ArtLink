import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent {
  currentUser: any;
  sidebarWidth: string = '25rem'; // Default for medium screens
  isMobileView: boolean = false; // Track if the view is mobile

  constructor(private router: Router, private dataService: DataService) {
    this.currentUser = this.dataService.getCurrentUser();
  }

  // Listen to the window resize event to adjust sidebar width dynamically
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.adjustSidebarWidth(window.innerWidth);
    this.checkIfMobileView(window.innerWidth);
  }

  ngOnInit(): void {
    // Set sidebar width and check view type based on current screen size on initialization
    this.adjustSidebarWidth(window.innerWidth);
    this.checkIfMobileView(window.innerWidth);
  }

  adjustSidebarWidth(screenWidth: number) {
    if (screenWidth >= 1024) {
      // Large screen (lg)
      this.sidebarWidth = '25rem';
    } else if (screenWidth >= 768) {
      // Medium screen (md)
      this.sidebarWidth = '20rem';
    } else {
      // Small screen (default)
      this.sidebarWidth = '0px';
    }
  }

  checkIfMobileView(screenWidth: number) {
    this.isMobileView = screenWidth < 768; // Set mobile view if the screen is smaller than 768px
  }

  logout() {
    this.dataService.logout();
  }
}
