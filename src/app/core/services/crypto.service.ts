import { Injectable } from '@angular/core';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import { Buffer } from 'buffer';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  generateCEK(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  async importCEK(cek: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'raw',
      cek as any,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Pakuje CEK kluczem publicznym odbiorcy w standardzie EIP-1024 (x25519-xsalsa20-poly1305).
   * Zwraca hex string (0x...) kompatybilny z eth_decrypt MetaMask.
   */
  wrapCEK(cek: Uint8Array, encryptionPublicKey: string): string {
    // Klucz publiczny MetaMask jest w base64 (bez prefiksu 0x)
    const recipientPublicKey = naclUtil.decodeBase64(encryptionPublicKey);

    // Efemeryczna para kluczy x25519
    const ephemeralKeyPair = nacl.box.keyPair();
    const nonce = nacl.randomBytes(nacl.box.nonceLength);

    // Szyfrujemy base64(CEK) – MetaMask eth_decrypt oczekuje że plaintext to string
    const cekBase64 = Buffer.from(cek).toString('base64');
    const messageBytes = new TextEncoder().encode(cekBase64);

    const ciphertext = nacl.box(
      messageBytes,
      nonce,
      recipientPublicKey,
      ephemeralKeyPair.secretKey
    );

    const encryptedData = {
      version: 'x25519-xsalsa20-poly1305',
      nonce: naclUtil.encodeBase64(nonce),
      ephemPublicKey: naclUtil.encodeBase64(ephemeralKeyPair.publicKey),
      ciphertext: naclUtil.encodeBase64(ciphertext)
    };

    // Zwróć jako 0x + hex(JSON)
    return '0x' + Buffer.from(JSON.stringify(encryptedData), 'utf8').toString('hex');
  }

  /**
   * Parsuje odszyfrowany przez MetaMask CEK (base64 string) → Uint8Array
   */
  parseDecryptedCEK(decryptedBase64: string): Uint8Array {
    return new Uint8Array(Buffer.from(decryptedBase64, 'base64'));
  }

  async encryptFile(file: ArrayBuffer, cek: Uint8Array): Promise<Uint8Array> {
    const key = await this.importCEK(cek);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      file
    );

    const encryptedBytes = new Uint8Array(encrypted);
    const payload = new Uint8Array(iv.length + encryptedBytes.length);

    payload.set(iv, 0);
    payload.set(encryptedBytes, iv.length);

    return payload;
  }

  async decryptFile(
    encryptedData: ArrayBuffer,
    cek: Uint8Array
  ): Promise<Uint8Array> {
    const key = await this.importCEK(cek);

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
