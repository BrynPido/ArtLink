import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyFormat',
  standalone: true
})
export class CurrencyFormatPipe implements PipeTransform {
  /**
   * Formats numbers as Philippine Peso currency
   * @param value - The number to format
   * @param showSymbol - Whether to show the ₱ symbol (default: true)
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted currency string
   */
  transform(value: number | string | null | undefined, showSymbol: boolean = true, decimals: number = 2): string {
    if (value === null || value === undefined || value === '') {
      return showSymbol ? '₱0.00' : '0.00';
    }

    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) {
      return showSymbol ? '₱0.00' : '0.00';
    }

    // Format with thousand separators and decimal places
    const formatted = num.toLocaleString('en-PH', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    return showSymbol ? `₱${formatted}` : formatted;
  }
}
