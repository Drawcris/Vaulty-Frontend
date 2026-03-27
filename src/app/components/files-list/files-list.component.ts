import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
import { AuthService } from '../../core/services/auth.service';
import { FilesService, UserFile } from '../../core/services/files.service';
import { NotificationService } from '../../core/services/notification.service';

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

  files: UserFile[] = [];
  isLoading = false;
  isDeleting = false;
  errorMessage = '';
  selectedIds = new Set<number>();
  activeMenuFile: UserFile | null = null;
  contextMenuPosition = { x: '0px', y: '0px' };
  searchTerm = '';
  sortOption: 'newest' | 'oldest' | 'name-asc' | 'name-desc' = 'newest';
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50];

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private filesService: FilesService,
    private notificationService: NotificationService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFiles();
  }

  @HostListener('window:vaulty-files-refresh')
  onExternalRefresh(): void {
    this.loadFiles();
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

  loadFiles(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.filesService
      .getMyFiles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: files => {
          this.files = files;
          this.selectedIds.forEach(id => {
            if (!files.some(file => file.id === id)) {
              this.selectedIds.delete(id);
            }
          });
          this.ensureValidPageIndex();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: error => {
          this.errorMessage = this.getReadableError(error);
          this.notificationService.error(this.errorMessage);
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('pl-PL');
  }

  filteredFiles(): UserFile[] {
    const normalizedQuery = this.searchTerm.trim().toLowerCase();

    const visibleFiles = normalizedQuery
      ? this.files.filter(file => {
          const label = this.getFileLabel(file).toLowerCase();
          const cid = file.cid.toLowerCase();
          const encryption = file.encryption_type.toLowerCase();
          return (
            label.includes(normalizedQuery) ||
            cid.includes(normalizedQuery) ||
            encryption.includes(normalizedQuery)
          );
        })
      : [...this.files];

    return visibleFiles.sort((left, right) => this.compareFiles(left, right));
  }

  pagedFiles(): UserFile[] {
    const filtered = this.filteredFiles();
    const start = this.pageIndex * this.pageSize;
    return filtered.slice(start, start + this.pageSize);
  }

  visibleCount(): number {
    return this.filteredFiles().length;
  }

  shortCid(cid: string): string {
    if (cid.length <= 28) {
      return cid;
    }

    return `${cid.slice(0, 16)}...${cid.slice(-10)}`;
  }

  getFileLabel(file: UserFile): string {
    return file.filename?.trim() || `Plik #${file.id}`;
  }

  getOwnerLabel(): string {
    return this.authService.getUsername() || 'ja';
  }

  getOwnerInitial(): string {
    const label = this.getOwnerLabel().trim();
    return label ? label.charAt(0).toUpperCase() : 'J';
  }

  getActivityLabel(file: UserFile): string {
    return `Otwarty przez Ciebie • ${this.formatDate(file.upload_date)}`;
  }

  isSelected(fileId: number): boolean {
    return this.selectedIds.has(fileId);
  }

  toggleSelection(fileId: number, checked: boolean): void {
    if (checked) {
      this.selectedIds.add(fileId);
    } else {
      this.selectedIds.delete(fileId);
    }
  }

  areAllSelected(): boolean {
    const visibleIds = this.pagedFiles().map(file => file.id);
    return !!visibleIds.length && visibleIds.every(id => this.selectedIds.has(id));
  }

  toggleSelectAll(checked: boolean): void {
    const visibleFiles = this.pagedFiles();

    if (checked) {
      visibleFiles.forEach(file => this.selectedIds.add(file.id));
      return;
    }

    visibleFiles.forEach(file => this.selectedIds.delete(file.id));
  }

  selectedCount(): number {
    return this.selectedIds.size;
  }

  onSearchTermChange(): void {
    this.pageIndex = 0;
  }

  onSortChange(): void {
    this.pageIndex = 0;
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  openRowMenu(file: UserFile): void {
    this.activeMenuFile = file;
  }

  onRowRightClick(event: MouseEvent, file: UserFile): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeMenuFile = file;
    this.contextMenuPosition = {
      x: `${event.clientX}px`,
      y: `${event.clientY}px`
    };

    this.contextMenuTrigger?.closeMenu();
    setTimeout(() => this.contextMenuTrigger?.openMenu());
  }

  async deleteOne(file: UserFile): Promise<void> {
    const confirmed = await this.askDeleteConfirmation(
      'Usun plik',
      `Czy na pewno chcesz usunac plik "${this.getFileLabel(file)}"?`
    );

    if (!confirmed) {
      return;
    }

    await this.performDelete([file]);
  }

  async deleteSelected(): Promise<void> {
    const filesToDelete = this.files.filter(file => this.selectedIds.has(file.id));
    if (!filesToDelete.length) {
      return;
    }

    const confirmed = await this.askDeleteConfirmation(
      'Usun zaznaczone pliki',
      `Czy na pewno chcesz usunac ${filesToDelete.length} zaznaczonych plikow?`
    );

    if (!confirmed) {
      return;
    }

    await this.performDelete(filesToDelete);
  }

  async renameOne(file: UserFile): Promise<void> {
    const dialogRef = this.dialog.open(RenameFileDialogComponent, {
      width: '420px',
      data: { filename: this.getFileLabel(file) },
      autoFocus: false
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) {
      return;
    }

    try {
      await firstValueFrom(this.filesService.renameFile(file.id, result));
      this.notificationService.success(`Zmieniono nazwę pliku na "${result}".`);
      this.loadFiles();
    } catch (error) {
      this.errorMessage = this.getReadableError(error);
      this.notificationService.error(this.errorMessage);
    }
  }

  clearSelection(): void {
    this.selectedIds.clear();
  }

  trackByFileId(_: number, file: UserFile): number {
    return file.id;
  }

  private ensureValidPageIndex(): void {
    const total = this.filteredFiles().length;
    const maxPageIndex = total > 0 ? Math.max(Math.ceil(total / this.pageSize) - 1, 0) : 0;

    if (this.pageIndex > maxPageIndex) {
      this.pageIndex = maxPageIndex;
    }
  }

  private compareFiles(left: UserFile, right: UserFile): number {
    switch (this.sortOption) {
      case 'oldest':
        return new Date(left.upload_date).getTime() - new Date(right.upload_date).getTime();
      case 'name-asc':
        return this.getFileLabel(left).localeCompare(this.getFileLabel(right), 'pl', { sensitivity: 'base' });
      case 'name-desc':
        return this.getFileLabel(right).localeCompare(this.getFileLabel(left), 'pl', { sensitivity: 'base' });
      case 'newest':
      default:
        return new Date(right.upload_date).getTime() - new Date(left.upload_date).getTime();
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

  private async performDelete(filesToDelete: UserFile[]): Promise<void> {
    try {
      this.isDeleting = true;
      this.errorMessage = '';

      await Promise.all(
        filesToDelete.map(file => firstValueFrom(this.filesService.deleteFile(file.id)))
      );

      filesToDelete.forEach(file => this.selectedIds.delete(file.id));
      this.notificationService.success(
        filesToDelete.length === 1
          ? 'Plik został usunięty.'
          : `Usunięto ${filesToDelete.length} pliki.`
      );
      this.loadFiles();
    } catch (error) {
      this.errorMessage = this.getReadableError(error);
      this.notificationService.error(this.errorMessage);
      this.isDeleting = false;
    } finally {
      this.isDeleting = false;
    }
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

    return 'Nie udalo sie pobrac listy plikow.';
  }
}
