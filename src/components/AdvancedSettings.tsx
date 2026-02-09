import React, { useMemo, useState, useEffect } from 'react';
import type { AppSettings, AIProvider, AIFeature } from '../types/settings';
import { AI_MODELS, DEFAULT_SETTINGS } from '../types/settings';
import { X, Keyboard, Zap, Save, Key, RotateCcw, ChevronRight, FolderOpen, HardDrive, Database } from 'lucide-react';
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
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
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
    for (const shortcut of localSettings.shortcuts) {
      const key = shortcut.keys.trim().toLowerCase();
      if (!key) continue;
      const current = byKey.get(key) ?? [];
      current.push(shortcut.description);
      byKey.set(key, current);
    }
    return Array.from(byKey.entries()).filter(([, values]) => values.length > 1);
  }, [localSettings.shortcuts]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (duplicateShortcuts.length > 0) {
      setShortcutError('Shortcut keys must be unique.');
      setActiveTab('shortcuts');
      return;
    }

    onSave(localSettings);
    onClose();
  };

  const updateApiKey = (provider: AIProvider, key: string) => {
    setLocalSettings({
      ...localSettings,
      apiKeys: { ...localSettings.apiKeys, [provider]: key },
    });
  };

  const updateModelAssignment = (feature: AIFeature, modelId: string) => {
    setLocalSettings({
      ...localSettings,
      modelAssignments: { ...localSettings.modelAssignments, [feature]: modelId },
    });
  };

  const updateShortcut = (index: number, keys: string) => {
    const newShortcuts = [...localSettings.shortcuts];
    newShortcuts[index] = { ...newShortcuts[index], keys };
    setLocalSettings({ ...localSettings, shortcuts: newShortcuts });
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
    const colors = [...localSettings.highlightColors];
    colors[index] = color;
    setLocalSettings({ ...localSettings, highlightColors: colors });
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
            className="relative z-10 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl shadow-black/20 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800"
          >
            <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
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

            <div className="flex-1 overflow-y-auto p-6">
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
                    <div key={provider} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
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
                        value={localSettings.apiKeys[provider]}
                        onChange={(e) => updateApiKey(provider, e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3.5 py-2.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 focus:border-zinc-400 transition-all font-mono"
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'models' && (
                <div className="space-y-5">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    각 기능별 AI 모델을 선택하세요.
                  </p>

                  {(['explain', 'summarize', 'discussion', 'formula', 'table', 'chat'] as AIFeature[]).map(feature => {
                    const currentModel = AI_MODELS.find(m => m.id === localSettings.modelAssignments[feature]);
                    const featureLabels: Record<AIFeature, string> = {
                      explain: '선택 텍스트 설명',
                      summarize: '요약',
                      discussion: 'AI 토론',
                      formula: '수식/공식',
                      table: '표 해석',
                      chat: '연구 에이전트 (채팅)',
                    };
                    return (
                      <div key={feature} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2.5">
                        <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {featureLabels[feature]}
                        </label>
                        <select
                          value={localSettings.modelAssignments[feature]}
                          onChange={(e) => updateModelAssignment(feature, e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 focus:border-zinc-400 transition-all appearance-none cursor-pointer"
                        >
                          {AI_MODELS
                            .map(model => {
                            const priceKrw = model.costPer1MTokens ? Math.round(model.costPer1MTokens * 1450) : 0;
                            return (
                              <option key={model.id} value={model.id}>
                                {model.name} — {model.costPer1MTokens === 0 ? '무료' : `₩${priceKrw.toLocaleString()}/1M`}
                              </option>
                            );
                          })}
                        </select>
                        {currentModel && (
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                            컨텍스트 윈도우: {currentModel.contextWindow.toLocaleString()} tokens
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'shortcuts' && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                    단축키 배지를 클릭하여 재할당하세요.
                  </p>

                  {localSettings.shortcuts.map((shortcut, index) => (
                    <div
                      key={shortcut.action}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
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
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          한글 우선 보기
                        </label>
                        <p className="text-xs text-zinc-500">한글 번역을 주 텍스트로 표시합니다</p>
                      </div>
                      <button
                        onClick={() => setLocalSettings({ ...localSettings, isKoreanPrimary: !localSettings.isKoreanPrimary })}
                        className={clsx(
                          "w-11 h-6 rounded-full transition-colors relative",
                          localSettings.isKoreanPrimary ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-800"
                        )}
                      >
                        <div className={clsx(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          localSettings.isKoreanPrimary ? "left-6" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800" />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          앱 테마 (App Theme)
                        </label>
                        <p className="text-xs text-zinc-500">라이트/다크 모드 전환</p>
                      </div>
                      <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                        <button
                          onClick={() => setLocalSettings({ ...localSettings, theme: 'light' })}
                          className={clsx(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            localSettings.theme === 'light' ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                          )}
                        >
                          Light
                        </button>
                        <button
                          onClick={() => setLocalSettings({ ...localSettings, theme: 'dark' })}
                          className={clsx(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            localSettings.theme === 'dark' ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                          )}
                        >
                          Dark
                        </button>
                      </div>
                    </div>

                    <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800" />

                    <div className="space-y-2.5">
                      <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        기본 번역 모드
                      </label>
                      <select
                        value={localSettings.defaultLanguage}
                        onChange={(event) =>
                          setLocalSettings({
                            ...localSettings,
                            defaultLanguage: event.target.value as 'en' | 'ko',
                          })
                        }
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="en">영어 원문 우선 (English Original Primary)</option>
                        <option value="ko">한글 번역 우선 (Korean Translation Primary)</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2.5">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      하이라이트 색상 (Highlight palette)
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {localSettings.highlightColors.map((color, index) => (
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

                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2.5">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      자동 저장 간격 (Autosave interval {localSettings.autoSaveInterval}s)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={5}
                      value={localSettings.autoSaveInterval}
                      onChange={(event) =>
                        setLocalSettings({
                          ...localSettings,
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
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <HardDrive size={18} className="text-blue-500" />
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          저장 위치 설정
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        기본적으로 브라우저 저장소를 사용합니다. 로컬 폴더를 지정하면 브라우저 캐시/쿠키 삭제와 무관하게 데이터가 유지됩니다.
                      </p>
                    </div>

                    <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800" />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          현재 저장 위치
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                          {storageInfo}
                        </span>
                      </div>

                      <button
                        onClick={async () => {
                          const success = await storageManager.requestDirectory();
                          if (success) {
                            setStorageInfo(storageManager.getStorageInfo());
                            if (onSyncLibrary) {
                                onSyncLibrary();
                            }
                            alert('로컬 폴더가 설정되었습니다!\\n\\n이제부터 모든 데이터는 선택한 폴더에 저장됩니다.\\n폴더 내의 HTML 파일들이 라이브러리에 추가됩니다.');
                          }
                        }}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <FolderOpen size={16} />
                        로컬 폴더 선택
                      </button>

                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        ⚠️ Chrome, Edge 브라우저에서만 지원됩니다. 폴더 선택 후 브라우저를 재시작해도 설정이 유지됩니다.
                      </p>
                    </div>

                    <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800" />

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Database size={18} className="text-purple-500" />
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          데이터 마이그레이션
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        브라우저 저장소의 기존 데이터를 로컬 폴더로 복사합니다.
                      </p>

                      <button
                        onClick={async () => {
                          if (!storageManager.isUsingFileSystem()) {
                            alert('먼저 로컬 폴더를 선택하세요.');
                            return;
                          }

                          if (!confirm('브라우저 저장소의 모든 데이터를 로컬 폴더로 복사합니다. 계속하시겠습니까?')) {
                            return;
                          }

                          setIsMigrating(true);
                          try {
                            const count = await storageManager.migrateToFileSystem();
                            alert(`✅ ${count}개 파일이 이동되었습니다!`);
                          } catch (e: any) {
                            alert(`❌ 마이그레이션 실패: ${e.message}`);
                          } finally {
                            setIsMigrating(false);
                          }
                        }}
                        disabled={isMigrating || !storageManager.isUsingFileSystem()}
                        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        {isMigrating ? '마이그레이션 중...' : '로컬 폴더로 데이터 복사'}
                      </button>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">💡 TIP</span>
                      </div>
                      <ul className="text-[11px] text-blue-700 dark:text-blue-300 space-y-1 pl-5 list-disc">
                        <li>로컬 폴더를 선택하면 문서, 주석, 설정이 모두 폴더에 저장됩니다</li>
                        <li>이미지도 별도 파일로 저장되어 메모리 절약 효과가 있습니다</li>
                        <li>브라우저를 삭제하거나 재설치해도 데이터가 유지됩니다</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <button
                onClick={() => setLocalSettings(DEFAULT_SETTINGS)}
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
                  취소(Cancel)
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-md shadow-sm transition-all active:scale-[0.98]"
                >
                  <Save size={14} />
                  설정 저장
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
