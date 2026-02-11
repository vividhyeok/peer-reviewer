import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareText, BookOpenText, Wand2, RefreshCw, Info, Copy, Check, Trash2, StickyNote, Bookmark, Sparkles, Plus, Table, Sigma } from 'lucide-react';
import { clsx } from 'clsx';
import type { ParagraphData, Annotation } from '../types/ReaderTypes';
import { toast } from 'sonner';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import ReactMarkdown from 'react-markdown';

interface ParagraphProps {
  data: ParagraphData;
  annotations: Annotation[];
  isKoreanPrimary: boolean;
  onAIAlign?: (paragraphId: string) => void;
  onRepair?: (paragraphId: string, instruction?: string) => void;
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

  const handleAIRepair = async (instruction?: string) => {
    if (!onRepair) return;
    setIsRepairing(true);
    try {
      await onRepair(data.id, instruction);
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

  // Helper to render text with HTML support (for citations, annotations, and Math)
  const renderText = (html: string) => {
    let processed = html;

    // 0. Render Math (KaTeX) - BEFORE highlights to avoid breaking HTML matches
    // We look for $...$ and $$...$$ patterns.
    // Note: ReaderParser ensures math is wrapped in these delimiters.
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, tex) => {
      try {
        return katex.renderToString(tex, { displayMode: true, throwOnError: false });
      } catch (e) { return match; }
    });
    
    processed = processed.replace(/\$([^$]+?)\$/g, (match, tex) => {
      try {
        // Prepare Tex: Remove extra spaces if Parser added them conservatively
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
      } catch (e) { return match; }
    });

    // 1. Auto-link Citations
    if (data.citations && data.citations.length > 0) {
       data.citations.forEach(cit => {
           const safeId = cit.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
           // Avoid double wrapping if simplified regex runs twice or overlaps
           const regex = new RegExp(`(?<!data-cit-id=")(?<!>)(${safeId})`, 'g');
           processed = processed.replace(regex, `<span class="citation-link text-blue-400 cursor-pointer hover:underline font-bold" data-cit-id="${cit.id}">$1</span>`);
       });
    }

    // 2. All Inline Annotations (Combined)
    // Filter relevant annotations
    const relevantAnnos = annotations.filter(a => processed.includes(a.target.selectedText));
    // Sort by length (Process longest first)
    relevantAnnos.sort((a, b) => b.target.selectedText.length - a.target.selectedText.length);

    relevantAnnos.forEach(ann => {
        const safeText = ann.target.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?![^<]*>)(${safeText})`);
        const safeContent = (ann.content || '').replace(/"/g, '&quot;');
        
        let replacement = '$1';

        // Styling based on type
        if (ann.type === 'highlight') {
            const color = ann.color ? `${ann.color}60` : 'rgba(250, 204, 21, 0.4)';
            replacement = `<mark style="background-color: ${color}; border-radius: 2px; color: inherit; padding-left: 1px; padding-right: 1px;">$1</mark>`;
        
        } else if (ann.type === 'insight') {
            // Light Purple Highlight + Underline
            replacement = `<span class="border-b-2 border-purple-400 bg-purple-500/10 cursor-help" title="AI Insight: ${safeContent}">$1</span>`;
        
        } else if (ann.type === 'comment' || ann.type === 'discussion') {
            // Light Blue Highlight + Underline (Manual Discussion)
            replacement = `<span class="border-b-2 border-cyan-400 bg-cyan-500/10 cursor-help" title="Reasoning: ${safeContent}">$1</span>`;
        
        } else if (ann.type === 'manual-definition') {
             // Light Indigo Underline (Definitions)
            replacement = `<abbr class="border-b-2 border-indigo-400 decoration-dotted bg-indigo-50 cursor-help" title="Def: ${safeContent}">$1</abbr>`;

        } else if (ann.type === 'note') {
            // Light Green Highlight + Underline (Manual Note)
            replacement = `<span class="border-b-2 border-emerald-400 bg-emerald-500/10 cursor-help" title="Note: ${safeContent}">$1</span>`;
        
        } else if (ann.type === 'question') {
            // Orange Highlight + Underline
            replacement = `<span class="ds-q border-b-2 border-orange-400 bg-orange-500/10 cursor-help" title="Question: ${safeContent}">$1</span>`;
        }

        // Apply replacement
        processed = processed.replace(regex, replacement);
    });

    // 4. Highlight Search Term
    if (highlightTerm && highlightTerm.length > 1) {
        const safeTerm = highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?![^<]*>)(${safeTerm})`, 'gi');
        processed = processed.replace(regex, '<mark class="bg-yellow-500/40 text-white rounded-sm px-0.5">$1</mark>');
    }

