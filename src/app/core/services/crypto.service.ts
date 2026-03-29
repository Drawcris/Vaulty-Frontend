import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  async generateKeyFromWallet(wallet: string): Promise<CryptoKey> {
    const enc = new TextEncoder().encode(wallet);

    const hash = await crypto.subtle.digest('SHA-256', enc);

    return crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptFile(file: ArrayBuffer, wallet: string): Promise<Uint8Array> {
    const key = await this.generateKeyFromWallet(wallet);
    // Generowanie losowego wektora inicjującego 12-bajtowego dla AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      file
    );

    // Tworzenie tablicy z IV na początku
    const encryptedBytes = new Uint8Array(encrypted);
    const payload = new Uint8Array(iv.length + encryptedBytes.length);
    
    payload.set(iv, 0);
    payload.set(encryptedBytes, iv.length);

    return payload;
  }

  async decryptFile(
    encryptedData: ArrayBuffer,
    wallet: string
  ): Promise<Uint8Array> {

    const key = await this.generateKeyFromWallet(wallet);

    const iv = encryptedData.slice(0, 12);
    const data = encryptedData.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );

    return new Uint8Array(decrypted);
  }
}
