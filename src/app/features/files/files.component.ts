import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FilesListComponent } from '../../components/files-list/files-list.component';
import { UploadComponent } from '../../components/upload/upload.component';
import { AuthService, AuthState } from '../../core/services/auth.service';
import { WalletService } from '../../core/services/wallet.service';

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatToolbarModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatTooltipModule,
    UploadComponent,
    FilesListComponent
  ],
  template: `
    <div class="files-toolbar">
      <div class="toolbar-content">
        <div class="toolbar-logo">
          <mat-icon class="logo-icon">lock</mat-icon>
          <span class="logo-text">Vaulty</span>
        </div>

        <div class="toolbar-spacer"></div>

        <div class="toolbar-user">
          <div class="user-chip">
            <span class="user-name">{{ getDisplayName() }}</span>
            <span class="user-wallet">{{ formatAddress(walletAddress) }}</span>
          </div>
          <button mat-icon-button [matMenuTriggerFor]="menu" class="user-menu-button" matTooltip="Menu użytkownika">
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #menu="matMenu">
            <button mat-menu-item (click)="onLogout()">
              <mat-icon class="menu-icon" aria-hidden="true">logout</mat-icon>
              <span>Wyloguj się</span>
            </button>
            <button mat-menu-item (click)="onDisconnectWallet()">
              <mat-icon class="menu-icon" aria-hidden="true">link_off</mat-icon>
              <span>Rozłącz portfel</span>
            </button>
          </mat-menu>
        </div>
      </div>
    </div>

    <div class="files-container">
      <div class="files-content">
        <div class="workspace-layout">
          <aside class="files-sidebar">
            <div class="sidebar-brand">
              <div class="brand-lock">
                <mat-icon>lock</mat-icon>
              </div>
              <div class="brand-copy">
                <div class="brand-title">Dysk</div>
                <div class="brand-subtitle">Vaulty</div>
              </div>
            </div>

            <div class="sidebar-upload">
              <app-upload (uploaded)="onUploadComplete()"></app-upload>
            </div>

            <button type="button" class="sidebar-item active drive-home">
              <mat-icon class="sidebar-icon">home</mat-icon>
              <span>Moje pliki</span>
            </button>

            <button type="button" class="sidebar-item" disabled>
              <mat-icon class="sidebar-icon">group</mat-icon>
              <span>Udostępnione mi pliki</span>
              <span class="sidebar-badge">wkrótce</span>
            </button>

            <button type="button" class="sidebar-item" disabled>
              <mat-icon class="sidebar-icon">folder_shared</mat-icon>
              <span>Pliki, które udostępniam</span>
              <span class="sidebar-badge">wkrótce</span>
            </button>
          </aside>

          <div class="content-grid">
            <app-files-list></app-files-list>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background:
        radial-gradient(circle at top left, rgba(66, 133, 244, 0.06), transparent 26%),
        linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%);
    }

    .files-toolbar {
      background: rgba(255, 255, 255, 0.86);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(210, 220, 235, 0.88);
      height: 68px;
      display: flex;
      align-items: center;
      padding: 0 24px;
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.03);
    }

    .toolbar-content {
      display: flex;
      align-items: center;
      width: 100%;
      max-width: 1540px;
      margin: 0 auto;
    }

    .toolbar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-icon {
      font-size: 24px;
    }

    .logo-text {
      font-size: 19px;
      font-weight: 600;
      color: #1f2937;
      letter-spacing: -0.02em;
    }

    .toolbar-spacer {
      flex: 1;
    }

    .toolbar-user {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .user-chip {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding: 10px 14px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(210, 220, 235, 0.9);
    }

    .user-name {
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
    }

    .user-wallet {
      font-size: 11px;
      color: #6b7280;
      font-family: 'Courier New', monospace;
      margin-top: 4px;
    }

    .user-menu-button {
      color: #5f6368;
    }

    .menu-icon {
      width: 22px;
      display: inline-flex;
      justify-content: center;
      margin-right: 8px;
    }

    .files-container {
      flex: 1;
      overflow-y: auto;
      padding: 18px 24px 28px;
    }

    .files-content {
      max-width: 1600px;
      margin: 0 auto;
    }

    .workspace-layout {
      display: grid;
      grid-template-columns: 246px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .files-sidebar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 0;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px 14px;
    }

    .brand-lock {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #0b57d0;
    }

    .brand-lock mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .brand-copy {
      min-width: 0;
    }

    .brand-title {
      font-size: 17px;
      font-weight: 600;
      color: #1f2937;
    }

    .brand-subtitle {
      font-size: 12px;
      color: #6b7280;
      margin-top: 2px;
    }

    .sidebar-upload {
      padding: 0 0 14px 16px;
    }

    .sidebar-item {
      width: 100%;
      min-height: 42px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      border: 0;
      border-radius: 0 999px 999px 0;
      background: transparent;
      color: #1f2937;
      text-align: left;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.16s ease, color 0.16s ease;
    }

    .sidebar-item:hover:not(:disabled) {
      background: rgba(26, 115, 232, 0.08);
    }

    .sidebar-item.active {
      background: #c2e7ff;
      color: #0b57d0;
      font-weight: 600;
    }

    .sidebar-item:disabled {
      cursor: default;
      opacity: 1;
      color: #1f2937;
    }

    .sidebar-icon {
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .sidebar-badge {
      margin-left: auto;
      padding: 3px 8px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.14);
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .content-grid {
      display: grid;
      gap: 16px;
    }

    @media (max-width: 900px) {
      .files-toolbar {
        padding: 0 16px;
      }

      .files-container {
        padding: 20px 16px 24px;
      }

      .workspace-layout {
        grid-template-columns: 1fr;
      }

      .files-sidebar {
        position: static;
        padding-top: 0;
      }

    }

    @media (max-width: 600px) {
      .files-toolbar {
        height: 64px;
        padding: 0 12px;
      }

      .logo-text {
        font-size: 18px;
      }

      .user-wallet {
        display: none;
      }

      .files-container {
        padding: 16px 12px 20px;
      }

      .files-sidebar {
        padding: 0;
      }
    }
  `]
})
export class FilesComponent implements OnInit, OnDestroy {
  walletAddress: string | null = null;
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

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private walletService: WalletService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.walletAddress = this.authService.getWallet();

    this.authService
      .getAuthState$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.authState = state;
        this.walletAddress = state.wallet;

        if (state.isAuthenticated && state.usernameRequired && !state.username) {
          this.router.navigate(['/auth/username']);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  async onDisconnectWallet(): Promise<void> {
    this.authService.logout();
    await this.walletService.disconnect();
    this.router.navigate(['/auth/login']);
  }

  onUploadComplete(): void {
    window.dispatchEvent(new CustomEvent('vaulty-files-refresh'));
  }

  getDisplayName(): string {
    return this.authState.username || 'Nowy użytkownik';
  }

  formatAddress(address: string | null): string {
    if (!address) {
      return '';
    }

    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}
