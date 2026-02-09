import { type ParagraphData, type Annotation } from '../types/ReaderTypes';
import { MultiAIClient } from './MultiAIClient';
import { type AIProvider } from '../types/settings';

export interface ExportOptions {
    type: 'insight-driven' | 'quick-scan';
    format: 'markdown';
}

export class SmartExporter {
    static async generateSummary(
        aiClient: MultiAIClient,
        modelInfo: { provider: AIProvider; modelId: string },
        paragraphs: ParagraphData[],
        annotations: Annotation[],
        options: ExportOptions
    ): Promise<string> {
        if (options.type === 'quick-scan') {
            return this.generateQuickScan(aiClient, modelInfo, paragraphs);
        } else {
            return this.generateInsightDriven(aiClient, modelInfo, paragraphs, annotations);
        }
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
