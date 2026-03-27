import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface UploadNameDialogData {
  suggestedName: string;
}

@Component({
  selector: 'app-upload-name-dialog',
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
    <h2 mat-dialog-title>Nazwa pliku</h2>

    <mat-dialog-content>
      <p class="dialog-copy">Podaj nazwe, pod jaka plik ma byc widoczny w aplikacji.</p>

      <mat-form-field appearance="outline" class="dialog-field">
        <mat-label>Nazwa pliku</mat-label>
        <input matInput [(ngModel)]="fileName" maxlength="255" />
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Anuluj</button>
      <button mat-flat-button color="primary" (click)="onConfirm()">Zapisz</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-copy {
      margin: 0 0 16px 0;
      color: #4b5563;
      font-size: 14px;
      line-height: 1.5;
    }

    .dialog-field {
      width: 100%;
    }
  `]
})
export class UploadNameDialogComponent {
  fileName: string;

  constructor(
    private dialogRef: MatDialogRef<UploadNameDialogComponent, string | null>,
    @Inject(MAT_DIALOG_DATA) data: UploadNameDialogData
  ) {
    this.fileName = data.suggestedName;
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onConfirm(): void {
    const trimmed = this.fileName.trim();
    this.dialogRef.close(trimmed || null);
  }
}
