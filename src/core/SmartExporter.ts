import { type ParagraphData, type Annotation } from '../types/ReaderTypes';
import { MultiAIClient } from './MultiAIClient';
import { type AIProvider } from '../types/settings';

export interface ExportOptions {
    type: 'insight-driven' | 'quick-scan' | 'obsidian-structured' | 'raw-dump' | 'custom-prompt';
    format: 'markdown';
    scope?: 'all' | 'highlights-only' | 'until-bookmark';
    bookmarkId?: string;
    customPrompt?: string;
}

export class SmartExporter {
    static async generateSummary(
        aiClient: MultiAIClient,
        modelInfo: { provider: AIProvider; modelId: string },
        paragraphs: ParagraphData[],
        annotations: Annotation[],
        options: ExportOptions
    ): Promise<string> {
        // 1. Filter Content based on Scope
        let targetParagraphs = paragraphs;
        
        if (options.scope === 'until-bookmark' && options.bookmarkId) {
            const index = paragraphs.findIndex(p => p.id === options.bookmarkId);
            if (index !== -1) {
                targetParagraphs = paragraphs.slice(0, index + 1);
            }
        } else if (options.scope === 'highlights-only') {
            const highlightedIds = new Set(annotations.map(a => a.target.paragraphId));
            targetParagraphs = paragraphs.filter(p => highlightedIds.has(p.id));
        }

        // 2. Route to Generator
        if (options.type === 'raw-dump') {
            return this.generateRawDump(targetParagraphs, annotations);
        } else if (options.type === 'quick-scan') {
            return this.generateQuickScan(aiClient, modelInfo, targetParagraphs);
        } else if (options.type === 'obsidian-structured') {
            return this.generateObsidianNote(aiClient, modelInfo, targetParagraphs, annotations);
        } else if (options.type === 'custom-prompt') {
            return this.generateCustomPrompt(aiClient, modelInfo, targetParagraphs, annotations, options.customPrompt || '');
        } else {
            return this.generateInsightDriven(aiClient, modelInfo, targetParagraphs, annotations);
        }
    }

    private static generateRawDump(paragraphs: ParagraphData[], annotations: Annotation[]): string {
        const today = new Date().toISOString().split('T')[0];
        let md = `---\ntags: [paper-review, raw-export]\ndate: ${today}\n---\n\n# Raw Highlights & Notes\n\n`;

        paragraphs.forEach(p => {
            const pNotes = annotations.filter(a => a.target.paragraphId === p.id);
            if (pNotes.length === 0) return;

            md += `### Paragraph ${p.index} (ID: ${p.id})\n\n`;
            
            // Render Highlights as Quotes
            pNotes.filter(a => a.type === 'highlight' || a.type === 'note').forEach(a => {
                if (a.target.selectedText) {
                    md += `> ${a.target.selectedText}\n`;
                }
                if (a.content) {
                    md += `- **Note**: ${a.content}\n`;
                }
                md += `\n`;
            });
            
            // Render other types
            pNotes.filter(a => !['highlight', 'note'].includes(a.type)).forEach(a => {
                md += `- **[${a.type.toUpperCase()}]**: ${a.content}\n`;
                if(a.target.selectedText) md += `  (Context: "${a.target.selectedText.slice(0, 50)}...")\n`;
            });
            md += `\n---\n\n`;
        });
        return md;
    }

    private static async generateObsidianNote(
        aiClient: MultiAIClient,
        modelInfo: { provider: AIProvider; modelId: string },
        paragraphs: ParagraphData[],
        annotations: Annotation[]
    ): Promise<string> {
        // Collect crucial data
        const summaryContext = paragraphs.map(p => p.enText.replace(/<[^>]+>/g, '')).join('\n').slice(0, 8000);
        const userNotes = annotations.map(a => `- [${a.type}] Content: ${a.content} (on item: ${a.target.selectedText.slice(0,30)}...)`).join('\n');

        const prompt = `Create a high-quality Obsidian Markdown note for this research paper.
        
        Rules:
        1. Use **Frontmatter** for metadata (status: #reading, type: #paper).
        2. Use **Callouts** (e.g., > [!ABSTRACT], > [!IMPORTANT]) to structure the content.
        3. Create a **"Core Concepts"** section defining key terms found in text.
        4. Create a **"My Insights"** section that synthesizes the User Notes provided below.
        5. Add a **"Actionable Takeaways"** section.
        6. Keep it clean and structured.

        User Notes:
        ${userNotes}

        Paper Text (Excerpt):
        ${summaryContext}
        
        Response Language: Korean (but keep technical terms in English where appropriate).`;

        const response = await aiClient.sendMessage(modelInfo.provider, modelInfo.modelId, [
            { role: 'user', content: prompt }
        ]);

        return response.content;
    }

