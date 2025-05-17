import { Pipe, PipeTransform } from '@angular/core';
import { formatTimeAgo, formatShortTimeAgo, formatFullDate, formatPostDate, formatMessageDate } from './date.utils';

@Pipe({
  name: 'timeAgo',
  standalone: true
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date, format: 'full' | 'short' | 'post' | 'message' = 'full'): string {
    if (!value) return '';
    
    switch (format) {
      case 'short':
        return formatShortTimeAgo(value);
      case 'post':
        return formatPostDate(value);
      case 'message':
        return formatMessageDate(value);
      default:
        return formatTimeAgo(value);
    }
  }
}