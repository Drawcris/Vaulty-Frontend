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
  folder_id?: number | null;
}

export interface UserFolder {
  id: number;
  name: string;
  owner: string;
  parent_id?: number | null;
  created_at: string;
}

export interface FolderContentResponse {
  folders: UserFolder[];
  files: UserFile[];
}

export interface FolderBreadcrumb {
  id: number;
  name: string;
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

export interface RenameResponse {
  id: number;
  name?: string;
  filename?: string;
}

export interface MoveItemRequest {
  target_folder_id: number | null;
  file_ids: number[];
  folder_ids: number[];
}

@Injectable({
  providedIn: 'root'
})
export class FilesService {
  private readonly filesApiUrl = `${environment.API_BASE_URL}/files`;
  private readonly foldersApiUrl = `${environment.API_BASE_URL}/folders`;

  constructor(private http: HttpClient) {}

  uploadFile(
    file: Blob,
    hash: string,
    encryptionType: string,
    filename: string,
    folderId: number | null = null,
    fileName: string = 'encrypted-file.vaulty.enc'
  ): Observable<UploadFileResponse> {
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('hash', hash);
    formData.append('filename', filename);
    formData.append('encryption_type', encryptionType);
    if (folderId !== null) {
      formData.append('folder_id', folderId.toString());
    }

    return this.http.post<UploadFileResponse>(`${this.filesApiUrl}/upload`, formData);
  }

  // ==== Files API ====
  getMyFiles(folderId: number | null = null): Observable<UserFile[]> {
    const params: any = {};
    if (folderId !== null) { params.folder_id = folderId; }
    return this.http.get<UserFile[]>(`${this.filesApiUrl}/my`, { params });
  }

  deleteFile(fileId: number): Observable<DeleteFileResponse> {
    return this.http.delete<DeleteFileResponse>(`${this.filesApiUrl}/${fileId}`);
  }

  renameFile(fileId: number, filename: string): Observable<RenameResponse> {
    return this.http.patch<RenameResponse>(`${this.filesApiUrl}/${fileId}/rename`, { filename });
  }

  // ==== Folders API ====
  getFolderContents(folderId: number | null = null): Observable<FolderContentResponse> {
    if (folderId === null) {
      return this.http.get<FolderContentResponse>(`${this.foldersApiUrl}/root/contents`);
    } else {
      return this.http.get<FolderContentResponse>(`${this.foldersApiUrl}/${folderId}/contents`);
    }
  }

  getAllFolders(): Observable<UserFolder[]> {
    return this.http.get<UserFolder[]>(`${this.foldersApiUrl}/all`);
  }

  createFolder(name: string, parentId: number | null = null): Observable<UserFolder> {
    return this.http.post<UserFolder>(this.foldersApiUrl, { name, parent_id: parentId });
  }

  renameFolder(folderId: number, name: string): Observable<UserFolder> {
    return this.http.patch<UserFolder>(`${this.foldersApiUrl}/${folderId}/rename`, { name });
  }

  deleteFolder(folderId: number): Observable<any> {
    return this.http.delete(`${this.foldersApiUrl}/${folderId}`);
  }

  getBreadcrumbs(folderId: number): Observable<FolderBreadcrumb[]> {
    return this.http.get<FolderBreadcrumb[]>(`${this.foldersApiUrl}/${folderId}/breadcrumbs`);
  }

  moveItems(request: MoveItemRequest): Observable<any> {
    return this.http.post(`${this.foldersApiUrl}/move`, request);
  }
}
