import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.css']
})
export class VerifyEmailComponent implements OnInit {
  verificationForm: FormGroup;
  email: string = '';
  isSubmitting: boolean = false;
  isResending: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  remainingAttempts: number | null = null;
  canResend: boolean = true;
  resendCountdown: number = 0;
  private countdownInterval: any;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private dataService: DataService,
    private toastService: ToastService
  ) {
    this.verificationForm = this.fb.group({
      otpCode: ['', [
        Validators.required,
        Validators.pattern(/^\d{6}$/),
        Validators.minLength(6),
        Validators.maxLength(6)
      ]]
    });
  }

  ngOnInit() {
    // Get email from query params (passed from registration)
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
      
      if (!this.email) {
        this.router.navigate(['/register']);
        return;
      }
    });

    // Auto-focus on OTP input
    setTimeout(() => {
      const otpInput = document.getElementById('otpCode');
      if (otpInput) {
        otpInput.focus();
      }
    }, 100);
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  onSubmit() {
    if (this.verificationForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.errorMessage = null;
      this.successMessage = null;

      const otpCode = this.verificationForm.get('otpCode')?.value;

      this.dataService.verifyOTP(this.email, otpCode).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          
          if (response.status === 'success') {
            this.successMessage = 'Email verified successfully! Redirecting...';
            this.toastService.showToast('Welcome to ArtLink! Your account has been verified.', 'success');
            
            // Store token and user data
            if (response.payload.token) {
              localStorage.setItem('token', response.payload.token);
              localStorage.setItem('user', JSON.stringify(response.payload.user));
            }

            // Redirect to home page
            setTimeout(() => {
              this.router.navigate(['/home']);
            }, 1500);
          } else {
            this.handleVerificationError(response);
          }
        },
        error: (error) => {
          this.isSubmitting = false;
          this.handleVerificationError(error.error || error);
        }
      });
    } else {
      // Mark form as touched to show validation errors
      this.verificationForm.markAllAsTouched();
    }
  }

  private handleVerificationError(error: any) {
    this.errorMessage = error.message || 'Failed to verify OTP';
    
    if (error.errorCode === 'INVALID_OTP' && error.remainingAttempts !== undefined) {
      this.remainingAttempts = error.remainingAttempts;
      if (error.remainingAttempts === 0) {
        this.errorMessage = 'Maximum verification attempts exceeded. Please request a new code.';
      } else {
        this.errorMessage = `Invalid OTP code. ${error.remainingAttempts} attempts remaining.`;
      }
    } else if (error.errorCode === 'OTP_EXPIRED') {
      this.errorMessage = 'Your verification code has expired. Please request a new one.';
    } else if (error.errorCode === 'MAX_ATTEMPTS_EXCEEDED') {
      this.errorMessage = 'Maximum verification attempts exceeded. Please request a new code.';
    }
  }

  resendOTP() {
    if (!this.canResend || this.isResending) {
      return;
    }

    this.isResending = true;
    this.errorMessage = null;
    this.successMessage = null;

    this.dataService.resendOTP(this.email).subscribe({
      next: (response) => {
        this.isResending = false;
        
        if (response.status === 'success') {
          this.successMessage = 'Verification code sent! Please check your email.';
          this.toastService.showToast('New verification code sent to your email.', 'success');
          this.remainingAttempts = null;
          this.startResendCountdown();
        } else {
          this.errorMessage = response.message || 'Failed to resend OTP';
          if (response.waitTime) {
            this.startResendCountdown(response.waitTime);
          }
        }
      },
      error: (error) => {
        this.isResending = false;
        const errorData = error.error || error;
        this.errorMessage = errorData.message || 'Failed to resend OTP';
        
        if (errorData.waitTime) {
          this.startResendCountdown(errorData.waitTime);
        }
      }
    });
  }

  private startResendCountdown(seconds: number = 60) {
    this.canResend = false;
    this.resendCountdown = seconds;

    this.countdownInterval = setInterval(() => {
      this.resendCountdown--;
      
      if (this.resendCountdown <= 0) {
        this.canResend = true;
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  onOTPInput(event: any) {
    let value = event.target.value.replace(/\D/g, ''); // Remove non-digits
    
    // Limit to 6 digits
    if (value.length > 6) {
      value = value.substring(0, 6);
    }
    
    // Update form control
    this.verificationForm.patchValue({ otpCode: value });
    
    // Auto-submit when 6 digits entered
    if (value.length === 6 && this.verificationForm.valid) {
      setTimeout(() => this.onSubmit(), 300);
    }
  }

  onOTPPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const numericData = pastedData.replace(/\D/g, '').substring(0, 6);
    
    this.verificationForm.patchValue({ otpCode: numericData });
    
    // Auto-submit if valid
    if (numericData.length === 6) {
      setTimeout(() => this.onSubmit(), 300);
    }
  }

  getFieldError(): string {
    const otpControl = this.verificationForm.get('otpCode');
    
    if (otpControl?.hasError('required') && otpControl?.touched) {
      return 'Verification code is required';
    }
    
    if (otpControl?.hasError('pattern') && otpControl?.touched) {
      return 'Please enter a valid 6-digit code';
    }
    
    if ((otpControl?.hasError('minlength') || otpControl?.hasError('maxlength')) && otpControl?.touched) {
      return 'Verification code must be 6 digits';
    }
    
    return '';
  }

  backToLogin() {
    this.router.navigate(['/login']);
  }
}