    return <span dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  // Special Rendering for Images
  if (data.type === 'image') {
      return (
        <article id={`para-${data.id}`} className="group relative scroll-mt-24 mb-8 flex flex-col items-center">
             <div className="relative rounded-lg overflow-hidden border border-zinc-800 bg-black/20 p-1">
                <img 
                    src={data.metadata?.src} 
                    alt={data.metadata?.alt || 'Figure'} 
                    className="w-auto h-auto max-w-full max-h-[800px] object-contain mx-auto"
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
        <div id={`para-${data.id}`} className="group relative scroll-mt-24 mb-8">
            <div className="w-full overflow-x-auto p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div 
                    dangerouslySetInnerHTML={{ __html: data.enText }} 
                    className="prose prose-invert prose-sm max-w-none 
                        [&_table]:w-full [&_table]:border-collapse 
                        [&_th]:bg-zinc-800/50 [&_th]:p-2 [&_th]:border [&_th]:border-zinc-700 [&_th]:text-left
                        [&_td]:p-2 [&_td]:border [&_td]:border-zinc-700/50" 
                />
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

           {/* Table Recovery */}
          <button
            onClick={(e) => { e.stopPropagation(); handleAIRepair("The user reports a missing or broken TABLE in this paragraph. Please reconstruct it as a Markdown Table or HTML Table from the context."); }}
            disabled={isRepairing}
            className="p-1 bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 rounded text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-50 shadow-lg"
            title="Recover Missing Table"
          >
             <Table size={12} />
          </button>

          {/* Math Recovery */}
          <button
            onClick={(e) => { e.stopPropagation(); handleAIRepair("The user reports missing or broken Math/Formula (LaTeX) in this paragraph. Please reconstruct the mathematical formula using LaTeX ($...$)."); }}
            disabled={isRepairing}
            className="p-1 bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 rounded text-zinc-400 hover:text-pink-400 hover:border-pink-500/30 transition-all disabled:opacity-50 shadow-lg"
            title="Recover Missing Formula"
          >
             <Sigma size={12} />
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
              ? 'font-sans font-bold text-zinc-900 mb-1.5 tracking-tight'
              : 'text-zinc-900 font-medium',
             data.type === 'code' && 'font-mono text-sm bg-zinc-100 p-4 rounded-lg block overflow-x-auto text-zinc-800'
          )}
          style={data.type === 'heading' ? { fontSize: `${1.5 - ((data.metadata?.headingLevel || 1) * 0.1)}rem` } : undefined}
        >
          {data.isReference && (
            <div
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-2 mb-2 p-2 bg-zinc-100 rounded-lg cursor-pointer hover:bg-zinc-200 transition-colors"
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
                const cleanEn = s.en ? s.en.replace(/<[^>]+>/g, '') : '';
                const cleanKo = s.ko ? s.ko.replace(/<[^>]+>/g, '') : '';
                // Check both EN and KO for matches
                return (cleanEn && cleanEn.includes(a.target.selectedText)) || 
                       (cleanKo && cleanKo.includes(a.target.selectedText)) || 
                       (a.target.selectedText.length > 20 && (cleanEn.includes(a.target.selectedText.slice(0, 20)) || cleanKo.includes(a.target.selectedText.slice(0, 20))));
              });

