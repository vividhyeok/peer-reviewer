import React, { useState } from 'react';
import type { Annotation } from '../types/ReaderTypes';
import { Trash2, ExternalLink, Highlighter, Lightbulb, MessageSquare, Edit2, RotateCw, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

interface AnnotationsPanelProps {
    annotations: Annotation[];
    onDelete: (id: string) => void;
    onJump: (paraId: string) => void;
    onUpdate?: (id: string, newContent: string) => void; // New for editing
}

export const AnnotationsPanel: React.FC<AnnotationsPanelProps> = ({ annotations, onDelete, onJump, onUpdate }) => {
    // Filter for Highlight, Insights, and AI Explanations/Definitions
    const items = annotations.filter(a => ['highlight', 'insight', 'comment', 'discussion', 'definition', 'question', 'manual-definition'].includes(a.type))
                        .sort((a, b) => a.target.paragraphId.localeCompare(b.target.paragraphId, undefined, {numeric: true}) || a.target.startOffset - b.target.startOffset);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");

    const startEditing = (id: string, content: string) => {
        setEditingId(id);
        setEditContent(content);
    };

    const saveEdit = (id: string) => {
        if (onUpdate) {
            onUpdate(id, editContent);
            setEditingId(null);
            toast.success("Note updated");
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditContent("");
    };

    if (items.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                    <Highlighter className="text-zinc-300" size={32} />
                </div>
                <h3 className="text-sm font-bold text-zinc-900 mb-2">No Annotations</h3>
                <p className="text-xs">
                    Highlights and AI explanations will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">Notebook ({items.length})</h3>
            
            {items.map(item => (
                <div key={item.id} className="group relative pr-8 pl-3 py-2 border-l-2 hover:bg-zinc-50 transition-colors"
                    style={{ borderLeftColor: item.color || (item.type === 'definition' ? '#3b82f6' : '#e2e8f0') }}
                >
                   {/* Actions */}
                   <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity bg-white/80 p-0.5 rounded shadow-sm">
                       {/* Edit Button for Text-based Annotations */}
                       {(item.type !== 'highlight' && onUpdate) && (
                           <button onClick={() => startEditing(item.id, item.content || '')} className="p-1 text-zinc-400 hover:text-blue-500 rounded hover:bg-zinc-100" title="Edit Content">
                               <Edit2 size={12} />
                           </button>
                       )}

                       <button onClick={() => onJump(item.target.paragraphId)} className="p-1 text-zinc-400 hover:text-blue-500 rounded hover:bg-zinc-100" title="Go to text">
                           <ExternalLink size={12} />
                       </button>
                       <button onClick={() => onDelete(item.id)} className="p-1 text-zinc-400 hover:text-red-500 rounded hover:bg-zinc-100" title="Remove">
                           <Trash2 size={12} />
                       </button>
                   </div>
                   
                   {/* Meta */}
                   <div className="flex items-center gap-2 mb-1">
                        <span className={clsx(
                            "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                            item.type === 'highlight' && "bg-yellow-100 text-yellow-700",
                            item.type === 'insight' && "bg-purple-100 text-purple-700",
                            (item.type === 'definition' || item.type === 'manual-definition') && "bg-blue-100 text-blue-700",
                            item.type === 'question' && "bg-orange-100 text-orange-700"
                        )}>
                            {item.type.replace('-', ' ')}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                            {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                   </div>

                   {/* Content */}
                   {editingId === item.id ? (
                        <div className="mb-2">
                            <textarea 
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full text-sm p-2 border border-zinc-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[80px]"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-1">
                                <button onClick={cancelEdit} className="p-1 text-zinc-500 hover:text-zinc-800"><X size={14}/></button>
                                <button onClick={() => saveEdit(item.id)} className="p-1 text-blue-500 hover:text-blue-700 bg-blue-50 rounded"><Check size={14}/></button>
                            </div>
                        </div>
                   ) : (
                       item.content && (
                           <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap mb-1 bg-white/50 p-1.5 rounded border border-zinc-100/50 hover:bg-white transition-colors">
                               {item.content}
                           </div>
                       )
                   )}
                   
                   {/* Target Text */}
                   <div className="text-xs text-zinc-400 italic border-l-2 border-zinc-200 pl-2 line-clamp-2">
                       "{item.target.selectedText}"
                   </div>
                </div>
            ))}
        </div>
    );
};

