import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../config/environment';

export interface ChallengeRequest {
  wallet: string;
}

export interface ChallengeResponse {
  challenge: string;
  wallet: string;
}

export interface VerifySignatureRequest {
  wallet: string;
  signature: string;
}

export interface VerifySignatureResponse {
  token: string;
  wallet: string;
  message: string;
  username_required?: boolean;
  username?: string | null;
}

export interface UserInfo {
  wallet: string;
  authenticated: boolean;
  exp?: number;
  username?: string | null;
  username_required?: boolean;
}

export interface UserProfileResponse {
  wallet: string;
  username: string | null;
  created_at?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.API_BASE_URL;

  constructor(private http: HttpClient) {
    console.log(`[API] Initialized with base URL: ${this.baseUrl}`);
  }

  async requestChallenge(wallet: string): Promise<ChallengeResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<ChallengeResponse>(`${this.baseUrl}/auth/challenge`, {
          wallet
        })
      );
      console.log('Challenge requested successfully');
      return response;
    } catch (error) {
      console.error('Failed to request challenge:', error);
      throw error;
    }
  }

  async verifySignature(wallet: string, signature: string): Promise<VerifySignatureResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<VerifySignatureResponse>(`${this.baseUrl}/auth/verify`, {
          wallet,
          signature
        })
      );
      console.log('Signature verified successfully');
      return response;
    } catch (error) {
      console.error('Failed to verify signature:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<UserInfo> {
    try {
      return await firstValueFrom(
        this.http.get<UserInfo>(`${this.baseUrl}/auth/me`)
      );
    } catch (error) {
      console.error('Failed to get current user:', error);
      throw error;
    }
  }

  async getMyProfile(): Promise<UserProfileResponse> {
    try {
      return await firstValueFrom(
        this.http.get<UserProfileResponse>(`${this.baseUrl}/users/me`)
      );
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw error;
    }
  }

  async setUsername(username: string): Promise<UserProfileResponse> {
    try {
      return await firstValueFrom(
        this.http.post<UserProfileResponse>(`${this.baseUrl}/users/set-username`, {
          username
        })
      );
    } catch (error) {
      console.error('Failed to set username:', error);
      throw error;
    }
  }

  async getWalletByUsername(username: string): Promise<{ wallet: string }> {
    try {
      return await firstValueFrom(
        this.http.get<{ wallet: string }>(`${this.baseUrl}/users/by-username/${username}`)
      );
    } catch (error) {
      console.error('Failed to resolve username:', error);
      throw error;
    }
  }

  async getMyFiles() {
    try {
      return await firstValueFrom(
        this.http.get(`${this.baseUrl}/files/my`)
      );
    } catch (error) {
      console.error('Failed to get files:', error);
      throw error;
    }
  }

  async getSharedFiles() {
    try {
      return await firstValueFrom(
        this.http.get(`${this.baseUrl}/files/shared`)
      );
    } catch (error) {
      console.error('Failed to get shared files:', error);
      throw error;
    }
  }

  async getFileMetadata(fileId: number) {
    try {
      return await firstValueFrom(
        this.http.get(`${this.baseUrl}/files/${fileId}`)
      );
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      throw error;
    }
  }

  async getFileDownloadCID(fileId: number) {
    try {
      return await firstValueFrom(
        this.http.get<{ cid: string; message: string }>(`${this.baseUrl}/files/${fileId}/download`)
      );
    } catch (error) {
      console.error('Failed to get download CID:', error);
      throw error;
    }
  }

  async downloadFileRaw(fileId: number): Promise<Blob> {
    try {
      return await firstValueFrom(
        this.http.get(`${this.baseUrl}/files/${fileId}/download/raw`, {
          responseType: 'blob'
        })
      );
    } catch (error) {
      console.error('Failed to download file:', error);
      throw error;
    }
  }

  async uploadFile(
    file: Blob,
    hash: string,
    encryptionType: string = 'AES_256'
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('hash', hash);
      formData.append('encryption_type', encryptionType);

      const response = await firstValueFrom(
        this.http.post(`${this.baseUrl}/files/upload`, formData)
      );
      console.log('File uploaded successfully');
      return response;
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  async grantAccess(fileId: number, wallet: string, expiration?: string): Promise<any> {
    try {
      const payload: any = {
        file_id: fileId,
        wallet
      };
      if (expiration) {
        payload.expiration = expiration;
      }

      return await firstValueFrom(
        this.http.post(`${this.baseUrl}/access/grant`, payload)
      );
    } catch (error) {
      console.error('Failed to grant access:', error);
      throw error;
    }
  }

  async revokeAccess(fileId: number, wallet: string): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.post(`${this.baseUrl}/access/revoke`, {
          file_id: fileId,
          wallet
        })
      );
    } catch (error) {
      console.error('Failed to revoke access:', error);
      throw error;
    }
  }

  async getFileAccessInfo(fileId: number): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.get(`${this.baseUrl}/access/file/${fileId}`)
      );
    } catch (error) {
      console.error('Failed to get access info:', error);
      throw error;
    }
  }

  async getFileAuditLogs(fileId: number): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.get(`${this.baseUrl}/audit/file/${fileId}`)
      );
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      throw error;
    }
  }
}