              // Find insight annotation for this sentence (keep sentence-level underlining for insights)
              const insightAnnotation = sentenceAnnotations.find(a => a.type === 'insight' || a.type === 'definition');

              return (
                <span
                  key={idx}
                  onMouseEnter={() => setHoveredSentence(idx)}
                  onMouseLeave={() => setHoveredSentence(null)}
                  onMouseDown={(e) => {
                      // Prevent selection if holding Ctrl to ensure clean click
                      if (e.ctrlKey || e.metaKey) e.preventDefault();
                  }}
                  onClick={(e) => {
                    // Toggle translation if Ctrl key is pressed (changed from Alt)
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSentence(idx);
                    }
                  }}
                  className={clsx(
                    "relative inline transition-all duration-150 cursor-text",
                    isCtrlPressed && "cursor-pointer", // Visual cue
                    ((activeEnSentences.has(idx) || (hoveredSentence === idx && isCtrlPressed))) && "bg-blue-500/10 text-blue-700 border-b border-blue-400/40",
                    insightAnnotation && "border-b-2 border-purple-400/70"
                  )}
                >
                  {/* Content Rendering: Korean or English with Highlights */} 
                  {/* Logic: If Korean Mode AND NOT Toggled -> Show Korean. Else Show English (or Korean if English missing) */}
                  {(isKoreanPrimary && s.ko && !activeEnSentences.has(idx)) ? (
                      renderText(s.ko)
                  ) : (
                      renderText(s.en || s.ko)
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
                        className="pointer-events-auto bg-yellow-100 p-3 rounded-lg shadow-xl border border-yellow-400/30 w-56 rotate-1"
                     >
                        <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            className="w-full bg-transparent text-sm text-yellow-950 placeholder-yellow-800/50 resize-none outline-none font-medium h-20 leading-snug"
                            placeholder="Write a note..."
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => { setShowNoteButton(false); setIsAddingNote(false); }} className="text-xs text-yellow-800 hover:underline">Cancel</button>
                            <button onClick={handleSaveNote} className="text-xs bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-900 px-2 py-1 rounded font-bold">Save</button>
                        </div>
                     </motion.div>
                 )}
             </AnimatePresence>

             {/* Existing Notes */}
             {notes.map(note => (
                 <StickyNoteItem 
                    key={note.id} 
                    note={note} 
                    onDelete={(id) => onDeleteAnnotation && onDeleteAnnotation(id)} 
                 />
             ))}
        </div>
      </div>
    </div>
  );
};

// -- Sticky Note Subcomponent --
const StickyNoteItem: React.FC<{ note: Annotation, onDelete: (id: string) => void }> = ({ note, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    return (
        <motion.div
            drag
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            layout
            className="pointer-events-auto bg-yellow-50 border-l-4 border-yellow-400 p-2 pl-3 shadow-md hover:shadow-lg transition-shadow relative group/note cursor-move"
            style={{ 
                width: '240px', // Default
                minWidth: '160px',
                maxWidth: '400px'
            }}
        >
            <div 
                className={clsx(
                    "text-base text-zinc-800 leading-relaxed font-normal whitespace-pre-wrap cursor-text prose prose-sm max-w-none prose-p:my-1",
                    !isExpanded && "line-clamp-5 max-h-[15em] overflow-hidden mask-fade-bottom"
                )}
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when clicking text text to select
                title={isExpanded ? "Click to collapse" : "Click to expand"}
            >
                <ReactMarkdown>{note.content}</ReactMarkdown>
            </div>
            
            {!isExpanded && note.content.length > 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-yellow-50 to-transparent pointer-events-none" />
            )}

            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
                 <button 
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag
                    onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                    className="p-0.5 text-zinc-400 hover:text-red-500 rounded hover:bg-red-50"
                 >
                    <Trash2 size={14} />
                 </button>
            </div>
        </motion.div>
    );
};

export const MemoizedParagraph = React.memo(Paragraph);
