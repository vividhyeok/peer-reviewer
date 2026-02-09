import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareText, BookOpenText, Wand2, RefreshCw, Info, Copy, Check, Trash2, StickyNote, Bookmark, Sparkles, Plus } from 'lucide-react';
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
  highlightTerm?: string;
  onDeleteAnnotation?: (id: string) => void;
  onExplainImage?: (src: string, alt: string) => void;
  // New props
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
  onAddNote?: (paragraphId: string, content: string) => void;
}

export const Paragraph: React.FC<ParagraphProps> = ({
  data,
  annotations,
  isKoreanPrimary,
  onAIAlign,
  onRepair,
  isSearchMatch = false,
  highlightTerm,
  onDeleteAnnotation,
  onExplainImage,
  isBookmarked = false,
  onToggleBookmark,
  onAddNote
}) => {
  const [hoveredSentence, setHoveredSentence] = useState<number | null>(null);
  const [activeEnSentences, setActiveEnSentences] = useState<Set<number>>(new Set());
  const [isAligning, setIsAligning] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(data.isReference || false);
  const [isRepairing, setIsRepairing] = useState(false);
  
  // Note Input State
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [showNoteButton, setShowNoteButton] = useState(false);

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

  const handleSaveNote = () => {
    if (noteContent.trim() && onAddNote) {
        onAddNote(data.id, noteContent);
        setNoteContent('');
        setIsAddingNote(false);
    }
  };

  const handleDeleteAnnotation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('삭제하시겠습니까?')) {
      onDeleteAnnotation?.(id);
      toast.success('제거되었습니다');
    }
  };

  const Tag = data.element as React.ElementType;
  const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(data.element);
  const isImage = data.type === 'image';

  const notes = annotations.filter(a => a.type === 'note');
  
  // Existing counts ...
  const highlightCount = annotations.filter((a) => a.type === 'highlight').length;
  // ... (keep existing count logic if possible, simplified here for replacement context)

  // ... (Rest of existing Sentence Logic or Image Render) ...
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

  // Helper to render text with HTML support (for citations and annotations)
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

    // 2. Wrap Definition and Question Annotations
    // Filter annotations relevant to this text block
    const inlineAnnotations = annotations.filter(a => 
      (a.type === 'definition' || a.type === 'question') && 
      processed.includes(a.target.selectedText)
    );

    inlineAnnotations.forEach(ann => {
       const className = ann.type === 'definition' ? 'ds-def' : 'ds-q';
       const safeText = ann.target.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       // Simple replacement ensuring we match the text. 
       // Ideally we'd use more complex parsing to avoid replacing inside tags, but for now specific text matching is usually safe in this context.
       const regex = new RegExp(`(${safeText})`, 'g');
       const safeTitle = ann.content.replace(/"/g, '&quot;');
       
       // Using title attribute for native tooltip behavior, plus class for styling.
       processed = processed.replace(regex, `<abbr class="${className}" title="${safeTitle}">$1</abbr>`);
    // 3. Highlight Search Term
    if (highlightTerm && highlightTerm.length > 1) {
        const safeTerm = highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Look for the term, but try not to break HTML tags (basic heuristic)
        // This simple regex might match inside attributes if not careful, but for this limited scope it's often acceptable.
        // A better way is using a TreeWalker or purely text-based replacement before rendering, but we are modifying HTML string here.
        // We use a negative lookahead to blindly avoid closing tags, but it's imperfect.
        const regex = new RegExp(`(?![^<]*>)(${safeTerm})`, 'gi');
        processed = processed.replace(regex, '<mark class="bg-yellow-500/40 text-white rounded-sm px-0.5">$1</mark>');
    }

    });

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
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                     <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onExplainImage && data.metadata?.src) {
                                onExplainImage(data.metadata.src, data.metadata.alt || 'Image');
                            } else {
                                toast("Image explanation not connected");
                            }
                        }}
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
        <div id={`para-${data.id}`} className="group relative scroll-mt-24 mb-8 overflow-x-auto">
            <div className="min-w-full p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div dangerouslySetInnerHTML={{ __html: data.enText }} className="prose prose-invert prose-sm max-w-none table-auto" />
            </div>
             {data.metadata?.caption && (
                <div className="mt-2 text-xs text-zinc-500 text-center font-mono">
                    {data.metadata.caption}
                </div>
             )}
        </div>
     );
  }

  return (
    <div
      id={`para-${data.id}`}
      className="group relative scroll-mt-24 mb-3"
      onClick={handleCitationClick}
    >
      <div
        className={clsx(
          'relative rounded-lg px-3 py-1.5 transition-all duration-300',
          isSearchMatch && 'ring-2 ring-blue-500/40 bg-blue-500/5',
          isBookmarked && 'ring-2 ring-red-500/30 bg-red-500/5',
          data.type === 'heading' && 'mt-8 mb-4 border-b border-zinc-800 pb-2'
        )}
      >
        {/* Bookmark Ribbon Indicator */}
        {isBookmarked && (
            <div className="absolute -left-1 top-0 bottom-0 w-1 bg-red-500 rounded-l-md" />
        )}

        {/* Paragraph Action Bar */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
          
          {/* Bookmark Button */}
          {onToggleBookmark && (
            <button
                onClick={(e) => { e.stopPropagation(); onToggleBookmark(data.id); }}
                className={clsx(
                    "p-1 backdrop-blur-sm border rounded transition-all shadow-lg",
                    isBookmarked 
                        ? "bg-red-500/10 border-red-500 text-red-500" 
                        : "bg-zinc-800/80 border-zinc-700/50 text-zinc-400 hover:text-red-400 hover:border-red-500/30"
                )}
                title={isBookmarked ? "Remove Bookmark" : "Set Bookmark"}
            >
                <Bookmark size={12} fill={isBookmarked ? "currentColor" : "none"} />
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); handleAIRepair(); }}
            disabled={isRepairing}
            // Highlight button if content looks potentially suspicious (simple heuristic)
            className={clsx(
              "p-1 backdrop-blur-sm border rounded hover:border-emerald-500/30 transition-all disabled:opacity-50 shadow-lg",
              (data.enText.includes('path d=') || data.enText.length > 500 && !data.enText.includes(' ')) 
                 ? "bg-amber-900/50 text-amber-200 border-amber-500/50 animate-pulse" 
                 : "bg-zinc-800/80 border-zinc-700/50 text-zinc-400 hover:text-emerald-400"
            )}
            title={data.enText.includes('path d=') ? "Broken content detected! Click to Auto-Repair with AI" : "AI Repair (Fix duplication/mangling)"}
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
                    // Toggle translation if Ctrl key is pressed (changed from Alt)
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault();
                      e.stopPropagation();
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
                      ? (activeEnSentences.has(idx) ? (s.en || s.ko) : s.ko)
                      : (s.en || s.ko)
                  )}

                  {/* Tooltip Layer - Now strictly requires Ctrl and Insight */}
                  <AnimatePresence>
                    {(hoveredSentence === idx && isCtrlPressed && insightAnnotation) && (
                      <motion.span
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-0 bg-transparent z-50 w-80 md:w-96 pointer-events-none"
                      >
                        <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden pointer-events-auto">
                          {/* User Annotations (Explanations/Notes) */}
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

        {/* Right Margin Notes Area */}
        <div 
            className="absolute left-[102%] top-0 bottom-0 w-64 pointer-events-none flex flex-col gap-3 pt-2 opacity-100 z-20"
        >
             {/* Toggle/Add Note Button (Always visible on hover) */}
             <div className="pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity flex justify-start">
                <button 
                    onClick={() => setShowNoteButton(!showNoteButton)}
                    className="p-1.5 bg-zinc-800 rounded-full text-zinc-400 hover:text-yellow-400 border border-zinc-700 hover:border-yellow-400/50 transition-all shadow-md"
                    title="Add Post-it Note"
                >
                    <StickyNote size={14} />
                </button>
             </div>

             {/* Note Input */}
             <AnimatePresence>
                 {(showNoteButton || isAddingNote) && (
                     <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="pointer-events-auto bg-yellow-100 dark:bg-yellow-900/90 p-3 rounded-lg shadow-xl border border-yellow-400/30 w-56 rotate-1"
                     >
                        <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            className="w-full bg-transparent text-sm text-yellow-950 dark:text-yellow-100 placeholder-yellow-800/50 dark:placeholder-yellow-200/50 resize-none outline-none font-medium h-20 leading-snug"
                            placeholder="Write a note..."
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => { setShowNoteButton(false); setIsAddingNote(false); }} className="text-xs text-yellow-800 dark:text-yellow-200 hover:underline">Cancel</button>
                            <button onClick={handleSaveNote} className="text-xs bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-900 dark:text-yellow-50 px-2 py-1 rounded font-bold">Save</button>
                        </div>
                     </motion.div>
                 )}
             </AnimatePresence>

             {/* Existing Notes */}
             {notes.map(note => (
                 <motion.div
                    key={note.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="pointer-events-auto bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-700/50 p-3 rounded-lg shadow-lg w-56 text-sm text-zinc-800 dark:text-zinc-200 group/note relative hover:z-50 hover:scale-105 transition-transform origin-top-left"
                 >
                    <div className="whitespace-pre-wrap leading-relaxed">{note.content}</div>
                    <button 
                        onClick={(e) => handleDeleteAnnotation(e, note.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover/note:opacity-100 text-zinc-400 hover:text-red-400 p-1"
                    >
                        <Trash2 size={12} />
                    </button>
                 </motion.div>
             ))}
        </div>
                <MessageSquareText size={10} />
                {discussionCount} DISCUSSION
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const MemoizedParagraph = React.memo(Paragraph);
