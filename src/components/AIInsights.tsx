
import * as React from 'react';
import { useState } from 'react';
import { Sparkles, RefreshCw, Zap, BookOpenText } from 'lucide-react';
import { MultiAIClient } from '../core/MultiAIClient';
import { type AppSettings, AI_MODELS } from '../types/settings';
import { toast } from 'sonner';

interface AIInsightsProps {
    settings: AppSettings;
    documentFullText?: string;
    onOpenSettings: () => void;
}

export const AIInsights: React.FC<AIInsightsProps> = ({ settings, documentFullText, onOpenSettings }) => {
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const generateAnalysis = async () => {
        if (!documentFullText) return;

        const modelId = settings.modelAssignments.discussion; // Use discussion or summarize model
        const modelInfo = AI_MODELS.find(m => m.id === modelId);

        if (!modelInfo || !settings.apiKeys[modelInfo.provider]) {
            toast.error("Configure AI API key first");
            onOpenSettings();
            return;
        }

        setLoading(true);
        try {
            const client = new MultiAIClient(settings.apiKeys);
            // Limit text to first ~15k chars to avoid huge context costs for simple digest
            const sample = documentFullText.slice(0, 15000);

            const prompt = `Analyze this academic paper text and provide a structured briefing:
            1. **Core Problem**: What is the paper trying to solve?
            2. **Methodology**: Key approach/algorithm.
            3. **Results**: Main findings.
            4. **Critical Takeaway**: Why this matters.
            
            Keep it concise.
            
            Text sample:
            ${sample}...`;

            const messages = [
                { role: 'system' as const, content: "You are a research assistant. Provide high-level insights." },
                { role: 'user' as const, content: prompt }
            ];

            const response = await client.sendMessage(modelInfo.provider, modelId, messages);
            setAnalysis(response.content);
        } catch (e) {
            console.error(e);
            toast.error("Analysis failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-transparent text-[var(--fg-primary)]">
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[var(--accent)]" />
                    <span className="font-semibold text-xs uppercase tracking-wider text-[var(--fg-secondary)]">AI Insights</span>
                </div>
                {documentFullText && !loading && (
                    <button onClick={generateAnalysis} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]" title="Regenerate">
                        <RefreshCw size={14} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
                {!documentFullText ? (
                    <div className="flex flex-col items-center justify-center h-64 text-[var(--fg-tertiary)] opacity-60">
                        <BookOpenText size={48} strokeWidth={1} className="mb-4" />
                        <p className="text-sm font-medium">Select a document</p>
                    </div>
                ) : !analysis ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <p className="text-sm text-[var(--fg-secondary)] mb-6 text-center max-w-[200px]">
                            Generate a briefing using your active AI model.
                        </p>
                        <button
                            onClick={generateAnalysis}
                            disabled={loading}
                            className="group relative px-6 py-2.5 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                        >
                            <span className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            {loading ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} fill="white" />}
                            <span>Generate Briefing</span>
                        </button>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="prose prose-sm prose-invert max-w-none">
                            <div className="text-[10px] uppercase tracking-widest text-[var(--fg-tertiary)] mb-4 pb-2 border-b border-[var(--border)]">
                                Intelligence Briefing
                            </div>
                            <div className="markdown-body text-sm leading-relaxed text-zinc-300 font-sans">
                                {analysis.split('\n').map((line, i) => (
                                    <p key={i} className="mb-2">{line}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
