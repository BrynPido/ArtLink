import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { ToastService } from '../../services/toast.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  step: 'email' | 'otp' | 'password' = 'email';
  emailForm: FormGroup;
  otpForm: FormGroup;
  passwordForm: FormGroup;
  
  isSubmitting: boolean = false;
  errorMessage: string | null = null;
  email: string = '';
  resetToken: string = '';
  
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  
  // OTP countdown timer
  otpTimer: number = 0;
  otpTimerInterval: any = null;

  constructor(
    private fb: FormBuilder, 
    private dataService: DataService, 
    private toastService: ToastService, 
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.otpForm = this.fb.group({
      digit1: ['', [Validators.required, Validators.pattern(/^\d$/)]],
      digit2: ['', [Validators.required, Validators.pattern(/^\d$/)]],
      digit3: ['', [Validators.required, Validators.pattern(/^\d$/)]],
      digit4: ['', [Validators.required, Validators.pattern(/^\d$/)]],
      digit5: ['', [Validators.required, Validators.pattern(/^\d$/)]],
      digit6: ['', [Validators.required, Validators.pattern(/^\d$/)]],
    });

    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Check if email is provided via query params
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email = params['email'];
        this.emailForm.patchValue({ email: this.email });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.otpTimerInterval) {
      clearInterval(this.otpTimerInterval);
    }
  }

  // Step 1: Submit email
  submitEmail(): void {
    if (this.emailForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = null;
    this.email = this.emailForm.value.email;

    this.dataService.forgotPassword(this.email).subscribe({
      next: (response) => {
        console.log('Password reset email sent:', response);
        this.step = 'otp';
        this.isSubmitting = false;
        this.startOTPTimer();
        this.toastService.showToast('Reset code sent to your email', 'success');
      },
      error: (error) => {
        console.error('Forgot password error:', error);
        this.isSubmitting = false;

        // Check if email verification is required
        if (error.error?.requiresVerification) {
          Swal.fire({
            icon: 'warning',
            title: 'Email Not Verified',
            html: `
              <p class="mb-3">${error.message || 'Please verify your email first.'}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">A verification code has been sent to your email.</p>
            `,
            showCancelButton: true,
            confirmButtonText: 'Verify Email',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#6366f1',
            cancelButtonColor: '#6b7280'
          }).then((result) => {
            if (result.isConfirmed) {
              // Redirect to email verification with email as query param
              this.router.navigate(['/verify-email'], { 
                queryParams: { email: this.email } 
              });
            }
          });
        } else {
          this.errorMessage = error.message || 'Failed to send reset email';
          this.toastService.showToast(this.errorMessage || 'An error occurred', 'error');
        }
      }
    });
  }

  // Step 2: Submit OTP
  submitOTP(): void {
    if (this.otpForm.invalid || this.isSubmitting) return;

    const otpCode = Object.values(this.otpForm.value).join('');
    this.isSubmitting = true;
    this.errorMessage = null;

    this.dataService.verifyResetOTP(this.email, otpCode).subscribe({
      next: (response) => {
        console.log('OTP verified:', response);
        this.resetToken = response.payload.resetToken;
        this.step = 'password';
        this.isSubmitting = false;
        this.stopOTPTimer();
        this.toastService.showToast('Code verified successfully', 'success');
      },
      error: (error) => {
        this.errorMessage = error.message || 'Invalid or expired code';
        this.isSubmitting = false;
        this.toastService.showToast(this.errorMessage || 'Verification failed', 'error');
        this.shakeOTPInputs();
      }
    });
  }

  // Step 3: Submit new password
  submitPassword(): void {
    if (this.passwordForm.invalid || this.isSubmitting) return;

    const { newPassword, confirmPassword } = this.passwordForm.value;

    if (newPassword !== confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      this.toastService.showToast(this.errorMessage, 'error');
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;

    this.dataService.resetPassword(this.resetToken, newPassword, confirmPassword).subscribe({
      next: (response) => {
        console.log('Password reset successful:', response);
        
        Swal.fire({
          icon: 'success',
          title: 'Password Reset Successful!',
          text: 'You can now login with your new password.',
          confirmButtonText: 'Go to Login',
          confirmButtonColor: '#6366f1',
          allowOutsideClick: false
        }).then(() => {
          this.router.navigate(['/login']);
        });
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to reset password';
        this.isSubmitting = false;
        this.toastService.showToast(this.errorMessage || 'Password reset failed', 'error');
      }
    });
  }

  // Resend OTP
  resendOTP(): void {
    if (this.otpTimer > 0) return;

    this.errorMessage = null;
    this.otpForm.reset();

    this.dataService.forgotPassword(this.email).subscribe({
      next: (response) => {
        this.toastService.showToast('New code sent to your email', 'success');
        this.startOTPTimer();
      },
      error: (error) => {
        this.toastService.showToast('Failed to resend code', 'error');
      }
    });
  }

  // OTP Timer
  startOTPTimer(): void {
    this.otpTimer = 60; // 60 seconds
    this.otpTimerInterval = setInterval(() => {
      this.otpTimer--;
      if (this.otpTimer <= 0) {
        this.stopOTPTimer();
      }
    }, 1000);
  }

  stopOTPTimer(): void {
    if (this.otpTimerInterval) {
      clearInterval(this.otpTimerInterval);
      this.otpTimerInterval = null;
    }
    this.otpTimer = 0;
  }

  // OTP Input handling
  onOTPInput(event: any, index: number): void {
    const input = event.target;
    const value = input.value;

    if (value.length === 1 && index < 6) {
      const nextInput = input.parentElement.nextElementSibling?.querySelector('input');
      if (nextInput) {
        nextInput.focus();
      }
    }
  }

  onOTPKeyDown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;

    if (event.key === 'Backspace' && !input.value && index > 1) {
      const prevInput = input.parentElement?.previousElementSibling?.querySelector('input');
      if (prevInput) {
        prevInput.focus();
      }
    }
  }

  onOTPPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text');
    if (pastedData && /^\d{6}$/.test(pastedData)) {
      this.autoFillOTP(pastedData);
    }
  }

  autoFillOTP(otpCode: string): void {
    const digits = otpCode.split('');
    this.otpForm.patchValue({
      digit1: digits[0] || '',
      digit2: digits[1] || '',
      digit3: digits[2] || '',
      digit4: digits[3] || '',
      digit5: digits[4] || '',
      digit6: digits[5] || ''
    });
  }

  shakeOTPInputs(): void {
    const inputs = document.querySelectorAll('.otp-input');
    inputs.forEach(input => {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);
    });
  }

  // Go back to previous step
  goBack(): void {
    if (this.step === 'otp') {
      this.step = 'email';
      this.stopOTPTimer();
      this.otpForm.reset();
    } else if (this.step === 'password') {
      this.step = 'otp';
      this.passwordForm.reset();
    }
    this.errorMessage = null;
  }

  // Navigate to login
  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
