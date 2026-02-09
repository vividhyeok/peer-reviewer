import React, { useState } from 'react';
import { X, Download, FileText, Zap, Sparkles, Loader2, Check } from 'lucide-react';
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
}

export const SmartExportModal: React.FC<SmartExportModalProps> = ({
    isOpen,
    onClose,
    paragraphs,
    annotations,
    settings,
    title
}) => {
    const [exportType, setExportType] = useState<ExportOptions['type']>('insight-driven');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const handleExport = async () => {
        const modelId = settings.modelAssignments.summarize || 'deepseek-chat';
        const modelInfo = AI_MODELS.find(m => m.id === modelId) || AI_MODELS[0];

        if (!settings.apiKeys[modelInfo.provider]) {
            toast.error("먼저 설정에서 API 키를 입력해주세요");
            return;
        }

        setLoading(true);
        try {
            const client = new MultiAIClient(settings.apiKeys);
            const summary = await SmartExporter.generateSummary(
                client,
                { provider: modelInfo.provider, modelId: modelInfo.id },
                paragraphs,
                annotations,
                { type: exportType, format: 'markdown' }
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
        a.download = `${title.replace(/\s+/g, '_')}_summary.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("마크다운 파일 다운로드 완료");
    };

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
                className="relative z-10 bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <Download size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-50">스마트 내보내기 (Smart Export)</h3>
                            <p className="text-xs text-zinc-500">AI 분석 보고서 생성</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {!result ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setExportType('quick-scan')}
                                    className={clsx(
                                        "relative flex flex-col p-4 rounded-2xl border-2 transition-all text-left group",
                                        exportType === 'quick-scan' 
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/5" 
                                            : "border-zinc-100 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-zinc-600 bg-white dark:bg-transparent"
                                    )}
                                >
                                    <Zap size={24} className={clsx("mb-3", exportType === 'quick-scan' ? "text-blue-600 dark:text-blue-500" : "text-zinc-400")} />
                                    <span className={clsx("font-bold text-sm block", exportType === 'quick-scan' ? "text-blue-700 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-300")}>빠른 요약 (Quick Scan)</span>
                                    <span className="text-[11px] text-zinc-500 mt-1">빠른 검토를 위한 일반 요약.</span>
                                    {exportType === 'quick-scan' && <Check size={16} className="absolute top-4 right-4 text-blue-500" />}
                                </button>

                                <button
                                    onClick={() => setExportType('insight-driven')}
                                    className={clsx(
                                        "relative flex flex-col p-4 rounded-2xl border-2 transition-all text-left group",
                                        exportType === 'insight-driven' 
                                            ? "border-purple-500 bg-purple-50 dark:bg-purple-500/5" 
                                            : "border-zinc-100 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-zinc-600 bg-white dark:bg-transparent"
                                    )}
                                >
                                    <Sparkles size={24} className={clsx("mb-3", exportType === 'insight-driven' ? "text-purple-600 dark:text-purple-500" : "text-zinc-400")} />
                                    <span className={clsx("font-bold text-sm block", exportType === 'insight-driven' ? "text-purple-700 dark:text-purple-400" : "text-zinc-700 dark:text-zinc-300")}>인사이트 종합 (Insight)</span>
                                    <span className="text-[11px] text-zinc-500 mt-1">내 메모와 하이라이트 기반 맞춤형 분석.</span>
                                    {exportType === 'insight-driven' && <Check size={16} className="absolute top-4 right-4 text-purple-500" />}
                                </button>
                            </div>

                            <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText size={14} className="text-zinc-500" />
                                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">문서 통계 (Analytics)</span>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{paragraphs.length}</span>
                                        <span className="text-[10px] text-zinc-500 uppercase">문단 수</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{annotations.length}</span>
                                        <span className="text-[10px] text-zinc-500 uppercase">메모/하이라이트</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleExport}
                                disabled={loading}
                                className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={18} />}
                                AI 분석 보고서 생성
                            </button>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="max-h-[300px] overflow-y-auto p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] leading-relaxed">
                                <p className="opacity-60 mb-2">--- 미리보기 ---</p>
                                {result}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => downloadFile(result)}
                                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                                >
                                    <Download size={18} /> .md 다운로드
                                </button>
                                <button
                                    onClick={() => setResult(null)}
                                    className="px-6 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold"
                                >
                                    뒤로
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
