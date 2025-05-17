import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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

  constructor(private fb: FormBuilder, private dataService: DataService, private router: Router, private toastService: ToastService) {
    this.registerForm = this.fb.group(
      {
        name: ['', Validators.required],
        username: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      { validator: this.passwordMatchValidator }
    );
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

  onSubmit() {
    if (this.registerForm.valid) {
      this.dataService.register(this.registerForm.value).subscribe({
        next: (response) => {
          console.log('Registration Successful', response);
          this.errorMessage = null; // Clear errors on success
          this.registerForm.reset(); // Reset the form after successful registration
          this.router.navigate(['/login']); // Redirect to login page after successful registration
          this.toastService.showToast('Registration successful!', 'success');
        },
        error: (error) => {
          this.errorMessage = error.message;
          console.error('Registration Failed', error);
          this.toastService.showToast('Registration failed!', 'error');
        },
      });
    }
  }

  showPasswords() {
    this.passwordFieldType = 'text';
  }

  hidePasswords() {
    this.passwordFieldType = 'password';
  }
}
