import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { UsernameSetupComponent } from './features/auth/username-setup.component';
import { FilesComponent } from './features/files/files.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth/login',
    component: LoginComponent
  },
  {
    path: 'auth/username',
    component: UsernameSetupComponent,
    canActivate: [authGuard]
  },
  {
    path: 'files',
    component: FilesComponent,
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];
