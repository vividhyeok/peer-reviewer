// Local Persistent Storage Manager using FileSystem Access API
// 브라우저 캐시/쿠키 삭제와 무관하게 사용자 지정 폴더에 데이터 저장

interface StorageConfig {
  useFileSystem: boolean;
  directoryHandle?: FileSystemDirectoryHandle;
}

const STORAGE_KEY = 'storage-config';
const DATA_FOLDER = 'paper-reader-data';

export class LocalStorageManager {
  private config: StorageConfig;
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  constructor() {
    this.config = this.loadConfig();
  }

  get needsReconnect(): boolean {
    return this.config.useFileSystem && this.directoryHandle === null;
  }

  private loadConfig(): StorageConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { useFileSystem: parsed.useFileSystem || false };
      }
    } catch (e) {
      console.warn('Failed to load storage config', e);
    }
    return { useFileSystem: false };
  }

  private saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        useFileSystem: this.config.useFileSystem
      }));
    } catch (e) {
      console.error('Failed to save storage config', e);
    }
  }

  /**
   * 사용자에게 로컬 폴더 선택 요청
   * FileSystem Access API 사용 (Chrome 86+, Edge 86+)
   */
  async requestDirectory(): Promise<boolean> {
    if (!('showDirectoryPicker' in window)) {
      alert('이 브라우저는 로컬 폴더 저장을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.');
      return false;
    }

    try {
      // @ts-ignore - FileSystem Access API
      this.directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      // 권한 확인
      // @ts-ignore
      const permission = await this.directoryHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        // @ts-ignore
        const request = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
        if (request !== 'granted') {
          throw new Error('폴더 접근 권한이 거부되었습니다.');
        }
      }

      this.config.useFileSystem = true;
      this.saveConfig();

      // IndexedDB에 handle 저장 (재시작 시 복원용)
      if (this.directoryHandle) {
        await this.saveDirectoryHandle(this.directoryHandle);
      }

      return true;
    } catch (e: any) {
      console.error('Directory picker failed', e);
      if (e.name !== 'AbortError') {
        alert(`폴더 선택 실패: ${e.message}`);
      }
      return false;
    }
  }

  /**
   * 루트 디렉토리의 모든 HTML 파일 목록 조회
   */
  async listFiles(extensions: string[] = ['.html', '.htm']): Promise<string[]> {
    const files: string[] = [];

    if (this.config.useFileSystem && this.directoryHandle) {
      try {
        // @ts-ignore - FileSystemDirectoryHandle is async iterable
        for await (const [name, handle] of this.directoryHandle.entries()) {
          if (handle.kind === 'file') {
            const lowerName = name.toLowerCase();
            if (extensions.some(ext => lowerName.endsWith(ext))) {
              files.push(name);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to list files from directory', e);
      }
    } else {
      // localStorage fallback
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('data:')) {
          const name = key.replace('data:', '');
          const lowerName = name.toLowerCase();
          if (extensions.some(ext => lowerName.endsWith(ext))) {
            files.push(name);
          }
        }
      }
    }
    return files;
  }

  /**
   * 루트 디렉토리에서 파일 내용 읽기 (Library papers loading)
   */
  async loadFromRoot(filename: string): Promise<string | null> {
    if (!this.config.useFileSystem || !this.directoryHandle) return null;

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: false });
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (e) {
      return null;
    }
  }

  /**
   * 일반 JSON 데이터 저장 (설정 예: settings.json, 주석 예: annotations/doc1.json)
   */
  async saveJson(filename: string, data: any, folderName?: string): Promise<void> {
    if (this.config.useFileSystem && this.directoryHandle) {
        try {
            // 기본 폴더는 paper-reader-data
            let targetHandle = await this.directoryHandle.getDirectoryHandle(DATA_FOLDER, { create: true });
            
            // 하위 폴더 지정 시 (예: 'annotations')
            if (folderName) {
                targetHandle = await targetHandle.getDirectoryHandle(folderName, { create: true });
            }

            const fileHandle = await targetHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
        } catch (e) {
            console.error(`Failed to save JSON ${folderName}/${filename}`, e);
        }
    } else {
        // LocalStorage Fallback
        const key = folderName ? `${folderName}:${filename}` : `data:${filename}`;
        localStorage.setItem(key, JSON.stringify(data));
    }
  }

  /**
   * 일반 JSON 데이터 로드
   */
  async loadJson<T>(filename: string, folderName?: string): Promise<T | null> {
    if (this.config.useFileSystem && this.directoryHandle) {
        try {
            let targetHandle = await this.directoryHandle.getDirectoryHandle(DATA_FOLDER, { create: false });
            if (folderName) {
                targetHandle = await targetHandle.getDirectoryHandle(folderName, { create: false });
            }
            const fileHandle = await targetHandle.getFileHandle(filename, { create: false });
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text) as T;
        } catch (e) {
            return null; // File not found
        }
    } else {
        // LocalStorage Fallback
        const key = folderName ? `${folderName}:${filename}` : `data:${filename}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) as T : null;
    }
  }

  /**
   * IndexedDB에 DirectoryHandle 저장 (브라우저 재시작 후에도 유지)
   */
  private async saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
    try {
      const db = await this.openDatabase();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('handles', 'readwrite');
        const store = tx.objectStore('handles');
        const request = store.put(handle, 'root-directory');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Failed to save directory handle', e);
    }
  }

  /**
   * IndexedDB에서 DirectoryHandle 복원
   */
  async restoreDirectoryHandle(requestIfPrompt: boolean = true): Promise<boolean> {
    try {
      const db = await this.openDatabase();
      
      const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
        const tx = db.transaction('handles', 'readonly');
        const store = tx.objectStore('handles');
        const request = store.get('root-directory');
        request.onsuccess = () => resolve(request.result as FileSystemDirectoryHandle);
        request.onerror = () => reject(request.error);
      });

      if (!handle) return false;

      // 권한 재확인
      // @ts-ignore
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      
      if (permission === 'granted') {
        this.directoryHandle = handle;
        this.config.useFileSystem = true;
        return true;
      }

      if (requestIfPrompt) {
        // @ts-ignore
        const request = await handle.requestPermission({ mode: 'readwrite' });
        if (request === 'granted') {
          this.directoryHandle = handle;
          this.config.useFileSystem = true;
          return true;
        }
      }

      // If we are here, we have a handle but no permission and didn't/couldn't ask
      // or user denied.
      // We keep directoryHandle null but don't clear config yet so we can ask again.
      return false;
    } catch (e) {
      console.error('Failed to restore directory handle', e);
      return false;
    }
  }

  /**
   * IndexedDB 초기화
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('paper-reader-storage', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
    });
  }

  /**
   * 데이터 저장 (파일 시스템 또는 localStorage)
   */
  async save(filename: string, content: string): Promise<void> {
    if (this.config.useFileSystem && this.directoryHandle) {
      await this.saveToFileSystem(filename, content);
    } else {
      localStorage.setItem(`data:${filename}`, content);
    }
  }

  /**
   * 데이터 로드 (파일 시스템 또는 localStorage)
   */
  async load(filename: string): Promise<string | null> {
    if (this.config.useFileSystem && this.directoryHandle) {
      return await this.loadFromFileSystem(filename);
    } else {
      return localStorage.getItem(`data:${filename}`);
    }
  }

  /**
   * 파일 시스템에 저장
   */
  private async saveToFileSystem(filename: string, content: string): Promise<void> {
    try {
      // data 폴더 생성/가져오기
      const dataFolder = await this.directoryHandle!.getDirectoryHandle(DATA_FOLDER, { create: true });

      // 파일 생성/덮어쓰기
      const fileHandle = await dataFolder.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (e) {
      console.error(`Failed to save to file system: ${filename}`, e);
      throw e;
    }
  }

  /**
   * 파일 시스템에서 로드
   */
  private async loadFromFileSystem(filename: string): Promise<string | null> {
    try {
      const dataFolder = await this.directoryHandle!.getDirectoryHandle(DATA_FOLDER, { create: false });
      const fileHandle = await dataFolder.getFileHandle(filename, { create: false });
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        return null;
      }
      console.error(`Failed to load from file system: ${filename}`, e);
      throw e;
    }
  }

  /**
   * 임의 경로의 파일 로드 (Blob URL)
   * 상대 경로(./img/fig.png) 또는 절대 경로 유사 패턴 지원
   */
  async loadFileAsUrl(relativePath: string): Promise<string | null> {
    if (!this.config.useFileSystem || !this.directoryHandle) return null;

    try {
      // 경로 정규화: 백슬래시를 슬래시로 변경하고 시작 부분의 ./ 제거
      const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
      const parts = normalizedPath.split('/');
      
      let currentDir = this.directoryHandle;
      
      // 디렉터리 순회
      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i];
        if (dirName === '' || dirName === '.') continue;
        currentDir = await currentDir.getDirectoryHandle(dirName, { create: false });
      }
      
      const fileName = parts[parts.length - 1];
      const fileHandle = await currentDir.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      return URL.createObjectURL(file);
    } catch (e) {
      // console.warn(`Failed to resolve file path: ${relativePath}`, e);
      return null;
    }
  }

  /**
   * 이미지 저장 (Blob)
   */
  async saveImage(filename: string, blob: Blob): Promise<void> {
    if (this.config.useFileSystem && this.directoryHandle) {
      try {
        const imagesFolder = await this.directoryHandle.getDirectoryHandle('images', { create: true });
        const fileHandle = await imagesFolder.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (e) {
        console.error(`Failed to save image: ${filename}`, e);
      }
    } else {
      // localStorage fallback: Base64 인코딩
      const reader = new FileReader();
      reader.onloadend = () => {
        localStorage.setItem(`image:${filename}`, reader.result as string);
      };
      reader.readAsDataURL(blob);
    }
  }

  /**
   * 이미지 로드 (URL 반환)
   */
  async loadImage(filename: string): Promise<string | null> {
    if (this.config.useFileSystem && this.directoryHandle) {
      try {
        const imagesFolder = await this.directoryHandle.getDirectoryHandle('images', { create: false });
        const fileHandle = await imagesFolder.getFileHandle(filename, { create: false });
        const file = await fileHandle.getFile();
        return URL.createObjectURL(file);
      } catch (e: any) {
        if (e.name !== 'NotFoundError') {
          console.error(`Failed to load image: ${filename}`, e);
        }
        return null;
      }
    } else {
      // localStorage fallback
      return localStorage.getItem(`image:${filename}`);
    }
  }


  /**
   * 현재 저장 방식 확인
   */
  isUsingFileSystem(): boolean {
    return this.config.useFileSystem && this.directoryHandle !== null;
  }

  /**
   * 저장 위치 정보
   */
  getStorageInfo(): string {
    if (this.isUsingFileSystem() && this.directoryHandle) {
      return `로컬 폴더: ${this.directoryHandle.name}`;
    }
    return '브라우저 저장소 (localStorage)';
  }

  /**
   * localStorage에서 파일 시스템으로 마이그레이션
   */
  async migrateToFileSystem(): Promise<number> {
    if (!this.directoryHandle) {
      throw new Error('먼저 폴더를 선택하세요.');
    }

    let count = 0;
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith('data:')) {
        const filename = key.replace('data:', '');
        const content = localStorage.getItem(key);
        if (content) {
          await this.saveToFileSystem(filename, content);
          count++;
        }
      }
    }

    return count;
  }
}
