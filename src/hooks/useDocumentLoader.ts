import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { LibraryManager, type LibraryItem } from '../core/LibraryManager';
import { LocalStorageManager } from '../core/LocalStorageManager';
import { DocumentSessionManager, DocumentSession } from '../core/DocumentSessionManager';
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
  
  const sessionRef = useRef<DocumentSession | null>(null);

  useEffect(() => {
    if (!activeFile) {
        if (sessionRef.current) {
            // Auto-save on closing
            sessionRef.current.save().catch(console.error);
            sessionRef.current = null;
        }
        setParagraphs([]);
        return;
    }

    const load = async () => {
      // 0. Auto-save previous session if switching files
      if (sessionRef.current && sessionRef.current.id !== activeFile.filePath) {
          console.log("Saving previous session", sessionRef.current.id);
          await sessionRef.current.save();
          sessionRef.current = null;
      }
      
      // If already loaded for this file, skip
      if (sessionRef.current && sessionRef.current.id === activeFile.filePath && paragraphs.length > 0) {
          return; 
      }

      setLoading(true);
      setError(null);
      
      try {
        if (!storageManager) {
             // If storage not ready, we can't load session. 
             // We'll return and wait for next render when storageManager is present
             return;
        }

        // 1. Get Session
        const session = DocumentSessionManager.getSession(activeFile.filePath, storageManager);
        sessionRef.current = session;
        
        // Link AnnotationManager for Reader interactions
        annotationManagerRef.current = session.annotationManager;

        // 2. Load Session State
        const state = await session.load();

        // 3. Hydrate Images (Legacy Logic adapted)
        let finalParagraphs = state.paragraphs;
        if (storageManager.isConnected) {
            finalParagraphs = await Promise.all(state.paragraphs.map(async (p) => {
                if (p.type === 'image' && p.metadata?.src && 
                    !p.metadata.src.startsWith('http') && 
                    !p.metadata.src.startsWith('data:')) {
                    try {
                        const decodedSrc = decodeURIComponent(p.metadata.src);
                        const blobUrl = await storageManager.loadFileAsUrl(decodedSrc);
                        if (blobUrl) {
                            return { ...p, metadata: { ...p.metadata, src: blobUrl } };
                        }
                    } catch (e) {
                         // silently fail image hydration
                    }
                }
                return p;
            })); 
        }

        setParagraphs(finalParagraphs);

        // 4. Update Global/Parent State
        LibraryManager.touchItem(activeFile.id);
        
        if (onStructureLoaded) {
            onStructureLoaded(state.structure);
        }
        
        if (onDocumentLoaded) {
            onDocumentLoaded(state.content);
            window.dispatchEvent(new CustomEvent('document-loaded', { detail: { text: state.content } }));
        }
        
        // Sync Annotations
        onAnnotationsChange(state.annotations);

        // 5. Scroll Restore
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

  }, [activeFile, storageManager]);

  return { loading, paragraphs, setParagraphs, error, sessionRef };
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
