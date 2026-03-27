import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() || authService.hasStoredSession()) {
    return true;
  }

  // Nie jesteś zalogowany, przekieruj na login
  console.log('[AuthGuard] User not authenticated, redirecting to login');
  router.navigate(['/auth/login']);
  return false;
};

