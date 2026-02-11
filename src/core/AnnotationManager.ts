import { LocalStorageManager } from './LocalStorageManager';
import type { Annotation } from '../types/ReaderTypes';

export interface AnnotationData {
    sourceFile: string;
    annotations: Annotation[];
}

export class AnnotationManager {
    filePath: string;
    storageManager?: LocalStorageManager;
    data: AnnotationData | null = null;
    
    // Derived from filepath, e.g., "doc1.html" -> "doc1.json"
    dataFileName: string;

    constructor(filePath: string, storageManager?: LocalStorageManager) {
        this.filePath = filePath;
        this.storageManager = storageManager;
        
        // Use stable per-path file key to avoid collisions between same file names in different folders.
        const basename = filePath.split(/[\\/]/).pop() || 'unknown';
        const stem = basename.replace(/\.(html?|md)$/i, '');
        const key = this.hash(filePath).slice(0, 8);
        this.dataFileName = `${stem}-${key}.json`;
    }

    async load(): Promise<Annotation[]> {
        if (this.storageManager) {
            // New "Systematic" Logic: Load from paper-reader-data/annotations/doc.json
            const loaded = await this.storageManager.loadJson<AnnotationData>(this.dataFileName, 'annotations');
            if (loaded) {
                this.data = loaded;
                return loaded.annotations;
            }
        }
        
        // Fallback or Initial state
        this.data = {
            sourceFile: this.filePath,
            annotations: []
        };
        return [];
    }

    async save(annotations: Annotation[]) {
        this.data = { sourceFile: this.filePath, annotations };

        if (this.storageManager) {
            // Save to paper-reader-data/annotations/doc.json
            await this.storageManager.saveJson(this.dataFileName, this.data, 'annotations');
        } else {
             // Shouldn't happen in new flow, but safe fallback logic if needed
             // ...
        }
    }

    private hash(input: string): string {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash |= 0;
        }
        return (hash >>> 0).toString(16);
    }
}
