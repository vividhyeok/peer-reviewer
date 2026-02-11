import React, { useState } from 'react';
import { X, Download, FileText, Zap, Sparkles, Loader2, Check, FileDown, Edit3, Bookmark } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { SmartExporter, type ExportOptions } from '../core/SmartExporter';
import { MultiAIClient } from '../core/MultiAIClient';
import { type ParagraphData, type Annotation } from '../types/ReaderTypes';
import { type AppSettings, AI_MODELS } from '../types/settings';
import { toast } from 'sonner';

interface SmartExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    paragraphs: ParagraphData[];
    annotations: Annotation[];
    settings: AppSettings;
    title: string;
    bookmarkId?: string; // Added bookmarkId
}

export const SmartExportModal: React.FC<SmartExportModalProps> = ({
    isOpen,
    onClose,
    paragraphs,
    annotations,
    settings,
    title,
    bookmarkId
}) => {
    const [exportType, setExportType] = useState<ExportOptions['type']>('obsidian-structured');
    const [scope, setScope] = useState<ExportOptions['scope']>('all');
    const [customPrompt, setCustomPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const handleExport = async () => {
        // AI가 필요한 옵션인지 체크
        const needsAI = exportType !== 'raw-dump';
        
        const modelId = settings.modelAssignments.summarize || 'deepseek-chat';
        const modelInfo = AI_MODELS.find(m => m.id === modelId) || AI_MODELS[0];

        if (needsAI && !settings.apiKeys[modelInfo.provider]) {
            toast.error("먼저 설정에서 AI API 키를 입력해주세요 (Raw 데이터 제외)");
            return;
        }

        setLoading(true);
        try {
            const client = new MultiAIClient(settings.apiKeys);
            // 북마크 ID 찾기 (scope가 until-bookmark일 때 사용)
            // 실제 구현에서는 activeFile의 bookmarkParagraphId를 prop으로 받아야 하지만, 
            // 여기서는 paragraphs에서 bookmark 메타데이터가 없으므로 생략하거나, 
            // prop을 추가해야 함. 우선은 사용자 Bookmark를 로컬 스토리지에서 찾거나 prop을 통해 받아야 함.
            // (간소화를 위해 scope가 until-bookmark인 경우 마지막 하이라이트 위치 등으로 추론할 수도 있음)
            
            const summary = await SmartExporter.generateSummary(
                client,
                { provider: modelInfo.provider, modelId: modelInfo.id },
                paragraphs,
                annotations,
                { 
                    type: exportType, 
                    format: 'markdown', 
                    scope,
                    bookmarkId, // Pass the bookmark ID
                    customPrompt 
                }
            );
            setResult(summary);
            toast.success("생성 완료");
        } catch (e) {
            console.error(e);
            toast.error("생성 실패");
        } finally {
            setLoading(false);
        }
    };

    const downloadFile = (content: string) => {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_')}_export.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("파일 다운로드 완료");
    };

    const copyToClipboard = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            toast.success("클립보드에 복사되었습니다 (Obsidian에 붙여넣기 하세요)");
        } catch (err) {
            toast.error("복사 실패");
        }
    };

    const CardOption = ({ id, icon: Icon, label, desc, colorClass }: any) => (
        <button
            onClick={() => setExportType(id)}
            className={clsx(
                "relative flex flex-col p-4 rounded-2xl border-2 transition-all text-left h-full",
                exportType === id
                    ? `border-${colorClass}-500 bg-${colorClass}-50`
                    : "border-zinc-100 hover:border-zinc-300 bg-white"
            )}
        >
            <Icon size={24} className={clsx("mb-2", exportType === id ? `text-${colorClass}-600` : "text-zinc-400")} />
            <span className={clsx("font-bold text-sm block", exportType === id ? "text-zinc-900" : "text-zinc-600")}>{label}</span>
            <span className="text-[11px] text-zinc-500 mt-1 leading-snug">{desc}</span>
            {exportType === id && <Check size={16} className={`absolute top-4 right-4 text-${colorClass}-500`} />}
        </button>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-zinc-200 max-h-[90vh] flex flex-col"
            >
                {/* Header */}
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shadow-lg">
                            <Download size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-zinc-900">내보내기 (Export)</h3>
                            <p className="text-xs text-zinc-500">Obsidian 및 마크다운 호환 형식</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {!result ? (
                        <div className="space-y-6">
                            {/* Scope Selector */}
                            <div className="flex p-1 bg-zinc-100 rounded-xl">
                                {[
                                    { id: 'all', label: '전체 문서' },
                                    { id: 'highlights-only', label: '하이라이트만' },
                                    { id: 'until-bookmark', label: '북마크까지 (읽은 곳)' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setScope(opt.id as any)}
                                        disabled={opt.id === 'until-bookmark' && !bookmarkId}
                                        className={clsx(
                                            "flex-1 py-2 text-xs font-medium rounded-lg transition-all",
                                            scope === opt.id
                                                ? "bg-white text-zinc-900 shadow-sm"
                                                : "text-zinc-500 hover:text-zinc-700",
                                            (opt.id === 'until-bookmark' && !bookmarkId) && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* Type Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <CardOption 
                                    id="obsidian-structured" 
                                    icon={FileDown} 
                                    label="Obsidian 노트" 
                                    desc="Callout, 태그, 메타데이터가 포함된 구조화된 노트." 
                                    colorClass="purple"
                                />
                                <CardOption 
                                    id="insight-driven" 
                                    icon={Sparkles} 
                                    label="인사이트 리포트" 
                                    desc="내 메모를 중심으로 AI가 작성하는 종합 분석." 
                                    colorClass="blue"
                                />
                                <CardOption 
                                    id="raw-dump" 
                                    icon={FileText} 
                                    label="Raw 데이터" 
                                    desc="AI 없이 내가 표시한 부분만 원본 그대로 추출." 
                                    colorClass="zinc"
                                />
                                <CardOption 
                                    id="quick-scan" 
                                    icon={Zap} 
                                    label="3줄 요약" 
                                    desc="논문의 핵심만 빠르게 요약." 
                                    colorClass="yellow"
                                />
                                <CardOption 
                                    id="custom-prompt" 
                                    icon={Edit3} 
                                    label="커스텀" 
                                    desc="직접 프롬프트를 입력하여 생성." 
                                    colorClass="pink"
                                />
                            </div>

                            {/* Custom Prompt Input */}
                            {exportType === 'custom-prompt' && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">프롬프트 입력</label>
                                    <textarea 
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="예: 이 논문의 한계점 위주로 정리해줘..."
                                        className="w-full h-24 p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                                    />
                                </div>
                            )}

                            {/* Analytics */}
                            <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                                <span className="text-xs text-zinc-500">내보낼 항목:</span>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-xs font-medium text-zinc-600">{paragraphs.length} 문단</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                        <span className="text-xs font-medium text-zinc-600">{annotations.length} 하이라이트</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="flex-1 overflow-y-auto p-4 bg-zinc-50 rounded-2xl border border-zinc-200 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
                                {result}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-100 bg-white/50 backdrop-blur-xl rounded-b-3xl">
                    {!result ? (
                        <button
                            onClick={handleExport}
                            disabled={loading || (exportType === 'custom-prompt' && !customPrompt.trim())}
                            className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zinc-500/10"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : (exportType === 'raw-dump' ? <FileText size={18}/> : <Sparkles size={18} />)}
                            {exportType === 'raw-dump' ? '추출하기' : 'AI 생성하기'}
                        </button>
                    ) : (
                        <div className="flex gap-3">
                             <button
                                onClick={() => copyToClipboard(result)}
                                className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <FileText size={18} /> 복사 (Copy)
                            </button>
                            <button
                                onClick={() => downloadFile(result)}
                                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
                            >
                                <Download size={18} /> 저장 (.md)
                            </button>
                            <button
                                onClick={() => setResult(null)}
                                className="px-5 py-3.5 bg-transparent hover:bg-zinc-100 text-zinc-500 rounded-xl font-bold transition-colors"
                            >
                                뒤로
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

