import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PostCardComponent } from '../../ui/post-card/post-card.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, PostCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

}
