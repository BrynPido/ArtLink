import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { NavigationCancelService } from '../services/navigation-cancel.service';

// Cancels in-flight HTTP requests when the user navigates away
export const cancelOnNavigationInterceptor: HttpInterceptorFn = (req, next) => {
  const navCancel = inject(NavigationCancelService);
  return next(req).pipe(takeUntil(navCancel.cancelRequests$));
};
