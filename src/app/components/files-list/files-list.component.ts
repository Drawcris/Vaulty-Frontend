import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DeleteConfirmDialogComponent } from './delete-confirm-dialog.component';
import { RenameFileDialogComponent } from './rename-file-dialog.component';
import { CreateFolderDialogComponent } from './create-folder-dialog.component';
import { MoveItemDialogComponent } from './move-item-dialog.component';
import { FileDetailsDialogComponent } from './file-details-dialog.component';
import { ShareDialogComponent } from './share-dialog.component';

import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { CryptoService } from '../../core/services/crypto.service';
import { DownloadService, DownloadProgress } from '../../core/services/download.service';
import { FilesService, UserFile, UserFolder, FolderBreadcrumb } from '../../core/services/files.service';
import { ContractService } from '../../core/services/contract.service';
import { NotificationService } from '../../core/services/notification.service';
import { WalletService } from '../../core/services/wallet.service';

@Component({
  selector: 'app-files-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule
  ],
  templateUrl: './files-list.component.html',
  styleUrls: ['./files-list.component.css']
})
export class FilesListComponent implements OnInit, OnDestroy {
  @ViewChild('contextMenuTrigger') contextMenuTrigger?: MatMenuTrigger;

  folders: UserFolder[] = [];
  files: UserFile[] = [];
  breadcrumbs: FolderBreadcrumb[] = [];
  @Input() view: 'my' | 'shared' | 'my-shares' = 'my';
  @Input() currentFolderId: number | null = null;

  isLoading = false;
  isDeleting = false;
  isDownloading = false;
  downloadProgress: DownloadProgress | null = null;
  errorMessage = '';

  selectedFileIds = new Set<number>();
  selectedFolderIds = new Set<number>();

  activeMenuFile: UserFile | null = null;
  activeMenuFolder: UserFolder | null = null;
  contextMenuPosition = { x: '0px', y: '0px' };
  
