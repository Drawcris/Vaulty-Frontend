import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { CryptoService } from './crypto.service';
import { FilesService, UserFile, UserFolder, FolderContentResponse } from './files.service';
import { WalletService } from './wallet.service';

export interface DownloadProgress {
  current: number;
  total: number;
  filename: string;
}

@Injectable({
  providedIn: 'root'
})
export class DownloadService {

  constructor(
    private apiService: ApiService,
    private cryptoService: CryptoService,
    private filesService: FilesService,
    private walletService: WalletService
  ) {}

  /**
   * Pobiera i odszyfrowuje jeden plik, zwraca Uint8Array
   */
  async downloadAndDecrypt(file: UserFile, wallet: string): Promise<Uint8Array> {
    const result = await this.apiService.downloadFileRaw(file.id);
    const encryptedData = await result.blob.arrayBuffer();

    let cek: Uint8Array;
    if (!result.encryptedCek) {
      throw new Error('Brak zaszyfrowanego klucza pliku. Prawdopodobnie stary format (bez hybrydowego E2EE).');
    }
    const decryptedCekBase64 = await this.walletService.decryptEncryptionKey(result.encryptedCek, wallet);
    cek = this.cryptoService.parseDecryptedCEK(decryptedCekBase64);

    return this.cryptoService.decryptFile(encryptedData, cek);
  }

  /**
   * Pobiera wiele plików jako ZIP. Callback onProgress wywoływany po każdym pliku.
   */
  async downloadFilesAsZip(
    files: UserFile[],
    wallet: string,
    zipName: string,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<void> {
    const zip = new JSZip();
    let current = 0;

    for (const file of files) {
      const filename = file.filename?.trim() || `plik_${file.id}`;
      onProgress?.({ current, total: files.length, filename });

      const decrypted = await this.downloadAndDecrypt(file, wallet);
      zip.file(filename, decrypted);
      current++;
    }

    onProgress?.({ current: files.length, total: files.length, filename: '' });

    const content = await zip.generateAsync({ type: 'blob' });
    this.triggerDownload(content, `${zipName}.zip`);
  }

  /**
   * Rekurencyjnie zbiera wszystkie pliki z folderu i podfolderów.
   * Zwraca listę { file, path } zachowując strukturę katalogów.
   */
  async collectFolderFiles(
    folderId: number | null,
    pathPrefix: string = ''
  ): Promise<{ file: UserFile; path: string }[]> {
    const contents: FolderContentResponse = await firstValueFrom(
      this.filesService.getFolderContents(folderId)
    );

    const results: { file: UserFile; path: string }[] = [];

    // Pliki w bieżącym folderze
    for (const file of contents.files) {
      const filename = file.filename?.trim() || `plik_${file.id}`;
      results.push({ file, path: pathPrefix ? `${pathPrefix}/${filename}` : filename });
    }

    // Rekurencja przez podfoldery
    for (const folder of contents.folders) {
      const subPath = pathPrefix ? `${pathPrefix}/${folder.name}` : folder.name;
      const subFiles = await this.collectFolderFiles(folder.id, subPath);
      results.push(...subFiles);
    }

    return results;
  }

  /**
   * Pobiera cały folder (rekurencyjnie) jako ZIP ze strukturą katalogów.
   */
  async downloadFolderAsZip(
    folder: UserFolder,
    wallet: string,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<void> {
    const allFiles = await this.collectFolderFiles(folder.id, folder.name);

    if (allFiles.length === 0) {
      throw new Error('Folder jest pusty');
    }

    const zip = new JSZip();
    let current = 0;

    for (const { file, path } of allFiles) {
      onProgress?.({ current, total: allFiles.length, filename: path });
      const decrypted = await this.downloadAndDecrypt(file, wallet);
      zip.file(path, decrypted);
      current++;
    }

    onProgress?.({ current: allFiles.length, total: allFiles.length, filename: '' });

    const content = await zip.generateAsync({ type: 'blob' });
    this.triggerDownload(content, `${folder.name}.zip`);
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
