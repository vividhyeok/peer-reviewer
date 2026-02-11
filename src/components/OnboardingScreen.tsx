import React, { useState } from 'react';
import { HardDrive, FolderOpen, ChevronRight, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { LocalStorageManager } from '../core/LocalStorageManager';

interface OnboardingScreenProps {
    onComplete: (path: string) => void;
    storageManager: LocalStorageManager;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete, storageManager }) => {
    const [isCreating, setIsCreating] = useState(false);

    const handleSelectDefault = async () => {
        // Empty string means default path in Logic
        onComplete(''); 
    };

    const handleSelectCustom = async () => {
        const path = await storageManager.requestDirectory();
        if (path) {
             onComplete(path); 
        }
    };

    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-white text-zinc-600 select-none">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-xl w-full flex flex-col items-center text-center space-y-8"
            >
                <div className="space-y-4">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-blue-500/20">
                        <HardDrive size={32} className="text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                        데이터 저장소 설정
                    </h1>
                    <p className="text-base text-zinc-500 max-w-md mx-auto leading-relaxed">
                        논문, 주석, AI 채팅 기록 등 모든 데이터가 저장될 위치를 선택해주세요.<br />
                        <span className="text-xs text-zinc-400 mt-2 block">
                            (한번 설정하면 이후에는 자동으로 연결됩니다)
                        </span>
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 w-full">
                    {/* Option 1: Default */}
                    <button
                        onClick={handleSelectDefault}
                        className="group flex items-start text-left p-5 bg-zinc-50 hover:bg-white hover:ring-2 hover:ring-blue-500 border border-zinc-200 rounded-xl transition-all shadow-sm hover:shadow-md"
                    >
                        <div className="p-3 bg-white border border-zinc-200 rounded-lg mr-4 shrink-0">
                            <Check size={20} className="text-zinc-400 group-hover:text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <span className="block font-bold text-zinc-900 text-sm mb-1">기본 문서 폴더 사용</span>
                            <span className="block text-xs text-zinc-500">
                                <code>내 문서/paper-reader-data</code>에 저장합니다.<br/>
                                가장 간편한 방법입니다.
                            </span>
                        </div>
                        <ChevronRight size={16} className="text-zinc-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>

                    {/* Option 2: Custom */}
                    <button
                        onClick={handleSelectCustom}
                        className="group flex items-start text-left p-5 bg-zinc-50 hover:bg-white hover:ring-2 hover:ring-blue-500 border border-zinc-200 rounded-xl transition-all shadow-sm hover:shadow-md"
                    >
                        <div className="p-3 bg-white border border-zinc-200 rounded-lg mr-4 shrink-0">
                            <FolderOpen size={20} className="text-zinc-400 group-hover:text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <span className="block font-bold text-zinc-900 text-sm mb-1">다른 폴더 선택...</span>
                            <span className="block text-xs text-zinc-500">
                                외장 하드, 클라우드 동기화 폴더(Dropbox 등) 또는<br/>
                                원하는 위치를 직접 지정합니다.
                            </span>
                        </div>
                         <ChevronRight size={16} className="text-zinc-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                </div>
            </motion.div>
        </div>
    );
};