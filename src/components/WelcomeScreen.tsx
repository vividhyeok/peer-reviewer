import React from 'react';
import { FileUp, Book, Github, Lightbulb, Command } from 'lucide-react';
import { motion } from 'framer-motion';

interface WelcomeScreenProps {
  onOpenLibrary: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenLibrary }) => {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-white text-zinc-600 select-none">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full flex flex-col items-center text-center space-y-8"
      >
        {/* Hero Section */}
        <div className="space-y-4">
          <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-1 ring-blue-500/20 shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)]">
            <Book size={40} className="text-blue-500" />
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 tracking-tight">
            Peer Reviewer
          </h1>
          <p className="text-lg text-zinc-500 max-w-md mx-auto">
            빠른 논문 읽기와 깊이 있는 이해를 돕는<br/>AI 기반 논문 리더 및 윤문 도구입니다.
          </p>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg mt-8">
          <button 
            onClick={onOpenLibrary}
            className="group flex flex-col items-center justify-center p-6 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-blue-500/30 rounded-xl transition-all duration-200"
          >
            <div className="p-3 bg-white border border-zinc-100 group-hover:bg-blue-50 rounded-lg mb-3 transition-colors">
              <FileUp size={24} className="text-zinc-500 group-hover:text-blue-500 transition-colors" />
            </div>
            <span className="font-semibold text-zinc-900">라이브러리 열기</span>
            <span className="text-xs text-zinc-500 mt-1">파일 선택 또는 드래그 & 드롭</span>
          </button>

          <button 
            disabled
            className="group flex flex-col items-center justify-center p-6 bg-zinc-50/50 border border-zinc-200/50 rounded-xl cursor-default opacity-60"
          >
            <div className="p-3 bg-zinc-100/50 rounded-lg mb-3">
              <Github size={24} className="text-zinc-400" />
            </div>
            <span className="font-semibold text-zinc-400">저장소 연결</span>
            <span className="text-xs text-zinc-500 mt-1">준비 중</span>
          </button>
        </div>

        {/* Hints / Shortcuts */}
        <div className="mt-12 flex flex-col md:flex-row gap-6 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded-md text-zinc-500 font-mono text-xs">Alt + L</kbd>
            <span>라이브러리 토글</span>
          </div>
          <div className="flex items-center gap-2">
             <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded-md text-zinc-500 font-mono text-xs">Alt + I</kbd>
            <span>AI 에이전트</span>
          </div>
          <div className="flex items-center gap-2">
             <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded-md text-zinc-500 font-mono text-xs">Alt + Click</kbd>
            <span>빠른 번역 (문장)</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
