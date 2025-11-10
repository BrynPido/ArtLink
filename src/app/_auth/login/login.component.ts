import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { ToastService } from '../../services/toast.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loginForm: FormGroup;
  passwordFieldType: string = 'password';
  errorMessage: string | null = null;
  isSubmitting: boolean = false;

  constructor(private fb: FormBuilder, private dataService: DataService, private toastService: ToastService, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  showPassword() {
    this.passwordFieldType = 'text';
  }

  hidePassword() {
    this.passwordFieldType = 'password';
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.isSubmitting = true;
      this.errorMessage = null;
      
      this.dataService.login(this.loginForm.value).subscribe({
        next: (response) => {
          console.log('Login Successful', response);
          this.errorMessage = null; // Clear errors on success
          this.toastService.showToast('Welcome back! You\'re now signed in.', 'success');
          // Navigate after a brief delay so the toast is visible and doesn\'t get cut by route change
          setTimeout(() => {
            this.isSubmitting = false;
            this.router.navigate(['/home']);
          }, 400);
        },
        error: (error) => {
          this.errorMessage = error.message;
          console.error('Login Failed', error);
          this.toastService.showToast('Login failed!', 'error');
          this.isSubmitting = false;
        },
      });
    }
  }
}