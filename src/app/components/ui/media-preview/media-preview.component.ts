import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-media-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="media-preview">
      <ng-container *ngIf="mediaType === 'image'; else videoTemplate">
        <img [src]="url" [alt]="name" class="max-w-full max-h-full object-contain rounded shadow-md" />
      </ng-container>
      <ng-template #videoTemplate>
        <video [src]="url" controls class="max-w-full max-h-full rounded shadow-md">
          Your browser does not support the video tag.
        </video>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .media-preview {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class MediaPreviewComponent {
  @Input() url!: SafeUrl;
  @Input() name!: string;
  @Input() mediaType!: 'image' | 'video';
}