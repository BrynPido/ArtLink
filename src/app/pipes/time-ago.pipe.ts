import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeAgo',
  standalone: true
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date): string {
    if (!value) return '';
    
    const now = new Date();
    const date = typeof value === 'string' ? new Date(value) : value;
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    // Less than a minute
    if (seconds < 60) {
      return 'just now';
    }
    
    // Less than an hour
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return minutes === 1 ? '1 min ago' : `${minutes} mins ago`;
    }
    
    // Less than a day
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return hours === 1 ? '1 hr ago' : `${hours} hrs ago`;
    }
    
    // Less than a week
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return days === 1 ? 'yesterday' : `${days} days ago`;
    }
    
    // Less than a month
    const weeks = Math.floor(days / 7);
    if (weeks < 4) {
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    
    // Less than a year
    const months = Math.floor(days / 30);
    if (months < 12) {
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    
    // More than a year
    const years = Math.floor(days / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }
}