import { LocalStorageManager } from './LocalStorageManager';
import { ReaderParser } from './ReaderParser';
import { AnnotationManager } from './AnnotationManager';
import type { Annotation, PaperStructure, ParagraphData } from '../types/ReaderTypes';

export interface DocumentState {
    id: string; // filePath
    textHash: string;
    content: string;
    structure: PaperStructure;
    paragraphs: ParagraphData[];
    annotations: Annotation[];
    images: Record<string, string>; // Blob URLs or Base64
}

interface DirtyFlags {
    annotations: boolean;
    meta: boolean;
}

export class DocumentSession {
    public id: string;
    public state: DocumentState | null = null;
    
    private storage: LocalStorageManager;
    private dirty: DirtyFlags = { annotations: false, meta: false };
    public annotationManager: AnnotationManager;

    constructor(id: string, storage: LocalStorageManager) {
        this.id = id;
        this.storage = storage;
        this.annotationManager = new AnnotationManager(id, storage);
    }

    /**
     * Loads the document.
     * Strategies:
     * 1. Load Text (IO)
     * 2. Calculate Hash
     * 3. Check Cache for Parsed Structure (Optimization) -> TODO
     * 4. Parse if needed (CPU)
     * 5. Load Annotations (IO)
     */
    async load(): Promise<DocumentState> {
        if (this.state) return this.state;

        // 1. Load Text
        let text = await this.storage.readFile(this.id);
        if (!text) {
             // Fallback for public demo files
             if (this.id.startsWith('/')) {
                 const res = await fetch(this.id);
                 if (res.ok) text = await res.text();
             }
        }
        
        if (!text) throw new Error(`Document not found: ${this.id}`);

        // 2. Generate Hash (Simple check for cache validity)
        const textHash = this.simpleHash(text);
        
        // 3. Try Load Parsed Cache (Structure & Paragraphs)
        // This is a big perf boost for large papers
        const cacheKey = `parse_v1_${textHash}`;
        let parseResult: { structure: PaperStructure; paragraphs: ParagraphData[] } | null = null;
        
        try {
            const cached = await this.storage.loadCache<any>(cacheKey);
            if (cached) {
                parseResult = cached;
                // console.log("Loaded from cache!");
            }
        } catch (e) { /* ignore cache error */ }

        // 4. Parse (if no cache)
        if (!parseResult) {
            const { paragraphs, structure } = ReaderParser.parse(text, this.id);
            parseResult = { paragraphs, structure };
            
            // Save to cache asynchronously
            this.storage.saveCache(cacheKey, parseResult).catch(console.error);
        }

        // 5. Load Annotations
        const annotations = await this.annotationManager.load();

        this.state = {
            id: this.id,
            textHash,
            content: text,
            structure: parseResult.structure,
            paragraphs: parseResult.paragraphs,
            annotations,
            images: {}
        };
        
        // Reset dirty flags on fresh load
        this.dirty = { annotations: false, meta: false };

        return this.state;
    }

    /**
     * Updates annotations in memory and marks dirty.
     */
    setAnnotations(newAnnotations: Annotation[]) {
        if (!this.state) return;
        this.state.annotations = newAnnotations;
        this.dirty.annotations = true;
    }

    /**
     * Persists changes if dirty.
     * Should be called by auto-save timer or before close.
     */
    async save(): Promise<void> {
        if (!this.state) return;

        if (this.dirty.annotations) {
            await this.annotationManager.save(this.state.annotations);
            this.dirty.annotations = false;
        }
        
        // Future: Save metadata locally if needed
    }

    /**
     * Forces a fresh parse (ignoring cache)
     * Useful for debugging or if parser logic updates
     */
    async reloadForce(): Promise<DocumentState> {
        this.state = null;
        // Invalidate specific cache? 
        // For now, load() handles logic. If we want to bypass cache, we assume new session.
        return this.load();
    }
    
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return (hash >>> 0).toString(16);
    }
}
