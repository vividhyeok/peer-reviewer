import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { readFileSafe } from '../core/FileSystem';
import { ReaderParser } from '../core/ReaderParser';
import { Paragraph, MemoizedParagraph } from './Paragraph';
import { AnnotationManager } from '../core/AnnotationManager';
import { FloatingToolbar } from './FloatingToolbar';
import { InputModal } from './InputModal';
import { toPlainTextFromHtml } from '../core/TextRendering';
import { MultiAIClient } from '../core/MultiAIClient';
import { type Annotation, type SelectionState, type ParagraphData, type PaperStructure } from '../types/ReaderTypes';
import { type AppSettings, AI_MODELS } from '../types/settings';
import { LibraryManager, type LibraryItem } from '../core/LibraryManager';
import { Search, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { toast } from 'sonner';
import { SmartExportModal } from './SmartExportModal';
import { LocalStorageManager } from '../core/LocalStorageManager';
import { WelcomeScreen } from './WelcomeScreen';
import { useDocumentLoader } from '../hooks/useDocumentLoader';
// import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

// Utility Hashing
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// DOM Utils
function getParagraphElement(node: Node): HTMLElement | null {
  let curr: Node | null = node;
  while (curr && curr !== document.body) {
    if (curr instanceof HTMLElement && curr.id.startsWith('para-')) return curr;
    curr = curr.parentNode;
  }
  return null;
}

function computeOffsetInParagraph(p: HTMLElement, targetNode: Node, targetOffset: number): number {
  let offset = 0;
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode === targetNode) {
      return offset + targetOffset;
    }
    offset += walker.currentNode.textContent?.length || 0;
  }
  return offset;
}

interface ReaderProps {
  settings: AppSettings;
  activeFile: LibraryItem | null;
  onToggleLibrary: () => void;
  onDocumentLoaded?: (text: string) => void;
  onStructureLoaded?: (structure: PaperStructure) => void;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  onExplainImage?: (src: string, alt: string) => void;
  storageManager: LocalStorageManager;
}

import { FlashcardReview } from './FlashcardReview';

import { CS_RESEARCH_PROMPTS } from '../core/Prompts';

