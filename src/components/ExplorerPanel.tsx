import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Edit2, Search, FileUp, Clock, Folder as FolderIcon, ChevronRight, ChevronDown, Check, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
// @ts-ignore
import { toast } from 'sonner';
import { LibraryManager, type LibraryItem } from '../core/LibraryManager';
import { registerBrowserFile } from '../core/FileSystem';
import { LocalStorageManager } from '../core/LocalStorageManager';
import { clsx } from 'clsx';

interface ExplorerPanelProps {
    items: LibraryItem[];
    activeFileId: string | null;
    onSelect: (item: LibraryItem) => void;
    onRefresh: () => void;
    onRemove: (id: string) => void;
    storageManager?: LocalStorageManager;
}

function timeAgo(date: number) {
    const seconds = Math.floor((Date.now() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return new Date(date).toLocaleDateString();
}

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
    items,
    activeFileId,
    onSelect,
    onRefresh,
    onRemove,
    storageManager
}) => {
    const [tab, setTab] = useState<'recent' | 'folders'>('recent');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<{ title: string; author: string; review: string }>({ title: '', author: '', review: '' });
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['General']));

    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredItems = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return items.filter(item =>
            item.title.toLowerCase().includes(query) ||
            item.author?.toLowerCase().includes(query) ||
            item.oneLineSummary?.toLowerCase().includes(query)
        );
    }, [items, searchQuery]);

    const recentItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => b.lastOpened - a.lastOpened);
    }, [filteredItems]);

    const folderGroups = useMemo(() => {
        const groups: Record<string, LibraryItem[]> = {};
        filteredItems.forEach(item => {
            const f = item.folder || 'General';
            if (!groups[f]) groups[f] = [];
            groups[f].push(item);
        });
        return groups;
    }, [filteredItems]);

    const toggleFolder = (f: string) => {
        const next = new Set(expandedFolders);
        if (next.has(f)) next.delete(f);
        else next.add(f);
        setExpandedFolders(next);
    };

    const handleImportClick = async () => {
        // Tauri Check
        if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
            try {
                const selected = await open({
                    multiple: false,
                    filters: [{
                        name: 'HTML/Markdown',
                        extensions: ['html', 'htm', 'md']
                    }]
                });
                
                if (selected) {
                    const absolutePath = selected as string;
                    
                    // Use Rust backend to copy file + images (bypasses JS FS permission issues)
                    try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        const isHtml = absolutePath.toLowerCase().endsWith('.html') || absolutePath.toLowerCase().endsWith('.htm');
                        const filename: string = isHtml 
                            ? await invoke('copy_html_with_images', { sourcePath: absolutePath })
                            : await invoke('copy_file_to_data', { sourcePath: absolutePath });
                        console.log('[Import] Rust copy succeeded:', filename, isHtml ? '(with images)' : '');
                        await LibraryManager.addItem(filename, storageManager);
                        toast.success(`"${filename}" 문서가 추가되었습니다`);
                    } catch (rustError) {
                        console.warn('[Import] Rust copy failed, trying JS fallback:', rustError);
                        
                        // JS Fallback: try storageManager
                        let writeSuccess = false;
                        if (storageManager && storageManager.isConnected) {
                            try {
                                const { readTextFile } = await import('@tauri-apps/plugin-fs');
                                const content = await readTextFile(absolutePath);
                                const filename = absolutePath.replace(/\\/g, '/').split('/').pop() || 'imported.html';
                                await storageManager.writeFile(filename, content);
                                await LibraryManager.addItem(filename, storageManager);
                                toast.success(`"${filename}" 문서가 추가되었습니다`);
                                writeSuccess = true;
                            } catch (jsError) {
                                console.error('[Import] JS fallback also failed:', jsError);
                            }
                        }
                        
                        if (!writeSuccess) {
                            // Last resort: register with absolute path
                            await LibraryManager.addItem(absolutePath);
                            toast.warning("파일이 원본 경로로 연결되었습니다 (이동 시 열리지 않을 수 있음)");
                        }
                    }
                    
                    onRefresh();
                    return;
                }
            } catch (e) {
                console.error("Dialog error", e);
            }
        }
        
        fileInputRef.current?.click();
    };

    // Optional Storage Manager for persistence 
    // (Ideally specific props, but for now we try global access or simple fetch)
    const uploadToDevServer = async (file: File): Promise<boolean> => {
        // 1. Try StorageManager (Tauri / Persistence)
        if (storageManager && storageManager.isConnected) {
            try {
                const text = await file.text();
                await storageManager.writeFile(file.name, text);
                return true;
            } catch(e) {
                console.warn("StorageManager write failed", e);
            }
        }

        // 2. Try Dev Server API
        try {
            await fetch('/api/fs/list?ext=.check_connection'); // Check probing
            const buffer = await file.arrayBuffer();
            const res = await fetch(`/api/fs/file?path=${encodeURIComponent(file.name)}`, {
                method: 'POST',
                body: buffer
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            for (const file of files) {
                if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm') || file.name.toLowerCase().endsWith('.md')) {
                    // Try to save to disk first (persistence)
                    const uploaded = await uploadToDevServer(file);
                    
                    if (uploaded) {
                        // If uploaded, use real path
                        const realPath = file.name;
                        await LibraryManager.addItem(realPath, storageManager); 
                        toast.success(`${file.name} saved to disk`);
                    } else {
                        // Fallback to memory (Session only)
                        const virtualPath = `virtual/${file.name}`;
                        await registerBrowserFile(virtualPath, file);
                        await LibraryManager.addItem(virtualPath);
                        toast.info(`${file.name} opened (Memory Only)`);
                    }
                }
            }
            onRefresh();
        }
    };

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')) {
                // Try to save to disk first (persistence)
                const uploaded = await uploadToDevServer(file);
                
                if (uploaded) {
                    const realPath = file.name;
                    await LibraryManager.addItem(realPath, storageManager);
                    toast.success(`${file.name} saved to disk`);
                } else {
                    const virtualPath = `virtual/${file.name}`;
                    await registerBrowserFile(virtualPath, file);
                    await LibraryManager.addItem(virtualPath);
                    toast.info(`${file.name} opened (Memory Only)`);
                }
                
                onRefresh();
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    const startEditing = (item: LibraryItem) => {
        setEditingId(item.id);
        setEditFormData({
            title: item.title,
            author: item.author || '',
            review: item.review || ''
        });
    };

    const saveEditing = () => {
        if (editingId) {
            LibraryManager.updateMetadata(editingId, editFormData);
            setEditingId(null);
            onRefresh();
        }
    };

    const renderItem = (item: LibraryItem) => (
        <div
            key={item.id}
            className={clsx(
                "group relative rounded-2xl p-4 transition-all cursor-pointer border",
                activeFileId === item.id
                    ? "bg-blue-50 border-blue-500/30 shadow-xl shadow-blue-500/5 ring-1 ring-blue-500/20"
                    : "bg-white border-zinc-200 hover:bg-gray-50 hover:border-blue-300"
            )}
            onClick={() => onSelect(item)}
        >
            {editingId === item.id ? (
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                    <input
                        className="w-full text-base font-medium bg-white text-zinc-900 border border-blue-500/50 rounded-xl px-4 py-2 outline-none"
                        value={editFormData.title}
                        onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                        autoFocus
                    />
                    <input
                        className="w-full text-sm text-zinc-500 bg-white border border-zinc-200 rounded-xl px-4 py-2 outline-none"
                        placeholder="Author"
                        value={editFormData.author}
                        onChange={(e) => setEditFormData({ ...editFormData, author: e.target.value })}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={saveEditing} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold transition-all hover:bg-blue-500 flex items-center">
                            <Check size={12} className="mr-1.5" /> SAVE
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-gray-100 text-zinc-600 rounded-lg text-xs font-bold transition-all hover:bg-gray-200 flex items-center">
                            <X size={12} className="mr-1.5" /> CANCEL
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="space-y-1">
                        <h3 className={clsx(
                            "font-serif font-bold text-[15px] leading-snug line-clamp-2 transition-colors",
                            activeFileId === item.id ? "text-blue-600" : "text-zinc-800 group-hover:text-blue-600"
                        )}>
                            {item.title}
                        </h3>
                    </div>

                    {item.oneLineSummary && (
                        <p className="text-[12px] text-zinc-500 leading-relaxed italic line-clamp-4 whitespace-pre-wrap">
                            {item.oneLineSummary}
                        </p>
                    )}

                    <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                            <Clock size={10} strokeWidth={3} />
                            <span>{timeAgo(item.lastOpened)}</span>
                        </div>

                        {item.progress !== undefined && (
                            <div className="flex items-center gap-2">
                                <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden border border-zinc-200">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                        style={{ width: `${item.progress}%` }}
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-zinc-400">{Math.round(item.progress)}%</span>
                            </div>
                        )}
                    </div>

                    {/* Hover Actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-all absolute top-2 right-2 flex gap-1 z-10 translate-y-1 group-hover:translate-y-0">
                        <button
                            onClick={(e) => { e.stopPropagation(); startEditing(item); }}
                            className="p-1.5 bg-white/90 backdrop-blur-sm text-zinc-400 hover:text-blue-500 border border-zinc-200 rounded-lg shadow-xl transition-all"
                        >
                            <Edit2 size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                            className="p-1.5 bg-white/90 backdrop-blur-sm text-zinc-400 hover:text-red-500 border border-zinc-200 rounded-lg shadow-xl transition-all"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-white text-zinc-900 border-r border-zinc-200">
            {/* Header */}
            <div className="p-5 pb-2 border-b border-zinc-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-serif font-bold text-zinc-900 tracking-tight">Library</h2>
                    </div>
                    <button
                        onClick={handleImportClick}
                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-95"
                    >
                        <Plus size={18} strokeWidth={2.5} />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".html,.htm" onChange={handleFileInput} />
                </div>

                <div className="relative mb-4">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        className="w-full bg-gray-100 border border-zinc-200 focus:border-blue-500/50 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none transition-all placeholder-zinc-400 text-zinc-800"
                        placeholder="Search papers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setTab('recent')}
                        className={clsx(
                            "flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all border",
                            tab === 'recent'
                                ? "bg-white border-zinc-200 text-blue-600 shadow-sm"
                                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-800"
                        )}
                    >
                        Recent
                    </button>
                    <button
                        onClick={() => setTab('folders')}
                        className={clsx(
                            "flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all border",
                            tab === 'folders'
                                ? "bg-zinc-800 border-zinc-700 text-blue-400 shadow-inner"
                                : "bg-transparent border-transparent text-zinc-600 hover:text-zinc-400"
                        )}
                    >
                        Folders
                    </button>
                </div>
            </div>

            {/* List Contents */}
            <div
                className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                {tab === 'recent' ? (
                    recentItems.map(renderItem)
                ) : (
                    Object.entries(folderGroups).map(([folder, folderItems]) => (
                        <div key={folder} className="space-y-2">
                            <div
                                onClick={() => toggleFolder(folder)}
                                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg cursor-pointer group"
                            >
                                {expandedFolders.has(folder) ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-400" />}
                                <FolderIcon size={14} className={clsx("transition-colors", expandedFolders.has(folder) ? "text-blue-500" : "text-zinc-400 group-hover:text-zinc-600")} />
                                <span className="text-xs font-bold text-zinc-600 group-hover:text-zinc-900">{folder}</span>
                                <span className="text-[10px] text-zinc-400 font-medium ml-auto">{folderItems.length} papers</span>
                            </div>
                            {expandedFolders.has(folder) && (
                                <div className="pl-4 space-y-2">
                                    {folderItems.map(renderItem)}
                                </div>
                            )}
                        </div>
                    ))
                )}

                {filteredItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                        <FileUp className="text-zinc-800 mb-4" size={32} strokeWidth={1} />
                        <p className="text-sm font-serif font-bold text-zinc-600">No papers found</p>
                    </div>
                )}
            </div>
        </div>
    );
};
