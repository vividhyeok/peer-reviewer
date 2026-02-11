import * as React from 'react';
import { 
  Search, 
  Settings, 
  Highlighter, 
  HelpCircle, 
  MessageSquare, 
  Languages, 
  Download, 
  BookOpen,
  PanelLeft,
  Sparkles,
  Undo2,
  Redo2
} from 'lucide-react';
import { clsx } from 'clsx';
import { type AppSettings } from '../types/settings';

interface TopToolbarProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ 
  settings, 
  onSaveSettings,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}) => {
  const getShortcut = (action: string) => {
    return settings.shortcuts.find(s => s.action === action)?.keys || '';
  };

  const handleAction = (action: string) => {
    switch (action) {
      case 'toggle-library':
      case 'toggle-agent':
      case 'open-settings':
        window.dispatchEvent(new CustomEvent('toolbar-action', { detail: { action } }));
        break;
      case 'toggle-translation':
        const nextMode = !settings.isKoreanPrimary;
        onSaveSettings({ ...settings, isKoreanPrimary: nextMode });
        break;
      default:
        // Dispatch global event for Reader to pick up
        window.dispatchEvent(new CustomEvent('toolbar-action', { detail: { action } }));
    }
  };

  const ToolButton = ({ 
    icon: Icon, 
    label, 
    action, 
    shortcutAction,
    active = false,
    colorClass = "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
  }: { 
    icon: any, 
    label: string, 
    action: string, 
    shortcutAction?: string,
    active?: boolean,
    colorClass?: string
  }) => {
    const shortcut = getShortcut(shortcutAction || action);
    
    return (
      <div className="group relative flex flex-col items-center">
        <button
          onClick={() => handleAction(action)}
          className={clsx(
            "p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 min-w-[64px] active:scale-95 hover:-translate-y-0.5",
            active ? "bg-blue-100 text-blue-600" : colorClass
          )}
        >
          <Icon size={18} strokeWidth={2} />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
        
        {/* Tooltip */}
        <div className="absolute top-full mt-2 px-3 py-2 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[1000] whitespace-nowrap">
          <p className="text-[11px] font-bold text-zinc-100">{label}</p>
          {shortcut && <p className="text-[9px] text-zinc-400 mt-0.5 font-mono bg-white/10 px-1 rounded w-fit">{shortcut}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="h-16 bg-white border-b border-zinc-200 flex items-center px-4 gap-2 shrink-0 z-[900] w-full">
      {/* Group: Navigation & Views */}
      <div className="flex items-center gap-1 border-r border-zinc-200 pr-4 mr-2">
        <ToolButton 
          icon={PanelLeft} 
          label="서재" 
          action="toggle-library" 
          shortcutAction="toggle-library"
        />
        <ToolButton 
          icon={Sparkles} 
          label="에이전트" 
          action="toggle-agent" 
          shortcutAction="toggle-agent"
        />
      </div>

      {/* Group: History */}
      {(onUndo || onRedo) && (
        <div className="flex items-center gap-1 border-r border-zinc-200 pr-4 mr-2">
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={clsx(
                "p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 min-w-[50px] active:scale-95 group",
                !canUndo ? "opacity-30 cursor-not-allowed text-zinc-400" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <Undo2 size={18} strokeWidth={2} />
              <span className="text-[10px] font-medium">실행취소</span>
            </button>
          )}
          {onRedo && (
             <button
              onClick={onRedo}
              disabled={!canRedo}
              className={clsx(
                "p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 min-w-[50px] active:scale-95 group",
                !canRedo ? "opacity-30 cursor-not-allowed text-zinc-400" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <Redo2 size={18} strokeWidth={2} />
              <span className="text-[10px] font-medium">다시실행</span>
            </button>
          )}
        </div>
      )}

      {/* Group: Core Tools */}
      <div className="flex items-center gap-1 border-r border-zinc-200 pr-4 mr-2">
        <ToolButton 
          icon={Highlighter} 
          label="하이라이트" 
          action="highlight" 
          shortcutAction="highlight"
          colorClass="text-yellow-500/80 hover:bg-yellow-500/10 hover:text-yellow-600"
        />
        <ToolButton 
          icon={MessageSquare} 
          label="설명" 
          action="ai-explain" 
          shortcutAction="ai-explain"
          colorClass="text-purple-500/80 hover:bg-purple-500/10 hover:text-purple-600"
        />
        <ToolButton 
          icon={HelpCircle} 
          label="AI 질문" 
          action="question" 
          shortcutAction="question"
          colorClass="text-blue-500/80 hover:bg-blue-500/10 hover:text-blue-600"
        />
        <ToolButton 
          icon={BookOpen} 
          label="요약" 
          action="ai-summarize" 
          shortcutAction="ai-summarize"
          colorClass="text-green-500/80 hover:bg-green-500/10 hover:text-green-600"
        />
        <ToolButton 
          icon={Sparkles} 
          label="쉽게 풀이" 
          action="ai-simplify" 
          colorClass="text-cyan-500/80 hover:bg-cyan-500/10 hover:text-cyan-600"
        />
        <ToolButton 
          icon={HelpCircle} 
          label="비평" 
          action="ai-critique" 
          colorClass="text-red-500/80 hover:bg-red-500/10 hover:text-red-600"
        />
      </div>

      {/* Group: Document Tools */}
      <div className="flex items-center gap-1 border-r border-zinc-200 pr-4 mr-2">
        <ToolButton 
          icon={Languages} 
          label={settings.isKoreanPrimary ? "한글 모드" : "영문 모드"} 
          action="toggle-translation" 
          shortcutAction="toggle-translation"
        />
        <ToolButton 
          icon={Search} 
          label="검색" 
          action="search" 
          shortcutAction="search"
        />
        <ToolButton 
          icon={Download} 
          label="내보내기" 
          action="export" 
        />
      </div>

      <div className="flex-1" />

      {/* Group: App Tools */}
      <div className="flex items-center gap-1">
        <ToolButton 
          icon={Settings} 
          label="설정" 
          action="open-settings" 
          shortcutAction="toggle-settings"
        />
      </div>
    </div>
  );
};