    private static async generateCustomPrompt(
        aiClient: MultiAIClient,
        modelInfo: { provider: AIProvider; modelId: string },
        paragraphs: ParagraphData[],
        annotations: Annotation[],
        customPrompt: string
    ): Promise<string> {
        const textContext = paragraphs.map(p => p.enText.replace(/<[^>]+>/g, '')).join('\n').slice(0, 10000);
        const noteContext = annotations.map(a => `[${a.type}] ${a.content}`).join('\n');

        const fullPrompt = `${customPrompt}
        
        Reference Materials:
        - Paper Content (Truncated): ${textContext}
        - User Notes: ${noteContext}
        
        Answer in Korean unless specified otherwise.`;

        const response = await aiClient.sendMessage(modelInfo.provider, modelInfo.modelId, [
            { role: 'user', content: fullPrompt }
        ]);

        return response.content;
    }

    private static async generateQuickScan(
        aiClient: MultiAIClient,
        modelInfo: { provider: AIProvider; modelId: string },
        paragraphs: ParagraphData[]
    ): Promise<string> {
        const fullText = paragraphs.map(p => p.enText.replace(/<[^>]+>/g, '')).join('\n\n').slice(0, 12000);
        const prompt = `논문의 핵심 내용을 빠른 파악을 위한 고수준 요약을 생성하세요.
        다음에 집중하세요:
        1. 배경/동기
        2. 핵심 알고리즘/방법론
        3. 주요 결과
        
        **반드시 한국어로 작성하고**, 명확한 마크다운 형식을 사용하세요.`;

        const response = await aiClient.sendMessage(modelInfo.provider, modelInfo.modelId, [
            { role: 'system', content: prompt },
            { role: 'user', content: fullText }
        ]);

        return response.content;
    }

    private static async generateInsightDriven(
        aiClient: MultiAIClient,
        modelInfo: { provider: AIProvider; modelId: string },
        paragraphs: ParagraphData[],
        annotations: Annotation[]
    ): Promise<string> {
        // 1. Analyze activity: Count annotations per paragraph
        const paragraphActivity = paragraphs.map(p => {
            const count = annotations.filter(a => a.target.paragraphId === p.id).length;
            return { id: p.id, text: p.enText.replace(/<[^>]+>/g, ''), count };
        });

        // 2. Identify Hot Zones
        const hotZones = paragraphActivity
            .sort((a, b) => b.count - a.count)
            .filter(z => z.count > 0 || z.text.length > 200) // Keep some context
            .slice(0, 15);

        // 3. Extract User Notes for those zones
        const details = hotZones.map(zone => {
            const zoneNotes = annotations.filter(a => a.target.paragraphId === zone.id);
            return `Paragraph Content: ${zone.text.slice(0, 300)}...
            User Interactions (${zoneNotes.length}):
            ${zoneNotes.map(n => `- [${n.type.toUpperCase()}] ${n.content}`).join('\n')}
            `;
        }).join('\n\n');

        const prompt = `당신은 연구 논문 합성 전문가입니다. 사용자가 이 논문을 읽고 다수의 노트와 하이라이트를 남겼습니다.
        사용자 맞춤형 합성 요약을 생성하세요.
        **사용자가 가장 많이 상호작용한 섹션을 우선순위로** 다루세요.
        사용자의 노트를 요약에 통합하여 그들의 통찰이 논문과 어떻게 연관되는지 보여주세요.
        
        전체 하이라이트/노트 수: ${annotations.length}
        주요 상호작용 섹션:
        ${details}
        
        **반드시 한국어로 작성하고**, 전문적인 연구 합성 형식(마크다운)을 사용하세요.`;

        const response = await aiClient.sendMessage(modelInfo.provider, modelInfo.modelId, [
            { role: 'system', content: prompt },
            { role: 'user', content: "제 읽기 활동을 기반으로 문서를 합성해주세요." }
        ]);

        return response.content;
    }
}
