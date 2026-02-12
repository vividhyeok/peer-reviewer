// LocalStorageManager.ts - Hybrid Storage Layer
// 1) Tauri plugin-fs (desktop) -> Supports Custom Root
// 2) Vite dev middleware (/api/fs)
// 3) localStorage fallback

import type { FileSystemDirectoryHandle } from '../types/FileSystem';
import {
    readTextFile,
    writeTextFile,
    readFile as readBinaryFile,
    writeFile as writeBinaryFile,
    exists,
    remove,
    readDir,
    mkdir,
    BaseDirectory
} from '@tauri-apps/plugin-fs';

const CACHE_FOLDER = 'cache';
const DEFAULT_TAURI_DIR = 'paper-reader-data';

interface StorageConfig {
    useFileSystem: boolean; // reserved for browser native FS mode
    useDevServer: boolean;
    useTauri: boolean;
}

function isAbsolutePath(path: string): boolean {
    return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('/') || path.startsWith('\\\\');
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\/+/, '').trim();
}

function inferMimeType(path: string): string {
    const lower = path.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.bmp')) return 'image/bmp';
    if (lower.endsWith('.md')) return 'text/markdown; charset=utf-8';
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html; charset=utf-8';
    return 'application/octet-stream';
}

export class LocalStorageManager {
    private config: StorageConfig = { useFileSystem: false, useDevServer: false, useTauri: false };
    private directoryHandle: FileSystemDirectoryHandle | null = null;
    private readyPromise: Promise<void>;
    
    // Dynamic Base Path (Relative to Documents OR Absolute)
    private basePath: string = DEFAULT_TAURI_DIR;
    // Which BaseDirectory to use for relative paths
    private _baseDir: BaseDirectory = BaseDirectory.Document;

    constructor() {
        this.readyPromise = this.checkEnvironment();
    }

    private async ensureReady(): Promise<void> {
        await this.readyPromise;
    }

    async checkEnvironment(): Promise<void> {
        const isTauriRuntime =
            typeof window !== 'undefined' &&
            Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);

        if (isTauriRuntime) {
            this.config.useTauri = true;
            this.config.useDevServer = false;
            await this.ensureTauriDataDir();
            return;
        }

