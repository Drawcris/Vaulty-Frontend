import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { UserFile } from '../../core/services/files.service';

@Component({
  selector: 'app-file-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule
  ],
  template: `
    <div style="padding: 24px;">
      <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px;">
        <div style="background: #e8eaed; color: #5f6368; border-radius: 8px; padding: 16px; display: flex;">
          <mat-icon style="font-size: 32px; width: 32px; height: 32px;">insert_drive_file</mat-icon>
        </div>
        <div style="flex: 1; min-width: 0;">
          <h2 mat-dialog-title style="margin: 0; padding: 0; font-size: 20px; font-weight: 500; color: #202124; word-break: break-all;">
            {{ getFilename() }}
          </h2>
          <div style="color: #5f6368; font-size: 13px; margin-top: 4px;">Informacje o pliku</div>
        </div>
      </div>

      <mat-dialog-content style="padding: 0; margin-bottom: 24px; overflow: visible;">
        <div style="display: flex; flex-direction: column; gap: 18px;">
          <div>
            <div style="font-size: 12px; font-weight: 500; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Adres IPFS (CID)</div>
            <div style="font-size: 13px; font-family: monospace; background: #f8f9fa; padding: 12px; border-radius: 6px; color: #202124; word-break: break-all; border: 1px solid #e8eaed;">
              {{ data.file.cid }}
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <div style="font-size: 12px; font-weight: 500; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Identyfikator rekordu</div>
                <div style="font-size: 14px; color: #202124;">{{ data.file.id }}</div>
              </div>
              <div>
                <div style="font-size: 12px; font-weight: 500; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Status szyfrowania</div>
                <div style="font-size: 14px; color: #202124;">
                   <span style="background: #e6f4ea; color: #137333; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                     {{ data.file.encryption_type || 'Brak' }}
                   </span>
                </div>
              </div>
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 500; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Data wgrania</div>
            <div style="font-size: 14px; color: #202124;">{{ formatDate(data.file.upload_date) }}</div>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" style="padding: 0;">
        <button mat-button (click)="onClose()" style="color: #1a73e8; font-weight: 500; letter-spacing: 0.25px;">Zamknij</button>
      </mat-dialog-actions>
    </div>
  `
})
export class FileDetailsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<FileDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { file: UserFile }
  ) {}

  getFilename(): string {
    return this.data.file.filename?.trim() || 'Plik #' + this.data.file.id;
  }

  formatDate(val: string): string {
    return new Date(val).toLocaleString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'});
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
