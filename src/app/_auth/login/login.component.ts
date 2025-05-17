import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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

  constructor(private fb: FormBuilder, private dataService: DataService, private toastService: ToastService) {
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
      this.dataService.login(this.loginForm.value).subscribe({
        next: (response) => {
          console.log('Login Successful', response);
          this.errorMessage = null; // Clear errors on success
          this.toastService.showToast('Login successful!', 'success');
        },
        error: (error) => {
          this.errorMessage = error.message;
          console.error('Login Failed', error);
          this.toastService.showToast('Login failed!', 'error');
        },
      });
    }
  }
}