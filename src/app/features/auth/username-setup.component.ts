import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService, AuthState } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-username-setup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="setup-shell">
      <div class="background-orb orb-one"></div>
      <div class="background-orb orb-two"></div>

      <mat-card class="setup-card">
        <div class="setup-header">
          <div class="setup-badge">
            <mat-icon>person</mat-icon>
          </div>
          <p class="eyebrow">Ostatni krok</p>
          <h1>Wybierz swój username</h1>
          <p class="subtitle">
            To Twoja publiczna nazwa w Vaulty. Dzięki niej inni użytkownicy udostępnią Ci pliki po aliasie,
            bez wpisywania adresu portfela.
          </p>
        </div>

        <div class="wallet-box">
          <span class="wallet-label">Zalogowany portfel</span>
          <span class="wallet-value">{{ formatAddress(authState.wallet) }}</span>
        </div>

        @if (errorMessage) {
          <div class="feedback error">{{ errorMessage }}</div>
        }

        @if (successMessage) {
          <div class="feedback success">{{ successMessage }}</div>
        }

        <mat-form-field appearance="outline" class="username-field">
          <mat-label>Username</mat-label>
          <input
            matInput
            [(ngModel)]="pendingUsername"
            maxlength="20"
            placeholder="np. maciej_01"
            [disabled]="isSubmitting || !!successMessage"
          />
          <mat-hint>3-20 znaków, litery, cyfry i underscore</mat-hint>
        </mat-form-field>

        <div class="actions">
          <button
            mat-stroked-button
            class="logout-button"
            (click)="onLogout()"
            [disabled]="isSubmitting"
          >
            Wyloguj się
          </button>

          <button
            mat-flat-button
            color="primary"
            class="submit-button"
            (click)="onSubmit()"
            [disabled]="isSubmitting || !!successMessage"
          >
            @if (isSubmitting) {
              <mat-spinner diameter="18"></mat-spinner>
              <span>Zapisywanie...</span>
            } @else if (successMessage) {
              <span>Gotowe</span>
            } @else {
              <span>Zapisz username</span>
            }
          </button>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(66, 133, 244, 0.16), transparent 30%),
        radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.12), transparent 28%),
        linear-gradient(180deg, #f8fbff 0%, #eff4fb 100%);
    }

    .setup-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      position: relative;
      overflow: hidden;
    }

    .background-orb {
      position: absolute;
      border-radius: 999px;
      filter: blur(6px);
      pointer-events: none;
    }

    .orb-one {
      width: 260px;
      height: 260px;
      top: 8%;
      left: -60px;
      background: rgba(66, 133, 244, 0.12);
    }

    .orb-two {
      width: 320px;
      height: 320px;
      right: -80px;
      bottom: -40px;
      background: rgba(16, 185, 129, 0.1);
    }

    .setup-card {
      width: min(100%, 560px);
      padding: 34px;
      border-radius: 28px;
      border: 1px solid rgba(214, 225, 240, 0.9);
      box-shadow: 0 28px 80px rgba(15, 23, 42, 0.12);
      background: rgba(255, 255, 255, 0.96);
      position: relative;
      z-index: 1;
    }

    .setup-header {
      margin-bottom: 24px;
    }

    .setup-badge {
      width: 56px;
      height: 56px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #4285f4 0%, #1a56db 100%);
      color: #fff;
      box-shadow: 0 16px 28px rgba(66, 133, 244, 0.24);
      margin-bottom: 18px;
    }

    .setup-badge mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .eyebrow {
      margin: 0 0 6px 0;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #4285f4;
    }

    h1 {
      margin: 0 0 10px 0;
      font-size: 32px;
      line-height: 1.05;
      letter-spacing: -0.04em;
      color: #111827;
    }

    .subtitle {
      margin: 0;
      color: #4b5563;
      font-size: 14px;
      line-height: 1.7;
    }

    .wallet-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
      padding: 16px 18px;
      border-radius: 18px;
      background: rgba(66, 133, 244, 0.06);
      border: 1px solid rgba(66, 133, 244, 0.12);
    }

    .wallet-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #4b5563;
    }

    .wallet-value {
      font-size: 13px;
      color: #111827;
      font-family: 'Courier New', monospace;
    }

    .feedback {
      border-radius: 14px;
      padding: 12px 14px;
      margin-bottom: 16px;
      font-size: 14px;
    }

    .feedback.error {
      background: #fce8e6;
      color: #c5221f;
      border: 1px solid #f6c7c1;
    }

    .feedback.success {
      background: #e6f4ea;
      color: #188038;
      border: 1px solid #cce7d3;
    }

    .username-field {
      width: 100%;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 18px;
    }

    .logout-button,
    .submit-button {
      min-width: 160px;
      height: 46px;
      border-radius: 12px;
      font-weight: 700;
    }

    .submit-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 12px 24px rgba(66, 133, 244, 0.2);
    }

    @media (max-width: 600px) {
      .setup-card {
        padding: 24px;
        border-radius: 22px;
      }

      h1 {
        font-size: 26px;
      }

      .wallet-box {
        flex-direction: column;
        align-items: flex-start;
      }

      .actions {
        flex-direction: column;
      }

      .logout-button,
      .submit-button {
        width: 100%;
      }
    }
  `]
})
export class UsernameSetupComponent implements OnInit, OnDestroy {
  authState: AuthState = {
    isAuthenticated: false,
    token: null,
    wallet: null,
    username: null,
    usernameRequired: false,
    bootstrapping: false,
    loading: false,
    error: null
  };

  pendingUsername = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService
      .getAuthState$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.authState = state;

        if (!state.isAuthenticated && !this.authService.hasStoredSession()) {
          this.router.navigate(['/auth/login']);
          return;
        }

        if (state.username && !state.usernameRequired) {
          this.router.navigate(['/files']);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async onSubmit(): Promise<void> {
    try {
      this.errorMessage = '';
      this.isSubmitting = true;
      const username = this.pendingUsername.trim();

      if (!username) {
        throw new Error('Podaj username.');
      }

      await this.authService.setUsername(username);
      this.notificationService.success('Username został zapisany.');
      this.successMessage = 'Username zapisany pomyślnie. Za chwilę przejdziemy do aplikacji.';

      setTimeout(() => {
        this.router.navigate(['/files']);
      }, 1200);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Nie udało się zapisać username.';
      this.notificationService.error(this.errorMessage);
    } finally {
      this.isSubmitting = false;
    }
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  formatAddress(address: string | null): string {
    if (!address) {
      return '';
    }

    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}
