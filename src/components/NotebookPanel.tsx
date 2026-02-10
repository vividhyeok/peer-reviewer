import React from 'react';
import type { Annotation } from '../types/ReaderTypes';
import { Trash2, ExternalLink, Bot, MessageSquare, StickyNote, Quote } from 'lucide-react';
import { clsx } from 'clsx';
import ReactMarkdown from 'react-markdown';

interface NotebookPanelProps {
    annotations: Annotation[];
    onDelete: (id: string) => void;
    onJump: (paraId: string) => void;
}

export const NotebookPanel: React.FC<NotebookPanelProps> = ({ annotations, onDelete, onJump }) => {
    // Filter for saved AI responses and Notes
    const items = annotations.filter(a => ['ai_response', 'note', 'question', 'definition'].includes(a.type))
                        .sort((a, b) => b.createdAt - a.createdAt);

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                    <Quote className="text-zinc-300 dark:text-zinc-600" size={32} />
                </div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Notebook Empty</h3>
                <p className="text-xs">
                    Save AI chats, notes, and definitions here for quick access.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">Saved Insights ({items.length})</h3>
            
            {items.map(item => (
                <div key={item.id} className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm hover:shadow-md transition-all">
                   {/* Header */}
                   <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                       <div className="flex items-center gap-2">
                           {item.type === 'ai_response' && <Bot size={14} className="text-blue-500" />}
                           {item.type === 'note' && <StickyNote size={14} className="text-yellow-500" />}
                           {item.type === 'question' && <MessageSquare size={14} className="text-purple-500" />}
                           
                           <span className={clsx(
                               "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                               item.type === 'ai_response' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 
                               item.type === 'note' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' :
                               'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                           )}>
                               {item.type.replace('_', ' ')}
                           </span>
                           <span className="text-[10px] text-zinc-400">
                               {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </span>
                       </div>
                       
                       <div className="flex items-center gap-1">
                           <button onClick={() => onJump(item.target.paragraphId)} className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Jump to context">
                               <ExternalLink size={12} />
                           </button>
                           <button onClick={() => onDelete(item.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete">
                               <Trash2 size={12} />
                           </button>
                       </div>
                   </div>
                   
                   {/* Content */}
                   <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                       {item.type === 'ai_response' ? (
                           <ReactMarkdown>{item.content}</ReactMarkdown>
                       ) : (
                           <p className="whitespace-pre-wrap">{item.content}</p>
                       )}
                   </div>
                   
                   {/* Context Quote */}
                   {item.target.selectedText && (
                       <div className="mt-3 pt-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-950/50 rounded-lg border border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 italic truncate cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors" onClick={() => onJump(item.target.paragraphId)}>
                           "{item.target.selectedText.slice(0, 60)}..."
                       </div>
                   )}
                </div>
            ))}
        </div>
    );
};
