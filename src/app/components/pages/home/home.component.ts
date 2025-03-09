import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PostCardComponent } from '../../ui/post-card/post-card.component';
import { CreatePostComponent } from '../../ui/create-post/create-post.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, PostCardComponent, CreatePostComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

}
