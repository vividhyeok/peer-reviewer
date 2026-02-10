import React from 'react';
import type { Annotation } from '../types/ReaderTypes';
import { Trash2, ExternalLink, Highlighter, Lightbulb, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';

interface AnnotationsPanelProps {
    annotations: Annotation[];
    onDelete: (id: string) => void;
    onJump: (paraId: string) => void;
}

export const AnnotationsPanel: React.FC<AnnotationsPanelProps> = ({ annotations, onDelete, onJump }) => {
    // Filter for Highlight and Insights
    const items = annotations.filter(a => ['highlight', 'insight', 'comment', 'discussion'].includes(a.type))
                        .sort((a, b) => a.target.paragraphId.localeCompare(b.target.paragraphId, undefined, {numeric: true}) || a.target.startOffset - b.target.startOffset);

    if (items.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                    <Highlighter className="text-zinc-300 dark:text-zinc-600" size={32} />
                </div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">No Highlights</h3>
                <p className="text-xs">
                    Highlight text or add comments to see them listed here.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">Highlights & Insights ({items.length})</h3>
            
            {items.map(item => (
                <div key={item.id} className="group relative pr-8 pl-3 py-2 border-l-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    style={{ borderLeftColor: item.color || '#e2e8f0' }}
                >
                   {/* Actions */}
                   <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity">
                       <button onClick={() => onJump(item.target.paragraphId)} className="p-1 text-zinc-400 hover:text-blue-500 rounded bg-white dark:bg-zinc-800 shadow-sm" title="Go to text">
                           <ExternalLink size={12} />
                       </button>
                       <button onClick={() => onDelete(item.id)} className="p-1 text-zinc-400 hover:text-red-500 rounded bg-white dark:bg-zinc-800 shadow-sm" title="Remove">
                           <Trash2 size={12} />
                       </button>
                   </div>
                   
                   {/* Meta */}
                   <div className="flex items-center gap-2 mb-1">
                        {item.type === 'insight' && <Lightbulb size={10} className="text-purple-500" />}
                        {item.type === 'discussion' && <MessageSquare size={10} className="text-blue-500" />}
                        <span className="text-[10px] font-mono text-zinc-400">Para {item.target.paragraphId}</span>
                   </div>

                   {/* Content */}
                   <div 
                        className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-3 cursor-pointer"
                        onClick={() => onJump(item.target.paragraphId)}
                    >
                       "{item.target.selectedText}"
                   </div>
                   
                   {/* Note content if exists */}
                   {item.content && (
                       <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                           {item.content}
                       </div>
                   )}
                </div>
            ))}
        </div>
    );
};
