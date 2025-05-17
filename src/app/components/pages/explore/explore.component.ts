import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.css']
})
export class ExploreComponent implements OnInit {
  searchForm: FormGroup;
  searchResults: any[] = [];
  isLoading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private dataService: DataService,
    private router: Router
  ) {
    this.searchForm = this.fb.group({
      query: ['']
    });
  }

  ngOnInit(): void {}

  onSearch(): void {
    if (!this.searchForm.value.query.trim()) return;

    this.isLoading = true;
    this.error = null;

    this.dataService.search(this.searchForm.value.query).subscribe({
      next: (response) => {
        // Combine and format the results
        const formattedResults = [
          ...response.payload.posts.map((post: any) => ({
            ...post,
            type: 'post'
          })),
          ...response.payload.users.map((user: any) => ({
            ...user,
            type: 'user'
          }))
        ];
        this.searchResults = formattedResults;
      },
      error: (err) => {
        this.error = 'Failed to perform search. Please try again.';
        console.error('Search error:', err);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  navigateToProfile(userId: number): void {
    this.router.navigate(['/profile', userId]);
  }

  navigateToPost(postId: number): void {
    this.router.navigate(['/post', postId]);
  }
}
