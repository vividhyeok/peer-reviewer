import * as React from 'react';
import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InputModalProps {
    isOpen: boolean;
    title: string;
    description?: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
}

export const InputModal: React.FC<InputModalProps> = ({ isOpen, title, description, onConfirm, onCancel }) => {
    const [value, setValue] = useState('');
    const trimmedValue = value.trim();

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10 border border-zinc-200"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
                            <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
                            <button 
                                onClick={onCancel} 
                                className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4">
                            {description && <p className="mb-4 text-sm text-zinc-500">{description}</p>}
                            <textarea
                                autoFocus
                                className="w-full h-32 p-3 bg-gray-50 border border-zinc-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-zinc-900 placeholder:text-zinc-400"
                                placeholder="여기에 입력하세요..."
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (trimmedValue) {
                                            onConfirm(trimmedValue);
                                        }
                                    } else if (e.key === 'Escape') {
                                        onCancel();
                                    }
                                }}
                            />
                            <p className="mt-2 text-[11px] text-zinc-400">{trimmedValue.length} 자</p>
                            
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={onCancel}
                                    className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => onConfirm(trimmedValue)}
                                    disabled={!trimmedValue}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm shadow-blue-500/20 transition-all"
                                >
                                    확인
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
