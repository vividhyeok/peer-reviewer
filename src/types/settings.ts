export type AIProvider = 'deepseek' | 'gemini' | 'openai';

export type AIModel = {
  id: string;
  name: string;
  provider: AIProvider;
  contextWindow: number;
  costPer1MTokens?: number;
};

// AI Models Configuration
export const AI_MODELS: AIModel[] = [
  // DeepSeek (Cost-Effective)
  { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', provider: 'deepseek', contextWindow: 64000, costPer1MTokens: 0.14 },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', provider: 'deepseek', contextWindow: 64000, costPer1MTokens: 0.55 },

  // Google Gemini (Efficient & Multimodal)
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', contextWindow: 1000000, costPer1MTokens: 0.075 },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', contextWindow: 2000000, costPer1MTokens: 1.25 },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Exp)', provider: 'gemini', contextWindow: 1000000, costPer1MTokens: 0.0 },
  
  // OpenAI (Standard)
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, costPer1MTokens: 2.50 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000, costPer1MTokens: 0.15 },
  { id: 'o1-mini', name: 'o1 Mini (Reasoning)', provider: 'openai', contextWindow: 128000, costPer1MTokens: 3.00 },
];

export type ActionType =
  | 'highlight'
  | 'define'
  | 'question'
  | 'comment'
  | 'ai-explain'
  | 'ai-summarize'
  | 'ai-discuss-start'
  | 'ai-discuss-end'
  | 'toggle-translation'
  | 'next-highlight'
  | 'prev-highlight'
  | 'undo'
  | 'redo'
  | 'search';

export type Shortcut = {
  action: ActionType;
  keys: string; // e.g., "Ctrl+H", "Alt+D"
  description: string;
};

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { action: 'highlight', keys: 'Alt+H', description: 'Highlight selection' },
  { action: 'define', keys: 'Alt+D', description: 'Add definition (ABBR)' },
  { action: 'question', keys: 'Alt+Q', description: 'Add question/answer' },
  { action: 'comment', keys: 'Alt+M', description: 'Add inline comment' },
  { action: 'ai-explain', keys: 'Alt+E', description: 'AI: Explain selection' },
  { action: 'ai-summarize', keys: 'Alt+S', description: 'AI: Summarize selection' },
  { action: 'ai-discuss-start', keys: 'Alt+Shift+D', description: 'AI: Start discussion' },
  { action: 'ai-discuss-end', keys: 'Alt+Shift+E', description: 'AI: End & save discussion as ABBR' },
  { action: 'toggle-translation', keys: 'Alt+T', description: 'Toggle EN/KO for paragraph' },
  { action: 'next-highlight', keys: 'Alt+ArrowDown', description: 'Navigate to next highlight' },
  { action: 'prev-highlight', keys: 'Alt+ArrowUp', description: 'Navigate to previous highlight' },
  { action: 'undo', keys: 'Ctrl+Z', description: 'Undo last action' },
  { action: 'redo', keys: 'Ctrl+Shift+Z', description: 'Redo last action' },
  { action: 'search', keys: 'Alt+F', description: 'Search in document' },
];

export type AIFeature =
  | 'explain'
  | 'summarize'
  | 'discussion'
  | 'formula'
  | 'table'
  | 'chat';

export type ModelAssignment = {
  [key in AIFeature]: string; // Model ID
};

export interface AppSettings {
  // API Keys
  apiKeys: {
    [key in AIProvider]: string;
  };

  // Model Assignments per Feature
  modelAssignments: ModelAssignment;

  // Shortcuts
  shortcuts: Shortcut[];

  // UI Preferences
  isKoreanPrimary: boolean;
  theme: 'light' | 'dark';
  uiZoom: number;
  sidebarWidths: {
    left: number;
    right: number;
  };
  defaultLanguage: 'en' | 'ko';
  highlightColors: string[];
  autoSaveInterval: number; // seconds
  dataRootPath?: string; // Optional user-defined root path
  setupCompleted?: boolean; // Whether the initial setup (storage selection) is done
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKeys: {
    'deepseek': '',
    'gemini': '',
    'openai': '',
  },
  modelAssignments: {
    'explain': 'deepseek-chat',
    'summarize': 'deepseek-chat',
    'discussion': 'deepseek-reasoner',
    'formula': 'gemini-1.5-flash',
    'table': 'gemini-1.5-flash',
    'chat': 'gemini-1.5-flash',
  },
  shortcuts: DEFAULT_SHORTCUTS,
  isKoreanPrimary: true,
  theme: 'light',
  uiZoom: 1.0,
  sidebarWidths: {
    left: 450,
    right: 450
  },
  defaultLanguage: 'en',
  highlightColors: ['#fef08a', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74'],
  autoSaveInterval: 30,
  dataRootPath: '',
  setupCompleted: false,
};