        this.config.useTauri = false;
        await this.checkDevServer();
    }

    // New: Set Root Path dynamically
    async setRootPath(path: string | undefined) {
        if (!path) {
            this.basePath = DEFAULT_TAURI_DIR;
            this._baseDir = BaseDirectory.Document; // reset to default
        } else {
            this.basePath = path;
            this._baseDir = isAbsolutePath(path) ? BaseDirectory.Document : BaseDirectory.Document;
        }
        console.log(`[Storage] setRootPath: "${path}" → basePath="${this.basePath}"`);
        
        if (this.config.useTauri) {
            await this.ensureTauriDataDir();
        }
    }

    // Whether Rust backend commands are available
    private _useRustBackend: boolean = false;

    private async ensureTauriDataDir(): Promise<void> {
        // Strategy 1: Try Rust backend (most reliable, no JS scope issues)
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const dataPath: string = await invoke('get_data_dir_path');
            console.log(`[Storage] Rust backend data dir: ${dataPath}`);
            this._useRustBackend = true;
            this.basePath = dataPath;
            return;
        } catch (rustErr) {
            console.warn('[Storage] Rust backend not available, falling back to JS:', rustErr);
        }

        // Strategy 2: JS plugin-fs
        try {
            const isAbsolute = isAbsolutePath(this.basePath);
            const options = isAbsolute ? undefined : { baseDir: this._baseDir };
            
            console.log(`[Storage] ensureTauriDataDir JS: basePath="${this.basePath}", isAbsolute=${isAbsolute}`);
            
            const dirExists = await exists(this.basePath, options);
            if (!dirExists) {
                await mkdir(this.basePath, { ...options, recursive: true });
            }
            const probeFile = `${this.basePath}/.probe`;
            await writeTextFile(probeFile, 'write_test', options);
            await remove(probeFile, options);
            console.log(`[Storage] Data dir verified OK: ${this.basePath}`);
        } catch (error) {
            console.error('[Storage] JS storage init failed', error);
            if (this.basePath !== DEFAULT_TAURI_DIR) {
                this.basePath = DEFAULT_TAURI_DIR;
                return this.ensureTauriDataDir();
            } else {
                try {
                    const appDataPath = 'paper-reader-data';
                    const opts = { baseDir: BaseDirectory.AppLocalData };
                    const adExists = await exists(appDataPath, opts);
                    if (!adExists) await mkdir(appDataPath, { ...opts, recursive: true });
                    const probe = `${appDataPath}/.probe`;
                    await writeTextFile(probe, 'test', opts);
                    await remove(probe, opts);
                    this.basePath = appDataPath;
                    this._baseDir = BaseDirectory.AppLocalData;
                    console.log('[Storage] Fallback to AppLocalData succeeded');
                } catch (e2) {
                    console.error('[Storage] All JS storage init failed:', e2);
                }
            }
        }
    }

    async checkDevServer(): Promise<void> {
        try {
            const res = await fetch('/api/fs/list?ext=.storage_probe');
            this.config.useDevServer = res.ok;
        } catch {
            this.config.useDevServer = false;
        }
    }

    get isConnected(): boolean {
        return this.config.useTauri || this.config.useDevServer || (this.config.useFileSystem && this.directoryHandle !== null);
    }

    get isDevServer(): boolean {
        return this.config.useDevServer;
    }

    get isTauri(): boolean {
        return this.config.useTauri;
    }

    get needsReconnect(): boolean {
        if (this.config.useDevServer || this.config.useTauri) return false;
        return this.config.useFileSystem && this.directoryHandle === null;
    }

    async restoreDirectoryHandle(_prompt: boolean = false): Promise<boolean> {
        this.readyPromise = this.checkEnvironment();
        await this.readyPromise;

        if (this.config.useDevServer || this.config.useTauri) return true;
        return false;
    }

    async reconnect(): Promise<boolean> {
        await this.ensureReady();
        if (this.config.useDevServer || this.config.useTauri) return true;
        return false;
    }

    async listFiles(extensions: string[] = ['.html', '.htm', '.md']): Promise<string[]> {
        await this.ensureReady();

        if (this.config.useTauri) {
            // Try Rust backend first
            if (this._useRustBackend) {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    const allFiles: string[] = await invoke('list_data_files');
                    return allFiles.filter(f => 
                        extensions.some(ext => f.toLowerCase().endsWith(ext.toLowerCase()))
                    );
                } catch (rustErr) {
                    console.warn('[Storage] Rust listFiles failed, trying JS:', rustErr);
                }
            }

            // JS fallback
            const isAbsolute = isAbsolutePath(this.basePath);
            const options = isAbsolute ? undefined : { baseDir: this._baseDir };

            const files: string[] = [];
            const walk = async (relativeDir: string): Promise<void> => {
                try {
                    // Path construction:
                    // If basePath = "C:/Data", relativeDir = "" -> "C:/Data"
                    // If basePath = "C:/Data", relativeDir = "sub" -> "C:/Data/sub"
                    const currentPath = relativeDir 
                        ? (this.basePath.endsWith('/') || this.basePath.endsWith('\\') ? `${this.basePath}${relativeDir}` : `${this.basePath}/${relativeDir}`)
                        : this.basePath;
                        
                    // readDir works with the mapped path
                    const entries = await readDir(currentPath, options);

                    for (const entry of entries as any[]) {
                        const name = (entry.name || '').toString();
                        if (!name) continue;

                        const nextRelative = relativeDir ? `${relativeDir}/${name}` : name;
                        
                        if (entry.isDirectory) {
                            await walk(nextRelative);
                            continue;
                        }

                        if (extensions.some((ext) => name.toLowerCase().endsWith(ext.toLowerCase()))) {
                             // Return relative path from base
                            files.push(nextRelative.replace(/\\/g, '/'));
                        }
                    }
                } catch (error) {
                    // console.warn('[LocalStorageManager] Walk error (might be permission or empty)', relativeDir, error);
                }
            };

            await walk('');
            return files;
        }

        if (this.config.useDevServer) {
            try {
                const extParam = extensions.join(',');
                const res = await fetch(`/api/fs/list?ext=${encodeURIComponent(extParam)}`);
                if (res.ok) {
                    const files: string[] = await res.json();
                    return files;
                }
            } catch (error) {
                console.error('[LocalStorageManager] Dev server list failed', error);
            }
            return [];
        }

        return [];
    }
    
    private getTauriPathOptions(path: string): { path: string, options?: any } {
        // Warning: 'path' here is usually relative to storage root (e.g., 'library.json', 'images/foo.png')
        // OR it's an absolute path to an external file (e.g., 'C:\Users\Downloads\paper.pdf') if handleImportClick passes it.
        
        // CASE 1: External Absolute Path (Imported file outside our root)
        if (isAbsolutePath(path)) {
            // We just read it directly.
            // CAUTION: This means we ignore 'basePath' entirely for this file.
            return { path }; 
        }

        // CASE 2: Relative Path (Inside our storage root)
        const clean = normalizePath(path);
        const isBaseAbsolute = isAbsolutePath(this.basePath);
        
        if (isBaseAbsolute) {
             // Join manually
             const joined = (this.basePath.endsWith('/') || this.basePath.endsWith('\\'))
                ? `${this.basePath}${clean}`
                : `${this.basePath}/${clean}`;
             return { path: joined };
        } else {
             // Use BaseDirectory
             return { 
                 path: `${this.basePath}/${clean}`,
                 options: { baseDir: this._baseDir }
             };
        }
    }

    async readFile(path: string): Promise<string | null> {
        await this.ensureReady();

        if (this.config.useTauri) {
            // Try Rust backend first (no scope issues)
            if (this._useRustBackend && !isAbsolutePath(path)) {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    return await invoke('read_data_file', { filename: normalizePath(path) });
                } catch (rustErr) {
                    console.warn('[Storage] Rust read failed, trying JS:', rustErr);
                }
            }
            // JS fallback
            try {
                const { path: targetPath, options } = this.getTauriPathOptions(path);
                return await readTextFile(targetPath, options);
            } catch {
                // Fallback for bundled docs
                const normalized = path.replace(/\\/g, '/');
                if (normalized.startsWith('/docs/') || normalized.startsWith('docs/')) {
                    const candidate = normalized.startsWith('/') ? normalized : `/${normalized}`;
                    try {
                        const response = await fetch(candidate);
                        if (response.ok) return await response.text();
                    } catch {}
                }
                return null;
            }
        }

        if (this.config.useDevServer) {
            try {
                const clean = normalizePath(path);
                if (!clean) return null;
                const res = await fetch(`/api/fs/file?path=${encodeURIComponent(clean)}`);
                if (res.ok) return await res.text();
            } catch {
                return null;
            }
            return null;
        }

        return localStorage.getItem(`data:${path}`) || localStorage.getItem(`cached-file:${path}`);
    }

    async writeFile(path: string, content: string): Promise<void> {
        await this.ensureReady();

        if (this.config.useTauri) {
            // Try Rust backend first (no scope issues)
            if (this._useRustBackend && !isAbsolutePath(path)) {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    await invoke('write_data_file', { filename: normalizePath(path), content });
                    console.log(`[Storage] writeFile via Rust OK: ${path}`);
                    return;
                } catch (rustErr) {
                    console.warn('[Storage] Rust write failed, trying JS:', rustErr);
                }
            }
            // JS fallback
            try {
                const { path: targetPath, options } = this.getTauriPathOptions(path);
                console.log(`[Storage] writeFile JS: target="${targetPath}", baseDir=${options?.baseDir ?? 'none(absolute)'}`);

                const lastSep = Math.max(targetPath.lastIndexOf('/'), targetPath.lastIndexOf('\\'));
                if (lastSep > -1) {
                    const dir = targetPath.substring(0, lastSep);
                    const dirExists = await exists(dir, options);
                    if (!dirExists) {
                        await mkdir(dir, { ...options, recursive: true });
                    }
                }

                await writeTextFile(targetPath, content, options);
                console.log(`[Storage] writeFile JS OK: ${targetPath}`);
            } catch (error) {
                console.error('[LocalStorageManager] Tauri write failed', error);
                throw error;
            }
            return;
        }

        if (this.config.useDevServer) {
            try {
                const clean = normalizePath(path);
                if (!clean) return;

                await fetch(`/api/fs/file?path=${encodeURIComponent(clean)}`, {
                    method: 'POST',
                    body: content
                });
            } catch (error) {
                console.error('[LocalStorageManager] Dev write failed', error);
            }
            return;
        }

        if (path.endsWith('.json') || path.endsWith('.md')) {
            localStorage.setItem(`data:${path}`, content);
        }
    }

    async deleteFile(path: string): Promise<void> {
        await this.ensureReady();

        if (this.config.useTauri) {
            if (this._useRustBackend && !isAbsolutePath(path)) {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    await invoke('delete_data_file', { filename: normalizePath(path) });
                    return;
                } catch (rustErr) {
                    console.warn('[Storage] Rust delete failed, trying JS:', rustErr);
                }
            }
            try {
                const { path: targetPath, options } = this.getTauriPathOptions(path);
                await remove(targetPath, options);
            } catch (error) {
                console.error('[LocalStorageManager] Tauri delete failed', error);
            }
            return;
        }

        if (this.config.useDevServer) {
            try {
                const clean = normalizePath(path);
                if (!clean) return;

                await fetch(`/api/fs/file?path=${encodeURIComponent(clean)}`, {
                    method: 'DELETE'
                });
            } catch (error) {
                console.error('[LocalStorageManager] Dev delete failed', error);
            }
            return;
        }

        localStorage.removeItem(`data:${path}`);
        localStorage.removeItem(`cached-file:${path}`);
    }

    async saveJson<T>(filename: string, data: T, subfolder: string | null = null): Promise<void> {
        const path = subfolder ? `${subfolder}/${filename}` : filename;
        await this.writeFile(path, JSON.stringify(data, null, 2));
    }

    async loadJson<T>(filename: string, subfolder: string | null = null): Promise<T | null> {
        const path = subfolder ? `${subfolder}/${filename}` : filename;
        const text = await this.readFile(path);
        try {
            return text ? (JSON.parse(text) as T) : null;
        } catch {
            return null;
        }
    }

    async saveCache(key: string, data: any): Promise<void> {
        await this.saveJson(`${key}.json`, data, CACHE_FOLDER);
    }

    async loadCache<T>(key: string): Promise<T | null> {
        return await this.loadJson<T>(`${key}.json`, CACHE_FOLDER);
    }

    async clearCache(): Promise<void> {
        await this.ensureReady();

        if (this.config.useTauri) {
            try {
                // Resolve path for cache folder
                const { path: cachePath, options } = this.getTauriPathOptions(CACHE_FOLDER);
                await remove(cachePath, { ...options, recursive: true });
                await mkdir(cachePath, { ...options, recursive: true });
            } catch {
                // Ignore
            }
            return;
        }

        if (this.config.useDevServer) {
            await fetch('/api/fs/clear-cache', { method: 'POST' });
            return;
        }
    }

    async saveImage(filename: string, blob: Blob): Promise<void> {
        await this.ensureReady();

        if (this.config.useTauri) {
            try {
                const clean = normalizePath(filename);
                const relative = clean.startsWith('images/') ? clean : `images/${clean}`;
                const { path: targetPath, options } = this.getTauriPathOptions(relative);

                // Mkdir logic
                const lastSep = Math.max(targetPath.lastIndexOf('/'), targetPath.lastIndexOf('\\'));
                if (lastSep > -1) {
                    const dir = targetPath.substring(0, lastSep);
                    const dirExists = await exists(dir, options);
                    if (!dirExists) {
                        await mkdir(dir, { ...options, recursive: true });
                    }
                }

                const bytes = new Uint8Array(await blob.arrayBuffer());
                await writeBinaryFile(targetPath, bytes, options);
            } catch (error) {
                console.error('[LocalStorageManager] Tauri image save failed', error);
            }
            return;
        }

        if (this.config.useDevServer) {
            const path = `images/${filename}`;
            await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`, {
                method: 'POST',
                body: blob
            });
        }
    }

    async loadFileAsUrl(relativePath: string): Promise<string | null> {
        await this.ensureReady();

        if (this.config.useTauri) {
            const clean = normalizePath(relativePath);
            if (!clean) return null;

            // Try Rust backend first (binary read)
            if (this._useRustBackend) {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    const base64: string = await invoke('read_data_file_binary', { filename: clean });
                    const binaryString = atob(base64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const blob = new Blob([bytes], { type: inferMimeType(clean) });
                    return URL.createObjectURL(blob);
                } catch {
                    // Fall through to JS plugin-fs
                }
            }

            try {
                const { path: targetPath, options } = this.getTauriPathOptions(clean);
                const bytes = await readBinaryFile(targetPath, options);
                const blob = new Blob([bytes], { type: inferMimeType(clean) });
                return URL.createObjectURL(blob);
            } catch {
                return null;
            }
        }

        if (this.config.useDevServer) {
            try {
                const clean = normalizePath(relativePath);
                if (!clean) return null;

                const res = await fetch(`/api/fs/file?path=${encodeURIComponent(clean)}`);
                if (res.ok) {
                    const blob = await res.blob();
                    return URL.createObjectURL(blob);
                }
            } catch {
                return null;
            }
            return null;
        }

        return null;
    }

    getPathInfo(): string {
        if (this.config.useTauri) {
            if (isAbsolutePath(this.basePath)) return `${this.basePath} (Custom)`;
            return `내 문서\\${this.basePath} (Default)`;
        } 
        if (this.config.useDevServer) return '로컬 프로젝트 폴더 (Dev Server)';
        return '브라우저 저장소 (임시)';
    }

    async requestDirectory(): Promise<string | null> {
        if (this.config.useTauri) {
             try {
                // Dynamically import to avoid build errors if not available in dev
                const { open } = await import('@tauri-apps/plugin-dialog');
                const selected = await open({
                    directory: true,
                    multiple: false,
                    title: 'Select Data Root Folder'
                });

                if (selected === null) return null;
                
                const path = Array.isArray(selected) ? selected[0] : selected;
                this.basePath = path;
                await this.ensureTauriDataDir();
                return path;
             } catch (e) {
                 console.error('Failed to open directory dialog', e);
                 return null;
             }
        }
        
        // Web Fallback (FileSystem Access API)
        if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
             try {
                 const handle = await (window as any).showDirectoryPicker();
                 this.directoryHandle = handle;
                 this.config.useFileSystem = true;
                 return handle.name; // Not full path, but handle name
             } catch (e) {
                 console.error(e);
                 return null;
             }
        }
        
        alert('이 환경에서는 폴더 선택을 지원하지 않습니다.');
        return null;
    }

    // Deprecated helpers for flat KV
    async save(key: string, value: string): Promise<void> { return this.writeFile(key, value); }
    async load(key: string): Promise<string | null> { return this.readFile(key); }
    async loadImage(filename: string): Promise<string | null> { return this.loadFileAsUrl(filename); }
    getStorageInfo(): string { return this.getPathInfo(); }
    async loadFromRoot(filename: string): Promise<string | null> { return this.readFile(filename); }
}
