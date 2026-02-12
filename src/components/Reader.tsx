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
import { Search, ChevronDown, ChevronUp, Download, BookOpen, Library as LibraryManagerIcon } from 'lucide-react';
import { toast } from 'sonner';
import { SmartExportModal } from './SmartExportModal';
import { LocalStorageManager } from '../core/LocalStorageManager';
import { WelcomeScreen } from './WelcomeScreen';
import { AnnotationsPanel } from './AnnotationsPanel';
import { NotebookPanel } from './NotebookPanel';
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
  const { loading: isLoading, paragraphs, setParagraphs, error: loadError, sessionRef } = useDocumentLoader({
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
          sessionRef.current.save().catch(e => console.error("Auto-save failed", e));
      }
  }, [_onAnnotationsChange]);

  // Sync annotations from parent (e.g., sidebar delete) to session
  useEffect(() => {
      annotationsRef.current = annotations;
      if (sessionRef.current) {
          sessionRef.current.setAnnotations(annotations);
      }
  }, [annotations]);
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
          if (next) toast.success("북마크가 설정되었습니다");
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
              toast.error("북마크된 위치를 찾을 수 없습니다");
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
      toast.success("노트가 추가되었습니다");
  };

  // Improved floating toolbar trigger logic
  // Removed redundant useEffect to avoid double binding and conflict with handleMouseUp prop
