import { Routes } from '@angular/router';
import { LoginComponent } from './_auth/login/login.component';
import { RegisterComponent } from './_auth/register/register.component';
import { AuthLayoutComponent } from './_auth/auth-layout/auth-layout.component';
import { LayoutComponent } from './components/layout/layout.component';
import { HomeComponent } from './components/pages/home/home.component';
import { ExploreComponent } from './components/pages/explore/explore.component';
import { InboxComponent } from './components/pages/inbox/inbox.component';
import { SavedComponent } from './components/pages/saved/saved.component';
import { CreatePostComponent } from './components/pages/createpost/createpost.component';
import { AuthGuard } from './services/_auth/auth.guard';
import { ImageeditComponent } from './components/pages/imageedit/imageedit.component';

export const routes: Routes = [
    {
        path: '',
        component: AuthLayoutComponent,
        children: [
          { path: '', redirectTo: 'login', pathMatch: 'full' },
          { path: 'login', component: LoginComponent },
          { path: 'register', component: RegisterComponent },
        ],
      },
      {
        path: '',
        component: LayoutComponent,
        canActivate: [AuthGuard], // Protect these routes
        children: [
          { path: 'home', component: HomeComponent },
          { path: 'explore', component: ExploreComponent },
          { path: 'inbox', component: InboxComponent },
          { path: 'saved', component: SavedComponent },
          { path: 'create', component: CreatePostComponent },
          { path: 'edit-image/:index', component: ImageeditComponent },
        ],
      },
      { path: '**', redirectTo: 'login' },
];
