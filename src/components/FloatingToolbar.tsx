import * as React from 'react';
import { Sparkles, MessageSquare, BookOpen, X, Sigma, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingToolbarProps {
  x: number;
  y: number;
  visible: boolean;
  highlightColors: string[];
  onHighlight: (color: string) => void;
  onDefine: () => void;
  onQuestion: () => void;
  onChat: () => void;
  onExplain: () => void;
  onSummarize: () => void;
  onClose: () => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  x,
  y,
  visible,
  highlightColors,
  onHighlight,
  onDefine,
  onQuestion,
  onChat,
  onExplain,
  onSummarize,
  onClose,
}) => {
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.max(12, y - 64),
    left: x,
    transform: 'translateX(-50%)',
    zIndex: 1000,
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          style={style}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          className="ir-toolbar flex items-center gap-1.5 rounded-2xl px-2 py-1.5 border border-[color:var(--line)] bg-[color:var(--panel)] text-[color:var(--fg-primary)] shadow-xl shadow-black/10 dark:shadow-black/40 backdrop-blur-xl"
        >
          <div className="flex items-center gap-1 px-1">
            {highlightColors.slice(0, 5).map((color, index) => (
              <button
                key={`${color}-${index}`}
                className="w-[22px] h-[22px] rounded-full border border-black/10 hover:scale-110 active:scale-95 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => onHighlight(color)}
                title="Highlight"
              />
            ))}
          </div>

          <div className="w-px h-5 bg-[color:var(--line)]" />

          <button
            onClick={onClose}
            className="toolbar-action"
            title="Close"
          >
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
