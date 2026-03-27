import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface RenameFileDialogData {
  filename: string;
}

@Component({
  selector: 'app-rename-file-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <h2 mat-dialog-title>Zmien nazwe pliku</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="field">
        <mat-label>Nazwa pliku</mat-label>
        <input matInput [(ngModel)]="filename" maxlength="255" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(null)">Anuluj</button>
      <button mat-flat-button color="primary" (click)="confirm()">Zapisz</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .field {
      width: 100%;
      margin-top: 8px;
    }
  `]
})
export class RenameFileDialogComponent {
  filename: string;

  constructor(
    public dialogRef: MatDialogRef<RenameFileDialogComponent, string | null>,
    @Inject(MAT_DIALOG_DATA) data: RenameFileDialogData
  ) {
    this.filename = data.filename;
  }

  confirm(): void {
    const trimmed = this.filename.trim();
    this.dialogRef.close(trimmed || null);
  }
}
