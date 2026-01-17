import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class SweetAlertService {

  // Success notification
  success(title: string, text?: string): Promise<any> {
    return Swal.fire({
      icon: 'success',
      title: title,
      text: text,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'OK'
    });
  }

  // Error notification
  error(title: string, text?: string): Promise<any> {
    return Swal.fire({
      icon: 'error',
      title: title,
      text: text,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'OK'
    });
  }

  // Warning notification
  warning(title: string, text?: string): Promise<any> {
    return Swal.fire({
      icon: 'warning',
      title: title,
      text: text,
      confirmButtonColor: '#f59e0b',
      confirmButtonText: 'OK'
    });
  }

  // Info notification
  info(title: string, text?: string): Promise<any> {
    return Swal.fire({
      icon: 'info',
      title: title,
      text: text,
      confirmButtonColor: '#3b82f6',
      confirmButtonText: 'OK'
    });
  }

  // Confirmation dialog
  confirm(title: string, text?: string, confirmButtonText: string = 'Yes', cancelButtonText: string = 'Cancel'): Promise<any> {
    return Swal.fire({
      icon: 'question',
      title: title,
      text: text,
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: confirmButtonText,
      cancelButtonText: cancelButtonText
    });
  }

  // Delete confirmation
  confirmDelete(itemName: string = 'item', customText?: string): Promise<any> {
    return Swal.fire({
      icon: 'warning',
      title: 'Are you sure?',
      text: customText || `You won't be able to recover this ${itemName}!`,
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });
  }

  // Archive confirmation (soft delete semantics)
  confirmArchive(itemName: string = 'item', customText?: string): Promise<any> {
    return Swal.fire({
      icon: 'warning',
      title: 'Archive this record?',
      text: customText || `This ${itemName} will be archived and hidden. It can be restored within the retention window before permanent cleanup.`,
      showCancelButton: true,
      confirmButtonColor: '#f59e0b', // amber for archive (less destructive than red)
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, archive',
      cancelButtonText: 'Cancel'
    });
  }

  // Bulk delete confirmation
  confirmBulkDelete(count: number, itemType: string = 'items'): Promise<any> {
    return Swal.fire({
      icon: 'warning',
      title: 'Are you sure?',
      text: `You are about to delete ${count} ${itemType}. This action cannot be undone!`,
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: `Yes, delete ${count} ${itemType}!`,
      cancelButtonText: 'Cancel'
    });
  }

  // Bulk archive confirmation (soft delete semantics)
  confirmBulkArchive(count: number, itemType: string = 'items'): Promise<any> {
    return Swal.fire({
      icon: 'warning',
      title: 'Archive multiple records?',
      text: `You are about to archive ${count} ${itemType}. They will be hidden and can be restored within the retention window.`,
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#6b7280',
      confirmButtonText: `Yes, archive ${count}`,
      cancelButtonText: 'Cancel'
    });
  }

  // Input dialog
  input(title: string, inputPlaceholder: string, inputType: any = 'text'): Promise<any> {
    return Swal.fire({
      title: title,
      input: inputType,
      inputPlaceholder: inputPlaceholder,
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Submit',
      cancelButtonText: 'Cancel',
      inputValidator: (value: string) => {
        if (!value) {
          return 'Please enter a value!';
        }
        return null;
      }
    } as any);
  }

  // Loading with custom message
  loading(title: string = 'Loading...', text?: string): void {
    Swal.fire({
      title: title,
      text: text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  // Close any open SweetAlert
  close(): void {
    Swal.close();
  }

  // Dropdown selection with "Other" option
  async selectWithOther(title: string, options: string[], allowOther: boolean = true): Promise<any> {
    const selectOptions: { [key: string]: string } = {};
    
    // Add predefined options
    options.forEach((option, index) => {
      selectOptions[option] = option;
    });
    
    // Add "Other" option if allowed
    if (allowOther) {
      selectOptions['other'] = 'Other (specify below)';
    }

    const result = await Swal.fire({
      title: title,
      input: 'select',
      inputOptions: selectOptions,
      inputPlaceholder: 'Select a reason',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Continue',
      cancelButtonText: 'Cancel',
      inputValidator: (value: string) => {
        if (!value) {
          return 'Please select a reason!';
        }
        return null;
      }
    });

    // If user selected "other", show input dialog
    if (result.isConfirmed && result.value === 'other' && allowOther) {
      return await this.input(
        'Custom Reason',
        'Please specify your reason:',
        'text'
      );
    }

    return result;
  }

  // Toast notification (small popup)
  toast(icon: 'success' | 'error' | 'warning' | 'info' | 'question', title: string, position: 'top' | 'top-start' | 'top-end' | 'center' | 'center-start' | 'center-end' | 'bottom' | 'bottom-start' | 'bottom-end' = 'top-end'): void {
    const Toast = Swal.mixin({
      toast: true,
      position: position,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });

    Toast.fire({
      icon: icon,
      title: title
    });
  }

  // Rejection reason input
  showRejectionReasonInput(options: {
    title: string;
    inputLabel: string;
    inputPlaceholder: string;
    confirmButtonText: string;
    showCancelButton: boolean;
  }): Promise<any> {
    return Swal.fire({
      title: options.title,
      input: 'textarea',
      inputLabel: options.inputLabel,
      inputPlaceholder: options.inputPlaceholder,
      inputAttributes: {
        'aria-label': options.inputLabel
      },
      showCancelButton: options.showCancelButton,
      confirmButtonText: options.confirmButtonText,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        if (!value) {
          return 'You need to provide a reason!';
        }
        return null;
      }
    });
  }}