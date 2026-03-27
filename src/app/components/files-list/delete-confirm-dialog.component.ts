import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface DeleteConfirmDialogData {
  title: string;
  message: string;
}

@Component({
  selector: 'app-delete-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="message">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">Anuluj</button>
      <button mat-flat-button color="warn" (click)="dialogRef.close(true)">Usun</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .message {
      margin: 0;
      color: #4b5563;
      font-size: 14px;
      line-height: 1.6;
    }
  `]
})
export class DeleteConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<DeleteConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteConfirmDialogData
  ) {}
}
