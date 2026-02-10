import { 
  Library as LibraryIcon, 
  Sparkles, 
  X, 
  List, 
  Image as ImageIcon, 
  Highlighter, 
  BookMarked,
  StickyNote
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { ExplorerPanel } from './ExplorerPanel';
import { ResearchAgentPanel } from './ResearchAgentPanel';
import { NotebookPanel } from './NotebookPanel';
import { AnnotationsPanel } from './AnnotationsPanel';
import { type LibraryItem } from '../core/LibraryManager';
import { type AppSettings } from '../types/settings';
import { type Annotation, type PaperStructure } from '../types/ReaderTypes';

import { LocalStorageManager } from '../core/LocalStorageManager';

interface SidebarProps {
  side?: 'left' | 'right';
  isOpen: boolean;
  activeTab: 'library' | 'agent' | 'toc' | 'notebook' | 'highlights';
  onTabChange: (tab: 'library' | 'agent' | 'toc' | 'notebook' | 'highlights') => void;
  onClose: () => void;
  library: LibraryItem[];
  activeFileId: string | null;
  onSelectFile: (item: LibraryItem) => void;
  onRefreshLibrary: () => void;
  onRemoveFile?: (id: string) => void;
  settings: AppSettings;
  onOpenSettings: () => void;
  currentDocText?: string;
  annotations?: Annotation[];
  structure?: PaperStructure;
  initialAgentQuery?: string;
  storageManager?: LocalStorageManager;
  onDeleteAnnotation?: (id: string) => void;
  onSaveNote?: (note: Annotation) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  side = 'left',
  isOpen,
  activeTab,
  onTabChange, 
  onClose,
  library,
  activeFileId,
  onSelectFile,
  onRefreshLibrary,
  onRemoveFile,
  settings,
  currentDocText = '',
  annotations = [],
  structure,
  onOpenSettings,
  initialAgentQuery,
  storageManager,
  onDeleteAnnotation,
  onSaveNote
}) => {
  const tabs = [
    { id: 'library' as const, icon: LibraryIcon, label: '서재', shortcut: 'Alt+1', side: 'left' },
    { id: 'toc' as const, icon: List, label: '목차', shortcut: 'Alt+2', side: 'left' },
    { id: 'highlights' as const, icon: Highlighter, label: '하이라이트', shortcut: 'Alt+3', side: 'left' },
    { id: 'agent' as const, icon: Sparkles, label: '연구 에이전트', shortcut: 'Alt+4', side: 'right' },
    { id: 'notebook' as const, icon: StickyNote, label: '노트북', shortcut: 'Alt+5', side: 'right' },
  ];

  const filteredTabs = tabs.filter(t => t.side === side);

  const scrollToParagraph = (id: string) => {
    const el = document.getElementById(`para-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ x: side === 'left' ? -450 : 450, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: side === 'left' ? -450 : 450, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={clsx(
            "w-[450px] bg-white dark:bg-zinc-950 flex shrink-0 h-full overflow-hidden shadow-2xl z-[850] relative",
            side === 'left' ? "border-r border-zinc-200 dark:border-zinc-800 flex-row" : "border-l border-zinc-200 dark:border-zinc-800 flex-row-reverse"
          )}
        >
          {/* Activity Bar (Tabs) */}
          <div className={clsx(
            "w-16 bg-gray-50 dark:bg-zinc-950 flex flex-col items-center py-6 gap-6 z-10 shrink-0",
            side === 'left' ? "border-r border-zinc-200 dark:border-zinc-900" : "border-l border-zinc-200 dark:border-zinc-900"
          )}>
            {filteredTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={clsx(
                    "p-3 rounded-2xl transition-all relative group hover:bg-[color:var(--bg-hover)]",
                    isActive ? "text-blue-500 bg-blue-500/10 shadow-inner" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                  )}
                >
                  <div className={clsx("relative", isActive && "drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]")}>
                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  </div>

                  {isActive && (
                    <motion.div 
                      layoutId={`activeTabIndicator-${side}`}
                      className={clsx(
                        "absolute top-1/2 -translate-y-1/2 w-[3px] h-8 bg-blue-500 rounded-px shadow-[0_0_10px_rgba(59,130,246,0.5)]",
                        side === 'left' ? "-left-[13px] rounded-r-full" : "-right-[13px] rounded-l-full"
                      )}
                    />
                  )}
                  
                  {/* Tooltip */}
                  <div className={clsx(
                    "absolute top-1/2 -translate-y-1/2 px-3 py-2 bg-zinc-900/90 dark:bg-zinc-100/90 backdrop-blur-md border border-white/10 dark:border-black/5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-xl translate-x-2 group-hover:translate-x-0",
                    side === 'left' ? "left-full ml-4" : "right-full mr-4"
                  )}>
                    <span className="font-bold text-zinc-100 dark:text-zinc-900">{tab.label}</span>
                    <div className="mt-1 flex items-center gap-1 opacity-70">
                       <span className="font-mono text-[10px] bg-white/20 dark:bg-black/10 px-1 rounded">{tab.shortcut}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            
            <div className="mt-auto mb-4">
              <button 
                onClick={onClose}
                className="p-3 text-zinc-500 hover:text-red-400 transition-colors"
                title="닫기"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-950 flex flex-col">
            <div className="flex-1 h-full overflow-hidden">
                {activeTab === 'library' && side === 'left' && (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Library</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <ExplorerPanel
                        items={library}
                        activeFileId={activeFileId}
                        onSelect={(item) => onSelectFile(item)}
                        onRefresh={onRefreshLibrary}
                        onRemove={onRemoveFile || (() => {})}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'toc' && side === 'left' && (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">목차 (Structure)</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                      
                      {/* TOC Section */}
                      <div>
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-3 flex items-center gap-2">
                          <List size={12} /> Table of Contents
                        </h3>
                        {structure?.toc && structure.toc.length > 0 ? (
                          <div className="space-y-1">
                            {structure.toc.map((item, idx) => (
                              <button
                                key={idx}
                                onClick={() => scrollToParagraph(item.paragraphId)}
                                className={clsx(
                                  "w-full text-left py-1 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-sm truncate",
                                  item.level === 1 ? "font-bold text-zinc-900 dark:text-zinc-200" : 
                                  item.level === 2 ? "pl-4 text-zinc-700 dark:text-zinc-300" : "pl-6 text-zinc-500 dark:text-zinc-400"
                                )}
                              >
                                {item.text}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-zinc-500 text-sm italic">No structure found</div>
                        )}
                      </div>

                      {/* Figures Section */}
                      {structure?.figures && structure.figures.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-3 flex items-center gap-2">
                             <ImageIcon size={12} /> Figures
                          </h3>
                          <div className="space-y-2">
                            {structure.figures.map((fig, idx) => (
                              <button
                                key={idx}
                                onClick={() => scrollToParagraph(fig.id)}
                                className="w-full text-left py-2 px-3 rounded bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-xs border border-zinc-200 dark:border-zinc-900"
                              >
                                <div className="font-medium text-zinc-900 dark:text-zinc-300 mb-1">Figure {idx + 1}</div>
                                <div className="text-zinc-500 truncate">{fig.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {activeTab === 'highlights' && side === 'left' && (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Highlights</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <AnnotationsPanel 
                        annotations={annotations} 
                        onDelete={onDeleteAnnotation || (() => {})} 
                        onJump={scrollToParagraph}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'agent' && side === 'right' && (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Research Agent</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {storageManager && (
                        <ResearchAgentPanel
                          settings={settings}
                          documentFullText={currentDocText}
                          onOpenSettings={onOpenSettings}
                          annotations={annotations}
                          initialQuery={initialAgentQuery}
                          storageManager={storageManager}
                          fileId={activeFileId || undefined}
                          onSaveNote={onSaveNote}
                        />
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'notebook' && side === 'right' && (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Notebook</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <NotebookPanel 
                        annotations={annotations} 
                        onDelete={onDeleteAnnotation || (() => {})} 
                        onJump={scrollToParagraph}
                      />
                    </div>
                  </div>
                )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

