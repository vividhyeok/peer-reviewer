// Library Manager - Persist list of papers (Recent Files)
// Uses localStorage for simplicity in this demo

import { LocalStorageManager } from './LocalStorageManager';

export interface LibraryItem {
  id: string; // generated uuid
  filePath: string;
  title: string;
  author?: string;
  review?: string;
  oneLineSummary?: string;
  lastOpened: number;
  progress?: number; // 0-100
  lastParagraphId?: string; // For precise scroll resumption
  bookmarkParagraphId?: string; // Explicit user bookmark
  folder?: string; // For grouping
}

const LIBRARY_KEY = 'paper-reader-library';

export class LibraryManager {
  static getLibrary(): LibraryItem[] {
    try {
      const stored = localStorage.getItem(LIBRARY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  static addItem(filePath: string): LibraryItem {
    const library = this.getLibrary();
    const existing = library.find(item => item.filePath === filePath);

    if (existing) {
      // Update last opened
      const updated = { ...existing, lastOpened: Date.now() };
      this.saveLibrary(library.map(i => i.id === existing.id ? updated : i));
      return updated;
    }

    const pathParts = filePath.split(/[\\/]/);
    const fileName = pathParts.pop() || 'Untitled';
    const folder = pathParts.pop() || 'General';

    const newItem: LibraryItem = {
      id: crypto.randomUUID(),
      filePath,
      title: fileName.replace('.html', ''),
      lastOpened: Date.now(),
      folder,
    };

    this.saveLibrary([newItem, ...library]);
    return newItem;
  }

  static async removeItem(id: string, storageManager?: LocalStorageManager) {
    const library = this.getLibrary();
    const item = library.find(i => i.id === id);
    
    if (item && storageManager) {
      // 파일 시스템에서 실제 파일 삭제
      try {
        const filename = `file-${item.id}.html`;
        // localStorage에서 삭제
        localStorage.removeItem(`cached-file:${item.filePath}`);
        localStorage.removeItem(`data:${filename}`);
        
        // 주석 파일 삭제
        const annotationFile = `${item.id}.json`;
        localStorage.removeItem(`data:${annotationFile}`);
      } catch (e) {
        console.error('파일 삭제 실패:', e);
      }
    }
    
    this.saveLibrary(library.filter(item => item.id !== id));
  }

  static updateTitle(id: string, newTitle: string) {
    const library = this.getLibrary();
    this.saveLibrary(library.map(i => i.id === id ? { ...i, title: newTitle } : i));
  }

  static updateMetadata(id: string, updates: Partial<Pick<LibraryItem, 'title' | 'author' | 'review' | 'oneLineSummary'>>) {
    const library = this.getLibrary();
    this.saveLibrary(library.map(i => i.id === id ? { ...i, ...updates } : i));
  }

  static updateProgress(id: string, progress: number) {
    const safeProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, Math.round(progress))) : 0;
    const library = this.getLibrary();
    this.saveLibrary(library.map((item) => (
      item.id === id ? { ...item, progress: safeProgress } : item
    )));
  }

  static updateLastPosition(id: string, paragraphId: string, progress: number) {
    const library = this.getLibrary();
    this.saveLibrary(library.map((item) => (
      item.id === id ? { ...item, lastParagraphId: paragraphId, progress: Math.max(item.progress || 0, progress), lastOpened: Date.now() } : item
    )));
  }

  static touchItem(id: string) {
    const library = this.getLibrary();
    this.saveLibrary(library.map((item) => (
      item.id === id ? { ...item, lastOpened: Date.now() } : item
    )));
  }

  private static saveLibrary(items: LibraryItem[]) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
  }
}
