import { Injectable } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationCancelService {
  // Emits on every navigation start to allow canceling in-flight requests
  readonly cancelRequests$ = new Subject<void>();

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationStart))
      .subscribe(() => {
        // Signal cancellation to subscribers
        this.cancelRequests$.next();
      });
  }
}
