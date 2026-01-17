import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span 
      *ngIf="isAdmin"
      [ngClass]="sizeClasses"
      class="inline-flex items-center gap-1 font-semibold rounded-full whitespace-nowrap"
      [class]="variant === 'solid' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 
               variant === 'outline' ? 'border-2 border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' :
               'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'"
      title="Administrator">
      <span class="material-symbols-rounded" [ngClass]="iconSize">{{ icon }}</span>
      <span *ngIf="showLabel">{{ label }}</span>
    </span>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    
    .material-symbols-rounded {
      font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 20;
    }
  `]
})
export class AdminBadgeComponent {
  @Input() isAdmin: boolean = false;
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'sm';
  @Input() variant: 'solid' | 'outline' | 'subtle' = 'solid';
  @Input() showLabel: boolean = true;
  @Input() label: string = 'ADMIN';
  @Input() icon: string = 'verified';

  get sizeClasses(): string {
    const sizes = {
      'xs': 'px-1.5 py-0.5 text-[9px]',
      'sm': 'px-2 py-0.5 text-[10px]',
      'md': 'px-2.5 py-1 text-xs',
      'lg': 'px-3 py-1.5 text-sm'
    };
    return sizes[this.size];
  }

  get iconSize(): string {
    const sizes = {
      'xs': 'text-[12px]',
      'sm': 'text-[14px]',
      'md': 'text-base',
      'lg': 'text-lg'
    };
    return sizes[this.size];
  }
}
