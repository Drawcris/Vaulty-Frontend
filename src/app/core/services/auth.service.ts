import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { ApiService } from './api.service';
import { WalletService } from './wallet.service';

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  wallet: string | null;
  username: string | null;
  usernameRequired: boolean;
  bootstrapping: boolean;
  loading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'vaulty_jwt_token';
  private readonly WALLET_KEY = 'vaulty_wallet';
  private readonly BOOTSTRAP_TIMEOUT_MS = 6000;

  private authState$ = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    token: null,
    wallet: null,
    username: null,
    usernameRequired: false,
    bootstrapping: false,
    loading: false,
    error: null
  });

  constructor(
    private walletService: WalletService,
    private apiService: ApiService
  ) {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    const token = this.getStoredToken();
    const wallet = this.getStoredWallet();

    if (token && wallet) {
      void this.bootstrapStoredSession(token, wallet);
    } else {
      this.updateState({ bootstrapping: false });
    }

    this.walletService.getWalletState$().subscribe(walletState => {
      if (!walletState.isConnected && this.authState$.value.isAuthenticated) {
        this.logout();
      }
    });
  }

  private async bootstrapStoredSession(token: string, wallet: string): Promise<void> {
    this.updateState({ bootstrapping: true, error: null });

    try {
      const restoredWallet = await this.withTimeout(
        this.walletService.restoreConnection(),
        this.BOOTSTRAP_TIMEOUT_MS,
        false
      );

      if (!restoredWallet) {
        this.clearStoredAuth();
        this.updateState({
          isAuthenticated: false,
          token: null,
          wallet: null,
          username: null,
          usernameRequired: false,
          error: null
        });
        return;
      }

      await this.withTimeout(
        this.verifyStoredToken(token, wallet),
        this.BOOTSTRAP_TIMEOUT_MS
      );
    } catch (error) {
      this.clearStoredAuth();
      this.updateState({
        isAuthenticated: false,
        token: null,
        wallet: null,
        username: null,
        usernameRequired: false,
        error: 'Nie udalo sie odtworzyc zapisanej sesji.'
      });
    } finally {
      this.updateState({ bootstrapping: false });
    }
  }

  private async verifyStoredToken(token: string, wallet: string): Promise<void> {
    try {
      const userInfo = await this.apiService.getCurrentUser();

      this.updateState({
        isAuthenticated: true,
        token,
        wallet,
        username: userInfo.username ?? null,
        usernameRequired: !!userInfo.username_required,
        error: null
      });

      console.log('Token verified successfully');
    } catch (error) {
      this.clearStoredAuth();
      this.updateState({
        isAuthenticated: false,
        token: null,
        wallet: null,
        username: null,
        usernameRequired: false,
        loading: false,
        error: 'Token invalid or expired'
      });
      throw error;
    }
  }

  async login(wallet: string): Promise<void> {
    try {
      this.updateState({ loading: true, error: null });

      console.log('[Auth] Step 1: Requesting challenge...');
      const challengeResponse = await this.apiService.requestChallenge(wallet);

      console.log('[Auth] Step 2: Signing message...');
      const signature = await this.walletService.signMessage(challengeResponse.challenge);

      console.log('[Auth] Step 3: Verifying signature...');
      const verifyResponse = await this.apiService.verifySignature(wallet, signature);

      console.log('[Auth] Step 4: Storing token...');
      const token = verifyResponse.token;
      this.storeToken(token);
      this.storeWallet(wallet);

      this.updateState({
        isAuthenticated: true,
        token,
        wallet,
        username: verifyResponse.username ?? null,
        usernameRequired: !!verifyResponse.username_required,
        bootstrapping: false,
        error: null
      });

      console.log('[Auth] Login successful!');
    } catch (error) {
      const errorMessage = this.getReadableError(error, 'Login failed');
      console.error('[Auth] Login failed:', errorMessage);

      this.updateState({
        isAuthenticated: false,
        token: null,
        wallet: null,
        username: null,
        usernameRequired: false,
        bootstrapping: false,
        error: errorMessage
      });

      throw error;
    } finally {
      this.updateState({ loading: false });
    }
  }

  async setUsername(username: string): Promise<void> {
    try {
      this.updateState({ loading: true, error: null });
      const profile = await this.apiService.setUsername(username);

      this.updateState({
        username: profile.username ?? username,
        usernameRequired: false,
        bootstrapping: false,
        error: null
      });
    } catch (error) {
      const errorMessage = this.getReadableError(error, 'Setting username failed');
      this.updateState({ error: errorMessage });
      throw error;
    } finally {
      this.updateState({ loading: false });
    }
  }

  logout(): void {
    this.clearStoredAuth();
    this.updateState({
      isAuthenticated: false,
      token: null,
      wallet: null,
      username: null,
      usernameRequired: false,
      bootstrapping: false,
      loading: false,
      error: null
    });
    console.log('[Auth] Logged out');
  }

  getToken(): string | null {
    return this.authState$.value.token;
  }

  getWallet(): string | null {
    return this.authState$.value.wallet;
  }

  getUsername(): string | null {
    return this.authState$.value.username;
  }

  isAuthenticated(): boolean {
    return this.authState$.value.isAuthenticated;
  }

  hasStoredSession(): boolean {
    return !!this.getStoredToken() && !!this.getStoredWallet();
  }

  requiresUsername(): boolean {
    return this.authState$.value.usernameRequired;
  }

  getAuthState$(): Observable<AuthState> {
    return this.authState$.asObservable();
  }

  isLoading$(): Observable<boolean> {
    return new Observable(observer => {
      const subscription = this.authState$.subscribe(state => {
        observer.next(state.loading);
      });
      return () => subscription.unsubscribe();
    });
  }

  getError$(): Observable<string | null> {
    return new Observable(observer => {
      const subscription = this.authState$.subscribe(state => {
        observer.next(state.error);
      });
      return () => subscription.unsubscribe();
    });
  }

  private storeToken(token: string): void {
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      return null;
    }
  }

  private storeWallet(wallet: string): void {
    try {
      localStorage.setItem(this.WALLET_KEY, wallet);
    } catch (error) {
      console.error('Failed to store wallet:', error);
    }
  }

  private getStoredWallet(): string | null {
    try {
      return localStorage.getItem(this.WALLET_KEY);
    } catch (error) {
      console.error('Failed to retrieve wallet:', error);
      return null;
    }
  }

  private clearStoredAuth(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.WALLET_KEY);
    } catch (error) {
      console.error('Failed to clear stored auth:', error);
    }
  }

  private updateState(partial: Partial<AuthState>): void {
    const currentState = this.authState$.value;
    this.authState$.next({ ...currentState, ...partial });
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue?: T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (fallbackValue !== undefined) {
          resolve(fallbackValue);
          return;
        }

        reject(new Error('Bootstrap timeout'));
      }, timeoutMs);

      promise
        .then(value => {
          window.clearTimeout(timeoutId);
          resolve(value);
        })
        .catch(error => {
          window.clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private getReadableError(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    return fallback;
  }
}
