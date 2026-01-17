import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { AdminGuard } from './guards/admin.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AdminGuard],
    children: [
      { 
        path: '', 
        redirectTo: 'dashboard', 
        pathMatch: 'full' 
      },
      { 
        path: 'dashboard', 
        loadComponent: () => import('./pages/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) 
      },
      { 
        path: 'users', 
        loadComponent: () => import('./pages/user-management/user-management.component').then(m => m.UserManagementComponent) 
      },
      { 
        path: 'posts', 
        loadComponent: () => import('./pages/post-management/post-management.component').then(m => m.PostManagementComponent) 
      },
      { 
        path: 'post-review', 
        loadComponent: () => import('./pages/post-review/post-review.component').then(m => m.PostReviewComponent) 
      },
      { 
        path: 'listings', 
        loadComponent: () => import('./pages/listing-management/listing-management.component').then(m => m.ListingManagementComponent) 
      },
      { 
        path: 'messages', 
        loadComponent: () => import('./pages/message-management/message-moderation.component').then(m => m.MessageModerationComponent) 
      },
      { 
        path: 'reports', 
        loadComponent: () => import('./pages/reports/reports.component').then(m => m.ReportsComponent) 
      },
      { 
        path: 'report-management', 
        loadComponent: () => import('./pages/report-management/report-management.component').then(m => m.ReportManagementComponent) 
      },
      { 
        path: 'archive', 
        loadComponent: () => import('./pages/archive-management/archive-management.component').then(m => m.ArchiveManagementComponent) 
      },
      { 
        path: 'settings', 
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) 
      }
    ]
  }
];
