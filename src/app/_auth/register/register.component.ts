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
        termsAccepted: [false, Validators.requiredTrue],
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
      if (field.hasError('required') && fieldName === 'termsAccepted') {
        errors.push('You must accept the Terms of Service and Privacy Policy');
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
      'confirmPassword': 'Confirm Password',
      'termsAccepted': 'Terms and Privacy Policy acceptance'
    };
    return displayNames[fieldName] || fieldName;
  }

  onSubmit() {
    if (this.registerForm.valid) {
      // Show confirmation dialog before proceeding with registration
      Swal.fire({
        title: 'Confirm Registration',
        html: `
          <div class="text-left">
            <p class="mb-3">Please confirm that you want to create an account with the following details:</p>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li><strong>Name:</strong> ${this.registerForm.get('name')?.value}</li>
              <li><strong>Username:</strong> ${this.registerForm.get('username')?.value}</li>
              <li><strong>Email:</strong> ${this.registerForm.get('email')?.value}</li>
            </ul>
            <p class="mt-3 text-xs text-gray-600">
              By proceeding, you confirm that you have read and agreed to our Terms of Service and Privacy Policy.
            </p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, Create Account',
        cancelButtonText: 'Cancel',
        customClass: {
          popup: 'swal2-popup-custom'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          this.proceedWithRegistration();
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.registerForm.controls).forEach(key => {
        this.registerForm.get(key)?.markAsTouched();
      });
    }
  }

  private proceedWithRegistration() {
    this.isSubmitting = true;
    this.errorMessage = null;
    this.validationErrors = {};

    // Remove termsAccepted from the form data before sending to server
    const formData = { ...this.registerForm.value };
    delete formData.termsAccepted;

    this.dataService.register(formData).subscribe({
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
  }

  showTermsOfService() {
    Swal.fire({
      title: 'Terms of Service',
      html: `
        <div class="text-left text-sm space-y-3 max-h-96 overflow-y-auto">
          <h3 class="font-semibold text-base">1. Acceptance of Terms</h3>
          <p>By creating an account on ArtLink, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
          
          <h3 class="font-semibold text-base">2. User Accounts</h3>
          <p>You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>
          
          <h3 class="font-semibold text-base">3. Content Guidelines</h3>
          <p>Users must not post content that is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable.</p>
          
          <h3 class="font-semibold text-base">4. Intellectual Property</h3>
          <p>Users retain ownership of their original content but grant ArtLink a license to display, distribute, and promote their work on the platform.</p>
          
          <h3 class="font-semibold text-base">5. Prohibited Activities</h3>
          <p>Users may not engage in spamming, harassment, impersonation, or any activity that disrupts the platform's functionality.</p>
          
          <h3 class="font-semibold text-base">6. Termination</h3>
          <p>ArtLink reserves the right to terminate or suspend accounts that violate these terms.</p>
          
          <h3 class="font-semibold text-base">7. Disclaimer</h3>
          <p>ArtLink is provided "as is" without any warranties, express or implied.</p>
          
          <p class="text-xs text-gray-500 mt-4">Last updated: August 14, 2025</p>
        </div>
      `,
      confirmButtonText: 'I Understand',
      confirmButtonColor: '#4f46e5',
      width: '600px',
      customClass: {
        popup: 'swal2-popup-custom'
      }
    });
  }

  showPrivacyPolicy() {
    Swal.fire({
      title: 'Privacy Policy',
      html: `
        <div class="text-left text-sm space-y-3 max-h-96 overflow-y-auto">
          <h3 class="font-semibold text-base">1. Information We Collect</h3>
          <p>We collect information you provide directly (name, email, username) and automatically through your use of our services (usage data, cookies).</p>
          
          <h3 class="font-semibold text-base">2. How We Use Your Information</h3>
          <p>We use your information to provide our services, communicate with you, improve our platform, and ensure security.</p>
          
          <h3 class="font-semibold text-base">3. Information Sharing</h3>
          <p>We do not sell your personal information. We may share information in limited circumstances such as legal requirements or service providers.</p>
          
          <h3 class="font-semibold text-base">4. Data Security</h3>
          <p>We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
          
          <h3 class="font-semibold text-base">5. Your Rights</h3>
          <p>You have the right to access, update, or delete your personal information. You can also opt out of certain communications.</p>
          
          <h3 class="font-semibold text-base">6. Cookies</h3>
          <p>We use cookies to enhance your experience, analyze usage, and provide personalized content.</p>
          
          <h3 class="font-semibold text-base">7. Data Retention</h3>
          <p>We retain your information as long as your account is active or as needed to provide services.</p>
          
          <h3 class="font-semibold text-base">8. Contact Us</h3>
          <p>If you have questions about this Privacy Policy, please contact us through our support channels.</p>
          
          <p class="text-xs text-gray-500 mt-4">Last updated: August 14, 2025</p>
        </div>
      `,
      confirmButtonText: 'I Understand',
      confirmButtonColor: '#4f46e5',
      width: '600px',
      customClass: {
        popup: 'swal2-popup-custom'
      }
    });
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
