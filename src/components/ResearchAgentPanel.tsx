import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, Loader2, ChevronDown, ChevronUp, Search, Database, UserCheck, Microscope, Layers, ShieldAlert, Lightbulb, MessageSquareText, BookOpen, Copy, Check } from 'lucide-react';
import { MultiAIClient } from '../core/MultiAIClient';
import { type AppSettings, AI_MODELS } from '../types/settings';
import { type AgentThought, type AIMessage, type PaperSummary, type Annotation } from '../types/ReaderTypes';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface ResearchAgentPanelProps {
    settings: AppSettings;
    documentFullText?: string;
    onOpenSettings: () => void;
    annotations: Annotation[];
    initialQuery?: string;
}

export const ResearchAgentPanel: React.FC<ResearchAgentPanelProps> = ({ settings, documentFullText, onOpenSettings, annotations, initialQuery }) => {
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [thoughts, setThoughts] = useState<AgentThought[]>([]);
    const [showThoughts, setShowThoughts] = useState(false);
    const [activeContext, setActiveContext] = useState<{ paragraphId: string; element: string; text: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'insights'>('chat');
    const [summary, setSummary] = useState<PaperSummary | null>(null);
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const aiClientRef = useRef<MultiAIClient>(new MultiAIClient(settings.apiKeys));

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast.success('코드가 클립보드에 복사되었습니다');
        setTimeout(() => setCopiedCode(null), 2000);
    };

    useEffect(() => {
        const handleExternalQuery = (e: any) => {
            const { query, selection, prompt, autoSend } = e.detail || {};
            
            if (prompt) {
                setInput(prompt);
                setActiveTab('chat');
                if (autoSend) {
                  // Signal to send
                  setTriggerSend(Date.now());
                }
            } else if (query) {
                if (selection) {
                    setInput(`${query}\n\nSelected Text: "${selection}"`);
                } else {
                    setInput(query);
                }
                setActiveTab('chat');
            }
        };

        window.addEventListener('research-agent-query', handleExternalQuery);
        // @ts-ignore
        window.addEventListener('research-agent-open', handleExternalQuery);

        const handleContextChange = (e: any) => {
            setActiveContext(e.detail);
        };
        window.addEventListener('research-agent-context-change', handleContextChange);

        const handleDocLoaded = () => {
            setSummary(null);
            setMessages([]);
            setThoughts([]);
        };
        window.addEventListener('document-loaded', handleDocLoaded);

        return () => {
            window.removeEventListener('research-agent-query', handleExternalQuery);
            // @ts-ignore
            window.removeEventListener('research-agent-open', handleExternalQuery);
            window.removeEventListener('research-agent-context-change', handleContextChange);
            window.removeEventListener('document-loaded', handleDocLoaded);
        };
    }, []);

    const [triggerSend, setTriggerSend] = useState<number>(0);

    useEffect(() => {
        if (initialQuery) {
            setInput(initialQuery);
            setTriggerSend(Date.now());
        }
    }, [initialQuery]);

    useEffect(() => {
        if (triggerSend > 0) {
            handleSend();
        }
    }, [triggerSend]);

    const fetchSummary = async () => {
        if (!documentFullText || generatingSummary || summary) return;
        setGeneratingSummary(true);
        try {
            const modelId = settings.modelAssignments.summarize || 'deepseek-chat';
            const modelInfo = AI_MODELS.find(m => m.id === modelId);
            if (!modelInfo || !settings.apiKeys[modelInfo.provider]) {
                toast.error("Configure AI API key for summary");
                return;
            }
            const res = await aiClientRef.current.generatePaperSummary(
                { provider: modelInfo.provider, modelId: modelInfo.id },
                documentFullText
            );
            setSummary(res);
        } catch (e) {
            console.error(e);
            toast.error("Summary generation failed");
        } finally {
            setGeneratingSummary(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'summary' && !summary && documentFullText) {
            fetchSummary();
        }
    }, [activeTab, summary, documentFullText]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, thoughts]);

    const handleSend = async () => {
        if (!input.trim() || !documentFullText || loading) return;

        const userQuery = input.trim();
        const userMsg: AIMessage = { role: 'user', content: userQuery };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        setThoughts([]);
        setShowThoughts(false);

        const modelId = settings.modelAssignments.discussion || 'deepseek-chat';
        const modelInfo = AI_MODELS.find(m => m.id === modelId);

        if (!modelInfo || !settings.apiKeys[modelInfo.provider]) {
            toast.error("Configure AI API key first");
            onOpenSettings();
            setLoading(false);
            return;
        }

        try {
            const finalAnswer = await aiClientRef.current.orchestrate(
                { provider: modelInfo.provider, modelId: modelInfo.id },
                userQuery,
                documentFullText,
                (thought) => {
                    setThoughts(prev => {
                        const existing = prev.find(t => t.id === thought.id);
                        if (existing) {
                            return prev.map(t => t.id === thought.id ? thought : t);
                        }
                        return [...prev, thought];
                    });
                }
            );

            setMessages(prev => [...prev, { role: 'assistant', content: finalAnswer }]);
        } catch (e) {
            console.error(e);
            toast.error("Agent execution failed");
            setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error while processing your request. Please check your API settings or try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const getThoughtIcon = (type: string) => {
        switch (type) {
            case 'search': return <Search size={14} className="text-blue-400" />;
            case 'extract': return <Database size={14} className="text-emerald-400" />;
            case 'author-sim': return <UserCheck size={14} className="text-purple-400" />;
            case 'analyze': return <Microscope size={14} className="text-amber-400" />;
            case 'critic': return <ShieldAlert size={14} className="text-rose-400" />;
            case 'hypothesize': return <Lightbulb size={14} className="text-yellow-400" />;
            case 'synthesize': return <Layers size={14} className="text-pink-400" />;
            default: return <Sparkles size={14} className="text-zinc-400" />;
        }
    };

    return (
        <div className="h-full flex flex-col bg-transparent text-[var(--fg-primary)] overflow-hidden">
            <div className="p-1 px-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel)]/50 backdrop-blur-md">
                <div className="flex gap-4">
                    {[
                        { id: 'chat', label: 'Chat', icon: MessageSquareText },
                        { id: 'summary', label: 'Summary', icon: BookOpen },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={clsx(
                                "py-2 px-1 text-[11px] font-bold uppercase tracking-widest transition-all relative",
                                activeTab === tab.id ? "text-[var(--accent)]" : "text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)]"
                            )}
                        >
                            <div className="flex items-center gap-1.5">
                                <tab.icon size={12} />
                                {tab.label}
                            </div>
                            {activeTab === tab.id && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
                            )}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    {loading && <Loader2 size={14} className="animate-spin text-[var(--accent)]" />}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar space-y-6">
                {!documentFullText ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--fg-tertiary)] opacity-40 px-10 text-center">
                        <Sparkles size={48} className="mb-4" strokeWidth={1} />
                        <p className="text-sm font-medium">Select a document to activate the agent</p>
                    </div>
                ) : activeTab === 'chat' ? (
                    messages.length === 0 && !loading ? (
                        <div className="py-10 space-y-6">
                            {activeContext && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="p-3 bg-zinc-900/50 border border-blue-500/20 rounded-xl flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <Layers size={14} className="text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">Current Section Context</p>
                                        <p className="text-[12px] text-[var(--fg-secondary)] truncate italic">
                                            "{activeContext.text}"
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleSend()}
                                        className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[10px] font-bold rounded-md transition-colors"
                                    >
                                        REFINE
                                    </button>
                                </motion.div>
                            )}
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-[color:var(--ink)]">How can I assist your research?</h3>
                                <p className="text-sm text-[color:var(--muted)]">I use a multi-agent orchestration system to search, extract, and analyze papers.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    "Explain the novelty of this work relative to current 2024 standards.",
                                    "Extract all performance metrics into a code block table.",
                                    "As the author, justify why you chose this specific methodology.",
                                    "Find potential real-world applications for this algorithm."
                                ].map(q => (
                                    <button
                                        key={q}
                                        onClick={() => { setInput(q); }}
                                        className="p-3 text-left bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl text-sm text-[var(--fg-secondary)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all group"
                                    >
                                        <span className="group-hover:text-[var(--fg-primary)]">{q}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <AnimatePresence mode="popLayout">
                                {messages.map((m, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.3, delay: i === messages.length - 1 ? 0 : 0.05 }}
                                        className={clsx("flex gap-3", m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                                    >
                                        <div className={clsx(
                                            "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center shadow-lg",
                                            m.role === 'user' ? "bg-zinc-800 text-white" : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                                        )}>
                                            {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                        </div>
                                        <div className={clsx(
                                            "max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed",
                                            m.role === 'user'
                                                ? "bg-zinc-100 dark:bg-white/5 text-[var(--fg-primary)]"
                                                : "bg-white dark:bg-zinc-900 border border-[var(--border)] text-[var(--fg-primary)] shadow-xl shadow-black/5 backdrop-blur-sm"
                                        )}>
                                            <div className="prose dark:prose-invert prose-sm max-w-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-white/10 prose-headings:text-zinc-100 prose-strong:text-zinc-100">
                                                <ReactMarkdown
                                                    components={{
                                                        code: ({ className, children, ...props }: any) => {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            const codeContent = String(children).replace(/\n$/, '');
                                                            
                                                            if (match) {
                                                                return (
                                                                    <div className="relative group">
                                                                        <button
                                                                            onClick={() => handleCopyCode(codeContent)}
                                                                            className="absolute top-2 right-2 p-2 rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                                                            title="코드 복사"
                                                                        >
                                                                            {copiedCode === codeContent ? (
                                                                                <Check size={14} className="text-green-400" />
                                                                            ) : (
                                                                                <Copy size={14} />
                                                                            )}
                                                                        </button>
                                                                        <pre className={className} {...props}>
                                                                            <code className={className}>{children}</code>
                                                                        </pre>
                                                                    </div>
                                                                );
                                                            }
                                                            
                                                            return <code className={className} {...props}>{children}</code>;
                                                        }
                                                    }}
                                                >
                                                    {m.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {loading && thoughts.length > 0 && (
                                <div className="border-l-2 border-[var(--accent)]/30 ml-4 pl-6 py-2 space-y-4">
                                    <button
                                        onClick={() => setShowThoughts(!showThoughts)}
                                        className="flex items-center gap-2 text-[11px] font-semibold text-[var(--accent)] hover:brightness-125 transition-all px-3 py-2 rounded-lg hover:bg-[var(--accent)]/10"
                                    >
                                        {showThoughts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        {showThoughts ? 'AI 생각 과정 숨기기' : 'Thinking...'}
                                    </button>

                                    <AnimatePresence>
                                        {showThoughts && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden space-y-3"
                                            >
                                                {thoughts.map((t) => (
                                                    <div key={t.id} className="relative flex items-start gap-3">
                                                        <div className="mt-1">
                                                            {t.status === 'running' ? (
                                                                <div className="w-4 h-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                                                            ) : (
                                                                getThoughtIcon(t.type)
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className={clsx(
                                                                "text-[12px] font-medium",
                                                                t.status === 'running' ? "text-[var(--fg-primary)]" : "text-[var(--fg-tertiary)]"
                                                            )}>
                                                                {t.message}
                                                            </p>
                                                            {t.result && (
                                                                <p className="text-[11px] text-[var(--fg-tertiary)] mt-0.5 line-clamp-1 italic">
                                                                    {t.result}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )) : activeTab === 'summary' ? (
                        <div className="space-y-6">
                            {generatingSummary ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                    <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
                                    <p className="text-sm text-[var(--fg-tertiary)] animate-pulse">Generating academic synthesis...</p>
                                </div>
                            ) : summary ? (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
                                    <section className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Sparkles size={48} className="text-blue-500" />
                                        </div>
                                        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Sparkles size={12} /> 3-Line Synthesis
                                        </h4>
                                        <p className="text-sm leading-relaxed text-[var(--fg-primary)] font-medium whitespace-pre-wrap">
                                            {summary.takeaway}
                                        </p>
                                    </section>

                                    <div className="space-y-4 px-1">
                                        {[
                                            { label: 'OBJECTIVE', content: summary.objective, icon: Search },
                                            { label: 'METHODOLOGY', content: summary.methodology, icon: Microscope },
                                            { label: 'KEY RESULTS', content: summary.results, icon: Layers },
                                            { label: 'LIMITATIONS', content: summary.limitations, icon: ShieldAlert }
                                        ].map(item => item.content && (
                                            <div key={item.label} className="space-y-1.5">
                                                <h5 className="text-[9px] font-black text-[var(--fg-tertiary)] uppercase tracking-tighter flex items-center gap-2">
                                                    <item.icon size={10} /> {item.label}
                                                </h5>
                                                <p className="text-[13px] leading-relaxed text-[var(--fg-secondary)] whitespace-pre-wrap">
                                                    {item.content}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <p className="text-sm text-[var(--fg-tertiary)] mb-4">No summary generated yet.</p>
                                    <button onClick={fetchSummary} className="px-6 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-full shadow-lg">
                                        GENERATE SUMMARY
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                    <div className="space-y-6 pb-20">
                        <section className="px-1">
                            <h4 className="text-[10px] font-bold text-[var(--fg-tertiary)] uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Database size={12} /> Document Insights & Marks
                            </h4>

                            {annotations.length === 0 ? (
                                <div className="py-20 text-center opacity-30">
                                    <Layers size={32} className="mx-auto mb-3" />
                                    <p className="text-xs uppercase tracking-tighter">No annotations yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {annotations.map(a => (
                                        <div
                                            key={a.id}
                                            className="p-3 bg-zinc-900 border border-[var(--border)] rounded-xl group cursor-pointer hover:border-[var(--accent)]/50 transition-all"
                                            onClick={() => {
                                                const el = document.getElementById(`para-${a.target.paragraphId}`);
                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span
                                                    className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter"
                                                    style={{ backgroundColor: `${a.color || '#3b82f6'}33`, color: a.color || '#3b82f6' }}
                                                >
                                                    {a.type}
                                                </span>
                                                <span className="text-[8px] text-[var(--fg-tertiary)] font-mono">
                                                    {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-[12px] text-[var(--fg-primary)] line-clamp-2 leading-tight italic opacity-80 mb-2">
                                                "{a.target.selectedText}"
                                            </p>
                                            {a.content && (
                                                <div className="p-2 bg-black/20 rounded-lg text-[11px] text-[var(--fg-secondary)] border-l-2 border-[var(--accent)]">
                                                    {a.content}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>

            {activeTab === 'chat' && (
                <div className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border)]">
                    <div className="relative flex items-center gap-2">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask the Research Agent..."
                            className="w-full bg-[var(--bg-element)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 min-h-[50px] max-h-[150px] resize-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || !documentFullText || loading}
                            className="absolute right-2 p-2 bg-[var(--accent)] text-white rounded-lg hover:brightness-110 disabled:opacity-50 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                    <p className="mt-2 text-[10px] text-[var(--fg-tertiary)] text-center">
                        Agent mode uses a planner to coordinate multiple specialized steps.
                    </p>
                </div>
            )}
        </div>
    );
};