/*
  useEffect(() => {
    const handleMouseUp = () => {
       // ... existing code ...
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [paragraphs]);
*/

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

  const handleSmartAsk = useCallback(() => {
    if (!currentSelection) return;
    
    // Find the enclosing sentence and retrieve Eng/Kor pair
    const para = paragraphs.find(p => p.id === currentSelection.paragraphId);
    if (para && para.sentences) {
        const selectionText = currentSelection.text.trim();
        const matchedSentence = para.sentences.find(s => 
            (s.en && s.en.includes(selectionText)) || 
            (s.ko && s.ko.includes(selectionText))
        );

        if (matchedSentence) {
            const query = `
[Quick Ask]
선택한 텍스트: "${selectionText}"
해당 문장: "${matchedSentence.en || matchedSentence.ko}"

위 텍스트에 대해 간결하게 설명해 주세요.
- 논문 맥락에서의 의미가 있으면 논문 기준으로 설명
- 일반적인 개념/용어 질문이면 배경지식을 활용하여 자유롭게 설명
- 한국어로 1~3문장 이내로 답변
`;
            
            const event = new CustomEvent('research-agent-query', { 
                detail: { 
                    prompt: query,
                    autoSend: true
                } 
            });
            window.dispatchEvent(event);
            setToolbarVisible(false);
            window.getSelection()?.removeAllRanges();
            return;
        }
    }

    // Fallback if no sentence matched
    const event = new CustomEvent('research-agent-query', { 
        detail: { 
            prompt: `"${currentSelection.text}"이(가) 무엇인지 간결하게 설명해 주세요. 논문 내용이면 논문 기준, 일반 개념이면 배경지식을 활용하세요. 한국어로 답변.`,
            autoSend: true
        } 
    });
    window.dispatchEvent(event);
    setToolbarVisible(false);
    window.getSelection()?.removeAllRanges();
  }, [currentSelection, paragraphs]);

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
    // 150ms debounce to prevent accidental triggers (e.g. while scrolling or clicking)
    setTimeout(() => {
        const selection = window.getSelection();
        
        // Strict validation: Must be non-empty and at least 1 char long to show toolbar
        if (!selection || selection.isCollapsed || selection.toString().trim().length < 1) {
          setToolbarVisible(false);
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Ensure valid visual selection
        if (rect.width === 0 || rect.height === 0) {
            setToolbarVisible(false);
            return;
        }

        // Use focusNode (end of selection) to determine paragraph, not anchorNode (start)
        // This prevents cross-paragraph selection from selecting the wrong paragraph
        const anchorPEl = getParagraphElement(selection.anchorNode!);
        const focusPEl = getParagraphElement(selection.focusNode!);
        
        // If selection spans multiple paragraphs, use the anchor paragraph but clamp text
        const pEl = anchorPEl;
        if (!pEl) return;

        const paragraphId = pEl.id.replace('para-', '');
        let text = selection.toString().trim();
        
        // If cross-paragraph selection, limit to text within the anchor paragraph only
        if (anchorPEl && focusPEl && anchorPEl !== focusPEl) {
            // Create a range clamped to the anchor paragraph
            const clampedRange = document.createRange();
            clampedRange.setStart(selection.anchorNode!, selection.anchorOffset);
            // Find the end of the anchor paragraph
            clampedRange.setEnd(anchorPEl, anchorPEl.childNodes.length);
            text = clampedRange.toString().trim();
            // If text is too small, try the focus paragraph instead
            if (text.length < 2 && focusPEl) {
                const focusRange = document.createRange();
                focusRange.setStart(focusPEl, 0);
                focusRange.setEnd(selection.focusNode!, selection.focusOffset);
                text = focusRange.toString().trim();
            }
        }
        
        if (text.length < 1) {
            setToolbarVisible(false);
            return;
        }
        
        const offset = computeOffsetInParagraph(pEl, selection.anchorNode!, selection.anchorOffset);

        setCurrentSelection({
          paragraphId,
          text,
          range: { start: offset, end: offset + text.length }
        });

        // Position toolbar above the selection using fixed coordinates (no scrollY needed for fixed positioning)
        setToolbarPos({ x: rect.left + rect.width / 2, y: rect.top });
        setToolbarVisible(true);
    }, 150);
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

      setParagraphs(prev => {
        const next = prev.map(p =>
            p.id === paragraphId ? { ...p, sentences: aligned } : p
        );
        // Important: Update session manager to ensure persistence
        if (sessionRef.current) sessionRef.current.setParagraphs(next);
        return next;
      });
      toast.success("Alignment refined by AI");
    } catch (e) {
      console.error(e);
      toast.error("AI Alignment failed");
    }
  }, [paragraphs, settings.apiKeys, settings.modelAssignments]);

  const handleAIRepair = useCallback(async (paragraphId: string, instruction?: string) => {
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
        para.koText,
        instruction
      );

      setParagraphs(prev => {
        const next = prev.map(p =>
            p.id === paragraphId ? { ...p, enText: repaired.en, koText: repaired.ko, sentences: [] } : p
        );
        // Important: Update session manager to ensure persistence
        if (sessionRef.current) {
          sessionRef.current.setParagraphs(next);
          sessionRef.current.save().catch((err) => console.error("Auto-save failed:", err));
        }
        return next;
      });
      toast.success("Paragraph repaired by AI");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "AI Repair failed");
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
        toast.error("AI API 키 설정을 먼저 해주세요.");
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
         loading: '단어 정의 생성 중...',
         success: '정의가 추가되었습니다',
         error: '생성 실패'
    });
  };

  const handleQuestionPrompt = () => {
    if (!currentSelection) return;
    const selection = currentSelection; // Capture selection

    setModalConfig({
        title: '선택한 내용에 대해 질문하기',
        description: `선택됨: "${selection.text.slice(0, 30)}..."`,
        onConfirm: async (question) => {
             if (!aiClientRef.current) return;
             const provider = settings.apiKeys.deepseek ? 'deepseek' : (settings.apiKeys.gemini ? 'gemini' : 'openai');
             const model = provider === 'deepseek' ? 'deepseek-chat' : (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
            
             if (!settings.apiKeys[provider]) {
                toast.error("AI API 키 설정을 먼저 해주세요.");
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
                 loading: 'AI에게 질문하는 중...',
                 success: '답변 완료',
                 error: '답변 받기 실패'
            });
        }
    });
    setModalOpen(true);
  };

  const handleManualDefine = () => {
    if (!currentSelection) return;
    const selection = currentSelection; // Capture selection
    setModalConfig({
        title: 'Add Manual Tooltip/Note',
        description: `Adding tooltip for: "${selection.text.slice(0, 30)}..."`,
        onConfirm: (text) => {
            processAnnotation('manual-definition', text, undefined, selection);
            toast.success("Tooltip added");
        }
    });
    setModalOpen(true);
  };

  const handleAIAction = async (type: string) => {
    if (!currentSelection && type !== 'summarize' && type !== 'critique') {
      toast.error("먼저 텍스트를 선택해주세요");
      return;
    }

    const textToProcess = currentSelection?.text || paragraphs.map(p => p.enText).join('\n').slice(0, 15000); // Increased limit for Gemini context
    
    // Open Research Agent with a specific prompt
    let prompt = "";
    switch(type) {
      case 'explain':
        // Direct In-Text Generation (User Request)
        {
             const explainPrompt = CS_RESEARCH_PROMPTS.explain(textToProcess);
             const provider = settings.apiKeys.deepseek ? 'deepseek' : (settings.apiKeys.gemini ? 'gemini' : 'openai');
             const model = provider === 'deepseek' ? 'deepseek-chat' : (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');

             if (!settings.apiKeys[provider]) {
                toast.error("AI API 키 설정을 먼저 해주세요.");
                return;
             }

             const capturedSelection = currentSelection; // Capture closure

             const promise = (async () => {
                 const response = await aiClientRef.current!.sendMessage(
                     provider, 
                     model, 
                     [{ role: 'user', content: explainPrompt }]
                 );
                 
                 // Create an 'insight' annotation for the explanation
                 if (capturedSelection) {
                    processAnnotation('insight', response.content, undefined, capturedSelection);
                 }
             })();

             toast.promise(promise, {
                 loading: '설명 생성 중...',
                 success: '설명이 노트에 추가되었습니다 (Insight)',
                 error: '생성 실패'
             });
             return; // Stop here, do not open chat
        }
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
      case 'sendToChat':
        window.dispatchEvent(new CustomEvent('research-agent-open', {
            detail: { prompt: textToProcess, autoSend: false }
        }));
        return;
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
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 animate-in fade-in duration-700 bg-zinc-50/50">
        <div className="text-center p-12 flex flex-col items-center max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-200">
          <div className="relative mb-6 w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping opacity-20" />
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-500 to-violet-500 flex items-center justify-center text-white shadow-lg rotate-3 group hover:rotate-6 transition-transform duration-500">
              <BookOpen size={40} strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="text-2xl font-serif text-zinc-900 mb-3 tracking-tight">Begin Research Session</h3>
          <p className="text-sm text-zinc-500 leading-relaxed mb-8 px-8">
            Select a document to enter the immersive reading environment. 
            <br/>AI tools will be ready to assist you.
          </p>
          <button
            onClick={() => { onToggleLibrary(); }}
            className="group relative px-6 py-3 bg-zinc-900 text-zinc-50 rounded-xl font-medium tracking-wide overflow-hidden shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <span className="relative z-10 flex items-center gap-2">
              <LibraryManagerIcon size={18} />
              Open Library
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white/80 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-zinc-200 border-t-violet-600"></div>
            <p className="text-sm font-medium text-zinc-500 animate-pulse">Loading Document...</p>
        </div>
      </div>
    );
  }

  if (loadError || (activeFile && !isLoading && paragraphs.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 bg-zinc-50/50">
        <div className="text-center p-12 flex flex-col items-center max-w-lg bg-white rounded-3xl shadow-xl border border-red-100">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-6 border border-red-200">
            <BookOpen size={32} className="text-red-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-serif text-zinc-900 mb-2">문서를 불러올 수 없습니다</h3>
          <p className="text-sm text-zinc-500 leading-relaxed mb-2">
            파일이 삭제되었거나 경로가 변경되었을 수 있습니다.
          </p>
          {loadError && (
            <p className="text-xs text-red-400 bg-red-50 px-3 py-1.5 rounded-lg mb-4 font-mono max-w-md break-all">
              {loadError}
            </p>
          )}
          <p className="text-xs text-zinc-400 mb-6">
            파일을 다시 추가(+)해 주세요. 파일은 데이터 폴더에 복사됩니다.
          </p>
          <button
            onClick={() => { onToggleLibrary(); }}
            className="px-5 py-2.5 bg-zinc-900 text-zinc-50 rounded-xl font-medium text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            서재로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col">

      <div className="absolute top-6 right-6 z-40 flex items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-1 p-1 bg-[color:var(--bg-panel)]/80 backdrop-blur-xl border border-[color:var(--border)] rounded-full shadow-2xl shadow-black/10 pointer-events-auto transition-all hover:bg-[color:var(--bg-panel)]">
          <div className="flex items-center px-2 border-r border-[color:var(--border)]">
            <button onClick={() => setZoomLevel(z => Math.max(50, z - 10))} className="p-1.5 hover:text-[color:var(--fg-primary)] text-[color:var(--fg-secondary)] rounded-full"><ChevronDown size={14} /></button>
            <span className="text-[10px] font-mono w-8 text-center text-[color:var(--fg-secondary)]">{zoomLevel}%</span>
            <button onClick={() => setZoomLevel(z => Math.min(200, z + 10))} className="p-1.5 hover:text-[color:var(--fg-primary)] text-[color:var(--fg-secondary)] rounded-full"><ChevronUp size={14} /></button>
          </div>

          <div className="flex items-center px-2 border-r border-[color:var(--border)] relative group">
            <Search size={14} className="text-[color:var(--fg-secondary)] group-hover:text-[color:var(--fg-primary)]" />
            <input
              ref={searchInputRef}
              className="w-0 group-hover:w-32 focus:w-32 transition-all duration-300 bg-transparent border-none text-xs text-[color:var(--fg-primary)] focus:outline-none ml-2 placeholder-[color:var(--fg-tertiary)]"
              placeholder="Find in text..."
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
            />
            {docSearchMatches.length > 0 && (
              <button onClick={() => navigateSearchResults(1)} className="ml-1 hover:text-[color:var(--fg-primary)] text-[color:var(--fg-secondary)]"><ChevronDown size={12} /></button>
            )}
          </div>

          <button
            onClick={() => setExportModalOpen(true)}
            className="p-2 text-[color:var(--fg-secondary)] hover:text-[color:var(--fg-primary)] transition-all mr-1"
            title="Smart Export (Synthesis)"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      <div
        ref={mainScrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar relative px-8 py-12"
        onMouseUp={handleMouseUp}
        onScroll={handleScroll}
      >
        <div className="w-full min-h-screen pb-40" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}>
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
                      postItWidth={settings.postItWidth ?? 240}
                      postItSide={settings.postItSide ?? 'right'}
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
        onSmartAsk={handleSmartAsk}
        onChat={() => handleAIAction('discuss')}
        onSendToChat={() => handleAIAction('sendToChat')}
        onExplain={() => handleAIAction('explain')}
        onSummarize={() => handleAIAction('summarize')}
        onManualDefine={handleManualDefine}
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
          bookmarkId={currentBookmarkId}
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
