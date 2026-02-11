import React, { useMemo, useState, useEffect } from 'react';
import type { AppSettings, AIProvider, AIFeature } from '../types/settings';
import { AI_MODELS, DEFAULT_SETTINGS } from '../types/settings';
import { X, Keyboard, Zap, Save, Key, RotateCcw, ChevronRight, FolderOpen, HardDrive, Database, MessageSquareText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { LocalStorageManager } from '../core/LocalStorageManager';

interface AdvancedSettingsProps {
  isOpen: boolean;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
  storageManager?: LocalStorageManager;
  onSyncLibrary?: () => void;
}

type TabId = 'api' | 'models' | 'shortcuts' | 'reader' | 'storage';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'api', label: 'API 키', icon: <Key size={16} /> },
  { id: 'models', label: '모델 설정', icon: <Zap size={16} /> },
  { id: 'shortcuts', label: '단축키', icon: <Keyboard size={16} /> },
  { id: 'reader', label: '리더 설정', icon: <Save size={16} /> },
  { id: 'storage', label: '저장소', icon: <Database size={16} /> },
];

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  isOpen,
  settings,
  onSave,
  onClose,
  storageManager: propStorageManager,
  onSyncLibrary,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('api');
  const [editingShortcut, setEditingShortcut] = useState<number | null>(null);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  
  // Storage Manager State
  const [internalStorageManager] = useState(() => new LocalStorageManager());
  const storageManager = propStorageManager || internalStorageManager;

  const [storageInfo, setStorageInfo] = useState<string>('브라우저 저장소 (localStorage)');
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    // 저장소 상태 복원
    const initStorage = async () => {
      // Prop으로 전달된 경우 이미 핸들 복원이 시도되었을 수 있음.
      // 여기서는 정보만 업데이트
      if (storageManager.getStorageInfo) {
        setStorageInfo(storageManager.getStorageInfo());
      }
    };
    initStorage();
  }, [storageManager, isOpen]);

  const duplicateShortcuts = useMemo(() => {
    const byKey = new Map<string, string[]>();
    for (const shortcut of settings.shortcuts) {
      const key = shortcut.keys.trim().toLowerCase();
      if (!key) continue;
      const current = byKey.get(key) ?? [];
      current.push(shortcut.description);
      byKey.set(key, current);
    }
    return Array.from(byKey.entries()).filter(([, values]) => values.length > 1);
  }, [settings.shortcuts]);

  if (!isOpen) return null;

  // Immediate Save Helpers
  const updateSettings = (newSettings: AppSettings) => {
    onSave(newSettings);
  };

  const updateApiKey = (provider: AIProvider, key: string) => {
    updateSettings({
      ...settings,
      apiKeys: { ...settings.apiKeys, [provider]: key },
    });
  };

  const updateModelAssignment = (feature: AIFeature, modelId: string) => {
    updateSettings({
      ...settings,
      modelAssignments: { ...settings.modelAssignments, [feature]: modelId },
    });
  };

  const updateShortcut = (index: number, keys: string) => {
    const newShortcuts = [...settings.shortcuts];
    newShortcuts[index] = { ...newShortcuts[index], keys };
    updateSettings({ ...settings, shortcuts: newShortcuts });
    setShortcutError(null);
  };

  const handleShortcutKeyPress = (e: React.KeyboardEvent, index: number) => {
    e.preventDefault();
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
      parts.push(e.key === ' ' ? 'Space' : e.key);
    }
    if (parts.length > 1 || (parts.length === 1 && !['Control', 'Shift', 'Alt'].includes(parts[0]))) {
      updateShortcut(index, parts.join('+'));
      setEditingShortcut(null);
    }
  };

  const updateHighlightColor = (index: number, color: string) => {
    const colors = [...settings.highlightColors];
    colors[index] = color;
    updateSettings({ ...settings, highlightColors: colors });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative z-10 bg-white dark:bg-zinc-950 rounded-xl shadow-2xl shadow-black/20 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800"
          >
            <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">설정</h2>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">API 키, 모델, 단축키 설정</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex gap-1 px-6">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      "relative flex items-center gap-2 px-3 py-2 text-[12px] font-medium transition-all border-b-2",
                      activeTab === tab.id
                        ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                        : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-zinc-950">
              {activeTab === 'api' && (
                <div className="space-y-5">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    API 키는 로컬 저장소에만 저장됩니다.
                  </p>

                  {([
                    { provider: 'deepseek' as AIProvider, name: 'DeepSeek', tag: '가성비 최적(Cost-efficient)', placeholder: 'sk-...', url: 'https://platform.deepseek.com', urlLabel: 'platform.deepseek.com' },
                    { provider: 'gemini' as AIProvider, name: 'Google Gemini', tag: '수식 처리에 강함', placeholder: 'AIza...', url: 'https://aistudio.google.com/apikey', urlLabel: 'aistudio.google.com' },
                    { provider: 'openai' as AIProvider, name: 'OpenAI', tag: 'GPT-4o 및 최신 모델', placeholder: 'sk-proj-...', url: 'https://platform.openai.com/api-keys', urlLabel: 'platform.openai.com' },
                  ] as const).map(({ provider, name, tag, placeholder, url, urlLabel }) => (
                    <div key={provider} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{name}</span>
                          <span className="ml-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{tag}</span>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {urlLabel} <ChevronRight size={10} />
                        </a>
                      </div>
                      <input
                        type="password"
                        value={settings.apiKeys[provider]}
                        onChange={(e) => updateApiKey(provider, e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3.5 py-2.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 focus:border-zinc-400 transition-all font-mono"
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'models' && (
                <div className="space-y-6">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    각 기능의 목적에 맞는 AI 모델을 할당하여 비용과 성능을 최적화하세요.
                  </p>

                  {/* 1. Quick Assistants */}
                  <div className="space-y-3">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                           <Zap size={14} /> 읽기 보조 도구 (Reading Tools)
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                            { id: 'explain', label: '단어/개념 설명', desc: '빠른 응답이 중요합니다. (Flashcard, Tooltip)' },
                            { id: 'summarize', label: '문단 요약', desc: '긴 텍스트를 처리할 수 있는 모델이 좋습니다.' }
                        ].map(feature => {
                           const currentModel = AI_MODELS.find(m => m.id === settings.modelAssignments[feature.id as AIFeature]);
                           return (
                              <div key={feature.id} className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                 <div className="flex flex-col gap-2">
                                     <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-200">{feature.label}</div>
                                            <div className="text-[11px] text-zinc-500 mt-0.5">{feature.desc}</div>
                                        </div>
                                        {currentModel && (
                                            <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded">
                                                {currentModel.contextWindow >= 100000 ? '100k+ Context' : 'Fast'}
                                            </span>
                                        )}
                                     </div>
                                     <select
                                        value={settings.modelAssignments[feature.id as AIFeature]}
                                        onChange={(e) => updateModelAssignment(feature.id as AIFeature, e.target.value)}
                                        className="w-full px-2 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                      >
                                         {AI_MODELS.map(model => {
                                            const priceKrw = model.costPer1MTokens ? Math.round(model.costPer1MTokens * 1450) : 0;
                                            return (
                                              <option key={model.id} value={model.id}>
                                                {model.name} — {model.costPer1MTokens === 0 ? '무료' : `₩${priceKrw.toLocaleString()}/1M`}
                                              </option>
                                            );
                                          })}
                                      </select>
                                 </div>
                              </div>
                           );
                        })}
                      </div>
                  </div>

                  {/* 2. Deep Thinking */}
                  <div className="space-y-3">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                           <MessageSquareText size={14} /> 심층 분석 (Deep Analysis)
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                            { id: 'chat', label: '연구 에이전트 (Chat)', desc: '복잡한 질문 해결 및 추론 능력 필요.' },
                            { id: 'discussion', label: '소크라테스 토론', desc: '논리적 비판 및 반론 생성.' }
                        ].map(feature => {
                           const currentModel = AI_MODELS.find(m => m.id === settings.modelAssignments[feature.id as AIFeature]);
                           return (
                              <div key={feature.id} className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                 <div className="flex flex-col gap-2">
                                     <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-200">{feature.label}</div>
                                            <div className="text-[11px] text-zinc-500 mt-0.5">{feature.desc}</div>
                                        </div>
                                         {currentModel && (
                                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                                Reasoning
                                            </span>
                                        )}
                                     </div>
                                     <select
                                        value={settings.modelAssignments[feature.id as AIFeature]}
                                        onChange={(e) => updateModelAssignment(feature.id as AIFeature, e.target.value)}
                                        className="w-full px-2 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                      >
                                         {AI_MODELS.map(model => {
                                            const priceKrw = model.costPer1MTokens ? Math.round(model.costPer1MTokens * 1450) : 0;
                                            return (
                                              <option key={model.id} value={model.id}>
                                                {model.name} — {model.costPer1MTokens === 0 ? '무료' : `₩${priceKrw.toLocaleString()}/1M`}
                                              </option>
                                            );
                                          })}
                                      </select>
                                 </div>
                              </div>
                           );
                        })}
                      </div>
                  </div>
                </div>
              )}

              {activeTab === 'shortcuts' && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                    단축키 배지를 클릭하여 재할당하세요.
                  </p>

                  {settings.shortcuts.map((shortcut, index) => (
                    <div
                      key={shortcut.action}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{shortcut.description}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">{shortcut.action}</p>
                      </div>
                      <div>
                        {editingShortcut === index ? (
                          <input
                            type="text"
                            value={shortcut.keys}
                            onKeyDown={(e) => handleShortcutKeyPress(e, index)}
                            onBlur={() => setEditingShortcut(null)}
                            autoFocus
                            placeholder="Press keys…"
                            className="w-36 px-3 py-1.5 text-center text-sm font-mono bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-400 dark:border-zinc-600 rounded-md outline-none text-zinc-800 dark:text-zinc-200"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingShortcut(index)}
                            className="px-3 py-1.5 text-sm font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
                          >
                            {shortcut.keys}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {duplicateShortcuts.length > 0 && (
                    <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                      중복된 키 할당이 감지되었습니다. 다른 단축키를 할당해주세요.
                    </div>
                  )}
                  {shortcutError && (
                    <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {shortcutError}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reader' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          한글 우선 보기
                        </label>
                        <p className="text-xs text-zinc-500">한글 번역을 주 텍스트로 표시합니다</p>
                      </div>
                      <button
                        onClick={() => updateSettings({ ...settings, isKoreanPrimary: !settings.isKoreanPrimary })}
                        className={clsx(
                          "w-11 h-6 rounded-full transition-colors relative",
                          settings.isKoreanPrimary ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-800"
                        )}
                      >
                        <div className={clsx(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          settings.isKoreanPrimary ? "left-6" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800" />

                    <div className="space-y-3">
                         <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    화면 배율 (UI Scale)
                                </label>
                                <p className="text-xs text-zinc-500">
                                    앱 전체 크기를 조절합니다 (현재: {Math.round((settings.uiZoom || 1) * 100)}%)
                                </p>
                            </div>
                            <button
                                onClick={() => updateSettings({ ...settings, uiZoom: 1.0 })}
                                className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            >
                                초기화
                            </button>
                         </div>
                         <div className="flex items-center gap-4">
                            <span className="text-xs font-medium w-8 text-zinc-400">50%</span>
                            <input 
                                type="range" 
                                min="0.5" 
                                max="1.5" 
                                step="0.1" 
                                value={settings.uiZoom || 1}
                                onChange={(e) => updateSettings({ ...settings, uiZoom: parseFloat(e.target.value) })}
                                className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <span className="text-xs font-medium w-8 text-right text-zinc-400">150%</span>
                         </div>
                        <p className="text-[10px] text-zinc-400 text-right">
                           * CTRL + / - 단축키로도 조절 가능
                        </p>
                    </div>

                    <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800" />
                    <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800" />

                    <div className="space-y-2.5">
                      <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        기본 번역 모드
                      </label>
                      <select
                        value={settings.defaultLanguage}
                        onChange={(event) =>
                          updateSettings({
                            ...settings,
                            defaultLanguage: event.target.value as 'en' | 'ko',
                          })
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="en">영어 원문 우선 (English Original Primary)</option>
                        <option value="ko">한글 번역 우선 (Korean Translation Primary)</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-2.5">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      하이라이트 색상 (Highlight palette)
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {settings.highlightColors.map((color, index) => (
                        <label key={`${color}-${index}`} className="flex flex-col gap-1">
                          <span className="text-[11px] text-zinc-500">Color {index + 1}</span>
                          <input
                            type="color"
                            value={color}
                            onChange={(event) => updateHighlightColor(index, event.target.value)}
                            className="w-full h-8 border border-zinc-200 dark:border-zinc-700 rounded cursor-pointer bg-transparent"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-2.5">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      자동 저장 간격 (Autosave interval {settings.autoSaveInterval}s)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={5}
                      value={settings.autoSaveInterval}
                      onChange={(event) =>
                        updateSettings({
                          ...settings,
                          autoSaveInterval: Number(event.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              )}
              {activeTab === 'storage' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <HardDrive size={18} className="text-blue-500" />
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          저장 위치 정보 (Storage Status)
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        현재 활성화된 저장소 모드 상태입니다.
                      </p>
                    </div>

                    <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800" />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          연결 상태
                        </span>
                        <div className="flex items-center gap-2">
                           {storageManager.isDevServer ? (
                               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                  Dev Server Connected
                               </span>
                           ) : (
                               <span className="text-xs text-zinc-500 font-mono">{storageInfo}</span>
                           )}
                        </div>
                      </div>

                      {storageManager.isDevServer ? (
                          <div className="p-3 bg-zinc-100 dark:bg-zinc-950 rounded text-xs text-zinc-500 dark:text-zinc-400 break-all border border-zinc-200 dark:border-zinc-800">
                             프로젝트 내부 <code>paper-reader-data</code> 폴더에 자동 저장됩니다.
                          </div>
                      ) : (
                        /* Only show folder picker if NOT in dev server mode */
                        <>
                          {storageManager.isTauri ? (
                             <div className="space-y-2 py-2">
                                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                  데이터 루트 폴더 (Root Folder Path)
                                </label>
                                <div className="space-y-1">
                                    <input
                                      type="text"
                                      value={settings.dataRootPath || 'paper-reader-data'}
                                      onChange={(e) => updateSettings({ ...settings, dataRootPath: e.target.value })}
                                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                                      placeholder="paper-reader-data"
                                    />
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                      * 절대 경로(예: <code>D:\Research</code>) 또는 문서 폴더 내 상대 경로를 입력하세요.<br/>
                                      * 변경 사항은 앱을 재시작하거나 재로딩할 때 적용됩니다.
                                    </p>
                                </div>
                             </div>
                          ) : (
                              /* Browser Local File Handle (Legacy/Web) */
                              <button
                                onClick={async () => {
                                  // Update logic for new requestDirectory signature (returns string | null)
                                  const path = await storageManager.requestDirectory();
                                  if (path) {
                                    setStorageInfo(storageManager.getStorageInfo());
                                    if (onSyncLibrary) {
                                        onSyncLibrary();
                                    }
                                    alert('로컬 폴더가 설정되었습니다!');
                                  }
                                }}
                                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                              >
                                <FolderOpen size={16} />
                                로컬 폴더 선택 (Browser Native)
                              </button>
                          )}
                        </>
                      )}

                      {!storageManager.isDevServer && (
                         <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800" />
                      )}
                      
                      {/* Cache clear button for maintenance */}
                      <button
                        onClick={async () => {
                           if(confirm("모든 캐시 데이터(AI 응답, 분석 결과 등)를 삭제하시겠습니까? 문서나 주석은 유지됩니다.")) {
                               await storageManager.clearCache();
                               alert("캐시가 초기화되었습니다.");
                           }
                        }}
                        className="w-full px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                      >
                         <Database size={16} />
                         캐시 비우기 (Clear Cache)
                      </button>

                    </div>
                  </div>
                </div>
              )}            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <button
                onClick={() => updateSettings(DEFAULT_SETTINGS)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-all"
              >
                <RotateCcw size={14} />
                초기화
              </button>
              <div className="flex gap-2.5">
                <button
                  onClick={onClose}
                  className="px-5 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-md transition-all"
                >
                  닫기 (Close)
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
