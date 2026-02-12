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
const DISK_FILENAME = 'library.json';

export class LibraryManager {
  private static normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/{2,}/g, '/').trim();
  }

  private static isBundledDemoPath(path: string): boolean {
    const normalized = this.normalizePath(path).toLowerCase();
    return normalized.startsWith('/docs/') || normalized.startsWith('docs/');
  }

  // Sync with disk (True Drive Mode)
  static async sync(storageManager: LocalStorageManager): Promise<LibraryItem[]> {
    if (!storageManager || !storageManager.isConnected) {
        return this.getLibrary();
    }

    try {
        // 1. Check direct file list from disk to auto-add new files
        const physicalFiles = await storageManager.listFiles();
        const normalizedPhysicalFiles = new Set(physicalFiles.map((file) => this.normalizePath(file)));
        
        // 2. Load persistent library metadata (library.json)
        const diskData = await storageManager.loadJson<LibraryItem[]>(DISK_FILENAME) || [];
        const localData = this.getLibrary(); // From localStorage

        // 3. Merge Strategies
        // Use Map to deduplicate by ID
        const mergedMap = new Map<string, LibraryItem>();
        
        // Priority: LocalStorage (recent interaction) > Disk JSON (persistence)
        // Actually, we want the union.
        const allItems = [...diskData, ...localData];
        
        allItems.forEach(item => {
            const existing = mergedMap.get(item.id);
            if (!existing) {
                mergedMap.set(item.id, item);
            } else {
                // If one has absolute path and the other has relative, prefer the RELATIVE one (migrated)
                const existingIsAbsolute = /^[a-zA-Z]:[\\/]/.test(existing.filePath) || existing.filePath.startsWith('/') || existing.filePath.startsWith('\\\\');
                const itemIsAbsolute = /^[a-zA-Z]:[\\/]/.test(item.filePath) || item.filePath.startsWith('/') || item.filePath.startsWith('\\\\');
                
                if (existingIsAbsolute && !itemIsAbsolute) {
                    // Prefer the relative path version (keep lastOpened from the newer one)
                    mergedMap.set(item.id, { ...item, lastOpened: Math.max(item.lastOpened || 0, existing.lastOpened || 0) });
                } else if (!existingIsAbsolute && itemIsAbsolute) {
                    // Keep existing (relative), just update lastOpened
                    mergedMap.set(item.id, { ...existing, lastOpened: Math.max(item.lastOpened || 0, existing.lastOpened || 0) });
                } else if ((item.lastOpened || 0) > (existing.lastOpened || 0)) {
                    mergedMap.set(item.id, item);
                }
            }
        });

        // 4. Auto-Add Unregistered Physical Files (The "Watch" feature)
        for (const file of physicalFiles) {
            const lower = file.toLowerCase();
            if (!lower.endsWith('.html') && !lower.endsWith('.htm') && !lower.endsWith('.md')) continue;
            
            const normalizedFile = this.normalizePath(file);
            
            // Check if this physical file is already known (by filePath)
            // We search values of mergedMap
            const isKnown = Array.from(mergedMap.values()).some(item => {
                const itemPath = this.normalizePath(item.filePath);
                return itemPath === normalizedFile || itemPath === `/${normalizedFile}` || normalizedFile.endsWith(itemPath);
            });

            if (!isKnown) {
                 const newItem: LibraryItem = {
                    id: crypto.randomUUID(),
                    filePath: file, // Keep original relative path
                    title: file.split(/[\\/]/).pop()?.replace(/\.(html|htm|md)$/i, '') || 'Untitled',
                    lastOpened: Date.now(),
                    folder: 'Inbox'
                };
                mergedMap.set(newItem.id, newItem);
            }
        }

        // 5. Auto-fix absolute paths: if filename exists in data dir, convert to relative
        if (physicalFiles.length > 0) {
            for (const [id, item] of mergedMap) {
                const fp = item.filePath;
                const isAbsolutePath = /^[a-zA-Z]:[\\/]/.test(fp) || (fp.startsWith('/') && !this.isBundledDemoPath(fp));
                if (isAbsolutePath) {
                    const filename = this.normalizePath(fp).split('/').pop() || '';
                    if (filename) {
                        // Exact match
                        const exactMatch = physicalFiles.find(f => this.normalizePath(f) === filename || f === filename);
                        if (exactMatch) {
                            console.log(`[LibrarySync] Auto-fixed absolute path: ${fp} → ${exactMatch}`);
                            mergedMap.set(id, { ...item, filePath: exactMatch });
                        } else {
                            // Fuzzy match: look for file containing the base name
                            const baseName = filename.replace(/\.(html|htm|md)$/i, '').toLowerCase();
                            const fuzzyMatch = physicalFiles.find(f => {
                                const fBase = f.replace(/\.(html|htm|md)$/i, '').toLowerCase();
                                return fBase.includes(baseName) || baseName.includes(fBase);
                            });
                            if (fuzzyMatch) {
                                console.log(`[LibrarySync] Fuzzy-fixed absolute path: ${fp} → ${fuzzyMatch}`);
                                mergedMap.set(id, { ...item, filePath: fuzzyMatch });
                            }
                        }
                    }
                }
            }
        }

        // 6. Pruning: Remove broken absolute-path entries that couldn't be fixed
        if (physicalFiles.length > 0) {
            const toDelete: string[] = [];
            for (const [id, item] of mergedMap) {
                if (item.filePath.startsWith('http') || item.filePath.startsWith('virtual/')) continue;
                if (this.isBundledDemoPath(item.filePath)) continue;

                const fp = item.filePath;
                const isAbsolute = /^[a-zA-Z]:[\\/]/.test(fp) || (fp.startsWith('\\\\'));
                
                if (isAbsolute) {
                    // Absolute path that survived step 5 means it couldn't be fixed
                    // → Remove this broken entry
                    console.log(`[LibrarySync] Removing unfixable absolute-path entry: ${fp}`);
                    toDelete.push(id);
                    continue;
                }

                const normalizedPath = this.normalizePath(fp);
                if (!normalizedPhysicalFiles.has(normalizedPath)) {
                    // Relative path but file not found in data dir - keep for now
                }
            }
            toDelete.forEach(id => mergedMap.delete(id));
        }

        const finalLibrary = Array.from(mergedMap.values()).sort((a, b) => b.lastOpened - a.lastOpened);
        
        // Update Memory/Local
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(finalLibrary));
        
        // Update Disk Rep (library.json)
        await storageManager.saveJson(DISK_FILENAME, finalLibrary);
        
        return finalLibrary;
    } catch (e) {
        console.error("Library Sync Error", e);
        return this.getLibrary();
    }
  }

  static getLibrary(): LibraryItem[] {
    try {
      const stored = localStorage.getItem(LIBRARY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  static async addItem(filePath: string, storageManager?: LocalStorageManager): Promise<LibraryItem> {
    const library = this.getLibrary();
    const normalizedPath = this.normalizePath(filePath);
    const existing = library.find(item => this.normalizePath(item.filePath) === normalizedPath);

    if (existing) {
      const updated = { ...existing, lastOpened: Date.now() };
      const newLib = library.map(i => i.id === existing.id ? updated : i);
      await this.saveLibrary(newLib, storageManager);
      return updated;
    }

    const pathParts = normalizedPath.split('/');
    const fileName = pathParts.pop() || 'Untitled';
    const folder = pathParts.pop() || 'General';

    const newItem: LibraryItem = {
      id: crypto.randomUUID(),
      filePath: normalizedPath,
      title: fileName.replace(/\.(html|htm|md)$/i, ''),
      lastOpened: Date.now(),
      folder,
    };

    await this.saveLibrary([newItem, ...library], storageManager);
    return newItem;
  }

  static async removeItem(id: string, storageManager?: LocalStorageManager) {
    const library = this.getLibrary();
    const item = library.find(i => i.id === id);
    
    if (item && storageManager && storageManager.isConnected) {
        // Delete physical file (True Delete)
        if (!item.filePath.startsWith('http') && !item.filePath.startsWith('virtual/')) {
           try {
             await storageManager.deleteFile(item.filePath).catch(() => {});
           } catch {}
        }
        // Delete metadata
        try {
            await storageManager.deleteFile(item.id + '.json').catch(() => {});
        } catch {}
    }
    
    await this.saveLibrary(library.filter(item => item.id !== id), storageManager);
  }

  static async updateTitle(id: string, newTitle: string, storageManager?: LocalStorageManager) {
    const library = this.getLibrary();
    await this.saveLibrary(library.map(i => i.id === id ? { ...i, title: newTitle } : i), storageManager);
  }

  static async updateMetadata(id: string, updates: Partial<LibraryItem>, storageManager?: LocalStorageManager) {
    const library = this.getLibrary();
    await this.saveLibrary(library.map(i => i.id === id ? { ...i, ...updates } : i), storageManager);
  }

  static async updateProgress(id: string, progress: number, storageManager?: LocalStorageManager) {
    const safeProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, Math.round(progress))) : 0;
    const library = this.getLibrary();
    await this.saveLibrary(library.map((item) => (
      item.id === id ? { ...item, progress: safeProgress } : item
    )), storageManager);
  }

  static async updateLastPosition(id: string, paragraphId: string, progress: number, storageManager?: LocalStorageManager) {
    const library = this.getLibrary();
    await this.saveLibrary(library.map((item) => (
      item.id === id ? { ...item, lastParagraphId: paragraphId, progress: Math.max(item.progress || 0, progress), lastOpened: Date.now() } : item
    )), storageManager);
  }

  static async touchItem(id: string, storageManager?: LocalStorageManager) {
    const library = this.getLibrary();
    await this.saveLibrary(library.map((item) => (
      item.id === id ? { ...item, lastOpened: Date.now() } : item
    )), storageManager);
  }

  private static async saveLibrary(items: LibraryItem[], storageManager?: LocalStorageManager) {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
      if (storageManager && storageManager.isConnected) {
         await storageManager.saveJson(DISK_FILENAME, items);
      }
    } catch (e) {
      console.error(e);
    }
  }
}
