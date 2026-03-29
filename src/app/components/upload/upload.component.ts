import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, HostListener } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../core/services/auth.service';
import { CryptoService } from '../../core/services/crypto.service';
import { FilesService, UploadFileResponse } from '../../core/services/files.service';
import { sha256 } from '../../utils/hash.util';
import { UploadNameDialogComponent } from './upload-name-dialog.component';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  @Output() uploaded = new EventEmitter<void>();

  isUploading = false;
  progressValue = 0;
  progressLabel = '';
  uploadMessage = '';
  uploadError = '';
  lastDebugFileName = '';
  activeFileName = '';
  showToast = false;

  currentFolderId: number | null = null;

  @HostListener('window:vaulty-folder-changed', ['$event'])
  onFolderChanged(event: Event): void {
    const customEvent = event as CustomEvent;
    this.currentFolderId = customEvent.detail;
  }

  constructor(
    private authService: AuthService,
    private cryptoService: CryptoService,
    private filesService: FilesService,
    private dialog: MatDialog
  ) {}

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || this.isUploading) {
      return;
    }

    const chosenName = await this.askForFileName(file.name);
    if (!chosenName) {
      input.value = '';
      return;
    }

    try {
      this.isUploading = true;
      this.showToast = true;
      this.progressValue = 8;
      this.progressLabel = 'Przygotowanie pliku';
      this.uploadMessage = '';
      this.uploadError = '';
      this.lastDebugFileName = '';
      this.activeFileName = chosenName;

      const dotIndex = file.name.lastIndexOf('.');
      const originalExt = dotIndex > 0 ? file.name.substring(dotIndex) : '';
      const finalFilename = chosenName.toLowerCase().endsWith(originalExt.toLowerCase()) 
        ? chosenName 
        : `${chosenName}${originalExt}`;

      const fileBuffer = await file.arrayBuffer();
      const wallet = this.authService.getWallet();

      if (!wallet) {
        throw new Error('Brak zdefiniowanego portfela');
      }

      this.progressValue = 30;
      this.progressLabel = 'Szyfrowanie AES-256';
      const encryptedBytes = await this.cryptoService.encryptFile(fileBuffer, wallet);

      const encryptedBlob = new Blob([encryptedBytes as any], {
        type: 'application/octet-stream'
      });
      const encryptedBuffer = await encryptedBlob.arrayBuffer();

      this.progressValue = 55;
      this.progressLabel = 'Liczenie SHA-256';
      const hash = await sha256(encryptedBuffer);

      this.progressValue = 72;
      this.progressLabel = 'Zapisywanie kopii testowej';
      this.saveEncryptedDebugCopy(file.name, encryptedBlob);

      this.progressValue = 88;
      this.progressLabel = 'Upload do backendu';
      const response = await firstValueFrom(
        this.filesService.uploadFile(
          encryptedBlob,
          hash,
          'AES_256',
          finalFilename,
          this.currentFolderId,
          `${file.name}.vaulty.enc`
        )
      );

      this.progressValue = 100;
      this.progressLabel = 'Gotowe';
      this.uploadMessage = `Plik "${response.filename ?? finalFilename}" zostal zapisany.`;
      this.uploaded.emit();
      input.value = '';

      setTimeout(() => {
        if (!this.isUploading) {
          this.showToast = false;
          this.uploadMessage = '';
          this.lastDebugFileName = '';
          this.progressValue = 0;
          this.progressLabel = '';
        }
      }, 2200);
    } catch (error) {
      this.uploadError = this.getReadableError(error);
      this.progressValue = 0;
      this.progressLabel = '';
    } finally {
      this.isUploading = false;
    }
  }

  closeToast(): void {
    if (this.isUploading) {
      return;
    }

    this.showToast = false;
    this.uploadMessage = '';
    this.uploadError = '';
    this.lastDebugFileName = '';
    this.progressValue = 0;
    this.progressLabel = '';
  }

  private async askForFileName(originalFileName: string): Promise<string | null> {
    const suggestedName = this.stripExtension(originalFileName);
    const dialogRef = this.dialog.open(UploadNameDialogComponent, {
      width: '420px',
      data: { suggestedName },
      autoFocus: false
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return typeof result === 'string' ? result.trim() : null;
  }

  private stripExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  }



  private saveEncryptedDebugCopy(originalFileName: string, encryptedBlob: Blob): void {
    const debugFileName = `${originalFileName}.vaulty.enc`;
    const url = URL.createObjectURL(encryptedBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = debugFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.lastDebugFileName = debugFileName;
  }

  private getReadableError(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const serverError = (error as { error?: { detail?: string } }).error;
      if (serverError?.detail) {
        return serverError.detail;
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Nie udalo sie zaszyfrowac lub wyslac pliku.';
  }
}
