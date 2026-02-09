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
} from 'lucide-react';
import { clsx } from 'clsx';
import { type AppSettings } from '../types/settings';

interface TopToolbarProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ 
  settings, 
  onSaveSettings
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
    colorClass = "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
            "p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 min-w-[64px]",
            active ? "bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400" : colorClass
          )}
        >
          <Icon size={18} strokeWidth={2} />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
        
        {/* Tooltip */}
        <div className="absolute top-full mt-2 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[1000] whitespace-nowrap">
          <p className="text-[11px] font-bold text-zinc-900 dark:text-white">{label}</p>
          {shortcut && <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-0.5">단축키: {shortcut}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="h-16 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 gap-2 shrink-0 z-[900]">
      {/* Group: Navigation & Views */}
      <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-4 mr-2">
        <ToolButton 
          icon={PanelLeft} 
          label="Library" 
          action="toggle-library" 
          shortcutAction="toggle-library"
        />
        <ToolButton 
          icon={Sparkles} 
          label="AI Agent" 
          action="toggle-agent" 
          shortcutAction="toggle-agent"
        />
      </div>

      {/* Group: Core Tools */}
      <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-4 mr-2">
        <ToolButton 
          icon={Highlighter} 
          label="하이라이트" 
          action="highlight" 
          shortcutAction="highlight"
          colorClass="text-yellow-500/80 hover:bg-yellow-500/10 hover:text-yellow-600 dark:hover:text-yellow-400"
        />
        <ToolButton 
          icon={MessageSquare} 
          label="설명" 
          action="ai-explain" 
          shortcutAction="ai-explain"
          colorClass="text-purple-500/80 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400"
        />
        <ToolButton 
          icon={HelpCircle} 
          label="AI 질문" 
          action="question" 
          shortcutAction="question"
          colorClass="text-blue-500/80 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
        />
        <ToolButton 
          icon={BookOpen} 
          label="요약" 
          action="ai-summarize" 
          shortcutAction="ai-summarize"
          colorClass="text-green-500/80 hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400"
        />
        <ToolButton 
          icon={Sparkles} 
          label="쉽게 풀이" 
          action="ai-simplify" 
          colorClass="text-cyan-500/80 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400"
        />
        <ToolButton 
          icon={HelpCircle} 
          label="비평" 
          action="ai-critique" 
          colorClass="text-red-500/80 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        />
      </div>

      {/* Group: Document Tools */}
      <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-4 mr-2">
        <ToolButton 
          icon={Languages} 
          label={settings.isKoreanPrimary ? "한글 모드" : "영문 모드"} 
          action="toggle-translation" 
          shortcutAction="toggle-translation"
        />
        <ToolButton 
          icon={Search} 
          label="검색" 
          action="document-search" 
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
          label="Settings" 
          action="open-settings" 
          shortcutAction="toggle-settings"
        />
      </div>
    </div>
  );
};

