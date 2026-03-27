import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}

  success(message: string): void {
    this.snackBar.open(message, '×', {
      duration: 3200,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass: ['vaulty-snackbar', 'vaulty-snackbar-success']
    });
  }

  error(message: string): void {
    this.snackBar.open(message, '×', {
      duration: 4600,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass: ['vaulty-snackbar', 'vaulty-snackbar-error']
    });
  }
}
