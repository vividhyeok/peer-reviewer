// Keyboard Shortcut Hook
import { useEffect, useCallback } from 'react';
import type { Shortcut, ActionType } from '../types/settings';

export const useKeyboardShortcuts = (
  shortcuts: Shortcut[],
  onAction: (action: ActionType) => void,
  enabled: boolean = true
) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    if (e.repeat) return;

    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const pressedKey = normalizeKeyEvent(e);
    
    for (const shortcut of shortcuts) {
      if (keysMatch(shortcut.keys, pressedKey)) {
        e.preventDefault();
        onAction(shortcut.action);
        break;
      }
    }
  }, [shortcuts, onAction, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

function normalizeKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  
  if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt' && e.key !== 'Meta') {
    const key = e.key === ' ' ? 'Space' : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
    parts.push(key);
  }
  
  return parts.join('+');
}

function keysMatch(shortcutKeys: string, pressedKeys: string): boolean {
  const normalize = (keys: string) => keys
    .split('+')
    .map(k => k.trim())
    .sort()
    .join('+')
    .toLowerCase();
  
  return normalize(shortcutKeys) === normalize(pressedKeys);
}
