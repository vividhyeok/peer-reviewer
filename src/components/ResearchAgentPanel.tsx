import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, Loader2, ChevronDown, ChevronUp, Search, Database, UserCheck, Microscope, Layers, ShieldAlert, Lightbulb, MessageSquareText, BookOpen, Copy, Check, RotateCw, Save } from 'lucide-react';
import { MultiAIClient } from '../core/MultiAIClient';
import { type AppSettings, AI_MODELS } from '../types/settings';
import { type AgentThought, type AIMessage, type PaperSummary, type Annotation } from '../types/ReaderTypes';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import parse from 'html-react-parser';

import { LocalStorageManager } from '../core/LocalStorageManager';

interface ResearchAgentPanelProps {
    settings: AppSettings;
    documentFullText?: string;
    onOpenSettings: () => void;
    annotations: Annotation[];
    initialQuery?: string;
    storageManager: LocalStorageManager;
    fileId?: string;
    onSaveNote?: (note: Annotation) => void;
}

// Utility for hashing
function simpleHash(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

export const ResearchAgentPanel: React.FC<ResearchAgentPanelProps> = ({ settings, documentFullText, onOpenSettings, annotations, initialQuery, storageManager, fileId, onSaveNote }) => {
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
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [useExternalKnowledge, setUseExternalKnowledge] = useState(false);

    // Listen for Save Trigger from Parent Sidebar
    useEffect(() => {
        const handleSaveTrigger = () => {
            if (activeTab === 'chat' && messages.length > 0) {
                 // Propagate up to App via property if available, or just use context?
                 // Since onSaveSession is not passed directly here yet... 
                 // Wait, App passed onSaveCurrentSession to Sidebar, but Sidebar renders this Panel.
                 // We need to pass the messages OUT.
                 // We'll dispatch an event back or use a prop if we update Sidebar prop passing.
                 // Actually, simpler: Dispatch 'save-session-data' with messages
                 window.dispatchEvent(new CustomEvent('save-session-data', { detail: { messages } }));
            }
        };
        window.addEventListener('trigger-save-session', handleSaveTrigger);

        const handleLoadSession = (e: any) => {
            if (e.detail?.messages) {
                setMessages(e.detail.messages);
                setActiveTab('chat');
                toast.success("Loaded conversation");
            }
        };
        window.addEventListener('load-chat-session', handleLoadSession);

        return () => {
            window.removeEventListener('trigger-save-session', handleSaveTrigger);
            window.removeEventListener('load-chat-session', handleLoadSession);
        };
    }, [messages, activeTab]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const aiClientRef = useRef<MultiAIClient>(new MultiAIClient(settings.apiKeys));
    const docKeyRef = useRef<string>('');

    // --- Persistence Logic ---
    useEffect(() => {
        // 1. Reset State immediately on file switch to prevent data leakage
        setMessages([]);
        setThoughts([]);
        setSummary(null);
        setSuggestedQuestions([]);
        setActiveTab('chat');
        
        // Prepare key: prefer fileId, fallback to hash of text
        let key = '';
        if (fileId) {
            key = fileId;
        } else if (documentFullText) {
            key = simpleHash(documentFullText.slice(0, 5000));
        } else {
            return; // No identity
        }
        
        docKeyRef.current = key;
        
        const loadCache = async () => {
             // 1. Load Suggestion Questions
            const cachedQuestions = await storageManager.load(`questions_${key}`);
            if (cachedQuestions) {
                try { setSuggestedQuestions(JSON.parse(cachedQuestions)); } catch(e) {}
            } else {
                // setSuggestedQuestions([]); // Already reset above
                // Only trigger generation if we have text
                if (documentFullText) loadSuggestions(key); 
            }

            // 2. Load Auto-Saved Chat History (Current Session)
            const autoSavedChat = localStorage.getItem(`autosave_chat_${key}`);
            if (autoSavedChat) {
                try {
                    const parsed = JSON.parse(autoSavedChat);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setMessages(parsed);
                    }
                } catch(e) { console.warn("Failed to load autosaved chat", e); }
            }

            // 3. Load Summary (if explicitly saved or active)
            const cachedSummary = await storageManager.load(`summary_${key}`);
            if (cachedSummary) {
                 try { setSummary(JSON.parse(cachedSummary)); } catch(e) {}
            }
        };

        loadCache();
    }, [fileId, documentFullText, storageManager]);

    // Auto-Save Chat on Change
    useEffect(() => {
        if (docKeyRef.current && messages.length > 0) {
            localStorage.setItem(`autosave_chat_${docKeyRef.current}`, JSON.stringify(messages));
        }
    }, [messages]);

    const loadSuggestions = async (key: string, force = false) => {
         // If key is not provided (legacy call), use current
         if (!key) key = docKeyRef.current;
         
         if (!documentFullText) return;
         setLoadingSuggestions(true);
         try {
             const modelId = settings.modelAssignments.chat || 'gemini-1.5-flash';
             const modelInfo = AI_MODELS.find(m => m.id === modelId);
             if (modelInfo && settings.apiKeys[modelInfo.provider]) {
                 const questions = await aiClientRef.current.suggestQuestions(
                     { provider: modelInfo.provider as any, modelId: modelInfo.id },
                     documentFullText
                 );
                 setSuggestedQuestions(questions);
                 storageManager.save(`questions_${key}`, JSON.stringify(questions));
             }
         } catch (e) {
             console.error(e);
         } finally {
             setLoadingSuggestions(false);
         }
    };


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
            } else if (query) {
                if (selection) {
                    setInput(`${query}\n\nSelected Text: "${selection}"`);
                } else {
                    setInput(query);
                }
                setActiveTab('chat');
            }

            if (autoSend) {
                setTriggerSend(Date.now());
            }
        };

        window.addEventListener('research-agent-query', handleExternalQuery);
        // @ts-ignore
        window.addEventListener('research-agent-open', handleExternalQuery);

        const handleContextChange = (e: any) => {
            // Disabled Active Context auto-tracking to prevent hallucinations
            // setActiveContext(e.detail);
        };
        window.addEventListener('research-agent-context-change', handleContextChange);

        return () => {
            window.removeEventListener('research-agent-query', handleExternalQuery);
            // @ts-ignore
            window.removeEventListener('research-agent-open', handleExternalQuery);
            window.removeEventListener('research-agent-context-change', handleContextChange);
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

    const fetchSummary = async (force = false) => {
        if (!documentFullText || generatingSummary) return;
        if (!force && summary) return;

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
            if (docKeyRef.current) {
                storageManager.save(`summary_${docKeyRef.current}`, JSON.stringify(res));
            }
            toast.success("Summary generated");
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

    const handleNewChat = () => {
        setMessages([]);
        setThoughts([]);
        setSummary(null);
        toast.info("새로운 대화가 시작되었습니다.");
    };

    const getSystemPrompt = () => {
        const isDOCMode = !useExternalKnowledge;
        let basePrompt = `You are an expert academic research assistant named "ScholarAI".
Role: Help the user understand the paper.
Language: ALWAYS respond in Korean (한국어).
Tone: Professional, academic, yet accessible.

Context Strategy:
${isDOCMode
  ? `1. Answer STRICTLY based on the provided text only. Do NOT use external knowledge.
2. When referencing the paper, ALWAYS include inline citation links using this exact format: [참조](citation:PARAGRAPH_ID)
   - The text contains markers like [[ID:xxx]] before each paragraph.
   - Use the ID from the marker closest to the information you reference.
   - Example: "이 연구에서는 transformer 모델을 제안합니다 [참조](citation:p3)"
3. Include at least one [참조] link per claim you make from the paper.
4. If the answer is not in the text, state "논문 내용에서 해당 정보를 찾을 수 없습니다."`
  : `1. You MAY freely use external knowledge to explain concepts.
2. For paper-specific claims, base them on the provided text.
3. Clearly distinguish between paper content and your general knowledge.
4. No need for [참조] citations in WEB mode.`
}

Output Rules:
- Be concise and direct.
- For [Quick Ask] queries: respond in 1-2 sentences, plain text, NO markdown formatting (no bold, no headers, no lists).
- For regular questions: use markdown as needed for clarity.

Current Context:
`;
        if (activeContext) {
            basePrompt += `\n[User is currently reading Paragraph #${activeContext.paragraphId}]\nExcerpt: "${activeContext.text}"\n`;
        }

        if (summary) {
            basePrompt += `\nPaper Summary:\n${summary.takeaway}\n`;
        }

        return basePrompt;
    };

    const handleSend = async (overrideInput?: string) => {
        const rawInput = typeof overrideInput === 'string' ? overrideInput : input;
        if (!rawInput.trim() || !documentFullText || loading) return;

        const userQuery = rawInput.trim();
        // User requested to REMOVE activeContext usage to prevent hallucinations.
        // We now only pass context if it's explicitly part of the user query (drag & drop selection).
        const userMsg: AIMessage = { 
            role: 'user', 
            content: userQuery,
            // context field removed intentionally 
        };
        
        // Optimistic update
        setMessages(prev => [...prev, userMsg]);
        if (!overrideInput) setInput('');
        setLoading(true);
        setThoughts([]);
        setShowThoughts(true);

        const modelId = settings.modelAssignments.discussion || 'deepseek-chat';
        const modelInfo = AI_MODELS.find(m => m.id === modelId);

        if (!modelInfo || !settings.apiKeys[modelInfo.provider]) {
            toast.error("Configure AI API key first");
            onOpenSettings();
            setLoading(false);
            return;
        }

        // Web Mode Optimization: Use Summary + First 30k chars instead of Deep Scan if we have a summary and external knowledge is on.
        // This speeds up "Web" queries significantly.
        let optimizedContext = documentFullText;
        if (useExternalKnowledge && summary && summary.takeaway) {
             // "Web" mode usually means user wants broad answers + quick lookup.
             // We skip the expensive "Scanner" step in MultiAIClient by tricking it or passing a smaller context?
             // Actually, MultiAIClient scans if text > 30k.
             // We can pass a "Summary Context" prepended to a smaller text chunk.
             optimizedContext = `[PRE-GENERATED SUMMARY]\n${summary.takeaway}\n\n[TEXT START]\n${documentFullText.slice(0, 15000)}`;
        }

        try {
            const finalAnswer = await aiClientRef.current.orchestrate(
                { provider: modelInfo.provider, modelId: modelInfo.id },
                userQuery,
                optimizedContext,
                (thought) => {
                    setThoughts(prev => {
                        const existing = prev.find(t => t.id === thought.id);
                        if (existing) {
                            return prev.map(t => t.id === thought.id ? thought : t);
                        }
                        return [...prev, thought];
                    });
                },
                messages, // Pass current history (excluding the new userMsg which is passed as query)
                useExternalKnowledge
            );

            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: finalAnswer,
                context: activeContext ? {
                    paragraphId: activeContext.paragraphId
                } : undefined
            }]);
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
        <div className="h-full flex flex-col bg-transparent text-zinc-900 overflow-hidden">
            <div className="p-1 px-4 flex items-center justify-between border-b border-zinc-200 bg-white/50 backdrop-blur-md">
                <div className="flex gap-4">
                    {[
                        { id: 'chat', label: '채팅', icon: MessageSquareText },
                        { id: 'summary', label: '요약', icon: BookOpen },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={clsx(
                                "py-2 px-1 text-[11px] font-bold uppercase tracking-widest transition-all relative",
                                activeTab === tab.id ? "text-blue-600" : "text-zinc-500 hover:text-zinc-800"
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
                    {/* Toggle External Knowledge */}
                    <div className="flex items-center gap-1.5 bg-zinc-100 rounded-full pl-2 pr-1 py-0.5 mr-1 border border-zinc-200">
                        <span className={clsx("text-[9px] font-bold tracking-tight", useExternalKnowledge ? "text-blue-600" : "text-zinc-400")}>
                            {useExternalKnowledge ? "WEB" : "DOC"}
                        </span>
                        <button 
                            onClick={() => setUseExternalKnowledge(!useExternalKnowledge)}
                            title={useExternalKnowledge ? "외부 지식 허용됨" : "문서 내용만 사용"}
                            className={clsx("w-6 h-3.5 rounded-full relative transition-colors shadow-inner", useExternalKnowledge ? "bg-blue-500" : "bg-zinc-300")}
                        >
                            <div className={clsx("absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all shadow-sm", useExternalKnowledge ? "left-3" : "left-0.5")} />
                        </button>
                    </div>

                    {activeTab === 'chat' && messages.length > 0 && (
                        <>
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('save-session-data', { detail: { messages } }));
                                toast.success("대화가 저장되었습니다");
                            }}
                            className="p-1.5 text-[var(--fg-tertiary)] hover:text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors"
                            title="대화 저장"
                        >
                            <Save size={14} />
                        </button>
                        <button
                            onClick={handleNewChat}
                            className="p-1.5 text-[var(--fg-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-md transition-colors"
                            title="새 대화 시작"
                        >
                            <RotateCw size={14} />
                        </button>
                        </>
                    )}
                    {loading && <Loader2 size={14} className="animate-spin text-[var(--accent)]" />}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar space-y-6">
                {!documentFullText ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--fg-tertiary)] opacity-40 px-10 text-center">
                        <Sparkles size={48} className="mb-4" strokeWidth={1} />
                        <p className="text-sm font-medium">AI 에이전트를 활성화하려면 문서를 선택하세요</p>
                    </div>
                ) : activeTab === 'chat' ? (
                    messages.length === 0 && !loading ? (
                        <div className="py-10 space-y-6">
                            {/* activeContext UI removed to prevent hallucination bias */}
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-[color:var(--ink)]">연구를 어떻게 도와드릴까요?</h3>
                                <p className="text-sm text-[color:var(--muted)]">멀티 에이전트 시스템을 사용하여 논문을 검색, 추출, 분석합니다.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-[var(--fg-tertiary)] font-bold">추천 질문</span>
                                    <button 
                                        onClick={() => loadSuggestions(docKeyRef.current, true)} 
                                        disabled={loadingSuggestions}
                                        className="text-[10px] flex items-center gap-1 text-[var(--fg-tertiary)] hover:text-[var(--accent)] px-2 py-1 rounded hover:bg-[var(--accent)]/10 disabled:opacity-50"
                                    >
                                        <RotateCw size={10} /> 재생성
                                    </button>
                                </div>
                                {loadingSuggestions ? (
                                     <div className="space-y-3 opacity-50 animate-pulse">
                                         {[1,2,3,4].map(i => (
                                             <div key={i} className="h-10 bg-zinc-200 rounded-xl" />
                                         ))}
                                     </div>
                                ) : (suggestedQuestions.length > 0 ? suggestedQuestions : [
                                    "현재 2024년 표준과 비교하여 이 연구의 차별점을 설명해줘.",
                                    "모든 성능 지표를 코드 블록 표로 추출해줘.",
                                    "저자의 입장에서, 왜 이 특정 방법론을 선택했는지 정당화해줘.",
                                    "이 알고리즘의 잠재적인 실제 응용 사례를 찾아줘."
                                ]).map(q => (
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
                                                ? "bg-zinc-800 text-white rounded-br-md" 
                                                : "bg-white text-zinc-900 border border-zinc-200 shadow-xl shadow-black/5 backdrop-blur-sm"
                                        )}>
                                            <div className="prose prose-sm max-w-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-white/10 prose-headings:text-zinc-900 prose-p:text-zinc-900">
                                                {m.content.trim().startsWith('<abbr') ? (
                                                    <div>{parse(m.content)}</div>
                                                ) : (
                                                <ReactMarkdown
                                                    components={{
                                                        a: ({ href, children, ...props }: any) => {
                                                            if (href?.startsWith('citation:')) {
                                                                const id = href.replace('citation:', '');
                                                                return (
                                                                    <button 
                                                                        onClick={(e) => { 
                                                                            e.preventDefault(); 
                                                                            // Direct DOM manipulation for jump - reusing logic
                                                                            const el = document.getElementById(`para-${id}`);
                                                                            if (el) {
                                                                                 el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                                 el.classList.add('ring-4', 'ring-blue-500/50', 'bg-blue-500/10');
                                                                                 setTimeout(() => el.classList.remove('ring-4', 'ring-blue-500/50', 'bg-blue-500/10'), 2000);
                                                                            } else {
                                                                                toast.error(`Source paragraph not found: ${id}`);
                                                                            }
                                                                        }} 
                                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold hover:bg-blue-200 transition-colors align-middle"
                                                                        title="Go to source"
                                                                    >
                                                                        <BookOpen size={10} />
                                                                        {children}
                                                                    </button>
                                                                );
                                                            }
                                                            return <a href={href} {...props} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{children}</a>;
                                                        },
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
                                                )}

                                                
                                                {m.role === 'assistant' && (
                                                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-100">
                                                        {/* 1. Regenerate */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Trigger last query again (Naive implementation)
                                                                const lastUserMsg = messages.slice(0, messages.indexOf(m)).reverse().find(msg => msg.role === 'user');
                                                                if (lastUserMsg) {
                                                                    handleSend(lastUserMsg.content); // Re-send
                                                                } else {
                                                                    toast.error("원문 질문을 찾을 수 없습니다");
                                                                }
                                                            }}
                                                            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
                                                            title="답변 재생성"
                                                        >
                                                            <RotateCw size={14} />
                                                        </button>

                                                        {/* 2. Copy */}
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigator.clipboard.writeText(m.content);
                                                                toast.success("복사되었습니다");
                                                            }}
                                                            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
                                                            title="복사"
                                                        >
                                                            <Copy size={14} />
                                                        </button>

                                                        {/* 3. Save Note */}
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Use message context if available, otherwise active selection context
                                                                const targetContext = m.context || activeContext || {
                                                                    paragraphId: 'global',
                                                                    textHash: 'global',
                                                                    startOffset: 0,
                                                                    endOffset: 0,
                                                                    selectedText: 'General Conversation'
                                                                };
                                                                
                                                                if (onSaveNote) {
                                                                    // Polymorphic access to text property
                                                                    const sourceText = 'selectedText' in targetContext 
                                                                        ? targetContext.selectedText
                                                                        : ('textSnippet' in targetContext 
                                                                            ? (targetContext as any).textSnippet 
                                                                            : (targetContext as any).text);

                                                                    onSaveNote({
                                                                        id: crypto.randomUUID(),
                                                                        type: 'ai_response',
                                                                        content: m.content,
                                                                        createdAt: Date.now(),
                                                                        target: {
                                                                            paragraphId: targetContext.paragraphId || 'global',
                                                                            textHash: 'ai',
                                                                            startOffset: 0, 
                                                                            endOffset: 0,
                                                                            selectedText: sourceText || "Saved Response" 
                                                                        }
                                                                    });
                                                                    toast.success("Saved to Notebook");
                                                                } else {
                                                                    toast.error("저장 기능이 연결되지 않았습니다.");
                                                                }
                                                            }}
                                                            className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                            title="Save Note"
                                                        >
                                                            <BookOpen size={14} />
                                                        </button>
                                                        
                                                        {m.context?.paragraphId && (
                                                            <button 
                                                                onClick={() => {
                                                                    const el = document.getElementById(`para-${m.context?.paragraphId}`);
                                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-500 text-[10px] font-bold rounded-lg hover:bg-zinc-100 transition-colors"
                                                            >
                                                                <Layers size={12} />
                                                                JUMP TO SOURCE
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
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
                                        {showThoughts ? 'AI 생각 과정 숨기기' : '생각 중...'}
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
                                    <p className="text-sm text-[var(--fg-tertiary)] animate-pulse">학술적 종합 분석 생성 중...</p>
                                </div>
                            ) : summary ? (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
                                    <div className="flex justify-end">
                                         <button 
                                            onClick={() => fetchSummary(true)} 
                                            className="text-[10px] flex items-center gap-1 text-[var(--fg-tertiary)] hover:text-[var(--accent)] px-2 py-1 rounded hover:bg-[var(--accent)]/10"
                                         >
                                             <RotateCw size={10} /> 재생성
                                         </button>
                                    </div>
                                    <section className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Sparkles size={48} className="text-blue-500" />
                                        </div>
                                        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Sparkles size={12} /> 3줄 요약
                                        </h4>
                                        <p className="text-sm leading-relaxed text-[var(--fg-primary)] font-medium whitespace-pre-wrap">
                                            {summary.takeaway}
                                        </p>
                                    </section>

                                    <div className="space-y-4 px-1">
                                        {[
                                            { label: '연구 목표', content: summary.objective, icon: Search },
                                            { label: '연구 방법론', content: summary.methodology, icon: Microscope },
                                            { label: '주요 결과', content: summary.results, icon: Layers },
                                            { label: '한계점', content: summary.limitations, icon: ShieldAlert }
                                        ].map(item => item.content && (
                                            <div key={item.label} className="space-y-1.5">
                                                <h5 className="text-[10px] font-bold text-[var(--fg-tertiary)] uppercase tracking-wide flex items-center gap-2">
                                                    <item.icon size={11} /> {item.label}
                                                </h5>
                                                <div className="text-[13px] leading-relaxed text-[var(--fg-secondary)]">
                                                    {/* Enforce clean bullet points and consistent font size */}
                                                    <ReactMarkdown 
                                                        components={{
                                                            p: ({node, ...props}) => <p className="mb-0" {...props} />,
                                                            ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1" {...props} />,
                                                            li: ({node, ...props}) => <li className="marker:text-[var(--accent)]" {...props} />,
                                                            strong: ({node, ...props}) => <span className="font-semibold text-[var(--fg-primary)]" {...props} />
                                                        }}
                                                    >
                                                        {item.content}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <p className="text-sm text-[var(--fg-tertiary)] mb-4">생성된 요약이 없습니다.</p>
                                    <button onClick={() => fetchSummary()} className="px-6 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-full shadow-lg">
                                        요약 생성
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                    <div className="space-y-6 pb-20">
                        <section className="px-1">
                            <h4 className="text-[10px] font-bold text-[var(--fg-tertiary)] uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Database size={12} /> 문서 인사이트 & 하이라이트
                            </h4>

                            {annotations.length === 0 ? (
                                <div className="py-20 text-center opacity-30">
                                    <Layers size={32} className="mx-auto mb-3" />
                                    <p className="text-xs uppercase tracking-tighter">하이라이트/메모 없음</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {annotations.map(a => (
                                        <div
                                            key={a.id}
                                            className="p-3 bg-white border border-[var(--border)] rounded-xl group cursor-pointer hover:border-[var(--accent)]/50 transition-all shadow-sm"
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
                            placeholder="연구 에이전트에게 질문하세요..."
                            className="w-full bg-[var(--bg-element)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 min-h-[50px] max-h-[150px] resize-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || !documentFullText || loading}
                            className="absolute right-2 p-2 bg-[var(--accent)] text-white rounded-lg hover:brightness-110 disabled:opacity-50 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                    <p className="mt-2 text-[10px] text-[var(--fg-tertiary)] text-center">
                        에이전트 모드는 여러 전문화된 단계를 조정하기 위해 플래너를 사용합니다.
                    </p>
                </div>
            )}
        </div>
    );
};
