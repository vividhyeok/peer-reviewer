import React from 'react';
import { MessageSquare, Calendar, Trash2, ArrowRight } from 'lucide-react';
import type { AIMessage } from '../types/ReaderTypes';

export interface ChatSession {
    id: string;
    title: string;
    date: number;
    messages: AIMessage[];
    preview: string;
}

interface ConversationsPanelProps {
    sessions: ChatSession[];
    onLoadSession: (session: ChatSession) => void;
    onDeleteSession: (id: string) => void;
}

export const ConversationsPanel: React.FC<ConversationsPanelProps> = ({ sessions, onLoadSession, onDeleteSession }) => {
    if (sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center bg-zinc-50/50">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 border border-zinc-200">
                    <MessageSquare className="text-zinc-300" size={32} />
                </div>
                <h3 className="text-sm font-bold text-zinc-900 mb-2">No Saved Conversations</h3>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-[200px]">
                    Save your research chats to access them later here.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-3 bg-zinc-50/30">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">Saved Sessions ({sessions.length})</h3>
            
            {sessions.sort((a,b) => b.date - a.date).map(session => (
                <div 
                    key={session.id} 
                    className="group bg-white border border-zinc-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer relative"
                    onClick={() => onLoadSession(session)}
                >
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-zinc-800 line-clamp-1 pr-6">{session.title}</h4>
                        <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(session.date).toLocaleDateString()}
                        </span>
                    </div>
                    
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-3 leading-relaxed">
                        {session.preview}
                    </p>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
                        <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">
                            {session.messages.length} messages
                        </span>
                        
                        <div className="flex items-center gap-1">
                             <button
                                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete"
                            >
                                <Trash2 size={12} />
                            </button>
                            <button
                                className="p-1.5 text-blue-400 bg-blue-50 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors"
                            >
                                <ArrowRight size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
