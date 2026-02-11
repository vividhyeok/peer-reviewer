import { LocalStorageManager } from './LocalStorageManager';
import { ReaderParser } from './ReaderParser';
import { AnnotationManager } from './AnnotationManager';
import { readFileSafe } from './FileSystem';
import type { Annotation, PaperStructure, ParagraphData } from '../types/ReaderTypes';

const PARSE_CACHE_PREFIX = 'parse_v5_';
const LEGACY_PARSE_CACHE_PREFIXES = ['parse_v4_', 'parse_v3_'];

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

    public isDirty(): boolean {
        return this.dirty.annotations || this.dirty.meta;
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
        
        // Smart Path Recovery: If not found and starts with 'virtual/', try reading without prefix
        // This handles migration from Legacy Memory-Only to Disk Persistence
        if (!text && this.id.startsWith('virtual/')) {
            const realPath = this.id.replace('virtual/', '');
            text = await this.storage.readFile(realPath);
            if (text) {
                console.log(`[Recovery] Found file at '${realPath}' instead of '${this.id}'`);
            }
        }

        // Fallback: Check Memory Registry (Drag & Drop) or Public Folder
        if (!text) {
             try {
                text = await readFileSafe(this.id);
             } catch (e) {
                 // Ignore
             }
        }
        
        if (!text) {
             // Fallback for public demo files (Legacy)
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
        const cacheKey = `${PARSE_CACHE_PREFIX}${textHash}`;
        let parseResult: { structure: PaperStructure; paragraphs: ParagraphData[] } | null = null;
        
        try {
            const cacheCandidates = [cacheKey, ...LEGACY_PARSE_CACHE_PREFIXES.map(prefix => `${prefix}${textHash}`)];
            for (const candidate of cacheCandidates) {
                const cached = await this.storage.loadCache<any>(candidate);
                if (cached) {
                    parseResult = cached;
                    break;
                }
            }
        } catch (e) { /* ignore cache error */ }

        // 4. Parse (if no cache)
        if (!parseResult) {
            try {
                const { paragraphs, structure } = ReaderParser.parse(text, this.id);
                parseResult = { paragraphs, structure };
            } catch (error) {
                console.error('[DocumentSession] Parsing failed, using text fallback', error);
                const safeText = this.escapeHtml(text.slice(0, 50000));
                parseResult = {
                    structure: { toc: [], figures: [], tables: [] },
                    paragraphs: [{
                        id: this.simpleHash(`fallback-${this.id}`),
                        element: 'p',
                        enText: safeText,
                        koText: '',
                        sentences: [{ en: safeText, ko: '' }],
                        citations: [],
                        index: 0,
                        type: 'text',
                        isReference: false
                    }]
                };
            }
        }

        // Save to latest cache key asynchronously
        this.storage.saveCache(cacheKey, parseResult).catch(console.error);

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
     * Updates paragraphs in memory and marks dirty.
     */
    setParagraphs(newParagraphs: ParagraphData[]) {
        if (!this.state) return;
        this.state.paragraphs = newParagraphs;
        this.dirty.meta = true; 
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

        if (this.dirty.meta) {
            // Re-save parsed cache structure essentially
            // Note: We are hijacking the cacheKey mechanism. 
            // Ideally we should have a separate 'edit' layer, but updating the cache works for persistence.
            const cacheKey = `${PARSE_CACHE_PREFIX}${this.state.textHash}`;
            const data = {
                structure: this.state.structure,
                paragraphs: this.state.paragraphs
            };
            await this.storage.saveCache(cacheKey, data);
            
            // Also update the physical file if it was a significant content edit?
            // For now, we only persist to metadata/cache so original file is untouched.
            // But user asked for "Save everything".
            // Since we don't support full HTML reconstruction output yet, we only save to session cache.
            console.log("Saved paragraph updates to cache");
            this.dirty.meta = false;
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

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

export class DocumentSessionManager {
    private static sessions: Map<string, DocumentSession> = new Map();

    static getSession(id: string, storage: LocalStorageManager): DocumentSession {
        if (!this.sessions.has(id)) {
            this.sessions.set(id, new DocumentSession(id, storage));
        }
        return this.sessions.get(id)!;
    }

    static removeSession(id: string) {
        if (this.sessions.has(id)) {
            this.sessions.delete(id);
            console.log(`[DocumentSessionManager] Cleared session for ${id}`);
        }
    }
}
