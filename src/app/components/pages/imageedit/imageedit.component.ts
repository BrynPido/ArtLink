import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-imageedit',
  imports: [CommonModule, FormsModule],
  templateUrl: './imageedit.component.html',
  styleUrl: './imageedit.component.css'
})
export class ImageeditComponent {
  imageSrc: string;
  caption: string = '';

  constructor(private router: Router, private route: ActivatedRoute) {
    const navigation = this.router.getCurrentNavigation();
    this.imageSrc = navigation?.extras.state?.['image'] || '';
  }

  applyFilter(filter: string): void {
    const img = document.querySelector('img');
    if (img) {
      img.style.filter = filter;
    }
  }

  saveImage(): void {
    // Save the edited image and caption (communicate back to CreatePostComponent)
    this.router.navigate(['/create'], {
      state: { caption: this.caption }
    });
  }
}
