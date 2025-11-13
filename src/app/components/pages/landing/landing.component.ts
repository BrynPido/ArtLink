import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit {
  isScrolled = false;
  isMobileMenuOpen = false;
  currentYear = new Date().getFullYear();

  features = [
    {
      icon: 'palette',
      title: 'Share Your Art',
      description: 'Showcase your creative works to a community that appreciates artistry and craftsmanship.'
    },
    {
      icon: 'people',
      title: 'Connect with Artists',
      description: 'Build meaningful connections with fellow creators, collaborate, and grow together.'
    },
    {
      icon: 'storefront',
      title: 'Sell Your Work',
      description: 'Turn your passion into profit with our integrated marketplace for art and supplies.'
    },
    {
      icon: 'chat',
      title: 'Direct Messaging',
      description: 'Communicate seamlessly with buyers, sellers, and fellow artists in real-time.'
    },
    {
      icon: 'explore',
      title: 'Discover Inspiration',
      description: 'Explore trending artwork, find new techniques, and stay inspired every day.'
    },
    {
      icon: 'workspace_premium',
      title: 'Commission Work',
      description: 'Offer custom commissions and connect with clients looking for unique creations.'
    }
  ];



  constructor(
    private router: Router,
    private dataService: DataService
  ) {}

  ngOnInit(): void {
    // Check if user is already logged in
    this.dataService.isLoggedIn().subscribe(isLoggedIn => {
      if (isLoggedIn) {
        this.router.navigate(['/home']);
      }
    });

    // Listen to scroll events
    window.addEventListener('scroll', this.onScroll.bind(this));
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll.bind(this));
  }

  onScroll(): void {
    this.isScrolled = window.scrollY > 50;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.isMobileMenuOpen = false;
    }
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/auth/register']);
  }
}
