import { useRef } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  BookOpen, 
  X, 
  Sigma, 
  FileText, 
  GraduationCap, 
  MessagesSquare, 
  Search, 
  HelpCircle,
  EyeOff
} from 'lucide-react';
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
  onHideTemporarily?: () => void;
}

// LoL-style Tooltip Component
const ActionTooltip: React.FC<{
  title: string;
  shortcut?: string;
  description: string;
  detailedDescription: string;
  children: React.ReactNode;
  onClick: () => void;
}> = ({ title, shortcut, description, detailedDescription, children, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Control') setShowDetail(e.type === 'keydown');
    };
    if (isHovered) {
      window.addEventListener('keydown', handleKey);
      window.addEventListener('keyup', handleKey);
    }
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, [isHovered]);

  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => { setIsHovered(true); setShowDetail(false); }}
      onMouseLeave={() => { setIsHovered(false); setShowDetail(false); }}
    >
      <button
        onClick={onClick}
        className="p-1.5 rounded-md text-[color:var(--fg-secondary)] hover:text-[color:var(--fg-primary)] hover:bg-[color:var(--bg-hover)] transition-colors"
      >
        {children}
      </button>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[240px] z-50 pointer-events-none"
          >
            <div className="bg-zinc-900/90 dark:bg-zinc-100/90 backdrop-blur-md text-zinc-100 dark:text-zinc-900 px-3 py-2 rounded-lg shadow-xl text-xs flex flex-col gap-1 border border-white/10 dark:border-black/5">
              <div className="flex items-center gap-2 border-b border-white/10 dark:border-black/5 pb-1 mb-0.5">
                <span className="font-bold text-sm tracking-tight">{title}</span>
                {shortcut && (
                  <span className="bg-white/10 dark:bg-black/10 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium">
                    {shortcut}
                  </span>
                )}
              </div>
              
              <div className="leading-relaxed opacity-90">
                 {showDetail ? (
                   <span className="text-blue-200 dark:text-blue-800 font-medium animate-pulse">
                     {detailedDescription}
                   </span>
                 ) : (
                   <span>{description}</span>
                 )}
              </div>
              
              {!showDetail && (
                <div className="mt-1 text-[10px] opacity-50 flex items-center gap-1">
                   <div className="w-3 h-3 flex items-center justify-center border border-current rounded-[3px]">^</div>
                   <span>Hold Ctrl for details</span>
                </div>
              )}
            </div>
            {/* Arrow */}
            <div className="w-2 h-2 bg-zinc-900/90 dark:bg-zinc-100/90 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
          className="ir-toolbar flex items-center gap-1 p-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-panel)] text-[color:var(--fg-primary)] shadow-2xl shadow-black/20 backdrop-blur-xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Section 1: Highlights */}
          <div className="flex items-center gap-1 px-1">
            {highlightColors.slice(0, 5).map((color, index) => (
              <button
                key={`${color}-${index}`}
                className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 active:scale-95 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => onHighlight(color)}
                title={`Highlight Color ${index + 1}`}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-[color:var(--border)] mx-1 opacity-50" />

          {/* Section 2: Instant AI Actions */}
          <div className="flex items-center gap-0.5">
            <ActionTooltip 
              title="Explain" 
              shortcut="Alt+E"
              description="Explain selected text"
              detailedDescription="Generates a clear explanation of concepts found in the text using AI."
              onClick={onExplain}
            >
              <Sparkles size={16} />
            </ActionTooltip>

            <ActionTooltip 
              title="Summarize" 
              shortcut="Alt+S"
              description="Summarize selection"
              detailedDescription="Condenses the selected paragraph into key points and insights."
              onClick={onSummarize}
            >
              <FileText size={16} />
            </ActionTooltip>

            <ActionTooltip 
              title="Dictionary" 
              shortcut="Alt+D"
              description="Define terms"
              detailedDescription="Provides academic definitions and context for technical terms."
              onClick={onDefine}
            >
              <BookOpen size={16} />
            </ActionTooltip>
          </div>

          <div className="w-px h-5 bg-[color:var(--border)] mx-1 opacity-50" />

          {/* Section 3: Deep Dive / Agent */}
          <div className="flex items-center gap-0.5">
             <ActionTooltip 
              title="Quick Ask" 
              shortcut="Alt+Q"
              description="Ask & Annotate"
              detailedDescription="Ask a question about this text and save the answer as a permanent note."
              onClick={onQuestion}
            >
              <HelpCircle size={16} />
            </ActionTooltip>
            
            <ActionTooltip 
              title="Discuss" 
              shortcut="Alt+C"
              description="Start discussion"
              detailedDescription="Initiates a Socratic dialogue with the AI about the implications of this text."
              onClick={onChat}
            >
              <MessagesSquare size={16} />
            </ActionTooltip>
          </div>

          <div className="w-px h-5 bg-[color:var(--border)] mx-1 opacity-50" />
            
          <div className="flex items-center gap-0.5">
             <button
               onClick={onClose}
               className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 transition-colors"
               title="Close Menu"
             >
                <X size={14} />
             </button>
          </div>

          <div className="w-px h-5 bg-[color:var(--border)] mx-1 opacity-50" />

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
