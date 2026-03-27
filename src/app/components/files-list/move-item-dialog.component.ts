import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FilesService, UserFolder } from '../../core/services/files.service';

export interface MoveDialogData {
  itemsCount: number;
}

export interface FolderNode {
  id: number | null;
  name: string;
  children?: FolderNode[];
}

@Component({
  selector: 'app-move-item-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatTreeModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  styles: [`
    .move-dialog-content {
      min-height: 250px;
      max-height: 480px;
      padding-top: 8px !important;
      padding-bottom: 8px !important;
    }
    .tree-wrapper {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 8px 0;
      background: white;
      min-height: 200px;
    }
    .folder-tree {
      background: transparent;
    }
    .tree-node {
      display: flex;
      align-items: center;
      padding: 4px 8px;
      margin: 2px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .tree-node:hover {
      background-color: #f5f5f5;
    }
    .tree-node.selected {
      background-color: #e8f0fe;
      color: #1967d2;
    }
    .tree-node.selected .folder-icon {
      color: #1967d2;
    }
    .folder-icon {
      color: #fbc02d;
      margin-right: 8px;
    }
    .folder-tree-invisible {
      display: none;
    }
    .nested-group {
      padding-left: 24px;
    }
    .invisible-toggle {
      visibility: hidden;
    }
    .folder-name {
      font-size: 14px;
      font-weight: 500;
      user-select: none;
    }
    .mat-mdc-icon-button {
      width: 32px;
      height: 32px;
      padding: 4px;
    }
  `],
  template: `
    <h2 mat-dialog-title>Przenieś elementy ({{ data.itemsCount }})</h2>
    <mat-dialog-content class="move-dialog-content">
      <div *ngIf="isLoading" class="flex justify-center p-4">
        <mat-spinner diameter="32"></mat-spinner>
      </div>
      
      <div *ngIf="!isLoading" class="tree-wrapper">
        <mat-tree [dataSource]="dataSource" [treeControl]="treeControl" class="folder-tree">
          
          <mat-tree-node *matTreeNodeDef="let node" matTreeNodeToggle>
            <div class="tree-node"
                 [class.selected]="selectedFolderId === node.id"
                 (click)="selectNode(node)">
              <button mat-icon-button disabled class="invisible-toggle"></button>
              <mat-icon class="folder-icon">folder</mat-icon>
              <span class="folder-name">{{node.name}}</span>
            </div>
          </mat-tree-node>

          <mat-nested-tree-node *matTreeNodeDef="let node; when: hasChild">
            <div class="tree-node-group">
              <div class="tree-node"
                   [class.selected]="selectedFolderId === node.id"
                   (click)="selectNode(node)">
                <button mat-icon-button matTreeNodeToggle
                        [attr.aria-label]="'Toggle ' + node.name">
                  <mat-icon>
                    {{treeControl.isExpanded(node) ? 'expand_more' : 'chevron_right'}}
                  </mat-icon>
                </button>
                <mat-icon class="folder-icon">
                    {{treeControl.isExpanded(node) ? 'folder_open' : 'folder'}}
                </mat-icon>
                <span class="folder-name">{{node.name}}</span>
              </div>
              <div [class.folder-tree-invisible]="!treeControl.isExpanded(node)" role="group" class="nested-group">
                <ng-container matTreeNodeOutlet></ng-container>
              </div>
            </div>
          </mat-nested-tree-node>
        </mat-tree>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Anuluj</button>
      <button mat-flat-button color="primary" [disabled]="isLoading || selectedFolderId === undefined" (click)="onConfirm()">Przenieś tutaj</button>
    </mat-dialog-actions>
  `
})
export class MoveItemDialogComponent implements OnInit {
  folders: UserFolder[] = [];
  selectedFolderId: number | null | undefined = undefined;
  isLoading = true;

  treeControl = new NestedTreeControl<FolderNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<FolderNode>();
  
  hasChild = (_: number, node: FolderNode) => !!node.children && node.children.length > 0;

  constructor(
    public dialogRef: MatDialogRef<MoveItemDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MoveDialogData,
    private filesService: FilesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.filesService.getAllFolders().subscribe({
      next: (folders) => {
        this.folders = folders;
        this.dataSource.data = this.buildTree(folders);
        this.isLoading = false;
        
        // Rozwiń roota na start
        if (this.dataSource.data.length > 0) {
          this.treeControl.expand(this.dataSource.data[0]);
        }
        
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        // fallback
      }
    });
  }

  buildTree(folders: UserFolder[]): FolderNode[] {
    const rootNode: FolderNode = { id: null, name: 'Mój Dysk', children: [] };
    const map = new Map<number, FolderNode>();
    
    // Inicjalizacja węzłów
    folders.forEach(f => {
      map.set(f.id, { id: f.id, name: f.name, children: [] });
    });

    // Budowanie hierarchii
    folders.forEach(f => {
      const node = map.get(f.id)!;
      if (f.parent_id) {
        const parent = map.get(f.parent_id);
        if (parent) {
          parent.children!.push(node);
        } else {
          rootNode.children!.push(node);
        }
      } else {
        rootNode.children!.push(node);
      }
    });

    return [rootNode];
  }

  selectNode(node: FolderNode): void {
    this.selectedFolderId = node.id;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.selectedFolderId !== undefined) {
      this.dialogRef.close({ targetFolderId: this.selectedFolderId });
    }
  }
}
