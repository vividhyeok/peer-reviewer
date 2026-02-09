import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, MessageCircle, Check, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import type { AIMessage } from '../core/MultiAIClient';

interface AIDiscussionModalProps {
  isOpen: boolean;
  selectedText: string;
  paragraphContext?: string;
  onClose: () => void;
  onSendMessage: (message: string) => Promise<string>;
  onEndDiscussion: (chatHistory: AIMessage[]) => Promise<void>;
}

export const AIDiscussionModal: React.FC<AIDiscussionModalProps> = ({
  isOpen,
  selectedText,
  paragraphContext,
  onClose,
  onSendMessage,
  onEndDiscussion,
}) => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setInput('');
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: AIMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await onSendMessage(input.trim());
      const assistantMessage: AIMessage = { role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const applyPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleEndDiscussion = async () => {
    setEnding(true);
    try {
      await onEndDiscussion(messages);
      onClose();
      toast.success('Discussion saved');
    } catch (error) {
      console.error('Failed to end discussion:', error);
      toast.error('Failed to save discussion summary');
    } finally {
      setEnding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative z-10 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl shadow-black/20 w-full max-w-2xl max-h-[82vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shadow-sm">
                  <MessageCircle size={15} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">AI Discussion</h3>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Ask questions about selected text</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Context Banner */}
            <div className="px-5 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-1">Context</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 italic line-clamp-2 leading-relaxed">"{selectedText}"</p>
              {paragraphContext && paragraphContext !== selectedText && (
                <p className="text-xs mt-1 text-zinc-500 dark:text-zinc-400 line-clamp-2">{paragraphContext}</p>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                    <Bot size={22} className="text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Start a conversation</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Ask anything about the selected text</p>
                </div>
              )}

              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className={clsx("flex gap-2.5", msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        <Bot size={13} />
                      </div>
                    )}
                    <div
                      className={clsx(
                        "max-w-[78%] px-4 py-3 rounded-2xl text-sm",
                        msg.role === 'user'
                          ? "bg-zinc-900 text-white rounded-br-md"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-md border border-zinc-200/50 dark:border-zinc-700/50"
                      )}
                    >
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      ) : (
                        <div className="prose dark:prose-invert prose-sm prose-p:leading-relaxed prose-p:my-1.5 prose-pre:bg-zinc-800 dark:prose-pre:bg-zinc-900 prose-pre:rounded-lg prose-pre:border prose-pre:border-zinc-700 prose-code:text-[13px] max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-md bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-white">
                        <User size={13} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-sm">
                    <Bot size={13} />
                  </div>
                  <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-md border border-zinc-200/50 dark:border-zinc-700/50">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  'Explain this in simpler terms.',
                  'What is the key assumption here?',
                  'How does this compare to prior work?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => applyPrompt(prompt)}
                    className="px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ask a question…"
                  disabled={loading}
                  rows={3}
                  className="flex-1 px-4 py-2.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 focus:border-zinc-400 disabled:opacity-50 transition-all resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="p-2.5 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 mb-2">Press Ctrl/Cmd + Enter to send.</p>

              {messages.length > 0 && (
                <button
                  onClick={handleEndDiscussion}
                  disabled={ending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 shadow-sm transition-all active:scale-[0.98]"
                >
                  {ending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      End Discussion & Save
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
