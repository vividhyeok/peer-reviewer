import * as React from 'react';
import { Library as LibraryIcon, Sparkles, X, List, Image as ImageIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { ExplorerPanel } from './ExplorerPanel';
import { ResearchAgentPanel } from './ResearchAgentPanel';
import { type LibraryItem } from '../core/LibraryManager';
import { type AppSettings } from '../types/settings';
import { type Annotation, type PaperStructure } from '../types/ReaderTypes';

interface SidebarProps {
  side?: 'left' | 'right';
  isOpen: boolean;
  activeTab: 'library' | 'agent' | 'toc';
  onTabChange: (tab: 'library' | 'agent' | 'toc') => void;
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
  initialAgentQuery
}) => {
  const tabs = [
    { id: 'library' as const, icon: LibraryIcon, label: 'Library', shortcut: 'Alt+L', side: 'left' },
    { id: 'toc' as const, icon: List, label: 'Structure', shortcut: 'Alt+O', side: 'left' },
    { id: 'agent' as const, icon: Sparkles, label: 'AI Agent', shortcut: 'Alt+I', side: 'right' },
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
            "w-[450px] bg-zinc-950 flex shrink-0 h-full overflow-hidden shadow-2xl z-[850] relative",
            side === 'left' ? "border-r border-zinc-800 flex-row" : "border-l border-zinc-800 flex-row-reverse"
          )}
        >
          {/* Activity Bar (Tabs) */}
          <div className={clsx(
            "w-16 bg-zinc-950 flex flex-col items-center py-6 gap-6 z-10 shrink-0",
            side === 'left' ? "border-r border-zinc-900" : "border-l border-zinc-900"
          )}>
            {filteredTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={clsx(
                    "p-3 rounded-2xl transition-all relative group",
                    isActive ? "text-blue-500 bg-blue-500/10 shadow-inner" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  {isActive && (
                    <motion.div 
                      layoutId={`activeTabIndicator-${side}`}
                      className={clsx(
                        "absolute top-1/2 -translate-y-1/2 w-[3px] h-8 bg-blue-500 rounded-px shadow-[0_0_10px_rgba(59,130,246,0.5)]",
                        side === 'left' ? "-left-px rounded-r-full" : "-right-px rounded-l-full"
                      )}
                    />
                  )}
                  
                  {/* Tooltip */}
                  <div className={clsx(
                    "absolute top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl",
                    side === 'left' ? "left-full ml-4" : "right-full mr-4"
                  )}>
                    <span className="font-medium text-zinc-100">{tab.label}</span>
                    <span className="ml-2 text-zinc-500">{tab.shortcut}</span>
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
          <div className="flex-1 overflow-hidden bg-zinc-950 flex flex-col">
            <div className="flex-1 h-full overflow-hidden">
                {activeTab === 'library' && side === 'left' && (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Library</h2>
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
                    <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Structure</h2>
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
                                  "w-full text-left py-1 px-2 rounded hover:bg-zinc-900 transition-colors text-sm truncate",
                                  item.level === 1 ? "font-bold text-zinc-200" : 
                                  item.level === 2 ? "pl-4 text-zinc-300" : "pl-6 text-zinc-400"
                                )}
                              >
                                {item.text}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-zinc-600 text-sm italic">No structure found</div>
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
                                className="w-full text-left py-2 px-3 rounded bg-zinc-900/50 hover:bg-zinc-800 transition-colors text-xs border border-zinc-900"
                              >
                                <div className="font-medium text-zinc-300 mb-1">Figure {idx + 1}</div>
                                <div className="text-zinc-500 truncate">{fig.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {activeTab === 'agent' && side === 'right' && (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Research Agent</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <ResearchAgentPanel
                        settings={settings}
                        documentFullText={currentDocText}
                        onOpenSettings={onOpenSettings}
                        annotations={annotations}
                        initialQuery={initialAgentQuery}
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

