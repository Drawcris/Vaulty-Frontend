import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../config/environment';

export interface UserFile {
  id: number;
  filename?: string | null;
  cid: string;
  encryption_type: string;
  upload_date: string;
}

export interface UploadFileResponse {
  file_id: number;
  cid: string;
  filename?: string | null;
  message: string;
}

export interface DeleteFileResponse {
  message: string;
}

export interface RenameFileResponse {
  id: number;
  filename?: string | null;
  cid: string;
  hash: string;
  encryption_type: string;
  upload_date: string;
}

@Injectable({
  providedIn: 'root'
})
export class FilesService {
  private readonly apiUrl = `${environment.API_BASE_URL}/files`;

  constructor(private http: HttpClient) {}

  uploadFile(
    file: Blob,
    hash: string,
    encryptionType: string,
    filename: string,
    fileName: string = 'encrypted-file.vaulty.enc'
  ): Observable<UploadFileResponse> {
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('hash', hash);
    formData.append('filename', filename);
    formData.append('encryption_type', encryptionType);

    return this.http.post<UploadFileResponse>(`${this.apiUrl}/upload`, formData);
  }

  getMyFiles(): Observable<UserFile[]> {
    return this.http.get<UserFile[]>(`${this.apiUrl}/my`);
  }

  deleteFile(fileId: number): Observable<DeleteFileResponse> {
    return this.http.delete<DeleteFileResponse>(`${this.apiUrl}/${fileId}`);
  }

  renameFile(fileId: number, filename: string): Observable<RenameFileResponse> {
    return this.http.patch<RenameFileResponse>(`${this.apiUrl}/${fileId}/rename`, {
      filename
    });
  }
}
