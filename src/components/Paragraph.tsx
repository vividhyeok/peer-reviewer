import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareText, BookOpenText, Wand2, RefreshCw, Info, Copy, Check, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ParagraphData, Annotation } from '../types/ReaderTypes';
import { toast } from 'sonner';
import 'katex/dist/katex.min.css';

interface ParagraphProps {
  data: ParagraphData;
  annotations: Annotation[];
  isKoreanPrimary: boolean;
  onAIAlign?: (paragraphId: string) => void;
  onRepair?: (paragraphId: string) => void;
  isSearchMatch?: boolean;
  onDeleteAnnotation?: (id: string) => void;
  onExplainImage?: (src: string, alt: string) => void;
}

export const Paragraph: React.FC<ParagraphProps> = ({
  data,
  annotations,
  isKoreanPrimary,
  onAIAlign,
  onRepair,
  isSearchMatch = false,
  onDeleteAnnotation,
  onExplainImage
}) => {
  const [hoveredSentence, setHoveredSentence] = useState<number | null>(null);
  const [activeEnSentences, setActiveEnSentences] = useState<Set<number>>(new Set());
  const [isAligning, setIsAligning] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(data.isReference || false);
  const [isRepairing, setIsRepairing] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      setIsCtrlPressed(e.ctrlKey || e.metaKey);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  const handleDeleteAnnotation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('이 설명을 삭제하시겠습니까?')) {
      onDeleteAnnotation?.(id);
      toast.success('설명이 삭제되었습니다');
    }
  };

  const Tag = data.element as React.ElementType;
  const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(data.element);

  const highlightCount = annotations.filter((a) => a.type === 'highlight').length;
  const insightCount = annotations.filter((a) => a.type === 'insight').length;
  const definitionCount = annotations.filter((a) => a.type === 'definition').length;
  const discussionCount = annotations.filter((a) => a.type === 'discussion').length;

  const toggleSentence = (idx: number) => {
    const next = new Set(activeEnSentences);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setActiveEnSentences(next);
  };

  const handleAIAlign = async () => {
    if (!onAIAlign) return;
    setIsAligning(true);
    try {
      await onAIAlign(data.id);
    } finally {
      setIsAligning(false);
    }
  };

  const handleAIRepair = async () => {
    if (!onRepair) return;
    setIsRepairing(true);
    try {
      await onRepair(data.id);
    } finally {
      setIsRepairing(false);
    }
  };

  const handleCopyLatex = (text: string) => {
    // Extract LaTeX from content if it's wrapped in $ or $$
    const latexMatch = text.match(/\$\$([\s\S]+?)\$\$|\$([\s\S]+?)\$/);
    const toCopy = latexMatch ? (latexMatch[1] || latexMatch[2]) : text;

    navigator.clipboard.writeText(toCopy);
    setCopiedId(text);
    toast.success("LaTeX copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCitationClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Citation Links
    const citationLink = target.closest('.citation-link');
    if (citationLink) {
      e.preventDefault();
      e.stopPropagation();
      const citId = citationLink.getAttribute('data-cit-id');
      const cit = data.citations.find(c => c.id === citId);
      if (cit && cit.paragraphId) {
        const targetEl = document.getElementById(`para-${cit.paragraphId}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.classList.add('ring-4', 'ring-blue-500/50', 'bg-blue-500/10');
          setTimeout(() => targetEl.classList.remove('ring-4', 'ring-blue-500/50', 'bg-blue-500/10'), 2000);
          toast.info(`Navigated to Reference ${citId}`);
        }
      } else {
        toast.error(`Reference ${citId} not found in this document`);
      }
      return;
    }

    // Internal Section/Figure Links
    const internalLink = target.closest('.internal-link');
    if (internalLink) {
      e.preventDefault();
      e.stopPropagation();
      const targetId = internalLink.getAttribute('data-target-id');
      const type = internalLink.getAttribute('data-ref-type');
      const refId = internalLink.getAttribute('data-ref-id');

      if (targetId) {
        const targetEl = document.getElementById(`para-${targetId}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.classList.add('ring-4', 'ring-blue-500/50', 'bg-emerald-500/10');
          setTimeout(() => targetEl.classList.remove('ring-4', 'ring-blue-500/50', 'bg-emerald-500/10'), 2000);
          toast.info(`Navigated to ${type} ${refId}`);
        }
      } else {
        toast.error(`${type} ${refId} not found in this document`);
      }
    }
  };

  // Helper to render text with HTML support (for citations)
  const renderText = (html: string) => {
    let processed = html;

    // 1. Auto-link Citations
    if (data.citations && data.citations.length > 0) {
       data.citations.forEach(cit => {
           const safeId = cit.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
           // Avoid double wrapping if simplified regex runs twice or overlaps
           const regex = new RegExp(`(?<!data-cit-id=")(?<!>)(${safeId})`, 'g');
           processed = processed.replace(regex, `<span class="citation-link text-blue-400 cursor-pointer hover:underline font-bold" data-cit-id="${cit.id}">$1</span>`);
       });
    }

    return <span dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  // Special Rendering for Images
  if (data.type === 'image') {
      return (
        <article id={`para-${data.id}`} className="group relative scroll-mt-24 mb-8 flex flex-col items-center">
             <div className="relative rounded-lg overflow-hidden bg-zinc-900/50 border border-zinc-800 p-1">
                <img 
                    src={data.metadata?.src} 
                    alt={data.metadata?.alt || 'Figure'} 
                    className="max-w-full max-h-[600px] object-contain dark:opacity-90 transition-opacity hover:opacity-100"
                    loading="lazy"
                />
                <div className="abe) => {
                            e.stopPropagation();
                            if (onExplainImage && data.metadata?.src) {
                                onExplainImage(data.metadata.src, data.metadata.alt || 'Image');
                            } else {
                                toast("Image explanation not connected");
                            }
                        }}
                        className="bg-zinc-900/80 backdrop-blur text-blue-400 p-2 rounded-full border border-blue-500/30 hover:bg-blue-500/10 transition-colors shadow-lg"
                        title="Explain this image with AIge analysis coming soon!")}
                        className="bg-zinc-900/80 backdrop-blur text-blue-400 p-2 rounded-full border border-blue-500/30 hover:bg-blue-500/10 transition-colors shadow-lg"
                        title="Explain this image"
                     >
                        <Wand2 size={16} />
                     </button>
                </div>
             </div>
             {data.metadata?.caption && (
                <figcaption className="mt-3 text-xs text-zinc-500 font-medium text-center px-4 max-w-2xl leading-relaxed">
                    {data.metadata.caption}
                </figcaption>
             )}
        </article>
      );
  }

  // Special Rendering for Tables
  if (data.type === 'table') {
     return (
        <article id={`para-${data.id}`} className="group relative scroll-mt-24 mb-8 overflow-x-auto">
            <div className="min-w-full p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div dangerouslySetInnerHTML={{ __html: data.enText }} className="prose prose-invert prose-sm max-w-none table-auto" />
            </div>
             {data.metadata?.caption && (
                <div className="mt-2 text-xs text-zinc-500 text-center font-mono">
                    {data.metadata.caption}
                </div>
             )}
        </article>
     );
  }

  return (
    <article
      id={`para-${data.id}`}
      className="group relative scroll-mt-24 mb-3"
      onClick={handleCitationClick}
    >
      <div
        className={clsx(
          'relative rounded-lg px-3 py-1.5 transition-all duration-300',
          isSearchMatch && 'ring-2 ring-blue-500/40 bg-blue-500/5',
          data.type === 'heading' && 'mt-8 mb-4 border-b border-zinc-800 pb-2'
        )}
      >
        {/* Paragraph Action Bar */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); handleAIRepair(); }}
            disabled={isRepairing}
            className="p-1 bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 rounded text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all disabled:opacity-50 shadow-lg"
            title="AI Repair (Fix duplication/mangling)"
          >
            {isRepairing ? <RefreshCw size={12} className="animate-spin" /> : <Info size={12} />}
          </button>

          {onAIAlign && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAIAlign(); }}
              disabled={isAligning}
              className="p-1 bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 rounded text-zinc-400 hover:text-blue-400 hover:border-blue-500/30 transition-all disabled:opacity-50 shadow-lg"
              title="AI Deep Align"
            >
              {isAligning ? <RefreshCw size={12} className="animate-spin" /> : <Wand2 size={12} />}
            </button>
          )}
        </div>

        <Tag
          className={clsx(
            'transition-colors duration-300 paper-typography',
            isHeading || data.type === 'heading'
              ? 'font-sans font-bold text-zinc-100 mb-1.5 tracking-tight'
              : 'text-zinc-200',
             data.type === 'code' && 'font-mono text-sm bg-zinc-900 p-4 rounded-lg block overflow-x-auto'
          )}
          style={data.type === 'heading' ? { fontSize: `${1.5 - ((data.metadata?.headingLevel || 1) * 0.1)}rem` } : undefined}
        >
          {data.isReference && (
            <div
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-2 mb-2 p-2 bg-zinc-100 dark:bg-white/5 rounded-lg cursor-pointer hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
            >
              <BookOpenText size={14} className="text-zinc-500" />
              <span className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">
                {isCollapsed ? "References (Folded - Click to expand)" : "References (Expanded)"}
              </span>
            </div>
          )}

          {!isCollapsed && (
            data.sentences && data.sentences.length > 0 ? (
            data.sentences.map((s, idx) => {
              const sentenceAnnotations = annotations.filter(a => {
                const cleanEn = s.en.replace(/<[^>]+>/g, '');
                return cleanEn.includes(a.target.selectedText) || a.target.selectedText.includes(cleanEn.slice(0, 20));
              });

              // Find highlight annotation for this sentence
              const highlightAnnotation = sentenceAnnotations.find(a => a.type === 'highlight');
              const insightAnnotation = sentenceAnnotations.find(a => a.type === 'insight' || a.type === 'definition');

              return (
                <span
                  key={idx}
                  onMouseEnter={() => setHoveredSentence(idx)}
                  onMouseLeave={() => setHoveredSentence(null)}
                  onClick={(e) => {
                    // Only toggle permanent state if Ctrl is NOT pressed
                    if (!e.ctrlKey && !e.metaKey) {
                      toggleSentence(idx);
                    }
                  }}
                  className={clsx(
                    "relative inline transition-all duration-150",
                    ((activeEnSentences.has(idx) || (hoveredSentence === idx && isCtrlPressed))) && "bg-blue-500/10 text-blue-200 border-b border-blue-400/40",
                    insightAnnotation && "border-b-2 border-purple-400/70"
                  )}
                  style={highlightAnnotation ? { 
                    backgroundColor: highlightAnnotation.color ? `${highlightAnnotation.color}40` : 'rgba(250, 204, 21, 0.25)',
                    borderRadius: '2px',
                    padding: '1px 2px'
                  } : undefined}
                >
                  {renderText(
                    (isKoreanPrimary && s.ko)
                      ? (activeEnSentences.has(idx) || (hoveredSentence === idx && isCtrlPressed) ? (s.en || s.ko) : s.ko)
                      : (s.en || s.ko)
                  )}

                  {/* Tooltip Layer - Now strictly requires Ctrl */}
                  <AnimatePresence>
                    {(hoveredSentence === idx && isCtrlPressed) && (
                      <motion.span
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-0 bg-transparent z-50 w-80 md:w-96 pointer-events-none"
                      >
                        <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden pointer-events-auto">
                          {/* Priority 1: User Annotations (Explanations/Notes) */}
                          {insightAnnotation && (
                            <div className="p-3 border-b border-zinc-800">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                                  <Info size={10} /> {insightAnnotation.type === 'insight' ? 'AI Insight' : 'Note'}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCopyLatex(insightAnnotation.content); }}
                                    className="text-zinc-500 hover:text-blue-400 transition-colors p-1"
                                    title="복사"
                                  >
                                    {copiedId === insightAnnotation.content ? <Check size={12} /> : <Copy size={12} />}
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteAnnotation(e, insightAnnotation.id)}
                                    className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                                    title="삭제"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              <div className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                {insightAnnotation.content}
                              </div>
                            </div>
                          )}

                          {/* English translation preview */}
                          {(isKoreanPrimary && s.ko) && (
                            <div className="p-3">
                              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                                English Preview
                              </div>
                              <div className="text-[13px] text-zinc-300 leading-relaxed">
                                {s.en || s.ko}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {" "}
                </span>
              );
            })
          ) : (
            <span>{renderText(isKoreanPrimary && data.koText ? data.koText : data.enText)}</span>
          ))}
        </Tag>

        {/* Action Indicators - Reduced Spacing */}
        {(highlightCount > 0 || insightCount > 0 || definitionCount > 0 || discussionCount > 0) && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-500 font-medium tracking-wide">
            {highlightCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/5 border border-yellow-500/10 px-2 py-0.5 text-yellow-500 dark:text-yellow-400/80">
                <BookOpenText size={10} />
                {highlightCount} HIGHLIGHT
              </span>
            )}
            {insightCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/5 border border-purple-500/10 px-2 py-0.5 text-purple-500 dark:text-purple-400/80">
                <MessageSquareText size={10} />
                {insightCount} AI INSIGHT
              </span>
            )}
            {definitionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/5 border border-blue-500/10 px-2 py-0.5 text-blue-500 dark:text-blue-400/80">
                <BookOpenText size={10} />
                {definitionCount} NOTE
              </span>
            )}
            {discussionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/5 border border-green-500/10 px-2 py-0.5 text-green-500 dark:text-green-400/80">
                <MessageSquareText size={10} />
                {discussionCount} DISCUSSION
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
