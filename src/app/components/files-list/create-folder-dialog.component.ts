import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-create-folder-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  template: `
    <div style="padding: 24px 24px 16px 24px;">
      <h2 mat-dialog-title style="margin: 0 0 16px 0; padding: 0; font-weight: 400; font-size: 24px; color: #202124;">Nowy folder</h2>
      
      <mat-dialog-content style="padding: 0; margin-bottom: 24px; overflow: visible;">
        <mat-form-field appearance="outline" style="width: 100%; font-size: 15px;">
          <mat-label>Wpisz nazwę</mat-label>
          <input matInput [(ngModel)]="folderName" cdkFocusInitial placeholder="np. Dokumenty prywatne" (keyup.enter)="onConfirm()">
        </mat-form-field>
      </mat-dialog-content>
      
      <mat-dialog-actions align="end" style="padding: 0;">
        <button mat-button (click)="onCancel()" style="color: #1a73e8; font-weight: 500; letter-spacing: 0.25px; margin-right: 8px;">Anuluj</button>
        <button mat-flat-button color="primary" [disabled]="!folderName.trim()" (click)="onConfirm()" style="background-color: #1a73e8; border-radius: 4px; font-weight: 500; letter-spacing: 0.25px; padding: 0 24px;">Utwórz</button>
      </mat-dialog-actions>
    </div>
  `
})
export class CreateFolderDialogComponent {
  folderName = '';

  constructor(
    public dialogRef: MatDialogRef<CreateFolderDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.folderName.trim()) {
      this.dialogRef.close(this.folderName.trim());
    }
  }
}
