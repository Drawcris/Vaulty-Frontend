import { Injectable } from '@angular/core';

export interface EncryptedFilePayload {
  encryptedData: ArrayBuffer;
  key: string;
  iv: string;
}

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  async generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encryptFile(file: ArrayBuffer): Promise<EncryptedFilePayload> {
    const key = await this.generateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      file
    );

    const exportedKey = await crypto.subtle.exportKey('raw', key);

    return {
      encryptedData: encrypted,
      key: this.arrayBufferToBase64(exportedKey),
      iv: this.arrayBufferToBase64(iv.buffer)
    };
  }

  async decryptFile(
    encryptedData: ArrayBuffer,
    keyBase64: string,
    ivBase64: string
  ): Promise<ArrayBuffer> {
    const keyBuffer = this.base64ToArrayBuffer(keyBase64);

    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      'AES-GCM',
      false,
      ['decrypt']
    );

    const iv = new Uint8Array(this.base64ToArrayBuffer(ivBase64));

    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);

    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
  }
}
