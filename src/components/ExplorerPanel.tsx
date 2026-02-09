import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Edit2, Search, FileUp, Clock, Folder as FolderIcon, ChevronRight, ChevronDown, Check, X } from 'lucide-react';
import { LibraryManager, type LibraryItem } from '../core/LibraryManager';
import { registerBrowserFile } from '../core/FileSystem';
import { clsx } from 'clsx';

interface ExplorerPanelProps {
    items: LibraryItem[];
    activeFileId: string | null;
    onSelect: (item: LibraryItem) => void;
    onRefresh: () => void;
    onRemove: (id: string) => void;
}

function timeAgo(date: number) {
    const seconds = Math.floor((Date.now() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(date).toLocaleDateString();
}

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
    items,
    activeFileId,
    onSelect,
    onRefresh,
    onRemove
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

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            for (const file of files) {
                if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')) {
                    const virtualPath = `virtual/${file.name}`;
                    await registerBrowserFile(virtualPath, file);
                    LibraryManager.addItem(virtualPath);
                }
            }
            onRefresh();
        }
    };

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')) {
                const virtualPath = `virtual/${file.name}`;
                await registerBrowserFile(virtualPath, file);
                LibraryManager.addItem(virtualPath);
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
                    ? "bg-blue-50 dark:bg-blue-600/10 border-blue-500/30 shadow-xl shadow-blue-500/5 ring-1 ring-blue-500/20"
                    : "bg-white dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60 hover:border-blue-300 dark:hover:border-zinc-700"
            )}
            onClick={() => onSelect(item)}
        >
            {editingId === item.id ? (
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                    <input
                        className="w-full text-base font-medium bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-blue-500/50 rounded-xl px-4 py-2 outline-none"
                        value={editFormData.title}
                        onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                        autoFocus
                    />
                    <input
                        className="w-full text-sm text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 outline-none"
                        placeholder="Author"
                        value={editFormData.author}
                        onChange={(e) => setEditFormData({ ...editFormData, author: e.target.value })}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={saveEditing} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold transition-all hover:bg-blue-500 flex items-center">
                            <Check size={12} className="mr-1.5" /> SAVE
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs font-bold transition-all hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center">
                            <X size={12} className="mr-1.5" /> CANCEL
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="space-y-1">
                        <h3 className={clsx(
                            "font-serif font-bold text-[15px] leading-snug line-clamp-2 transition-colors",
                            activeFileId === item.id ? "text-blue-600 dark:text-blue-400" : "text-zinc-800 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-white"
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
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                            <Clock size={10} strokeWidth={3} />
                            <span>{timeAgo(item.lastOpened)}</span>
                        </div>

                        {item.progress !== undefined && (
                            <div className="flex items-center gap-2">
                                <div className="w-12 h-1 bg-gray-200 dark:bg-zinc-950 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800/50">
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
                            className="p-1.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm text-zinc-400 hover:text-blue-500 border border-zinc-200 dark:border-zinc-700/50 rounded-lg shadow-xl transition-all"
                        >
                            <Edit2 size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                            className="p-1.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm text-zinc-400 hover:text-red-500 border border-zinc-200 dark:border-zinc-700/50 rounded-lg shadow-xl transition-all"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="p-5 pb-2 border-b border-zinc-200 dark:border-zinc-900">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-serif font-bold text-zinc-900 dark:text-white tracking-tight">Library</h2>
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 dark:shadow-blue-900/20 transition-all transform active:scale-95"
                    >
                        <Plus size={18} strokeWidth={2.5} />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".html,.htm" onChange={handleFileInput} />
                </div>

                <div className="relative mb-4">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600" />
                    <input
                        className="w-full bg-gray-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500/50 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none transition-all placeholder-zinc-400 dark:placeholder-zinc-700 text-zinc-800 dark:text-zinc-300"
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
                                ? "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm dark:shadow-inner"
                                : "bg-transparent border-transparent text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-400"
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
                                className="flex items-center gap-2 p-2 hover:bg-zinc-900 rounded-lg cursor-pointer group"
                            >
                                {expandedFolders.has(folder) ? <ChevronDown size={14} className="text-zinc-600" /> : <ChevronRight size={14} className="text-zinc-600" />}
                                <FolderIcon size={14} className={clsx("transition-colors", expandedFolders.has(folder) ? "text-blue-500" : "text-zinc-700 group-hover:text-zinc-500")} />
                                <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200">{folder}</span>
                                <span className="text-[10px] text-zinc-600 font-medium ml-auto">{folderItems.length} papers</span>
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
