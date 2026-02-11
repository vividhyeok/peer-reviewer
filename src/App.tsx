import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Reader } from './components/Reader';
import { Toaster, toast } from 'sonner';
import { Settings, Sparkles, Languages, Download, Search, BookOpen, Brain } from 'lucide-react';
import { AdvancedSettings as SettingsDialog } from './components/AdvancedSettings';
import { CommandPalette, type CommandItem } from './components/CommandPalette';
import { TopToolbar } from './components/TopToolbar';
import { Sidebar } from './components/Sidebar';
import { type AppSettings } from './types/settings';
import { SettingsManager } from './core/SettingsManager';
import { LibraryManager, type LibraryItem } from './core/LibraryManager';
import { DocumentSessionManager } from './core/DocumentSessionManager';
import { MultiAIClient } from './core/MultiAIClient';
import { type Annotation, type PaperStructure, type AIMessage } from './types/ReaderTypes';
import { type ChatSession } from './components/ConversationsPanel';
import { LocalStorageManager } from './core/LocalStorageManager';
import { AnnotationManager } from './core/AnnotationManager';
import { useUndoableState } from './hooks/useUndoableState';


import { OnboardingScreen } from './components/OnboardingScreen';

function App() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [leftSidebarTab, setLeftSidebarTab] = useState<'library' | 'toc' | 'highlights' | 'notebook'>('library');
  const [rightSidebarTab, setRightSidebarTab] = useState<'agent' | 'conversations'>('agent');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => SettingsManager.load());

  const [activeFileId, setActiveFileId] = useState<string | null>(() => {
      const saved = localStorage.getItem('active_file_id');
      return saved ? saved : null;
  });
  // Initialize library immediately from local storage to prevent flash of empty state
  const [library, setLibrary] = useState<LibraryItem[]>(() => {
      const lib = LibraryManager.getLibrary();
      return lib.sort((a, b) => b.lastOpened - a.lastOpened);
  });
  const [currentDocText, setCurrentDocText] = useState<string>('');
  
  // Initialize from LocalStorage
  const [savedSessions, setSavedSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('saved_chat_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse saved sessions', e);
      return [];
    }
  });

  const { 
    state: annotations, 
    setState: setAnnotations, 
    undo: undoAnnotations, 
    redo: redoAnnotations, 
    canUndo, 
    canRedo 
  } = useUndoableState<Annotation[]>([]);
  const [docStructure, setDocStructure] = useState<PaperStructure | undefined>(undefined);
  const [initialAgentQuery, setInitialAgentQuery] = useState<string | undefined>(undefined);
  
  const activeFile = useMemo(() => library.find(i => i.id === activeFileId) || null, [library, activeFileId]);

  const aiClientRef = useRef(new MultiAIClient(settings.apiKeys));
  const storageManagerRef = useRef(new LocalStorageManager());

  // --- Resizable Sidebars ---
  const [sidebarWidths, setSidebarWidths] = useState(settings.sidebarWidths || { left: 450, right: 450 });
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    if (settings.sidebarWidths) {
      setSidebarWidths(settings.sidebarWidths);
    }
  }, [settings.sidebarWidths]);

  // Sync Data Root Path
  useEffect(() => {
    storageManagerRef.current.setRootPath(settings.dataRootPath);
  }, [settings.dataRootPath]);

  // Handlers for Onboarding
  const handleOnboardingComplete = (path: string) => {
      const newSettings = { 
          ...settings, 
          dataRootPath: path, 
          setupCompleted: true 
      };
      setSettings(newSettings);
      SettingsManager.save(newSettings);
      
      // Force sync after path change
      // storageManager will be updated by useEffect dependency on settings.dataRootPath
      // But we might need a small delay or direct set to ensure it's ready before refreshLibrary is called automatically
      storageManagerRef.current.setRootPath(path).then(() => {
          void refreshLibrary();
      });
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: Save confirmation
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        toast.success("All changes saved automatically", {
             description: "Your work is synced instantly."
        });
      }
      
      // Ctrl+F: Focus Search (if not already handled)
      // We'll let native behavior or specific component logic handle this if present, 
      // but preventing the browser "Find" bar is usually desired in apps like this.
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          // If we want to open our Command Palette or Search:
          // e.preventDefault();
          // setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const startResizing = useCallback((side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(side);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      // Request Animation Frame for smoother UI updates could be good, but direct setState is usually fine for this complexity
      if (isResizing === 'left') {
        const newWidth = Math.max(250, Math.min(800, e.clientX));
        setSidebarWidths(prev => ({ ...prev, left: newWidth }));
      } else {
        const newWidth = Math.max(250, Math.min(800, window.innerWidth - e.clientX));
        setSidebarWidths(prev => ({ ...prev, right: newWidth }));
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(null);
        // Save to settings
        const newSettings = { ...settings, sidebarWidths: sidebarWidths };
        // We call handleSaveSettings but be careful not to trigger infinite loop if it updates 'settings' prop which updates 'sidebarWidths' state.
        // It's safe because of the check in useEffect above.
        SettingsManager.save(newSettings);
        setSettings(newSettings); 
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      // Add overlay to iframe components if any (like embedding pdfs) to prevent mouse trap
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, sidebarWidths, settings]);

  // --- Zoom Handling (Root Font Size for Responsive Rem) ---
  useEffect(() => {
    if (settings.uiZoom) {
      // Default browser font-size is usually 16px.
      // We scale this percentage wise.
      const percentage = Math.round(settings.uiZoom * 100);
      document.documentElement.style.fontSize = `${percentage}%`;
    }
  }, [settings.uiZoom]);

  useEffect(() => {
    const handleZoom = (e: KeyboardEvent) => {
      // Allow browser native zoom to work if not prevented? 
      // Actually standardizing on rem-scaling gives better control in standalone app.
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setSettings(prev => {
             const current = prev.uiZoom || 1;
             const newZoom = Math.min(Number((current + 0.1).toFixed(1)), 2.0); // Max 200%
             const newSettings = { ...prev, uiZoom: newZoom };
             SettingsManager.save(newSettings);
             return newSettings;
          });
        } else if (e.key === '-') {
           // ... (rest same) -> min 50%
          e.preventDefault();
          setSettings(prev => {
             const current = prev.uiZoom || 1;
             const newZoom = Math.max(Number((current - 0.1).toFixed(1)), 0.5);
             const newSettings = { ...prev, uiZoom: newZoom };
             SettingsManager.save(newSettings);
             return newSettings;
          });
        } else if (e.key === '0') {
           e.preventDefault();
           setSettings(prev => {
             const newSettings = { ...prev, uiZoom: 1.0 };
             SettingsManager.save(newSettings);
             return newSettings;
           });
        }
      }
    };
    window.addEventListener('keydown', handleZoom);
    return () => window.removeEventListener('keydown', handleZoom);
  }, []);

  const refreshLibrary = useCallback(async () => {
    const storage = storageManagerRef.current;
    const hasSeenWelcome = localStorage.getItem('has_seen_welcome');

    if (storage.isConnected) {
      const synced = await LibraryManager.sync(storage);
      if (synced.length > 0) {
        setLibrary(synced.sort((a, b) => b.lastOpened - a.lastOpened));
        return;
      }
    }

    const items = LibraryManager.getLibrary().sort((a, b) => b.lastOpened - a.lastOpened);
    if (items.length > 0) {
      setLibrary(items);
      return;
    }

    if (!hasSeenWelcome) {
      await LibraryManager.addItem('/docs/doc1.html', storage);
      await LibraryManager.addItem('/docs/doc2.html', storage);
      await LibraryManager.addItem('/docs/doc3.html', storage);
      localStorage.setItem('has_seen_welcome', 'true');
      setLibrary(LibraryManager.getLibrary().sort((a, b) => b.lastOpened - a.lastOpened));
      return;
    }

    setLibrary([]);
  }, []);

  const handleSaveNote = useCallback((note: Annotation) => {
    setAnnotations(prev => [...prev, note]);
    toast.success('Saved to Notebook', { icon: <BookOpen size={16} /> });
  }, []);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    toast.success('Deleted', { icon: <Search size={16} /> });
  }, []);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    if (activeFileId) {
      localStorage.setItem('active_file_id', activeFileId);
    } else {
      localStorage.removeItem('active_file_id');
    }
  }, [activeFileId]);

  const handleSaveSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    SettingsManager.save(newSettings);
    
    // Systematic Persistence: Save settings.json to local folder if connected
    if (storageManagerRef.current && !storageManagerRef.current.needsReconnect) {
        storageManagerRef.current.saveJson('settings.json', newSettings);
    }

    aiClientRef.current = new MultiAIClient(newSettings.apiKeys);
  }, []);

  const handleSaveSession = useCallback((messages: AIMessage[]) => {
      if (messages.length === 0) return;
      const newSession: ChatSession = {
          id: crypto.randomUUID(),
          title: messages[0].content.slice(0, 50) || 'New Conversation',
          date: Date.now(),
          messages,
          preview: messages.length > 1 ? messages[1].content.slice(0, 100) : ''
      };
      setSavedSessions(prev => [newSession, ...prev]);
      toast.success("Conversation saved");
  }, []);

  // Listener for Child Panel Data
  useEffect(() => {
     const handler = (e: any) => {
         if (e.detail?.messages) {
             handleSaveSession(e.detail.messages);
         }
     };
     window.addEventListener('save-session-data', handler);
     return () => window.removeEventListener('save-session-data', handler);
  }, [handleSaveSession]);

  const handleLoadSession = useCallback((session: ChatSession) => {
      // Dispatch event to ResearchAgentPanel to load messages
      // This is a bit hacky, normally we'd lift state, but for now we use the event bus
      window.dispatchEvent(new CustomEvent('load-chat-session', { detail: { messages: session.messages } }));
      setRightSidebarTab('agent');
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
      setSavedSessions(prev => prev.filter(s => s.id !== id));
      toast.success("Session deleted");
  }, []);

  // Persist conversations
  useEffect(() => {
    localStorage.setItem('saved_chat_sessions', JSON.stringify(savedSessions));
  }, [savedSessions]);

  // Theme Management (Enforcing Light Mode)
  useEffect(() => {
    // Force Light Mode attributes
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark');
  }, [settings.theme]); // Keep dependency just in case, but we ignore the value.

  const syncLibraryWithStorage = useCallback(async () => {
    // New Robust Sync: Merges Disk + Local Storage + Physical Files
    try {
      const mergedLibrary = await LibraryManager.sync(storageManagerRef.current);
      const sorted = mergedLibrary.sort((a, b) => b.lastOpened - a.lastOpened);
      setLibrary(sorted);
    } catch (error) {
      console.error('[App] Library sync failed', error);
      await refreshLibrary();
    }
    
    // Check if we added anything new (simple check against previous count or just toast)
    // For now, silent sync is better UX than popping toast every refresh
  }, [refreshLibrary]);

  // Local Folder Reconnect Check (Browser Security Handling)
  const isSyncingRef = useRef(false);
  
  useEffect(() => {
    const checkStorage = async () => {
      // Prevent double invocation in Strict Mode
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      // Attempt silent restore
      const restored = await storageManagerRef.current.restoreDirectoryHandle();
      
      if (restored) {
        await syncLibraryWithStorage();
        
        // Systematic Persistence: Try to load settings.json
        const localSettings = await storageManagerRef.current.loadJson<AppSettings>('settings.json');
        if (localSettings) {
             setSettings(prev => ({ ...prev, ...localSettings }));
        }
      }

      // If silent restore failed but we are configured to use FileSystem, show a reconnect button
      if (!restored && storageManagerRef.current.needsReconnect) {
        toast.info("Local Storage Disconnected", {
            description: "Browser requires permission to write to your local folder again.",
            duration: Infinity,
            action: {
                label: "Reconnect",
                onClick: async () => {
                    const result = await storageManagerRef.current.reconnect();
                    if (result) {
                        toast.success("Storage Connected");
                        await syncLibraryWithStorage();
                    } else {
                         // Fallback
                        await storageManagerRef.current.requestDirectory();
                        await syncLibraryWithStorage();
                    }
                }
            }
        });
      }
    };

    checkStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save Annotations (Handled by Reader Session with Dirty Flags)
  // We keep this useEffect strict or remove it to avoid conflicts.
  // The Reader component now manages session.save() based on dirty state.
  useEffect(() => {
    // Legacy auto-save removed.
  }, []);

  // Global Keybindings & Events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette: Alt+P
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      // Korean Toggle: Alt+K
      if (e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const nextMode = !settings.isKoreanPrimary;
        const newSettings = { ...settings, isKoreanPrimary: nextMode };
        handleSaveSettings(newSettings);
        toast.success(`Korean-First Mode: ${nextMode ? 'ENABLED' : 'DISABLED'}`, {
          icon: <Languages className="text-blue-500" size={16} />
        });
      }
      
      // Theme Toggle Removed (Light Mode Only Implementation)

      // Library Toggle: Alt+L
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLeftSidebarOpen(prev => !prev);
      }
      // Agent Toggle: Alt+I
      if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setRightSidebarOpen(prev => !prev);
      }

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (canUndo) {
          e.preventDefault();
          undoAnnotations();
        }
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        if (canRedo) {
          e.preventDefault();
          redoAnnotations();
        }
      }
    };

    const handleAction = (e: CustomEvent) => {
      const { action } = e.detail || {};
      if (action === 'toggle-library') setLeftSidebarOpen(prev => !prev);
      if (action === 'toggle-agent') setRightSidebarOpen(prev => !prev);
      if (action === 'open-settings') setSettingsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    // @ts-ignore
    window.addEventListener('toolbar-action', handleAction);

    const handleOpenAgent = (e: any) => {
      const { prompt } = e.detail || {};
      if (prompt) setInitialAgentQuery(prompt);
      setRightSidebarOpen(true);
      setRightSidebarTab('agent');
    };
    window.addEventListener('research-agent-open', handleOpenAgent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // @ts-ignore
      window.removeEventListener('toolbar-action', handleAction);
      window.removeEventListener('research-agent-open', handleOpenAgent);
    };
  }, [settings, handleSaveSettings, canUndo, canRedo, undoAnnotations, redoAnnotations]);

  const globalCommands: CommandItem[] = useMemo(() => [
    {
      id: 'open-review',
      label: 'Review Concepts',
      description: 'Start flashcard review of definitions and questions',
      icon: <Brain size={18} />,
      shortcut: 'Alt + R',
      action: () => {
        window.dispatchEvent(new Event('open-flashcard-review'));
      }
    },
    {
      id: 'toggle-library',
      label: 'Toggle Library Explorer',
      description: 'Open or close the document library panel',
      icon: <BookOpen size={18} />,
      shortcut: 'Alt + L',
      action: () => setLeftSidebarOpen(prev => !prev)
    },
    {
      id: 'toggle-agent',
      label: 'Toggle AI Agent',
      description: 'Open or close the AI Research Agent panel',
      icon: <Sparkles size={18} />,
      shortcut: 'Alt + I',
      action: () => setRightSidebarOpen(prev => !prev)
    },
    {
      id: 'toggle-settings',
      label: 'Open Settings',
      description: 'Configure API keys, models, and reader preferences',
      icon: <Settings size={18} />,
      shortcut: 'Alt + S',
      action: () => setSettingsOpen(true)
    },
    {
      id: 'toggle-korean',
      label: 'Toggle Korean-First Mode',
      description: 'Switch between Korean translation and English original primary view',
      icon: <Languages size={18} />,
      shortcut: 'Alt + K',
      action: () => {
        const nextMode = !settings.isKoreanPrimary;
        handleSaveSettings({ ...settings, isKoreanPrimary: nextMode });
        toast.success(`Korean-First Mode: ${nextMode ? 'ENABLED' : 'DISABLED'}`);
      }
    },
    {
      id: 'copy-bibtex',
      label: 'Copy BibTeX Citation',
      description: 'Generate and copy BibTeX for this paper',
      icon: <Download size={18} />,
      action: () => {
        if (!activeFile) return;
        const bib = `@article{${activeFile.author?.split(' ')[0] || 'unknown'}${new Date().getFullYear()},
  title={${activeFile.title}},
  author={${activeFile.author || 'Unknown'}},
  year={${new Date().getFullYear()}},
  journal={Imported via Immersive Reader}
}`;
        navigator.clipboard.writeText(bib);
        toast.success("BibTeX copied to clipboard");
      }
    },
    {
      id: 'export-smart',
      label: 'Smart Document Export',
      description: 'Generate AI synthesis or high-level summary for export',
      icon: <Download size={18} />,
      action: () => {
        const exportBtn = document.querySelector('[title="Smart Export (Synthesis)"]') as HTMLButtonElement;
        if (exportBtn) exportBtn.click();
        else toast.error("Open a document first to export");
      }
    },
    {
      id: 'search-doc',
      label: 'Search in Document',
      description: 'Find text within the current active paper',
      icon: <Search size={18} />,
      shortcut: 'Alt + F',
      action: () => {
        const searchInput = document.querySelector('input[placeholder="Find in text..."]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
        else toast.error("Open a document first to search");
      }
    }
  ], [settings, handleSaveSettings]);

  // AI-powered Metadata enrichment
  useEffect(() => {
    if (activeFileId && currentDocText) {
      const activeFile = library.find(i => i.id === activeFileId);
      if (activeFile && (activeFile.title.includes('.html') || !activeFile.oneLineSummary)) {
        enrichMetadata(activeFile, currentDocText);
      }
    }
  }, [activeFileId, currentDocText]);

  const enrichMetadata = async (file: LibraryItem, text: string) => {
    const modelId = settings.modelAssignments['summarize'] || 'deepseek-chat';
    const modelInfo = { provider: 'deepseek' as const, modelId };

    if (!settings.apiKeys[modelInfo.provider]) return;

    try {
      if (file.title.includes('.html') || !file.author) {
        const metadata = await aiClientRef.current.extractMetadata(modelInfo, text);
        if (metadata.title) {
          LibraryManager.updateMetadata(file.id, { title: metadata.title, author: metadata.author });
        }
      }

      if (!file.oneLineSummary) {
        // Use a more reliable default model if DeepSeek is not configured perfectly
        const summary = await aiClientRef.current.generateOneLineSummary(
             { provider: 'gemini', modelId: 'gemini-1.5-flash' }, 
             text
        );
        LibraryManager.updateMetadata(file.id, { oneLineSummary: summary });
      }

      refreshLibrary();
    } catch (e) {
      console.warn('Metadata enrichment failed', e);
    }
  };

  const handleDocumentLoaded = useCallback((text: string) => {
    setCurrentDocText(text);
  }, []);

  const handleExplainImage = useCallback((src: string, alt: string) => {
    // Determine context (local file or URL)
    // For local files, we might need a way to pass the actual image data or path
    // For now, we simulate by passing a text prompt about the image
    const query = `Explain this image: ${alt || 'Figure'}. (Note: Vision AI integration checks src: ${src.substring(0, 50)}...)`;
    
    setInitialAgentQuery(query);
    setRightSidebarOpen(true);
    setRightSidebarTab('agent');
    
    // Clear trigger after a moment so it doesn't loop if sidebar toggles
    setTimeout(() => setInitialAgentQuery(undefined), 1000);
  }, []);

  if (!settings.setupCompleted) {
    return (
      <>
        <OnboardingScreen storageManager={storageManagerRef.current} onComplete={handleOnboardingComplete} />
        <Toaster position="top-right" theme="dark" richColors expand closeButton />
      </>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white text-zinc-900 font-sans flex flex-col">
      {/* MS Word style Ribbon Top Bar */}
      <TopToolbar 
        settings={settings}
        onSaveSettings={handleSaveSettings}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undoAnnotations}
        onRedo={redoAnnotations}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Library */}
        <Sidebar 
          side="left"
          isOpen={leftSidebarOpen}
          activeTab={leftSidebarTab}
          onTabChange={(tab: any) => setLeftSidebarTab(tab)}
          onClose={() => setLeftSidebarOpen(false)}
          width={sidebarWidths.left}
          onResizeStart={startResizing('left')}
          library={library}
          activeFileId={activeFileId}
          onSelectFile={(item) => setActiveFileId(item.id)}
          onRefreshLibrary={refreshLibrary}
          onRemoveFile={async (id) => {
            const item = library.find(i => i.id === id);
            if (item && window.confirm(`"${item.title}" 문서를 삭제하시겠습니까?`)) {
              // Clear memory session to prevent stale state on re-add
              DocumentSessionManager.removeSession(item.filePath);
              
              await LibraryManager.removeItem(id, storageManagerRef.current);
              if (activeFileId === id) setActiveFileId(null);
              refreshLibrary();
              toast.success("문서가 삭제되었습니다");
            }
          }}
          settings={settings}
          onOpenSettings={() => setSettingsOpen(true)}
          structure={docStructure}
          annotations={annotations}
          onDeleteAnnotation={handleDeleteAnnotation}
        />

        <div className="flex-1 relative z-0">
          <Reader 
            settings={settings}
            activeFile={activeFile}
            onToggleLibrary={() => setLeftSidebarOpen(true)}
            onDocumentLoaded={handleDocumentLoaded}
            onStructureLoaded={setDocStructure}
            annotations={annotations}
            onAnnotationsChange={setAnnotations}
            storageManager={storageManagerRef.current}
            onExplainImage={handleExplainImage}
          />
        </div>

        {/* Right Sidebar: Agent/Chat */}
        <Sidebar 
          side="right"
          isOpen={rightSidebarOpen}
          activeTab={rightSidebarTab}
          onTabChange={(tab: any) => setRightSidebarTab(tab)}
          onClose={() => setRightSidebarOpen(false)}
          width={sidebarWidths.right}
          onResizeStart={startResizing('right')}
          library={library}
          activeFileId={activeFileId}
          onSelectFile={(item) => setActiveFileId(item.id)}
          onRefreshLibrary={refreshLibrary}
          settings={settings}
          currentDocText={currentDocText}
          annotations={annotations}
          onOpenSettings={() => setSettingsOpen(true)}
          initialAgentQuery={initialAgentQuery}
          storageManager={storageManagerRef.current}
          onSaveNote={handleSaveNote}
          onDeleteAnnotation={handleDeleteAnnotation}
          savedSessions={savedSessions}
          onLoadSession={handleLoadSession}
          onDeleteSession={handleDeleteSession}
          onSaveCurrentSession={() => window.dispatchEvent(new Event('trigger-save-session'))}
        />
      </div>

      <Toaster position="top-right" theme="dark" richColors expand closeButton />

      {settingsOpen && (
        <SettingsDialog
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSave={handleSaveSettings}
          storageManager={storageManagerRef.current}
          onSyncLibrary={syncLibraryWithStorage}
        />
      )}

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={globalCommands}
      />
    </div>
  )
}

export default App