  searchTerm = '';
  sortOption: 'newest' | 'oldest' | 'name-asc' | 'name-desc' = 'newest';
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50];

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private cryptoService: CryptoService,
    private downloadService: DownloadService,
    private filesService: FilesService,
    private contractService: ContractService,
    private notificationService: NotificationService,
    private walletService: WalletService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadContents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['view']) {
      // Przy zmianie widoku (np. z Moje pliki na Udostępnione) ZAWSZE resetujemy folder do root
      this.currentFolderId = null;
      this.breadcrumbs = [];
      this.clearSelection();
    }

    if (changes['view'] || changes['currentFolderId']) {
      // setTimeout zapobiega błędowi ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.loadContents();
      });
    }
  }

  @HostListener('window:vaulty-files-refresh')
  onExternalRefresh(): void {
    this.loadContents();
  }

  @HostListener('document:contextmenu', ['$event'])
  onDocumentContextMenu(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.files-list-card')) {
      event.preventDefault();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadContents(): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.view === 'shared') {
      this.filesService.getSharedFiles().pipe(takeUntil(this.destroy$)).subscribe({
        next: resources => {
          this.files = resources.filter(r => !r._isFolder);
          this.folders = resources.filter(r => r._isFolder).map(r => ({
            id: r.id,
            name: r.filename,
            owner: r.owner,
            created_at: r.upload_date,
            _isShared: true 
          } as any));
          this.breadcrumbs = [];
          this.finalizeLoad();
        },
        error: err => {
          this.errorMessage = this.getReadableError(err);
          this.isLoading = false;
        }
      });
      return;
    }

    if (this.view === 'my-shares') {
      this.filesService.getMyShares().pipe(takeUntil(this.destroy$)).subscribe({
        next: shares => {
          // Convert ShareListItem to UserFile for display with extra metadata
          this.files = shares.map(s => ({
            id: s.is_folder ? s.folder_id : s.file_id,
            filename: s.filename,
            cid: '', 
            encryption_type: 'None',
            upload_date: s.granted_at,
            expiration: s.expiration,
            recipient_wallet: s.recipient_wallet,
            recipient_username: s.recipient_username,
            _isFolder: s.is_folder
          } as any));
          this.folders = [];
          this.breadcrumbs = [];
          this.finalizeLoad();
        },
        error: err => {
          this.errorMessage = this.getReadableError(err);
          this.isLoading = false;
        }
      });
      return;
    }

    this.filesService
      .getFolderContents(this.currentFolderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => {
          this.folders = data.folders;
          this.files = data.files;
          
          if (this.currentFolderId) {
            this.filesService.getBreadcrumbs(this.currentFolderId).subscribe(bc => {
                 this.breadcrumbs = bc;
                 this.finalizeLoad();
            });
          } else {
            this.breadcrumbs = [];
            this.finalizeLoad();
          }
        },
        error: error => {
          this.errorMessage = this.getReadableError(error);
          this.notificationService.error(this.errorMessage);
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  private finalizeLoad(): void {
    this.selectedFileIds.clear();
    this.selectedFolderIds.clear();
    this.ensureValidPageIndex();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  navigateToFolder(folderId: number | null): void {
    this.currentFolderId = folderId;
    this.searchTerm = '';
    this.pageIndex = 0;
    this.loadContents();
    window.dispatchEvent(new CustomEvent('vaulty-folder-changed', { detail: folderId }));
  }

  goBack(): void {
     if (this.breadcrumbs.length > 1) {
         // wroc do przedostatniego
         const parent = this.breadcrumbs[this.breadcrumbs.length - 2];
         this.navigateToFolder(parent.id);
     } else {
         this.navigateToFolder(null); // wracamy do root
     }
  }

  // --- Opcje folderu ---
  async createFolder(): Promise<void> {
    const dialogRef = this.dialog.open(CreateFolderDialogComponent, {
      width: '420px',
      autoFocus: false
    });
    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result) {
      try {
        await firstValueFrom(this.filesService.createFolder(result, this.currentFolderId));
        this.notificationService.success(`Utworzono folder "${result}"`);
        this.loadContents();
      } catch (err) {
        this.notificationService.error(this.getReadableError(err));
      }
    }
  }

  // --- Drag & Drop ---
  onDragStart(event: DragEvent, item: any, type: 'file'|'folder') {
    event.stopPropagation();
    event.dataTransfer?.setData('application/json', JSON.stringify({ id: item.id, type }));
  }
  
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  onDrop(event: DragEvent, targetFolder: UserFolder | null) {
    event.preventDefault();
    event.stopPropagation();
    const data = event.dataTransfer?.getData('application/json');
    if (!data) return;
    const { id, type } = JSON.parse(data);
    const targetId = targetFolder ? targetFolder.id : null;
    
    if (type === 'folder' && targetId === id) return; // ignore drop into itself

    this.filesService.moveItems({
      target_folder_id: targetId,
      file_ids: type === 'file' ? [id] : [],
      folder_ids: type === 'folder' ? [id] : [],
    }).subscribe({
        next: () => {
          this.loadContents();
          this.notificationService.success('Element pomyślnie przeniesiony.');
        },
        error: err => this.notificationService.error(this.getReadableError(err))
    });
  }


  // --- Narzędzia list ---
  formatDate(value: string): string {
    return new Date(value).toLocaleString('pl-PL');
  }

  filteredFolders(): UserFolder[] {
      const q = this.searchTerm.trim().toLowerCase();
      let res = this.folders;
      if (q) res = res.filter(f => f.name.toLowerCase().includes(q));
      
      return res.sort((a,b) => {
          if (this.sortOption === 'name-desc') return b.name.localeCompare(a.name);
          return a.name.localeCompare(b.name);
      });
  }

  filteredFiles(): UserFile[] {
    const q = this.searchTerm.trim().toLowerCase();
    const visibleFiles = q
      ? this.files.filter(file => {
          const label = this.getFileLabel(file).toLowerCase();
          return label.includes(q);
        })
      : [...this.files];

    return visibleFiles.sort((left, right) => this.compareFiles(left, right));
  }

  pagedItems(): any[] {
     // Pagujemy wspólnie (foldery na górze, pliki na dole)
     const all = [...this.filteredFolders().map(f => ({...f, _isFolder: true})), ...this.filteredFiles()];
     const start = this.pageIndex * this.pageSize;
     const page = all.slice(start, start + this.pageSize);
     
     if (this.currentFolderId !== null && this.pageIndex === 0 && !this.searchTerm.trim()) {
         const parentId = this.breadcrumbs.length > 1 ? this.breadcrumbs[this.breadcrumbs.length - 2].id : null;
         const upDir = {
             id: parentId,
             name: '..',
             _isFolder: true,
             _isUpDir: true,
             created_at: new Date().toISOString()
         };
         return [upDir, ...page];
     }
     return page;
  }

  visibleCount(): number {
    return this.filteredFolders().length + this.filteredFiles().length;
  }

  shortCid(cid: string): string {
    if (!cid) return '';
    return cid.length <= 28 ? cid : `${cid.slice(0, 16)}...${cid.slice(-10)}`;
  }

  getFileLabel(file: UserFile): string {
    return file.filename?.trim() || `Plik #${file.id}`;
  }

  getOwnerLabel(file?: UserFile): string {
    if (this.view === 'shared') {
      return (file as any)?.owner_wallet ? this.formatAddress((file as any).owner_wallet) : 'Nieznany';
    }
    return 'Ty';
  }

  private formatAddress(address: string | null): string {
    if (!address) return '';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  }


  // --- Selekcja ---
  isSelected(item: any, isFolder: boolean = false): boolean {
    return isFolder ? this.selectedFolderIds.has(item.id) : this.selectedFileIds.has(item.id);
  }

  toggleSelection(item: any, isFolder: boolean, checked: boolean): void {
    const set = isFolder ? this.selectedFolderIds : this.selectedFileIds;
    if (checked) set.add(item.id);
    else set.delete(item.id);
  }

  areAllSelected(): boolean {
    const visible = this.pagedItems();
    if (!visible.length) return false;
    return visible.every(item => this.isSelected(item, item._isFolder));
  }

  toggleSelectAll(checked: boolean): void {
    const visible = this.pagedItems();
    if (checked) {
      visible.forEach(item => item._isFolder ? this.selectedFolderIds.add(item.id) : this.selectedFileIds.add(item.id));
    } else {
      visible.forEach(item => item._isFolder ? this.selectedFolderIds.delete(item.id) : this.selectedFileIds.delete(item.id));
    }
  }

  selectedCount(): number {
    return this.selectedFileIds.size + this.selectedFolderIds.size;
  }

  clearSelection(): void {
    this.selectedFileIds.clear();
    this.selectedFolderIds.clear();
  }


  // --- Eventy UI ---
  onSearchTermChange(): void { this.pageIndex = 0; }
  onSortChange(): void { this.pageIndex = 0; }
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  onRowRightClick(event: MouseEvent, item: any, isFolder: boolean): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (isFolder) {
        this.activeMenuFolder = item;
        this.activeMenuFile = null;
    } else {
        this.activeMenuFile = item;
        this.activeMenuFolder = null;
    }
    
    this.contextMenuPosition = {
      x: `${event.clientX}px`,
      y: `${event.clientY}px`
    };

    this.contextMenuTrigger?.closeMenu();
    setTimeout(() => this.contextMenuTrigger?.openMenu());
  }
  
  openFileDetails(item: UserFile): void {
    this.dialog.open(FileDetailsDialogComponent, {
      width: '460px',
      data: { file: item, view: this.view },
      autoFocus: false
    });
  }

  async downloadFile(item: UserFile): Promise<void> {
    const wallet = this.authService.getWallet();
    if (!wallet) {
      this.notificationService.error('Brak zdefiniowanego portfela');
      return;
    }

    try {
      this.isDownloading = true;
      this.downloadProgress = { current: 10, total: 100, filename: item.filename ?? `Plik #${item.id}` };
      this.cdr.detectChanges();

      this.downloadProgress = { current: 50, total: 100, filename: 'Próba deszyfrowania przez MetaMask...' };
      this.cdr.detectChanges();

      try {
        const decrypted = await this.downloadService.downloadAndDecrypt(item, wallet);
        this.saveFile(decrypted, this.getFileLabel(item));
        this.notificationService.success(`Pobrano i odszyfrowano plik.`);
      } catch (decryptErr: any) {
        console.warn('[Download] Decryption failed:', decryptErr);
        this.notificationService.error(`Błąd deszyfrowania: ${this.getReadableError(decryptErr)}`);
      }
    } catch (err: any) {
      console.error('[Download] Error:', err);
      this.notificationService.error(`Błąd przy pobieraniu: ${this.getReadableError(err)}`);
    } finally {
      this.isDownloading = false;
      this.downloadProgress = null;
      this.cdr.detectChanges();
    }
  }

  async downloadSelected(): Promise<void> {
    const wallet = this.authService.getWallet();
    if (!wallet) {
      this.notificationService.error('Brak zdefiniowanego portfela');
      return;
    }

    const selectedFiles = this.files.filter(f => this.selectedFileIds.has(f.id));
    if (!selectedFiles.length) {
      this.notificationService.error('Zaznacz co najmniej jeden plik do pobrania.');
      return;
    }

    if (selectedFiles.length === 1) {
      await this.downloadFile(selectedFiles[0]);
      return;
    }

    try {
      this.isDownloading = true;
      await this.downloadService.downloadFilesAsZip(
        selectedFiles,
        wallet,
        'vaulty-pobrane',
        (p) => {
          this.downloadProgress = p;
          this.cdr.detectChanges();
        }
      );
      this.notificationService.success(`Pobrano ${selectedFiles.length} plików jako ZIP.`);
    } catch (err) {
      this.notificationService.error(`Błąd przy pobieraniu: ${this.getReadableError(err)}`);
    } finally {
      this.isDownloading = false;
      this.downloadProgress = null;
      this.cdr.detectChanges();
    }
  }

  async downloadFolder(folder: UserFolder): Promise<void> {
    const wallet = this.authService.getWallet();
    if (!wallet) {
      this.notificationService.error('Brak zdefiniowanego portfela');
      return;
    }

    try {
      this.isDownloading = true;
      this.downloadProgress = { current: 0, total: 0, filename: 'Zbieranie plików...' };
      this.cdr.detectChanges();

      await this.downloadService.downloadFolderAsZip(
        folder,
        wallet,
        (p) => {
          this.downloadProgress = p;
          this.cdr.detectChanges();
        }
      );
      this.notificationService.success(`Folder "${folder.name}" pobrany jako ZIP.`);
    } catch (err) {
      this.notificationService.error(`Błąd pobierania folderu: ${this.getReadableError(err)}`);
    } finally {
      this.isDownloading = false;
      this.downloadProgress = null;
      this.cdr.detectChanges();
    }
  }

  private saveFile(data: Uint8Array, fileName: string): void {
    const blob = new Blob([data as any], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;

    a.click();

    window.URL.revokeObjectURL(url);
  }

  async shareFile(file: UserFile): Promise<void> {
    const dialogRef = this.dialog.open(ShareDialogComponent, {
      width: '420px',
      data: { file },
      autoFocus: false
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result && result.walletAddress) {
      try {
        this.isLoading = true;
        let targetWallet = result.walletAddress;

        // Rozwiąż username → wallet jeśli potrzeba
        if (!targetWallet.startsWith('0x') || targetWallet.length !== 42) {
          try {
            const resolved = await this.authService.lookupUser(targetWallet);
            targetWallet = resolved.wallet;
          } catch (err: any) {
            this.notificationService.error(`Nie znaleziono użytkownika o nazwie "${result.walletAddress}"`);
            this.isLoading = false;
            return;
          }
        }

        // Pobierz klucz publiczny odbiorcy
        let recipientPublicKey: string | undefined;
        if (!file._isFolder) {
          try {
            const keyInfo = await this.apiService.getUserPublicKey(targetWallet);
            recipientPublicKey = keyInfo.encryption_public_key;
          } catch (err) {
            this.notificationService.warning('Odbiorca nie ma klucza szyfrowania – plik zostanie udostępniony bez CEK (stary format).');
          }
        }

        // Zaszyfruj CEK dla odbiorcy (tylko dla plików, nie folderów)
        let encryptedCekForRecipient: string | undefined;
        if (!file._isFolder && recipientPublicKey) {
          const ownerWallet = this.authService.getWallet()!;
          try {
            // 1. Pobierz swój zaszyfrowany CEK z backendu (raw download + header)
            const downloadResult = await this.apiService.downloadFileRaw(file.id);
            if (!downloadResult.encryptedCek) {
              throw new Error('Brak zaszyfrowanego klucza pliku (CEK). Plik może być w starym formacie.');
            }
            // 2. Odszyfrowaj swój CEK przez MetaMask
            this.notificationService.warning('MetaMask: odszyfrowywanie klucza pliku...');
            const rawCekBase64 = await this.walletService.decryptEncryptionKey(downloadResult.encryptedCek, ownerWallet);
            const cek = this.cryptoService.parseDecryptedCEK(rawCekBase64);

            // 3. Zaszyfruj CEK kluczem publicznym odbiorcy
            encryptedCekForRecipient = this.cryptoService.wrapCEK(cek, recipientPublicKey);
          } catch (err: any) {
            if (err?.message?.includes('User denied')) {
              this.notificationService.error('Odmowa w MetaMask – nie można udostępnić pliku.');
              this.isLoading = false;
              return;
            }
            console.warn('[Share] Failed to wrap CEK for recipient:', err);
            this.notificationService.warning('Nie udało się zaszyfrować klucza dla odbiorcy. Udostępnianie bez E2EE CEK.');
          }
        }

        // Rejestracja on-chain
        const onChainSuccess = await this.contractService.grantAccess(
          file.id,
          targetWallet,
          result.expiryDays,
          file._isFolder
        );

        if (onChainSuccess) {
          const expiryTs = Math.floor(Date.now() / 1000) + (result.expiryDays * 24 * 60 * 60);
          this.filesService.grantAccess(
            file.id,
            targetWallet,
            new Date(expiryTs * 1000).toISOString(),
            file._isFolder,
            encryptedCekForRecipient
          ).subscribe({
            next: () => {
              this.notificationService.success(`Pomyślnie udostępniono ${file._isFolder ? 'folder' : 'plik'}.`);
              this.loadContents();
            },
            error: (err: any) => console.error('[Sync] Failed to update SQL cache:', err)
          });
        }
      } catch (err: any) {
        this.notificationService.error(this.getReadableError(err));
      } finally {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }
  }
  
  async editShare(file: UserFile): Promise<void> {
    const dialogRef = this.dialog.open(ShareDialogComponent, {
      width: '420px',
      data: { 
        file, 
        initialWallet: file.recipient_wallet,
        initialExpiry: 7 // Domyślnie 7, lub można obliczyć na podstawie file.expiration
      },
      autoFocus: false
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result && result.walletAddress) {
      try {
        this.isLoading = true;
        const onChainSuccess = await this.contractService.grantAccess(
          file.id, 
          result.walletAddress, 
          result.expiryDays,
          file.folder_id !== undefined && file.cid === '' // W widoku my-shares folder_id to pole z ShareListItem
        );

        // Poprawka: w my-shares file.is_folder mówi nam czy to folder
        const isActuallyFolder = (file as any).is_folder || file._isFolder;

        const onChainSuccessFinal = await this.contractService.grantAccess(
          file.id, 
          result.walletAddress, 
          result.expiryDays,
          isActuallyFolder
        );

        if (onChainSuccessFinal) {
          const expiryTs = Math.floor(Date.now() / 1000) + (result.expiryDays * 24 * 60 * 60);
          this.filesService.grantAccess(
            file.id, 
            result.walletAddress, 
            new Date(expiryTs * 1000).toISOString(),
            isActuallyFolder
          ).subscribe({
            next: () => {
              this.notificationService.success('Pomyślnie zaktualizowano czas wygaśnięcia.');
              this.loadContents();
            },
            error: (err: any) => console.error('[Sync] Failed to update SQL cache:', err)
          });
        }
      } catch (err: any) {
        this.notificationService.error(this.getReadableError(err));
      } finally {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  async revokeShare(file: UserFile): Promise<void> {
    const confirmed = await this.askDeleteConfirmation('Odbierz dostęp', `Czy na pewno odebrać dostęp dla portfela ${file.recipient_wallet}?`);
    if (!confirmed) return;

    try {
      this.isLoading = true;
      const targetWallet = file.recipient_wallet!;
      const isActuallyFolder = (file as any).is_folder || file._isFolder;
      const onChainSuccess = await this.contractService.revokeAccess(file.id, targetWallet, isActuallyFolder);
      
      if (onChainSuccess) {
        this.filesService.revokeAccess(file.id, targetWallet, isActuallyFolder).subscribe({
          next: () => {
            this.notificationService.success('Pomyślnie odebrano dostęp.');
            this.loadContents();
          },
          error: (err: any) => console.error('[Sync] Failed to update SQL cache:', err)
        });
      }
    } catch (err: any) {
      this.notificationService.error(this.getReadableError(err));
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // --- Metody operacji ---
  async deleteOne(item: any, isFolder: boolean): Promise<void> {
    const label = isFolder ? item.name : this.getFileLabel(item);
    const confirmed = await this.askDeleteConfirmation('Usuń', `Czy na pewno usunąć "${label}"?`);
    if (!confirmed) return;

    try {
        if (isFolder) {
            await firstValueFrom(this.filesService.deleteFolder(item.id));
            this.selectedFolderIds.delete(item.id);
        } else {
            await firstValueFrom(this.filesService.deleteFile(item.id));
            this.selectedFileIds.delete(item.id);
        }
        this.notificationService.success('Pomyślnie usunięto.');
        this.loadContents();
    } catch(err) {
        this.notificationService.error(this.getReadableError(err));
    }
  }

  async renameOne(item: any, isFolder: boolean): Promise<void> {
    const label = isFolder ? item.name : this.getFileLabel(item);
    const dialogRef = this.dialog.open(RenameFileDialogComponent, {
      width: '420px',
      data: { filename: label },
      autoFocus: false
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) return;

    try {
      if (isFolder) {
         await firstValueFrom(this.filesService.renameFolder(item.id, result));
      } else {
         let finalFilename = result;
         const dotIndex = label.lastIndexOf('.');
         const originalExt = dotIndex > 0 ? label.substring(dotIndex) : '';
         if (originalExt && !result.toLowerCase().endsWith(originalExt.toLowerCase()) && result.lastIndexOf('.') <= 0) {
             finalFilename = `${result}${originalExt}`;
         }
         await firstValueFrom(this.filesService.renameFile(item.id, finalFilename));
      }
      this.notificationService.success(`Zmieniono nazwę na "${result}".`);
      this.loadContents();
    } catch (error) {
      this.notificationService.error(this.getReadableError(error));
    }
  }

  contextMenuMove(): void {
    const activeItem = this.activeMenuFolder || this.activeMenuFile;
    if (!activeItem) return;
    const isFolder = !!this.activeMenuFolder;

    if (this.isSelected(activeItem, isFolder) && this.selectedCount() > 1) {
      this.moveSelected();
    } else {
      this.moveOne(activeItem, isFolder);
    }
  }

  contextMenuDelete(): void {
    const activeItem = this.activeMenuFolder || this.activeMenuFile;
    if (!activeItem) return;
    const isFolder = !!this.activeMenuFolder;

    if (this.isSelected(activeItem, isFolder) && this.selectedCount() > 1) {
      this.deleteSelected();
    } else {
      this.deleteOne(activeItem, isFolder);
    }
  }

  async moveSelected(): Promise<void> {
     // Przenosimy wybrane
     const selectedFolders = Array.from(this.selectedFolderIds);
     const selectedFiles = Array.from(this.selectedFileIds);
     if (!selectedFolders.length && !selectedFiles.length) return;
     
     const dialogRef = this.dialog.open(MoveItemDialogComponent, {
      width: '420px',
      data: { itemsCount: selectedFolders.length + selectedFiles.length }
    });
    
    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result && result.targetFolderId !== undefined) {
         try {
             await firstValueFrom(this.filesService.moveItems({
                 target_folder_id: result.targetFolderId,
                 folder_ids: selectedFolders,
                 file_ids: selectedFiles
             }));
             this.notificationService.success('Elementy zostały przeniesione.');
             this.loadContents();
         } catch(err) {
             this.notificationService.error(this.getReadableError(err));
         }
    }
  }

  async moveOne(item: any, isFolder: boolean): Promise<void> {
     const dialogRef = this.dialog.open(MoveItemDialogComponent, {
      width: '420px',
      data: { itemsCount: 1 }
    });
    
    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result && result.targetFolderId !== undefined) {
         try {
             await firstValueFrom(this.filesService.moveItems({
                 target_folder_id: result.targetFolderId,
                 folder_ids: isFolder ? [item.id] : [],
                 file_ids: !isFolder ? [item.id] : []
             }));
             this.notificationService.success('Pomyślnie przeniesiono.');
             this.loadContents();
         } catch(err) {
             this.notificationService.error(this.getReadableError(err));
         }
    }
  }

  async deleteSelected(): Promise<void> {
    const total = this.selectedFolderIds.size + this.selectedFileIds.size;
    if (total === 0) return;
    
    const confirmed = await this.askDeleteConfirmation('Usuń wybrane', `Czy na pewno usunąć wybrane elementy (${total})?`);
    if (!confirmed) return;

    this.isDeleting = true;
    try {
        for (const id of this.selectedFolderIds) {
            await firstValueFrom(this.filesService.deleteFolder(id));
        }
        for (const id of this.selectedFileIds) {
            await firstValueFrom(this.filesService.deleteFile(id));
        }
        this.notificationService.success(`Usunięto ${total} elementów.`);
        this.loadContents();
    } catch(err) {
        this.notificationService.error(this.getReadableError(err));
    } finally {
        this.isDeleting = false;
    }
  }

  private ensureValidPageIndex(): void {
    const total = this.visibleCount();
    const maxPageIndex = total > 0 ? Math.max(Math.ceil(total / this.pageSize) - 1, 0) : 0;
    if (this.pageIndex > maxPageIndex) this.pageIndex = maxPageIndex;
  }

  private compareFiles(left: UserFile, right: UserFile): number {
    switch (this.sortOption) {
      case 'oldest': return new Date(left.upload_date).getTime() - new Date(right.upload_date).getTime();
      case 'name-asc': return this.getFileLabel(left).localeCompare(this.getFileLabel(right), 'pl');
      case 'name-desc': return this.getFileLabel(right).localeCompare(this.getFileLabel(left), 'pl');
      case 'newest':
      default: return new Date(right.upload_date).getTime() - new Date(left.upload_date).getTime();
    }
  }

  private async askDeleteConfirmation(title: string, message: string): Promise<boolean> {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '420px',
      data: { title, message },
      autoFocus: false
    });
    const result = await firstValueFrom(dialogRef.afterClosed());
    return !!result;
  }

  isOwner(item: UserFile): boolean {
    if (!item) return true;
    if (this.view === 'my') return true;
    if (this.view === 'my-shares') return true;
    
    // W widoku 'shared' sprawdzamy czy włascicielem jest obecny portfel
    if (item.owner) {
      const currentWallet = this.authService.getWallet();
      return item.owner.toLowerCase() === currentWallet?.toLowerCase();
    }
    
    return false;
  }

  getExpirationInfo(item: UserFile): string {
    if (!item.expiration) return '';
    try {
      const exp = new Date(item.expiration);
      const now = new Date();
      
      // Jeśli data jest w bardzo odległej przyszłości (np. > 50 lat), traktujemy jako bezterminowo
      const fiftyYearsFromNow = new Date();
      fiftyYearsFromNow.setFullYear(now.getFullYear() + 50);
      
      if (exp > fiftyYearsFromNow) return 'Bezterminowo';
      if (exp < now) return 'Wygasło';
      
      const diffMs = exp.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) return `Pozostało ${diffDays} dni`;
      
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours > 0) return `Pozostało ${diffHours} godz.`;
      
      return 'Wygasa wkrótce';
    } catch {
      return '';
    }
  }

  public getReadableError(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const serverError = (error as any).error;
      if (serverError?.detail) return serverError.detail;
    }
    if (error instanceof Error && error.message) return error.message;
    return 'Wystąpił nieoczekiwany błąd.';
  }
}
