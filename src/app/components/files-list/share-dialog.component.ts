import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { UserFile } from '../../core/services/files.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatSelectModule,
    MatOptionModule
  ],
  template: `
    <div style="padding: 16px;">
      <h2 mat-dialog-title style="margin-bottom: 8px;">{{ isEdit ? 'Edytuj uprawnienia on-chain' : 'Udostępnij plik on-chain' }}</h2>
      <mat-dialog-content style="margin-bottom: 20px;">
        <p style="font-size: 14px; color: #5f6368; margin-bottom: 24px;">
          Udostępniasz plik: <strong style="color: #202124;">{{ data.file.filename }}</strong>
          <br>
          <small>Ta operacja wymaga potwierdzenia transakcji w MetaMask.</small>
        </p>
        
        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>{{ isEdit ? 'Adres portfela (Tylko do odczytu)' : 'Odbiorca (Adres portfela lub Username)' }}</mat-label>
          <input matInput 
                 [(ngModel)]="walletAddress" 
                 [placeholder]="isEdit ? '' : 'Wprowadź 0x... lub nazwę użytkownika'" 
                 [readonly]="isEdit" 
                 [matAutocomplete]="auto"
                 (ngModelChange)="onInputChange($event)"
                 required>
          <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onOptionSelected($event)">
            <mat-option *ngFor="let user of suggestedUsers" [value]="user.username">
              <div style="display: flex; flex-direction: column; line-height: 1.4; padding: 4px 0;">
                <span style="font-weight: 600; font-size: 14px; color: #1a73e8;">{{ user.username }}</span>
                <span style="font-size: 11px; color: #5f6368; font-family: 'Roboto Mono', monospace;">{{ user.wallet }}</span>
              </div>
            </mat-option>
            <mat-option *ngIf="suggestedUsers.length === 0 && walletAddress.length >= 1" disabled>
              <span style="font-size: 12px; color: #9aa0a6;">Nie znaleziono użytkownika...</span>
            </mat-option>
          </mat-autocomplete>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Dostęp wygaśnie po:</mat-label>
          <mat-select [(ngModel)]="expiryDays">
            <mat-option [value]="1">1 dzień</mat-option>
            <mat-option [value]="7">7 dni</mat-option>
            <mat-option [value]="30">30 dni</mat-option>
            <mat-option [value]="365">1 rok</mat-option>
            <mat-option [value]="99999">Bezterminowo</mat-option>
          </mat-select>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end" style="padding-top: 12px; border-top: 1px solid #eee;">
        <button mat-button (click)="onCancel()" style="color: #5f6368;">Anuluj</button>
        <button mat-flat-button color="primary" 
                [disabled]="!isValidAddress()" 
                (click)="onConfirm()"
                style="background: #1a73e8;">
          {{ isEdit ? 'Zatwierdź zmiany' : 'Udostępnij' }}
        </button>
      </mat-dialog-actions>
    </div>
  `
})
export class ShareDialogComponent {
  walletAddress = '';
  expiryDays = 7;
  isEdit = false;
  suggestedUsers: any[] = [];
  private searchTimeout: any;

  constructor(
    public dialogRef: MatDialogRef<ShareDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { file: UserFile, initialWallet?: string, initialExpiry?: number },
    private authService: AuthService
  ) {
    if (data.initialWallet) {
      this.walletAddress = data.initialWallet;
      this.isEdit = true;
    }
    if (data.initialExpiry !== undefined) {
      this.expiryDays = data.initialExpiry;
    }
  }

  onInputChange(val: string): void {
    if (this.isEdit || !val || val.length < 1) {
      this.suggestedUsers = [];
      return;
    }

    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(async () => {
      try {
        const users = await this.authService.searchUsers(val);
        const currentWallet = this.authService.getWallet();
        
        // Nie podpowiadaj samego siebie
        this.suggestedUsers = users.filter((u: any) => 
          u.wallet.toLowerCase() !== currentWallet?.toLowerCase()
        );
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 300);
  }

  onOptionSelected(event: any): void {
    const username = event.option.value;
    const user = this.suggestedUsers.find(u => u.username === username);
    if (user) {
      // Możemy zostawić username, mechanizm shareFile i tak rozwiąże go na wallet
      this.walletAddress = user.username;
    }
  }

  isValidAddress(): boolean {
    const trimmed = this.walletAddress.trim();
    // Allow either a valid 0x address OR a username (at least 3 characters)
    return /^0x[a-fA-F0-9]{40}$/.test(trimmed) || (trimmed.length >= 3 && !trimmed.startsWith('0x'));
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    this.dialogRef.close({
      walletAddress: this.walletAddress.trim(),
      expiryDays: this.expiryDays
    });
  }
}
