import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly tokenKey = 'vaulty_jwt_token';
  private readonly walletKey = 'vaulty_wallet';
  private readonly publicEndpoints = ['/auth/challenge', '/auth/verify'];

  constructor(private router: Router) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isPublicEndpoint = this.publicEndpoints.some(endpoint => request.url.includes(endpoint));

    if (!isPublicEndpoint) {
      const token = localStorage.getItem(this.tokenKey);

      if (token) {
        request = request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          localStorage.removeItem(this.tokenKey);
          localStorage.removeItem(this.walletKey);
          this.router.navigate(['/auth/login']);
        }

        return throwError(() => error);
      })
    );
  }
}
