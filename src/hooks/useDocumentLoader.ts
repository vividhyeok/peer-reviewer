import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { LibraryManager, type LibraryItem } from '../core/LibraryManager';
import { LocalStorageManager } from '../core/LocalStorageManager';
import { DocumentSessionManager, DocumentSession } from '../core/DocumentSessionManager';
import type { ParagraphData, PaperStructure, Annotation } from '../types/ReaderTypes';
import { AnnotationManager } from '../core/AnnotationManager';

import { toPlainTextFromHtml } from '../core/TextRendering';

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
  const hydratedBlobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      if (hydratedBlobUrlsRef.current.length > 0) {
        hydratedBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        hydratedBlobUrlsRef.current = [];
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!activeFile) {
        if (sessionRef.current) {
            // Auto-save on closing
            sessionRef.current.save().catch(console.error);
            sessionRef.current = null;
        }

        if (hydratedBlobUrlsRef.current.length > 0) {
            hydratedBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            hydratedBlobUrlsRef.current = [];
        }

        annotationManagerRef.current = null;
        setParagraphs([]);
        setError(null);
        setLoading(false);
        return;
    }

    const load = async () => {
      // 0. Auto-save previous session if switching files
      if (sessionRef.current && sessionRef.current.id !== activeFile.filePath) {
          console.log("Saving previous session", sessionRef.current.id);
          await sessionRef.current.save().catch(console.error);
          sessionRef.current = null;
      }
      
      // If already loaded for this file, skip
      if (sessionRef.current && sessionRef.current.id === activeFile.filePath && paragraphs.length > 0) {
          return; 
      }

      setParagraphs([]); // prevent stale document flash while switching files
      setLoading(true);
      setError(null);
      
      try {
        await storageManager?.checkEnvironment();

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
        if (cancelled) return;

        // 3. Hydrate Images (Legacy Logic adapted)
        let finalParagraphs = state.paragraphs;
        const nextBlobUrls: string[] = [];
        if (storageManager.isConnected) {
            finalParagraphs = await Promise.all(state.paragraphs.map(async (p) => {
                if (p.type === 'image' && p.metadata?.src && 
                    !p.metadata.src.startsWith('http') && 
                    !p.metadata.src.startsWith('data:') &&
                    !p.metadata.src.startsWith('blob:')) {
                    try {
                        const decodedSrc = decodeURIComponent(p.metadata.src);
                        const blobUrl = await storageManager.loadFileAsUrl(decodedSrc);
                        if (blobUrl) {
                            nextBlobUrls.push(blobUrl);
                            return { ...p, metadata: { ...p.metadata, src: blobUrl } };
                        }
                    } catch (e) {
                         // silently fail image hydration
                    }
                }
                return p;
            })); 
        }

        if (cancelled) {
            nextBlobUrls.forEach((url) => URL.revokeObjectURL(url));
            return;
        }

        if (hydratedBlobUrlsRef.current.length > 0) {
            hydratedBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        }
        hydratedBlobUrlsRef.current = nextBlobUrls;

        setParagraphs(finalParagraphs);

        // 4. Update Global/Parent State
        LibraryManager.touchItem(activeFile.id);
        
        if (onStructureLoaded) {
            onStructureLoaded(state.structure);
        }
        
        if (onDocumentLoaded) {
            // Generate Clean Full Text for Agent
            // State content is Raw HTML. Agent needs Plain Text.
            // We reconstruct it from paragraphs to respect the parsing logic (excluding scripts/styles/garbage)
            const cleanFullText = finalParagraphs
                .map(p => {
                    const idMarker = `[[ID:${p.id}]]`;
                    if (p.type === 'heading') return `${idMarker} # ${toPlainTextFromHtml(p.enText)}`;
                    if (p.type === 'code') return `${idMarker} \`\`\`\n${toPlainTextFromHtml(p.enText)}\n\`\`\``;
                    // Prefer English text for global context if available (assuming scientific papers)
                    // But if it's empty, use Korean
                    const text = toPlainTextFromHtml(p.enText) || toPlainTextFromHtml(p.koText);
                    return `${idMarker} ${text}`;
                })
                .filter(t => t.length > 0)
                .join('\n\n');

            onDocumentLoaded(cleanFullText);
            window.dispatchEvent(new CustomEvent('document-loaded', { detail: { text: cleanFullText } }));
        }
        
        // Sync Annotations
        onAnnotationsChange(state.annotations);

        // 5. Scroll Restore
        handleScrollRestoration(activeFile);

      } catch (e: any) {
        console.error("Document load failed", e);
        const message = e?.message || "Failed to load document";
        if (!cancelled) {
            setError(message);
            toast.error("문서 로드 실패", { description: message });
        }
      } finally {
        if (!cancelled) {
            setLoading(false);
        }
      }
    };

    load().catch((error) => {
        if (cancelled) return;
        console.error("Unexpected document load error", error);
        setError("Unexpected document load error");
        setLoading(false);
    });

    return () => {
        cancelled = true;
    };

  }, [activeFile, storageManager]);

  // Save Confirmation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionRef.current && sessionRef.current.isDirty()) {
        e.preventDefault();
        e.returnValue = ''; // Modern browsers require setting returnValue
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Auto-save interval
  useEffect(() => {
    if (!activeFile) return;

    const interval = setInterval(() => {
      if (sessionRef.current && sessionRef.current.isDirty()) {
        console.log("[AutoSave] Saving session...");
        sessionRef.current.save().catch(console.error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [activeFile]);

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
