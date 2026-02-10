import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { readFileSafe } from '../core/FileSystem';
import { ReaderParser } from '../core/ReaderParser';
import { LibraryManager, type LibraryItem } from '../core/LibraryManager';
import { toPlainTextFromHtml } from '../core/TextRendering';
import { LocalStorageManager } from '../core/LocalStorageManager';
import type { ParagraphData, PaperStructure, Annotation } from '../types/ReaderTypes';
import { AnnotationManager } from '../core/AnnotationManager';

interface UseDocumentLoaderProps {
  activeFile: LibraryItem | null;
  storageManager: LocalStorageManager | null;
  onStructureLoaded?: (structure: PaperStructure) => void;
  onDocumentLoaded?: (text: string) => void;
  onAnnotationsChange: (annotations: Annotation[]) => void;
  annotationManagerRef: React.MutableRefObject<AnnotationManager | null>;
}

export function useDocumentLoader({
  activeFile,
  storageManager,
  onStructureLoaded,
  onDocumentLoaded,
  onAnnotationsChange,
  annotationManagerRef
}: UseDocumentLoaderProps) {
  const [loading, setLoading] = useState(false);
  const [paragraphs, setParagraphs] = useState<ParagraphData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFile) {
      setParagraphs([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Update Last Opened
        LibraryManager.touchItem(activeFile.id);

        // 2. Read File Content
        let text: string | null = null;
        
        // Try File System First (Priority: Disk > Cache)
        if (storageManager) {
          const basename = activeFile.filePath.split(/[\\/]/).pop() || activeFile.filePath;
          text = await storageManager.readFile(basename);
        }

        // Fallback to safe reader (cache/public)
        if (!text) {
          text = await readFileSafe(activeFile.filePath);
        }

        // 3. Parse HTML
        const { paragraphs: parsedParagraphs, structure } = ReaderParser.parse(text, activeFile.filePath);

        // 4. Hydrate Images (Local File System)
        let finalParagraphs = parsedParagraphs;
        if (storageManager && storageManager.isConnected) {
          finalParagraphs = await Promise.all(parsedParagraphs.map(async (p) => {
            if (p.type === 'image' && p.metadata?.src && 
                !p.metadata.src.startsWith('http') && 
                !p.metadata.src.startsWith('data:')) {
               
               try {
                 const decodedSrc = decodeURIComponent(p.metadata.src);
                 const blobUrl = await storageManager.loadFileAsUrl(decodedSrc);
                 if (blobUrl) {
                   return { ...p, metadata: { ...p.metadata, src: blobUrl } };
                 }
               } catch (err) {
                 console.warn("Image hydration failed for", p.metadata.src);
               }
            }
            return p;
          }));
        }
        
        setParagraphs(finalParagraphs);

        // 5. Callback: Structure
        if (onStructureLoaded) {
          onStructureLoaded(structure);
        }

        // 6. Callback: Full Text
        const fullText = finalParagraphs.map(p => toPlainTextFromHtml(p.enText)).join('\n\n');
        if (onDocumentLoaded) {
          onDocumentLoaded(fullText);
          window.dispatchEvent(new CustomEvent('document-loaded', { detail: { text: fullText } }));
        }

        // 7. Load Annotations
        const manager = new AnnotationManager(activeFile.filePath, storageManager || undefined);
        annotationManagerRef.current = manager;
        const loadedAnnotations = await manager.load();
        
        // Filter out insights if needed (or keep them based on preference)
        const cleanLoaded = loadedAnnotations.filter(a => a.type !== 'insight');
        onAnnotationsChange(cleanLoaded);

        // 8. Restore Scroll Position
        handleScrollRestoration(activeFile);

      } catch (e: any) {
        console.error("Document load failed", e);
        setError(e.message || "Failed to load document");
        toast.error("Failed to load document");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeFile]); // Depend on activeFile

  return { loading, paragraphs, setParagraphs, error };
}

function handleScrollRestoration(activeFile: LibraryItem) {
    // Slight delay to ensure DOM is rendered
    setTimeout(() => {
        if (activeFile.lastParagraphId) {
            const el = document.getElementById(`para-${activeFile.lastParagraphId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'auto', block: 'start' });
                return;
            }
        }
        
        // Fallback to progress %
        // Note: Needs access to scroll ref, which is tricky in a pure hook without ref passing.
        // We will dispatch a custom event or let the component handle the ref-based scroll if needed,
        // but id-based restoration works fine here for most cases.
    }, 200);
}
