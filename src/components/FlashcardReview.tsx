import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Brain, Check, RefreshCw } from 'lucide-react';
import type { Annotation } from '../types/ReaderTypes';

interface FlashcardReviewProps {
  isOpen: boolean;
  onClose: () => void;
  annotations: Annotation[];
}

export const FlashcardReview: React.FC<FlashcardReviewProps> = ({ isOpen, onClose, annotations }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Filter for definitions (concept -> definition) and questions (user thought -> ?)
  const cards = useMemo(() => {
    return annotations.filter(a => a.type === 'definition' || a.type === 'question').map(a => ({
        id: a.id,
        front: a.type === 'definition' ? a.target.selectedText : "Question", // Term or "Question"
        back: a.content, // Definition or User's Question content
        type: a.type,
        context: a.target.selectedText
    }));
  }, [annotations]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 200);
  };
  
  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl flex flex-col items-center">
        
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 text-zinc-900">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Brain className="text-purple-600" size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold">Concept Review</h2>
                    <p className="text-zinc-500 text-sm">
                        {cards.length > 0 ? `${currentIndex + 1} of ${cards.length} cards` : 'No concepts found'}
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors">
                <X size={24} />
            </button>
        </div>

        {cards.length === 0 ? (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-12 text-center">
                <p className="text-zinc-500 text-lg">No definitions or questions found to review.</p>
                <p className="text-zinc-600 text-sm mt-2">Use the AI "Define" tool or add Questions highlights context.</p>
            </div>
        ) : (
            <>
                {/* Card Perspective */}
                <div className="relative w-full aspect-[3/2] perspective-1000 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                    <motion.div 
                        className="w-full h-full relative preserve-3d transition-all duration-500"
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                    >
                        {/* Front */}
                        <div className="absolute inset-0 backface-hidden bg-white border border-zinc-200 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8 text-center group hover:border-blue-500/30 transition-colors">
                            <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4 bg-zinc-100 px-3 py-1 rounded-full">
                                {currentCard.type === 'definition' ? 'Term' : 'Context'}
                            </span>
                            <h3 className="text-3xl font-bold text-zinc-900 mb-6 leading-tight">
                                {currentCard.front}
                            </h3>
                            <span className="text-zinc-500 text-sm opacity-50 group-hover:opacity-100 transition-opacity">
                                Click to flip
                            </span>
                        </div>

                        {/* Back */}
                        <div className="absolute inset-0 backface-hidden bg-zinc-50 border-2 border-purple-500/20 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8 text-center rotate-y-180">
                            <span className="text-xs font-mono uppercase tracking-widest text-purple-600 mb-4 bg-purple-500/10 px-3 py-1 rounded-full">
                                {currentCard.type === 'definition' ? 'Definition' : 'My Question'}
                            </span>
                            <p className="text-lg text-zinc-700 leading-relaxed max-h-[80%] overflow-y-auto">
                                {currentCard.back}
                            </p>
                        </div>
                    </motion.div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-6 mt-8">
                    <button onClick={handlePrev} className="p-4 rounded-full bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-all">
                        <ChevronLeft size={24} />
                    </button>
                    
                    <button onClick={() => setIsFlipped(!isFlipped)} className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-lg shadow-blue-500/20">
                        <RefreshCw size={18} className={isFlipped ? "rotate-180 transition-transform" : ""} />
                        <span>{isFlipped ? "Show Term" : "Show Definition"}</span>
                    </button>

                    <button onClick={handleNext} className="p-4 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white transition-all">
                        <ChevronRight size={24} />
                    </button>
                </div>
            </>
        )}

      </div>
    </div>
  );
};
