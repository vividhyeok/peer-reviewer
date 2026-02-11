import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

export interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    commands: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const filteredCommands = commands.filter((cmd) =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setActiveIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((prev) => (prev + 1) % filteredCommands.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === 'Enter') {
                if (filteredCommands[activeIndex]) {
                    filteredCommands[activeIndex].action();
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, activeIndex, onClose]);

    // Ensure active item is visible in scroll
    useEffect(() => {
        const activeEl = scrollRef.current?.children[activeIndex] as HTMLElement;
        if (activeEl && scrollRef.current) {
            const container = scrollRef.current;
            const { offsetTop, offsetHeight } = activeEl;
            const { scrollTop, clientHeight } = container;

            if (offsetTop < scrollTop) {
                container.scrollTop = offsetTop;
            } else if (offsetTop + offsetHeight > scrollTop + clientHeight) {
                container.scrollTop = offsetTop + offsetHeight - clientHeight;
            }
        }
    }, [activeIndex]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
                    />

                    {/* Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col"
                    >
                        {/* Search Input */}
                        <div className="flex items-center px-4 py-4 border-b border-zinc-200 bg-zinc-50">
                            <Search className="text-zinc-400 mr-3" size={18} />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Type a command or search..."
                                className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 placeholder:text-zinc-500"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-200 text-[10px] font-bold text-zinc-500 tracking-wider">
                                <span>ESC</span>
                            </div>
                        </div>

                        {/* Results */}
                        <div
                            ref={scrollRef}
                            className="max-h-[350px] overflow-y-auto py-2 custom-scrollbar"
                        >
                            {filteredCommands.length > 0 ? (
                                filteredCommands.map((cmd, idx) => (
                                    <button
                                        key={cmd.id}
                                        onClick={() => { cmd.action(); onClose(); }}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                        className={clsx(
                                            "w-full flex items-center px-4 py-2.5 transition-all text-left",
                                            idx === activeIndex
                                                ? "bg-blue-600/10 border-l-4 border-blue-500"
                                                : "bg-transparent border-l-4 border-transparent hover:bg-zinc-100"
                                        )}
                                    >
                                        <div className={clsx(
                                            "p-2 rounded-lg mr-3",
                                            idx === activeIndex ? "text-blue-500" : "text-zinc-400"
                                        )}>
                                            {cmd.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={clsx(
                                                "text-sm font-medium truncate",
                                                idx === activeIndex ? "text-blue-500" : "text-zinc-700"
                                            )}>
                                                {cmd.label}
                                            </p>
                                            {cmd.description && (
                                                <p className="text-[11px] text-zinc-400 truncate mt-0.5">{cmd.description}</p>
                                            )}
                                        </div>
                                        {cmd.shortcut && (
                                            <span className="ml-4 text-[10px] font-mono font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                                                {cmd.shortcut}
                                            </span>
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className="py-12 text-center">
                                    <p className="text-sm text-zinc-500">No commands matching "{query}"</p>
                                </div>
                            )}
                        </div>

                        {/* Hint */}
                        <div className="px-4 py-2.5 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1"><span className="p-1 rounded bg-zinc-200">↑↓</span> to navigate</span>
                                <span className="flex items-center gap-1"><span className="p-1 rounded bg-zinc-200">ENTER</span> to select</span>
                            </div>
                            <span className="italic flex items-center gap-1">Command Sync <ChevronRight size={10} /></span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
