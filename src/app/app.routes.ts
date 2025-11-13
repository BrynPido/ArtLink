import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './_auth/auth-layout/auth-layout.component';
import { LayoutComponent } from './components/layout/layout.component';
import { AuthGuard } from './services/_auth/auth.guard';

export const routes: Routes = [
  // Landing page (public, no layout)
  { 
    path: '', 
    loadComponent: () => import('./components/pages/landing/landing.component').then(m => m.LandingComponent),
    pathMatch: 'full'
  },
  
  // Legal pages (public, no layout)
  {
    path: 'terms',
    loadComponent: () => import('./components/pages/terms/terms.component').then(m => m.TermsComponent)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./components/pages/privacy/privacy.component').then(m => m.PrivacyComponent)
  },
  
  // Auth routes
  {
    path: 'auth',
    component: AuthLayoutComponent,
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', loadComponent: () => import('./_auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./_auth/register/register.component').then(m => m.RegisterComponent) },
      { path: 'verify-email', loadComponent: () => import('./_auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent) },
      { path: 'reset-password', loadComponent: () => import('./_auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
    ],
  },
  
  // Legacy auth redirects for backward compatibility
  { path: 'login', redirectTo: 'auth/login', pathMatch: 'full' },
  { path: 'register', redirectTo: 'auth/register', pathMatch: 'full' },
  { path: 'verify-email', redirectTo: 'auth/verify-email', pathMatch: 'full' },
  { path: 'reset-password', redirectTo: 'auth/reset-password', pathMatch: 'full' },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then(m => m.adminRoutes)
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', loadComponent: () => import('./components/pages/home/home.component').then(m => m.HomeComponent) },
      { path: 'explore', loadComponent: () => import('./components/pages/explore/explore.component').then(m => m.ExploreComponent) },
      { path: 'inbox', loadComponent: () => import('./components/pages/inbox/inbox.component').then(m => m.InboxComponent) },
      { path: 'saved', loadComponent: () => import('./components/pages/saved/saved.component').then(m => m.SavedComponent) },
      { path: 'create', loadComponent: () => import('./components/pages/createpost/createpost.component').then(m => m.CreatePostComponent) },
      { path: 'edit-image/:index', loadComponent: () => import('./components/pages/imageedit/imageedit.component').then(m => m.ImageeditComponent) },
      { path: 'post/:id', loadComponent: () => import('./components/pages/post/post.component').then(m => m.PostComponent) },
      { path: 'profile/:id', loadComponent: () => import('./components/pages/profile/profile.component').then(m => m.ProfileComponent) },
      { path: 'messages/:id', loadComponent: () => import('./components/pages/inbox/messages/messages.component').then(m => m.MessagesComponent) },
      { path: 'listings', loadComponent: () => import('./components/pages/listings/listings.component').then(c => c.ListingsComponent), canActivate: [AuthGuard] },
      { path: 'listing/:id', loadComponent: () => import('./components/pages/listing-details/listing-details.component').then(c => c.ListingDetailsComponent), canActivate: [AuthGuard] },
      { path: 'edit-listing/:id', loadComponent: () => import('./components/pages/listing-edit/listing-edit.component').then(c => c.ListingEditComponent), canActivate: [AuthGuard] },
      { path: 'sales', loadComponent: () => import('./components/pages/sales/sales.component').then(c => c.SalesComponent), canActivate: [AuthGuard] },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
