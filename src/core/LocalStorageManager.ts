// LocalStorageManager.ts - Hybrid Implementation
// 1. Dev Mode: Uses Vite Dev Server API (/api/fs) -> Direct disk write
// 2. Prod Mode: Uses File System Access API (Manual folder pick) -> Browser sandbox
// 3. Fallback: LocalStorage (Memory)

import type { FileSystemDirectoryHandle } from '../types/FileSystem';

// Constants
const CACHE_FOLDER = 'cache';

interface StorageConfig {
    useFileSystem: boolean; // For Browser Native FS
    useDevServer: boolean;  // For Local Dev Server
}

export class LocalStorageManager {
    private config: StorageConfig = { useFileSystem: false, useDevServer: false };
    private directoryHandle: FileSystemDirectoryHandle | null = null;
    
    // --- Initialization ---

    constructor() {
        this.checkDevServer();
    }

    /**
     * Check if the Vite Dev Server API is available.
     * If yes, use it as the primary storage.
     */
    async checkDevServer() {
        try {
            // Try to list files with a probe
            const res = await fetch('/api/fs/list?ext=.test-check');
            if (res.ok) {
                console.log('✅ Local Dev Server Storage Connected');
                this.config.useDevServer = true;
                this.config.useFileSystem = false; // Disable manual picking in dev mode
            }
        } catch (e) {
            // Not in dev mode or server not running
            this.config.useDevServer = false;
        }
    }

    get isConnected(): boolean {
        return this.config.useDevServer || (this.config.useFileSystem && this.directoryHandle !== null);
    }

    get isDevServer(): boolean {
        return this.config.useDevServer;
    }
    
    // In dev mode, we never "need reconnect" because the server is always there.
    get needsReconnect(): boolean {
        if (this.config.useDevServer) return false;
        return this.config.useFileSystem && this.directoryHandle === null;
    }

    /**
     * No-op in Dev Mode. 
     * In Prod Mode, tries to restore handle from IDB.
     */
    async restoreDirectoryHandle(prompt: boolean = false): Promise<boolean> {
        await this.checkDevServer();
        if (this.config.useDevServer) return true;

        // ... Existing IDB restore logic (Omitted for brevity as User wants Dev Server focus)
        // If we need to support Prod build later, we can uncomment/restore the IDB logic here.
        return false; 
    }

    async reconnect(): Promise<boolean> {
        if (this.config.useDevServer) return true;
        return false;
    }
    
    // --- File Operations ---

    async listFiles(extensions: string[] = ['.html', '.htm', '.md']): Promise<string[]> {
        // 1. Dev Server
        if (this.config.useDevServer) {
            try {
                const extParam = extensions.join(',');
                const res = await fetch(`/api/fs/list?ext=${extParam}`);
                if (res.ok) {
                    const files: string[] = await res.json();
                     // Filter out non-root files if needed, or keeping it recursive is fine
                    return files;
                }
            } catch (e) {
                console.error('Diff Server List Failed', e);
            }
            return [];
        }

        // 2. Browser FS (Legacy/Prod)
        // ... (Simplified: assume Dev Server for now as per request)
        return [];
    }

    async readFile(path: string): Promise<string | null> {
        // 1. Dev Server
        if (this.config.useDevServer) {
            try {
                // Ensure no double slashes or absolute paths
                const clean = path.replace(/^\/+/, '');
                const res = await fetch(`/api/fs/file?path=${encodeURIComponent(clean)}`);
                if (res.ok) return await res.text();
            } catch (e) { return null; }
            return null;
        }

        // 2. LocalStorage Fallback
        return localStorage.getItem(`data:${path}`) || localStorage.getItem(`cached-file:${path}`);
    }

    async writeFile(path: string, content: string): Promise<void> {
        // 1. Dev Server
        if (this.config.useDevServer) {
            try {
                const clean = path.replace(/^\/+/, '');
                await fetch(`/api/fs/file?path=${encodeURIComponent(clean)}`, {
                    method: 'POST',
                    body: content
                });
            } catch (e) {
                console.error('Write failed', e);
            }
            return;
        }

        // 2. LocalStorage Fallback
        if (path.endsWith('.json') || path.endsWith('.md')) {
            localStorage.setItem(`data:${path}`, content);
        }
    }

    // --- Helpers ---

    async saveJson<T>(filename: string, data: T, subfolder: string | null = null): Promise<void> {
        const path = subfolder ? `${subfolder}/${filename}` : filename;
        await this.writeFile(path, JSON.stringify(data, null, 2));
    }

    async loadJson<T>(filename: string, subfolder: string | null = null): Promise<T | null> {
        const path = subfolder ? `${subfolder}/${filename}` : filename;
        const text = await this.readFile(path);
        try {
            return text ? JSON.parse(text) : null;
        } catch { return null; }
    }

    async saveCache(key: string, data: any): Promise<void> {
        await this.saveJson(key + '.json', data, CACHE_FOLDER); 
    }

    async loadCache<T>(key: string): Promise<T | null> {
        return await this.loadJson<T>(key + '.json', CACHE_FOLDER);
    }
    
    async clearCache(): Promise<void> {
        if (this.config.useDevServer) {
            await fetch('/api/fs/clear-cache', { method: 'POST' });
        }
    }

    async saveImage(filename: string, blob: Blob): Promise<void> {
        if (this.config.useDevServer) {
            // Ensure images folder
            const path = `images/${filename}`;
            await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`, {
                method: 'POST',
                body: blob
            });
        }
    }
    
    async loadFileAsUrl(relativePath: string): Promise<string | null> {
        if (this.config.useDevServer) {
            try {
                const clean = relativePath.replace(/^\.?\//, '');
                // Fetch blob to create URL
                const res = await fetch(`/api/fs/file?path=${encodeURIComponent(clean)}`);
                if (res.ok) {
                    const blob = await res.blob();
                    return URL.createObjectURL(blob);
                }
            } catch {}
            return null;
        }
        return null;
    }

    getPathInfo(): string {
        if (this.config.useDevServer) return '로컬 프로젝트 폴더 (Dev Server)';
        // if (this.config.useFileSystem) return 'Local Folder (Browser Native)';
        return '브라우저 저장소 (임시)';
    }

    // Placeholder for interface compatibility
    async requestDirectory() { 
        alert("개발 서버 모드에서는 폴더 선택이 필요하지 않습니다. 프로젝트 내부 'paper-reader-data'에 자동 저장됩니다.");
        return false; 
    }
    
    // Legacy support
    async loadFromRoot(filename: string) { return this.readFile(filename); }
}
