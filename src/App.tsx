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
import { MultiAIClient } from './core/MultiAIClient';
import { type Annotation, type PaperStructure } from './types/ReaderTypes';
import { LocalStorageManager } from './core/LocalStorageManager';
import { AnnotationManager } from './core/AnnotationManager';
import { useUndoableState } from './hooks/useUndoableState';

function App() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [leftSidebarTab, setLeftSidebarTab] = useState<'library' | 'toc' | 'highlights'>('library');
  const [rightSidebarTab, setRightSidebarTab] = useState<'agent' | 'notebook'>('agent');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => SettingsManager.load());

  const [activeFileId, setActiveFileId] = useState<string | null>(() => localStorage.getItem('active_file_id'));
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [currentDocText, setCurrentDocText] = useState<string>('');
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

  const refreshLibrary = useCallback(() => {
    const items = LibraryManager.getLibrary().sort((a, b) => b.lastOpened - a.lastOpened);
    const hasSeenWelcome = localStorage.getItem('has_seen_welcome');

    if (items.length === 0 && !hasSeenWelcome) {
      LibraryManager.addItem('/doc1.html');
      LibraryManager.addItem('/doc2.html');
      LibraryManager.addItem('/doc3.html');
      localStorage.setItem('has_seen_welcome', 'true');
      const freshItems = LibraryManager.getLibrary().sort((a, b) => b.lastOpened - a.lastOpened);
      setLibrary(freshItems);
    } else {
      setLibrary(items);
    }
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
    refreshLibrary();
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

  // Theme Management
  useEffect(() => {
    // Set data attribute for CSS variables
    document.documentElement.setAttribute('data-theme', settings.theme);
    
    // Set class for Tailwind dark mode
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const syncLibraryWithStorage = useCallback(async () => {
    const files = await storageManagerRef.current.listFiles();
    if (files.length === 0) return;

    let addedCount = 0;
    const library = LibraryManager.getLibrary();
    
    files.forEach(filename => {
        const exists = library.some(item => item.filePath === filename || item.filePath === '/' + filename);
        if (!exists) {
           LibraryManager.addItem(filename);
           addedCount++;
        }
    });
    
    if (addedCount > 0) {
        refreshLibrary();
        toast.success(`${addedCount} new papers added from Local Folder`);
    }
  }, [refreshLibrary]);

  // Local Folder Reconnect Check (Browser Security Handling)
  useEffect(() => {
    const checkStorage = async () => {
      // Attempt silent restore
      const restored = await storageManagerRef.current.restoreDirectoryHandle();
      
      if (restored) {
        await syncLibraryWithStorage();
        
        // Systematic Persistence: Try to load settings.json
        const localSettings = await storageManagerRef.current.loadJson<AppSettings>('settings.json');
        if (localSettings) {
            setSettings(prev => ({
                ...prev,
                ...localSettings,
                // Merge critical things logic if needed, but simple overwrite is often what user expects from "Sync"
            }));
            toast.success("Settings loaded from local folder");
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
  }, [syncLibraryWithStorage]);

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
      // Theme Toggle: Alt+Shift+T
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
        handleSaveSettings({ ...settings, theme: nextTheme });
        toast.success(`Theme switched to ${nextTheme}`);
      }
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
  }, [settings, handleSaveSettings]);

  const globalCommands: CommandItem[] = useMemo(() => [
    {
      id: 'toggle-theme',
      label: 'Toggle Light/Dark Mode',
      description: `Switch to ${settings.theme === 'dark' ? 'Light' : 'Dark'} theme`,
      icon: <Settings size={18} />,
      shortcut: 'Alt + Shift + T',
      action: () => {
        const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
        handleSaveSettings({ ...settings, theme: nextTheme });
      }
    },
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
        const searchInput = document.querySelector('input[placeholder="Find..."]') as HTMLInputElement;
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans flex flex-col">
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
          library={library}
          activeFileId={activeFileId}
          onSelectFile={(item) => setActiveFileId(item.id)}
          onRefreshLibrary={refreshLibrary}
          onRemoveFile={async (id) => {
            const item = library.find(i => i.id === id);
            if (window.confirm(`"${item?.title}" 문서를 삭제하시겠습니까?`)) {
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
