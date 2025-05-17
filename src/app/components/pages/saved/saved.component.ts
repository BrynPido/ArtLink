import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { DataService } from '../../../services/data.service';


@Component({
  selector: 'app-saved',
  imports: [CommonModule],
  templateUrl: './saved.component.html',
  styleUrls: ['./saved.component.css']
})
export class SavedComponent implements OnInit {
  savedPosts: any[] = [];

  constructor(private dataService: DataService) { }

  ngOnInit(): void {
    this.loadSavedPosts();
  }

  loadSavedPosts() {
    this.dataService.getSavedPosts().subscribe(
      (response) => {
        console.log('API Response:', response);
        if (response && response.payload) {
          this.savedPosts = response.payload;
        } else {
          console.error('No data found in response');
        }
      },
      (error) => {
        console.error('Error fetching saved posts', error);
      }
    );
  }
}
