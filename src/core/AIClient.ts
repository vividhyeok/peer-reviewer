
export interface AIModel {
    id: string;
    name: string;
    provider: 'deepseek' | 'gemini' | 'openai';
}

export const AI_MODELS: AIModel[] = [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
    { id: 'gemini-pro', name: 'Gemini Pro', provider: 'gemini' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' }
];

type ChatMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

export class AIClient {
    private apiKey: string;
    private provider: 'deepseek' | 'gemini' | 'openai';
    private model: string;

    constructor(provider: 'deepseek' | 'gemini' | 'openai', apiKey: string, model: string) {
        this.provider = provider;
        this.apiKey = apiKey;
        this.model = model;
    }

    async chat(messages: ChatMessage[]): Promise<string> {
        if (!this.apiKey) throw new Error("API Key is missing");

        try {
            switch (this.provider) {
                case 'deepseek':
                    return this.callDeepSeek(messages);
                case 'gemini':
                    return this.callGemini(messages);
                case 'openai':
                    return this.callOpenAI(messages);
                default:
                    throw new Error("Invalid provider");
            }
        } catch (error) {
            console.error("AI API Call Failed:", error);
            throw error;
        }
    }

    private async callDeepSeek(messages: ChatMessage[]): Promise<string> {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model || 'deepseek-chat',
                messages: messages
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'DeepSeek API Error');
        return data.choices[0].message.content;
    }

    private async callOpenAI(messages: ChatMessage[]): Promise<string> {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model || 'gpt-3.5-turbo',
                messages: messages
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'OpenAI API Error');
        return data.choices[0].message.content;
    }

    private async callGemini(messages: ChatMessage[]): Promise<string> {
        // Simple mapping for Gemini: System prompt needs to be handled differently or merged
        // For simplicity, we'll just use the last user message or simple history construction
        const contents = messages.map((message) => ({
            role: message.role === 'user' ? 'user' : 'model',
            parts: [{ text: message.content }]
        }));

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model || 'gemini-pro'}:generateContent?key=${this.apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Gemini API Error');
        return data.candidates[0].content.parts[0].text;
    }
}
