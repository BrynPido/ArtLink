import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { ToastService } from '../../services/toast.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  registerForm: FormGroup;
  passwordFieldType: string = 'password';
  errorMessage: string | null = null;
  validationErrors: any = {};
  isSubmitting: boolean = false;

  constructor(private fb: FormBuilder, private dataService: DataService, private router: Router, private toastService: ToastService) {
    this.registerForm = this.fb.group(
      {
        name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
        username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30), this.usernameValidator]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6), this.passwordValidator]],
        confirmPassword: ['', Validators.required],
      },
      { validator: this.passwordMatchValidator }
    );
  }

  // Custom validator for username (alphanumeric and underscores only)
  usernameValidator(control: AbstractControl): {[key: string]: any} | null {
    const username = control.value;
    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      return { 'invalidUsername': true };
    }
    return null;
  }

  // Custom validator for password complexity
  passwordValidator(control: AbstractControl): {[key: string]: any} | null {
    const password = control.value;
    if (password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return { 'passwordComplexity': true };
    }
    return null;
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password?.value !== confirmPassword?.value) {
      confirmPassword?.setErrors({ mismatch: true });
    } else {
      confirmPassword?.setErrors(null);
    }
    return null;
  }

  get passwordMismatch() {
    return this.registerForm.get('confirmPassword')?.hasError('mismatch');
  }

  // Get validation errors for a specific field
  getFieldErrors(fieldName: string): string[] {
    const errors: string[] = [];
    const field = this.registerForm.get(fieldName);
    const serverErrors = this.validationErrors[fieldName];

    // Frontend validation errors
    if (field?.invalid && field?.touched) {
      if (field.hasError('required')) {
        errors.push(`${this.getFieldDisplayName(fieldName)} is required`);
      }
      if (field.hasError('email')) {
        errors.push('Please enter a valid email address');
      }
      if (field.hasError('minlength')) {
        const requiredLength = field.getError('minlength').requiredLength;
        errors.push(`${this.getFieldDisplayName(fieldName)} must be at least ${requiredLength} characters`);
      }
      if (field.hasError('maxlength')) {
        const requiredLength = field.getError('maxlength').requiredLength;
        errors.push(`${this.getFieldDisplayName(fieldName)} must be less than ${requiredLength} characters`);
      }
      if (field.hasError('invalidUsername')) {
        errors.push('Username can only contain letters, numbers, and underscores');
      }
      if (field.hasError('passwordComplexity')) {
        errors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      }
      if (field.hasError('mismatch')) {
        errors.push('Passwords do not match');
      }
    }

    // Backend validation errors
    if (serverErrors) {
      errors.push(...serverErrors);
    }

    return errors;
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: {[key: string]: string} = {
      'name': 'Name',
      'username': 'Username',
      'email': 'Email',
      'password': 'Password',
      'confirmPassword': 'Confirm Password'
    };
    return displayNames[fieldName] || fieldName;
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.isSubmitting = true;
      this.errorMessage = null;
      this.validationErrors = {};

      this.dataService.register(this.registerForm.value).subscribe({
        next: (response) => {
          console.log('Registration Successful', response);
          this.registerForm.reset();
          this.router.navigate(['/login']);
          this.toastService.showToast('Registration successful! Please sign in.', 'success');
          this.isSubmitting = false;
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('Registration Failed', error);
          
          // Reset validation errors
          this.validationErrors = {};
          
          // Handle different error types
          let errorResponse = error;
          
          // If the error is wrapped in an Error object, extract the actual response
          if (error instanceof Error && error.message) {
            try {
              errorResponse = JSON.parse(error.message);
            } catch (parseError) {
              // If parsing fails, use the error object itself
              errorResponse = error;
            }
          }
          
          // Handle validation errors from backend
          if (errorResponse.status === 'error' && errorResponse.errors) {
            errorResponse.errors.forEach((err: any) => {
              if (err.path) {
                if (!this.validationErrors[err.path]) {
                  this.validationErrors[err.path] = [];
                }
                this.validationErrors[err.path].push(err.msg);
              }
            });
            this.errorMessage = errorResponse.message || 'Validation failed';
          } else if (errorResponse.message) {
            this.errorMessage = errorResponse.message;
          } else if (error.message) {
            this.errorMessage = error.message;
          } else {
            this.errorMessage = 'Registration failed. Please try again.';
          }
          
          this.toastService.showToast(this.errorMessage || 'Registration failed', 'error');
        },
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.registerForm.controls).forEach(key => {
        this.registerForm.get(key)?.markAsTouched();
      });
    }
  }

  showPasswords() {
    this.passwordFieldType = 'text';
  }

  hidePasswords() {
    this.passwordFieldType = 'password';
  }

  // Clear server-side errors when user starts typing
  onFieldChange(fieldName: string) {
    if (this.validationErrors[fieldName]) {
      delete this.validationErrors[fieldName];
    }
  }
}