export const Reader: React.FC<ReaderProps> = ({ settings, activeFile, onToggleLibrary, onDocumentLoaded, onStructureLoaded, annotations, onAnnotationsChange: _onAnnotationsChange, onExplainImage, storageManager }) => {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const aiClientRef = useRef<MultiAIClient | null>(null);
  const annotationsRef = useRef<Annotation[]>(annotations);
  const autoHighlightRunRef = useRef<string | null>(null);
  const annotationManagerRef = useRef<AnnotationManager | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Hook Integration ---
  const { loading: isLoading, paragraphs, setParagraphs, sessionRef } = useDocumentLoader({
      activeFile,
      storageManager,
      onStructureLoaded,
      onDocumentLoaded,
      onAnnotationsChange: _onAnnotationsChange,
      annotationManagerRef
  });

  // Wrapper to update dirty state in session
  const onAnnotationsChange = useCallback((newAnnos: Annotation[]) => {
      _onAnnotationsChange(newAnnos);
      if (sessionRef.current) {
          sessionRef.current.setAnnotations(newAnnos);
      }
  }, [_onAnnotationsChange]);
  // ------------------------

  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [currentSelection, setCurrentSelection] = useState<SelectionState | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    description?: string;
    onConfirm: (value: string) => void;
  }>({ title: '', onConfirm: () => undefined });

  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docSearchIndex, setDocSearchIndex] = useState(0);

  // isLoading is now handled by the hook
  const [exportModalOpen, setExportModalOpen] = useState(false);
  
  // Bookmark State
  const [currentBookmarkId, setCurrentBookmarkId] = useState<string | undefined>(activeFile?.bookmarkParagraphId);

  useEffect(() => {
     setCurrentBookmarkId(activeFile?.bookmarkParagraphId);
  }, [activeFile]);

  const handleToggleBookmark = (id: string) => {
      const next = currentBookmarkId === id ? undefined : id;
      setCurrentBookmarkId(next);
      if (activeFile) {
          const library = LibraryManager.getLibrary();
          const updated = library.map(item => item.id === activeFile.id ? { ...item, bookmarkParagraphId: next } : item);
          localStorage.setItem('paper-reader-library', JSON.stringify(updated));
          if (next) toast.success("Bookmark set");
      }
  };

  const handleJumpToBookmark = () => {
      if (currentBookmarkId) {
          const el = document.getElementById(`para-${currentBookmarkId}`);
          if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-4', 'ring-red-500/50');
              setTimeout(() => el.classList.remove('ring-4', 'ring-red-500/50'), 2000);
          } else {
              toast.error("Bookmark location not found in loaded text");
          }
      }
  };

  const handleAddNote = (paragraphId: string, content: string) => {
      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        type: 'note',
        content,
        createdAt: Date.now(),
        target: {
            paragraphId,
            textHash: 'note',
            startOffset: 0,
            endOffset: 0,
            selectedText: ''
        }
      };
      onAnnotationsChange([...annotations, newAnnotation]);
      toast.success("Note added");
  };

  const processAnnotation = useCallback(async (type: Annotation['type'], content: string, color?: string, selectionOverride?: SelectionState) => {
    const selection = selectionOverride || currentSelection;
    if (!selection) return;

    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      type,
      content,
      color,
      createdAt: Date.now(),
      target: {
        paragraphId: selection.paragraphId,
        textHash: hashText(selection.text),
        startOffset: selection.range.start,
        endOffset: selection.range.end,
        selectedText: selection.text,
      }
    };

    onAnnotationsChange([...annotations, newAnnotation]);
    setToolbarVisible(false);
    window.getSelection()?.removeAllRanges();
  }, [currentSelection, annotations, onAnnotationsChange]);

  useEffect(() => {
    aiClientRef.current = new MultiAIClient(settings.apiKeys);
  }, [settings.apiKeys]);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  // Sync scroll progress update when file changes or loading finishes
  useEffect(() => {
     if (!activeFile || isLoading) return;
     
     // Set File Path for legacy compat if needed (though hook handles this internally)
     setFilePath(activeFile.filePath);

     if (activeFile.lastParagraphId) {
        setTimeout(() => {
          const el = document.getElementById(`para-${activeFile.lastParagraphId}`);
          if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 300);
     } else if (activeFile.progress && mainScrollRef.current) {
         setTimeout(() => {
             if (mainScrollRef.current) {
                const max = mainScrollRef.current.scrollHeight - mainScrollRef.current.clientHeight;
                mainScrollRef.current.scrollTop = ((activeFile.progress || 0) / 100) * max;
             }
         }, 300);
     }
  }, [activeFile?.id, isLoading]);

  // Listen for review mode command
  useEffect(() => {
      const handleOpenReview = () => setIsReviewOpen(true);
      window.addEventListener('open-flashcard-review', handleOpenReview);
      return () => window.removeEventListener('open-flashcard-review', handleOpenReview);
  }, []);

  const runAutoHighlight = async (text: string, currentParagraphs: ParagraphData[]) => {
    if (!aiClientRef.current) return;
    const modelId = settings.modelAssignments['summarize'] || 'deepseek-chat';
    const modelInfo = AI_MODELS.find(m => m.id === modelId);
    if (!modelInfo || !settings.apiKeys[modelInfo.provider]) return;

    try {
      const insights = await aiClientRef.current.autoHighlightAI(
        { provider: modelInfo.provider, modelId: modelInfo.id },
        text
      );

      const newAnnotations: Annotation[] = [];
      insights.forEach(insight => {
        const foundPara = currentParagraphs.find(p => p.enText.includes(insight.text));
        if (foundPara) {
          newAnnotations.push({
            id: crypto.randomUUID(),
            type: 'insight',
            content: insight.reason,
            color: insight.type === 'novelty' ? '#a855f7' : insight.type === 'method' ? '#3b82f6' : '#22c55e',
            createdAt: Date.now(),
            target: {
              paragraphId: foundPara.id,
              textHash: hashText(insight.text),
              startOffset: foundPara.enText.indexOf(insight.text),
              endOffset: foundPara.enText.indexOf(insight.text) + insight.text.length,
              selectedText: insight.text
            }
          });
        }
      });

      if (newAnnotations.length > 0) {
        onAnnotationsChange([...annotations, ...newAnnotations]);
        toast.success(`AI identified ${newAnnotations.length} core insights`, {
          description: "Look for purple, blue, and green highlights."
        });
      }
    } catch (e) {
      console.warn('Auto-highlight failed', e);
    }
  };

  useEffect(() => {
    // Dirty Flag Saving Strategy:
    // Periodically check session dirty state and save if needed.
    // Minimizes disk writes compared to blind saving.
    const interval = setInterval(() => {
        if (sessionRef.current) {
            sessionRef.current.save().catch(console.error);
        }
    }, settings.autoSaveInterval * 1000);
    return () => clearInterval(interval);
  }, [settings.autoSaveInterval]);

  const annotationsByParagraph = useMemo(() => {
    const map: Record<string, Annotation[]> = {};
    annotations.forEach(a => {
      if (!map[a.target.paragraphId]) map[a.target.paragraphId] = [];
      map[a.target.paragraphId].push(a);
    });
    return map;
  }, [annotations]);

  const docSearchMatches = useMemo(() => {
    if (!docSearchQuery || docSearchQuery.length < 2) return [];
    const query = docSearchQuery.toLowerCase();
    const matches: { paragraphId: string; index: number }[] = [];
    paragraphs.forEach((p) => {
      let text = (p.enText + p.koText).toLowerCase();
      let pos = text.indexOf(query);
      while (pos !== -1) {
        matches.push({ paragraphId: p.id, index: pos });
        pos = text.indexOf(query, pos + 1);
      }
    });
    return matches;
  }, [docSearchQuery, paragraphs]);

  const navigateSearchResults = (dir: 1 | -1) => {
    if (docSearchMatches.length === 0) return;
    const nextIndex = (docSearchIndex + dir + docSearchMatches.length) % docSearchMatches.length;
    setDocSearchIndex(nextIndex);
    const match = docSearchMatches[nextIndex];
    const el = document.getElementById(`para-${match.paragraphId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleScroll = useCallback(() => {
    if (!mainScrollRef.current || !activeFile) return;
    const { scrollTop, scrollHeight, clientHeight } = mainScrollRef.current;
    const max = scrollHeight - clientHeight;
    const progress = max > 0 ? (scrollTop / max) * 100 : 0;
    LibraryManager.updateProgress(activeFile.id, progress);
  }, [activeFile]);

  useEffect(() => {
    if (paragraphs.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible.length > 0) {
        const topParaId = visible[0].target.id.replace('para-', '');
        const para = paragraphs.find(p => p.id === topParaId);
        if (para && activeFile) {
          // Update Research Agent Context
          window.dispatchEvent(new CustomEvent('research-agent-context-change', {
            detail: {
              paragraphId: para.id,
              element: para.element,
              text: para.enText.slice(0, 200)
            }
          }));

          // Update Library Progress
          const { scrollTop, scrollHeight, clientHeight } = mainScrollRef.current!;
          const max = scrollHeight - clientHeight;
          const progress = max > 0 ? (scrollTop / max) * 100 : 0;
          LibraryManager.updateLastPosition(activeFile.id, para.id, progress);
        }
      }
    }, { threshold: 0.5 });

    paragraphs.forEach(p => {
      const el = document.getElementById(`para-${p.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [paragraphs]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setToolbarVisible(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const pEl = getParagraphElement(selection.anchorNode!);
    if (!pEl) return;

    const paragraphId = pEl.id.replace('para-', '');
    const text = selection.toString().trim();
    const offset = computeOffsetInParagraph(pEl, selection.anchorNode!, selection.anchorOffset);

    setCurrentSelection({
      paragraphId,
      text,
      range: { start: offset, end: offset + text.length }
    });

    setToolbarPos({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY });
    setToolbarVisible(true);
  }, []);

  const handleAIAlign = useCallback(async (paragraphId: string) => {
    if (!aiClientRef.current) return;
    const para = paragraphs.find(p => p.id === paragraphId);
    if (!para) return;

    const modelId = settings.modelAssignments['summarize'] || 'deepseek-chat';
    const modelInfo = AI_MODELS.find(m => m.id === modelId);
    if (!modelInfo || !settings.apiKeys[modelInfo.provider]) {
      toast.error("Configure API key in settings for alignment");
      return;
    }

    try {
      const aligned = await aiClientRef.current.alignSentencesAI(
        { provider: modelInfo.provider, modelId: modelInfo.id },
        para.enText,
        para.koText
      );

      setParagraphs(prev => prev.map(p =>
        p.id === paragraphId ? { ...p, sentences: aligned } : p
      ));
      toast.success("Alignment refined by AI");
    } catch (e) {
      console.error(e);
      toast.error("AI Alignment failed");
    }
  }, [paragraphs, settings.apiKeys, settings.modelAssignments]);

  const handleAIRepair = useCallback(async (paragraphId: string) => {
    if (!aiClientRef.current) return;
    const para = paragraphs.find(p => p.id === paragraphId);
    if (!para) return;

    const modelId = settings.modelAssignments['summarize'] || 'deepseek-chat';
    const modelInfo = AI_MODELS.find(m => m.id === modelId);
    if (!modelInfo || !settings.apiKeys[modelInfo.provider]) {
      toast.error("Configure API key in settings for repair");
      return;
    }

    try {
      const repaired = await aiClientRef.current.repairParagraph(
        { provider: modelInfo.provider, modelId: modelInfo.id },
        para.enText,
        para.koText
      );

      setParagraphs(prev => prev.map(p =>
        p.id === paragraphId ? { ...p, enText: repaired.en, koText: repaired.ko, sentences: [] } : p
      ));
      toast.success("Paragraph repaired by AI");
    } catch (e) {
      console.error(e);
      toast.error("AI Repair failed");
    }
  }, [paragraphs, settings.apiKeys, settings.modelAssignments]);

  // Listen for Top Bar Ribbon actions
  useEffect(() => {
    const handleToolbarAction = (e: any) => {
      const { action } = e.detail || {};
      if (!action) return;

      // Map toolbar actions to Reader internal functions
      switch (action) {
        case 'ai-explain':
          handleAIAction('explain');
          break;
        case 'ai-summarize':
          handleAIAction('summarize');
          break;
        case 'ai-simplify':
          handleAIAction('simplify');
          break;
        case 'ai-critique':
          handleAIAction('critique');
          break;
        case 'highlight':
          processAnnotation('highlight', '');
          break;
        case 'question':
          handleAIAction('question');
          break;
        case 'document-search':
          searchInputRef.current?.focus();
          break;
        case 'export':
          setExportModalOpen(true);
          break;
      }
    };

    // @ts-ignore
    window.addEventListener('toolbar-action', handleToolbarAction);
    // @ts-ignore
    return () => window.removeEventListener('toolbar-action', handleToolbarAction);
  }, [settings, currentSelection, paragraphs, annotations]);

  const handleDefine = async () => {
    if (!currentSelection || !aiClientRef.current) return;
    const text = currentSelection.text;
    const selection = currentSelection; // Capture selection

    const provider = settings.apiKeys.deepseek ? 'deepseek' : (settings.apiKeys.gemini ? 'gemini' : 'openai');
    const model = provider === 'deepseek' ? 'deepseek-chat' : (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');

    if (!settings.apiKeys[provider]) {
        toast.error("AI API Key not configured.");
        return;
    }

    const promise = (async () => {
         const response = await aiClientRef.current!.sendMessage(
             provider, 
             model, 
             [{ role: 'user', content: `Define the term "${text}" in the context of CS/AI research. Provide a crisp definition and 2 bullet points. Answer in Korean. Format: Definition\n- Point 1\n- Point 2` }]
         );
         processAnnotation('definition', response.content, undefined, selection);
    })();

    toast.promise(promise, {
         loading: 'Generating definition...',
         success: 'Definition added',
         error: 'Failed to generate definition'
    });
  };

  const handleQuestionPrompt = () => {
    if (!currentSelection) return;
    const selection = currentSelection; // Capture selection

    setModalConfig({
        title: 'Ask about this text',
        description: `Selected: "${selection.text.slice(0, 30)}..."`,
        onConfirm: async (question) => {
             if (!aiClientRef.current) return;
             const provider = settings.apiKeys.deepseek ? 'deepseek' : (settings.apiKeys.gemini ? 'gemini' : 'openai');
             const model = provider === 'deepseek' ? 'deepseek-chat' : (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
            
             if (!settings.apiKeys[provider]) {
                toast.error("Please configure an AI API key first.");
                return;
            }

            const promise = (async () => {
                 const response = await aiClientRef.current!.sendMessage(
                     provider, 
                     model, 
                     [{ role: 'user', content: CS_RESEARCH_PROMPTS.question(selection.text, question) }]
                 );
                 const content = `Q) ${question}\n\nA) ${response.content}`;
                 processAnnotation('question', content, undefined, selection); 
             })();
             
              toast.promise(promise, {
                 loading: 'Asking AI...',
                 success: 'Answer received',
                 error: 'Failed to get answer'
            });
        }
    });
    setModalOpen(true);
  };

  const handleAIAction = async (type: string) => {
    if (!currentSelection && type !== 'summarize' && type !== 'critique') {
      toast.error("Please select some text first");
      return;
    }

    const textToProcess = currentSelection?.text || paragraphs.map(p => p.enText).join('\n').slice(0, 15000); // Increased limit for Gemini context
    
    // Open Research Agent with a specific prompt
    let prompt = "";
    switch(type) {
      case 'explain': 
        prompt = CS_RESEARCH_PROMPTS.explain(textToProcess); 
        break;
      case 'summarize': 
        prompt = CS_RESEARCH_PROMPTS.summarize(textToProcess); 
        break;
      case 'simplify': 
        prompt = CS_RESEARCH_PROMPTS.simplify(textToProcess); 
        break;
      case 'critique': 
        prompt = CS_RESEARCH_PROMPTS.critique(textToProcess); 
        break;
      case 'question': 
        prompt = `I have a question about this part: "${textToProcess}"\n\n My question is: `; 
        break;
      case 'discuss': 
        window.dispatchEvent(new CustomEvent('research-agent-open', {
          detail: { prompt: `Let's discuss this part: "${textToProcess}"`, autoSend: false }
        }));
        return;
    }

    window.dispatchEvent(new CustomEvent('research-agent-open', {
      detail: { 
        prompt,
        autoSend: type !== 'question'
      }
    }));
  };

  if (!activeFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 animate-in fade-in duration-700 bg-white dark:bg-zinc-950">
        <div className="text-center p-10 flex flex-col items-center">
          <div className="relative mb-8 w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-pulse" />
            <Search size={48} strokeWidth={1} className="text-blue-500 relative z-10" />
          </div>
          <h3 className="text-3xl font-serif text-zinc-900 dark:text-white mb-4 tracking-tight">Ready to Read</h3>
          <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed mb-8">
            Select a document from your library to enter the immersive reading space.
          </p>
          <button
            onClick={() => { onToggleLibrary(); }}
            className="px-12 py-5 bg-blue-600 text-white rounded-2xl font-bold shadow-2xl shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all text-xl cursor-pointer pointer-events-auto"
          >
            Open Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col">

      <div className="absolute top-6 right-6 z-40 flex items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-1 p-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-full shadow-xl pointer-events-auto transition-all hover:bg-gray-50 dark:hover:bg-zinc-900">
          <div className="flex items-center px-2 border-r border-zinc-200 dark:border-zinc-800">
            <button onClick={() => setZoomLevel(z => Math.max(50, z - 10))} className="p-1.5 hover:text-zinc-900 dark:hover:text-white text-zinc-500 dark:text-zinc-400 rounded-full"><ChevronDown size={14} /></button>
            <span className="text-[10px] font-mono w-8 text-center text-zinc-500 dark:text-zinc-400">{zoomLevel}%</span>
            <button onClick={() => setZoomLevel(z => Math.min(200, z + 10))} className="p-1.5 hover:text-zinc-900 dark:hover:text-white text-zinc-500 dark:text-zinc-400 rounded-full"><ChevronUp size={14} /></button>
          </div>

          <div className="flex items-center px-2 border-r border-zinc-200 dark:border-zinc-800 relative group">
            <Search size={14} className="text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
            <input
              ref={searchInputRef}
              className="w-0 group-hover:w-32 focus:w-32 transition-all duration-300 bg-transparent border-none text-xs text-zinc-900 dark:text-white focus:outline-none ml-2 placeholder-zinc-400 dark:placeholder-zinc-600"
              placeholder="Find..."
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
            />
            {docSearchMatches.length > 0 && (
              <button onClick={() => navigateSearchResults(1)} className="ml-1 hover:text-zinc-900 dark:hover:text-white text-zinc-500 dark:text-zinc-400"><ChevronDown size={12} /></button>
            )}
          </div>

          <button
            onClick={() => setExportModalOpen(true)}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all mr-1"
            title="Smart Export (Synthesis)"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      <div
        ref={mainScrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar relative px-8 py-12"
        onMouseUp={handleMouseUp}
        onScroll={handleScroll}
      >
        <div className="w-full min-h-screen pb-40" style={{ zoom: `${zoomLevel}%` }}>
          <div className="w-full max-w-3xl mx-auto">
            <div className="prose-reader">
              {paragraphs.map((para) => {
                const Tag = (para.element || 'div') as React.ElementType;
                // Fix for nesting error: avoid <li> nesting if Paragraph is just a container.
                // However, Reader uses `SafeTag` as the container. If tag is 'li' or 'p', we might have issues if Paragraph uses block elements.
                // Safest bet for clean DOM: always use 'div' for wrapper, rely on internal semantic markup. 
                // But we want to preserve header styling etc. 
                // If tag is 'li', simply changing to 'div' is safe visually if CSS handles it. The issue usually is <ul><SafeTag>... where SafeTag is div appearing as li.
                // But the log says `<li> matches <li id="para">`. 
                // Let's force div for wrapper.
                const SafeTag = 'div'; 
                
                return (
                  <SafeTag
                    key={para.id}
                    id={`para-${para.id}`}
                    className="group relative transition-all duration-500"
                  >
                    <MemoizedParagraph
                      data={para}
                      isKoreanPrimary={settings.isKoreanPrimary}
                      onAIAlign={handleAIAlign}
                      onRepair={handleAIRepair}
                      annotations={annotationsByParagraph[para.id] || []}
                      isSearchMatch={docSearchMatches.some(m => m.paragraphId === para.id)}
                      highlightTerm={docSearchQuery}
                      onDeleteAnnotation={(id) => {
                        onAnnotationsChange(annotations.filter((a) => a.id !== id));
                      }}
                      onExplainImage={onExplainImage}
                      isBookmarked={currentBookmarkId === para.id}
                      onToggleBookmark={handleToggleBookmark}
                      onAddNote={handleAddNote}
                    />
                  </SafeTag>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <FloatingToolbar
        x={toolbarPos.x}
        y={toolbarPos.y}
        visible={toolbarVisible}
        highlightColors={settings.highlightColors}
        onHighlight={(color) => processAnnotation('highlight', '', color)}
        onDefine={handleDefine}
        onQuestion={handleQuestionPrompt}
        onChat={() => handleAIAction('discuss')}
        onExplain={() => handleAIAction('explain')}
        onSummarize={() => handleAIAction('summarize')}
        onClose={() => setToolbarVisible(false)}
      />

      {modalOpen && (
        <InputModal
          isOpen={modalOpen}
          title={modalConfig.title}
          description={modalConfig.description}
          onConfirm={(val) => {
            setModalOpen(false);
            modalConfig.onConfirm(val);
          }}
          onCancel={() => setModalOpen(false)}
        />
      )}

      {exportModalOpen && activeFile && (
        <SmartExportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          paragraphs={paragraphs}
          annotations={annotations}
          settings={settings}
          title={activeFile.title}
        />
      )}

      <FlashcardReview
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          annotations={annotations}
      />
    </div>
  );
};
