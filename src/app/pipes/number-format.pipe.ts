import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'numberFormat',
  standalone: true
})
export class NumberFormatPipe implements PipeTransform {
  /**
   * Formats numbers with thousand separators and optional decimal places
   * @param value - The number to format
   * @param decimals - Number of decimal places (default: 0)
   * @param locale - Locale for formatting (default: 'en-US')
   * @returns Formatted number string
   */
  transform(value: number | string | null | undefined, decimals: number = 0, locale: string = 'en-US'): string {
    if (value === null || value === undefined || value === '') {
      return '0';
    }

    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) {
      return '0';
    }

    // Format with thousand separators and specified decimal places
    return num.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
}
