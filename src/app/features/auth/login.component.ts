import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService, AuthState } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { WalletService, WalletState } from '../../core/services/wallet.service';
import { MetamaskOnboardingComponent } from './metamask-onboarding.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MetamaskOnboardingComponent
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  walletState: WalletState = {
    address: null,
    isConnected: false,
    chainId: null,
    error: null
  };

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

  isMetaMaskInstalled = false;
  showError = false;

  private destroy$ = new Subject<void>();

  constructor(
    private walletService: WalletService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isMetaMaskInstalled = this.walletService.isMetaMaskInstalled();

    this.walletService
      .getWalletState$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.walletState = state;
      });

    this.authService
      .getAuthState$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.authState = state;

        if (state.isAuthenticated) {
          const targetRoute = state.usernameRequired ? '/auth/username' : '/files';
          console.log(`[LoginComponent] Authenticated, redirecting to ${targetRoute}`);
          setTimeout(() => {
            this.router.navigate([targetRoute]);
          }, 1000);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async onConnectWallet(): Promise<void> {
    try {
      this.showError = false;
      const walletAddress = await this.walletService.connectWallet();
      console.log('[LoginComponent] Wallet connected:', walletAddress);
      await this.onLogin();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      console.error('[LoginComponent] Error connecting wallet:', errorMessage);
      this.showError = true;
      setTimeout(() => {
        this.showError = false;
      }, 5000);
    }
  }

  async onLogin(): Promise<void> {
    try {
      this.showError = false;
      if (!this.walletState.address) {
        throw new Error('Wallet not connected. Connect wallet first.');
      }

      await this.authService.login(this.walletState.address);
      this.notificationService.success('Logowanie zakończyło się sukcesem.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      console.error('[LoginComponent] Error logging in:', errorMessage);
      this.notificationService.error(errorMessage);
      this.showError = true;
      setTimeout(() => {
        this.showError = false;
      }, 5000);
    }
  }

  async onDisconnect(): Promise<void> {
    try {
      this.showError = false;
      await this.walletService.disconnect();
      this.authService.logout();
      console.log('[LoginComponent] Disconnected');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect';
      console.error('[LoginComponent] Error disconnecting:', errorMessage);
    }
  }

  getErrorMessage(): string {
    if (this.walletState.error) {
      return this.walletState.error;
    }
    if (this.authState.error) {
      return this.authState.error;
    }
    return '';
  }

  formatAddress(address: string | null): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}
