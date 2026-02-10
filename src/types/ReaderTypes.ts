export type AnnotationType = 'definition' | 'discussion' | 'comment' | 'highlight' | 'insight' | 'question' | 'note' | 'ai_response';

export interface AnnotationTarget {
    paragraphId: string;
    textHash: string;
    startOffset: number;
    endOffset: number;
    selectedText: string;
}

export interface Annotation {
    id: string;
    type: AnnotationType;
    content: string;
    target: AnnotationTarget;
    color?: string;
    createdAt: number;
}

export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    context?: {
        paragraphId: string;
        textSnippet?: string;
    };
}

export interface AlignedSentence {
    en: string;
    ko: string;
}

export interface Citation {
    id: string; // The text of the citation, e.g., "[1]"
    paragraphId?: string; // Target paragraph if found
}

export interface ParagraphData {
    id: string;
    element: string;
    enText: string;
    koText: string;
    sentences: AlignedSentence[];
    citations: Citation[];
    index: number;
    isReference?: boolean;
    // Enhanced Types
    type: 'text' | 'image' | 'table' | 'heading' | 'code'; 
    metadata?: {
        src?: string;      
        alt?: string;      
        caption?: string;  
        headingLevel?: number; 
        headingId?: string; 
    };
}

export interface TocItem {
    id: string;      
    text: string;    
    level: number;    
    paragraphId: string;
}

export interface PaperStructure {
    toc: TocItem[];
    figures: { id: string, desc: string }[];
    tables: { id: string, desc: string }[];
}

export interface SelectionState {
    paragraphId: string;
    text: string;
    range: {
        start: number;
        end: number;
    };
}

export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIResponse {
    content: string;
    usage?: any;
}

export interface PaperSummary {
    takeaway: string; // The 3-line synthesis
    objective: string;
    methodology: string;
    results: string;
    limitations?: string;
}

export type AgentTaskType = 'search' | 'extract' | 'analyze' | 'author-sim' | 'synthesize';

export interface AgentThought {
    id: string;
    type: AgentTaskType;
    status: 'pending' | 'running' | 'completed' | 'failed';
    message: string;
    result?: string;
}

export interface AgentSession {
    id: string;
    query: string;
    thoughts: AgentThought[];
    finalAnswer?: string;
}
