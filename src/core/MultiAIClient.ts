import type { AIProvider } from '../types/settings';
import type { AIMessage, AIResponse, AgentThought, AgentTaskType, AgentSession, PaperSummary } from '../types/ReaderTypes';

export { type AIMessage, type AIResponse };

export class MultiAIClient {
  private apiKeys: { [key in AIProvider]: string };

  constructor(apiKeys: { [key in AIProvider]: string }) {
    this.apiKeys = apiKeys;
  }

  async sendMessage(
    provider: AIProvider,
    modelId: string,
    messages: AIMessage[],
    options: { temperature?: number } = {}
  ): Promise<AIResponse> {
    const apiKey = this.apiKeys[provider];
    if (!apiKey) {
      console.error(`No API key for provider: ${provider}`);
      throw new Error(`설정에서 ${provider} API 키를 먼저 등록하세요.`);
    }

    console.log(`AI Request: ${provider} / ${modelId}`);

    if (provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature: options.temperature ?? 0.7,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('DeepSeek API Error:', data);
        throw new Error(`DeepSeek: ${data.error?.message || 'API 요청 실패'}`);
      }
      return {
        content: data.choices[0].message.content,
        usage: data.usage,
      };
    }

    if (provider === 'gemini') {
      const systemMessage = messages.find(m => m.role === 'system');
      const chatMessages = messages.filter(m => m.role !== 'system');

      const body: any = {
        contents: chatMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: 8192,
        },
      };

      if (systemMessage) {
        body.system_instruction = {
          parts: [{ text: systemMessage.content }]
        };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        console.error('Gemini API Error:', data);
        const errorMsg = data.error?.message || JSON.stringify(data.error) || `HTTP ${response.status}`;
        throw new Error(`Gemini: ${errorMsg}`);
      }

      if (!data.candidates || data.candidates.length === 0) {
        console.error('Gemini No Candidates:', data);
        const reason = data.promptFeedback?.blockReason || 'Safety filter or empty response';
        throw new Error(`Gemini: ${reason}`);
      }

      const candidate = data.candidates[0];
      if (!candidate.content?.parts?.[0]?.text) {
        console.error('Gemini Invalid Response:', data);
        throw new Error('Gemini: Invalid response structure');
      }

      return {
        content: candidate.content.parts[0].text,
        usage: data.usageMetadata,
      };
    }

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature: options.temperature ?? 0.7,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('OpenAI API Error:', data);
        throw new Error(`OpenAI: ${data.error?.message || 'API 요청 실패'}`);
      }
      return {
        content: data.choices[0].message.content,
        usage: data.usage,
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  // --- Agent Orchestration (Phase 7) ---

  async orchestrate(
    modelInfo: { provider: AIProvider; modelId: string },
    query: string,
    documentText: string,
    onThought: (thought: AgentThought) => void
  ): Promise<string> {
    const session: AgentSession = {
      id: crypto.randomUUID(),
      query,
      thoughts: []
    };

    // Analyze user intent for output format
    const requiresMarkdown = /마크다운|markdown|md|코드블록|code\s*block/i.test(query);
    const requiresSummary = /정리|요약|summary|summarize/i.test(query);

    const addThought = (type: AgentTaskType, message: string) => {
      const thought: AgentThought = {
        id: crypto.randomUUID(),
        type,
        status: 'running',
        message
      };
      session.thoughts.push(thought);
      onThought(thought);
      return thought;
    };

    const updateThought = (thought: AgentThought, result: string, status: AgentThought['status'] = 'completed') => {
      thought.result = result;
      thought.status = status;
      onThought(thought);
    };

    try {
      // Step 1: Planning
      const planThought = addThought('analyze', 'Analyzing query and planning research steps...');
      const plannerPrompt = `You are a Research Architect. Break down this user query into 1-3 concrete sub-tasks.
      Available Tools:
      - search: Search for real-world context/applications outside the paper.
      - extract: Find and format specific data/facts into Markdown code blocks.
      - author-sim: Roleplay as the author to explain the "why".
      - analyze: Perform deep technical analysis of the paper content.
      - critic: Rigorously challenge the methodology, assumptions, and results. Identify missing citations or potential biases.
      - hypothesize: Propose 3-5 concrete "Future Work" or "Next Step" research directions based on findings.

      User Query: "${query}"

      Return ONLY a JSON array: [{ "tool": "search" | "extract" | "author-sim" | "analyze", "goal": "..." }]
      IMPORTANT: All sub-goals and reasoning must be in Korean (한국어로 작성).`;

      const planResponse = await this.sendMessage(modelInfo.provider, modelInfo.modelId, [
        { role: 'system', content: plannerPrompt }
      ], { temperature: 0.1 });

      const plan = JSON.parse(planResponse.content.replace(/```json|```/g, '').trim());
      updateThought(planThought, `Plan created: ${plan.length} steps.`);

      // Step 2: Execution
      const results: string[] = [];
      for (const step of plan) {
        const stepThought = addThought(step.tool, step.goal);

        let systemPrompt = "";
        if (step.tool === 'author-sim') {
          systemPrompt = "You are the primary author of the paper below. Answer questions with the confidence, nuance, and perspective of the researcher who wrote it. Justify your choices. Always respond in Korean (한국어로 답변하세요).";
        } else if (step.tool === 'extract') {
          systemPrompt = "You are a data extraction specialist. Extract the requested information and format it in Clean Markdown Code Blocks. Provide a brief rationale for each block. Always respond in Korean (한국어로 답변하세요).";
        } else if (step.tool === 'search') {
          systemPrompt = "You are a field researcher. Contextualize the paper's findings within the current 2024-2025 state of the industry/field. Use your internal knowledge as the 'search tool'. Always respond in Korean (한국어로 답변하세요).";
        } else if (step.tool === 'critic') {
          systemPrompt = "You are a Rigorous Peer Reviewer. Your goal is to find holes. Challenge the experimental setup, the statistical significance, the generalizability of results, and the logical leaps between the data and conclusions. Be critical but constructive. Always respond in Korean (한국어로 답변하세요).";
        } else if (step.tool === 'hypothesize') {
          systemPrompt = "You are a Research Visionary. Based on the paper's contributions, propose the 'next big thing'. What are the logical extensions? What industries could this transform? Propose concrete, testable hypotheses for follow-up studies. Always respond in Korean (한국어로 답변하세요).";
        } else {
          systemPrompt = "Perform high-level academic analysis of the paper text provided. Always respond in Korean (한국어로 답변하세요).";
        }

        const stepResponse = await this.sendMessage(modelInfo.provider, modelInfo.modelId, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Goal: ${step.goal}\n\nDocument Context:\n${documentText.slice(0, 8000)}` }
        ]);

        results.push(`[${step.tool.toUpperCase()}] ${stepResponse.content}`);
        updateThought(stepThought, "Step completed.");
      }

      // Step 3: Synthesis
      const synthThought = addThought('synthesize', 'Synthesizing all research findings...');
      
      let synthSystemPrompt = "You are the Lead Researcher. Synthesize the sub-agent outputs into a final, comprehensive answer for the user. PLEASE RESPOND IN KOREAN (한국어로 상세히 답변하세요).";
      
      // Add format guidance based on user intent
      if (requiresMarkdown) {
        synthSystemPrompt += "\n\n**IMPORTANT**: The user requested structured markdown output. Format your response with proper markdown syntax including:\n- Headers (##, ###)\n- Code blocks (```language)\n- Bullet points and numbered lists\n- Bold/italic emphasis\n- Tables if applicable\nProvide a well-organized, structured document.";
      } else if (requiresSummary) {
        synthSystemPrompt += "\n\n**IMPORTANT**: The user requested a summary. Provide a concise, conversational summary in plain text (not heavily structured markdown). Focus on key insights and main points in 2-3 paragraphs.";
      }
      
      const synthResponse = await this.sendMessage(modelInfo.provider, modelInfo.modelId, [
        { role: 'system', content: synthSystemPrompt },
        { role: 'user', content: `Original Query: ${query}\n\nAgent Findings:\n${results.join('\n\n')}` }
      ]);

      updateThought(synthThought, "Synthesis complete.");
      return synthResponse.content;

    } catch (e) {
      console.error('Orchestration failed', e);
      throw e;
    }
  }

  // --- Legacy / Specific Tasks ---
  async extractMetadata(
    modelInfo: { provider: AIProvider; modelId: string },
    text: string
  ): Promise<{ title?: string; author?: string }> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'Extract the scientific paper title and authors from the provided text. Return ONLY JSON: { "title": "...", "author": "..." }. Keep title in original language. Always respond in Korean (한국어로 답변하세요).',
      },
      { role: 'user', content: text.slice(0, 5000) },
    ];

    const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages);
    try {
      return JSON.parse(response.content.replace(/```json|```/g, '').trim());
    } catch (e) {
      console.warn('Failed to parse metadata JSON', e);
      return {};
    }
  }

  async explainSelection(
    modelInfo: { provider: AIProvider; modelId: string },
    selection: string,
    context?: string
  ): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: '전문적인 연구 보조자로서, 선택된 구절을 쉽고 정확하게 한국어로 설명하세요. 문맥이 제공되면 이를 활용해 정확한 해석을 제공하세요.',
      },
      {
        role: 'user',
        content: `${context ? `문맥:\n${context}\n\n` : ''}설명할 구절: "${selection}"`,
      },
    ];

    const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages);
    return response.content;
  }

  async summarizeSelection(
    modelInfo: { provider: AIProvider; modelId: string },
    selection: string,
    context?: string
  ): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: '선택된 텍스트의 핵심 기여나 발견을 1-2문장으로 압축하여 한국어로 요약하세요. 연구 로그에 적합하도록 간결하고 강력하게 작성하세요.',
      },
      {
        role: 'user',
        content: `${context ? `문맥:\n${context}\n\n` : ''}요약할 구절: "${selection}"`,
      },
    ];

    const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages);
    return response.content;
  }

  async answerQuestion(
    modelInfo: { provider: AIProvider; modelId: string },
    question: string,
    selection: string,
    context?: string
  ): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'Answer the user\'s question about the scientific paper passage provided. Be concise and use evidence from the text. ALWAYS RESPOND IN KOREAN (한국어로 답변하세요).',
      },
      {
        role: 'user',
        content: `${context ? `Context:\n${context}\n\n` : ''}Passage: "${selection}"\n\nQuestion: ${question}`,
      },
    ];

    const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages);
    return response.content;
  }

  async generateOneLineSummary(
    modelInfo: { provider: AIProvider; modelId: string },
    fullText: string
  ): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `당신은 논문 요약 전문가입니다. 이 논문의 핵심 내용을 한국어로 요약하세요.
- 반드시 '-'로 시작하는 불렛 포인트 형식을 사용하세요.
- 문장이 나뉘면 별개의 '-'로 구분하세요.
- 필요하다면 들여쓰기를 사용하여 뎁스(계층)를 나누어 상세히 요약하세요.
- 전문적인 톤을 유지하되 핵심만 간결하게 전달하세요.`
      },
      { role: 'user', content: fullText.slice(0, 10000) },
    ];

    const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages);
    return response.content;
  }

  async alignSentencesAI(
    modelInfo: { provider: AIProvider; modelId: string },
    enText: string,
    koText: string
  ): Promise<{ en: string; ko: string }[]> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a precision translation aligner. 
Given a paragraph in English and its translation in Korean, align them into sentence pairs.
Some English sentences might be combined or split in Korean. 
Ensure EVERY English sentence is represented.
Return ONLY a JSON array of objects: [{ "en": "...", "ko": "..." }]
Always respond in Korean (한국어로 답변하세요).`
      },
      {
        role: 'user',
        content: `English:\n${enText}\n\nKorean:\n${koText}`
      }
    ];

    const response = await this.sendMessage(
      modelInfo.provider,
      modelInfo.modelId,
      messages,
      { temperature: 0.1 }
    );

    try {
      const jsonStr = response.content.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse alignment JSON', e);
      return [{ en: enText, ko: koText }];
    }
  }

  async autoHighlightAI(
    modelInfo: { provider: AIProvider; modelId: string },
    fullText: string
  ): Promise<{ text: string; type: 'novelty' | 'method' | 'result'; reason: string }[]> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are an expert academic research assistant. 
Analyze the provided paper text and identify the top 5-7 most critical sentences that represent:
1. Novelty (The unique contribution or gap being filled)
2. Method (The key technique or experimental setup)
3. Result (The main finding or performance metric)

Return ONLY a JSON array of objects:
[
  { "text": "exact sentence from text", "type": "novelty" | "method" | "result", "reason": "brief explanation in Korean (한국어로 이유 작성)" }
]
Always respond in Korean (한국어로 답변하세요).`
      },
      { role: 'user', content: fullText.slice(0, 15000) }
    ];

    const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages);
    try {
      const jsonStr = response.content.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse auto-highlights', e);
      return [];
    }
  }

  async generatePaperSummary(
    modelInfo: { provider: AIProvider; modelId: string },
    fullText: string
  ): Promise<PaperSummary> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a high-level research synthesizer. 
Analyze the paper and provide a structured summary in KOREAN.
1. Return ONLY a JSON object: { "takeaway": "...", "objective": "...", "methodology": "...", "results": "...", "limitations": "..." }
2. For EACH field, use a bulleted list format starting with '-'.
3. If there are multiple sentences or points, split them into separate '-' bullets.
4. Use hierarchical depth (indentation) if necessary for sub-details.
5. ALL TEXT VALUES MUST BE IN KOREAN (요약 내용은 반드시 한국어로 작성하세요).`
      },
      { role: 'user', content: fullText.slice(0, 20000) }
    ];

    const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages, { temperature: 0.1 });
    try {
      const jsonStr = response.content.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse paper summary', e);
      // Fallback
      return {
        takeaway: "Summary generation failed.",
        objective: "N/A",
        methodology: "N/A",
        results: "N/A"
      };
    }
  }

  async repairParagraph(
    modelInfo: { provider: AIProvider; modelId: string },
    enText: string,
    koText: string
  ): Promise<{ en: string; ko: string }> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a precision text repair specialist.
1. The provided English and Korean text might be mangled with random spaces (e.g., "8 5 %") or repeated fragments (e.g., "50% 50%").
2. Your goal is to return a clean, grammatically correct version of BOTH.
3. PRESERVE ALL TECHNICAL DATA AND NUMBERS EXACTLY.
4. Return ONLY a JSON object: { "en": "...", "ko": "..." }
5. Always respond in Korean (responses within the JSON values).`
      },
      {
        role: 'user',
        content: `Mangled English:\n${enText}\n\nMangled Korean:\n${koText}`
      }
    ];

    const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages, { temperature: 0.1 });
    try {
      const jsonStr = response.content.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse repair JSON', e);
      return { en: enText, ko: koText };
    }
  }
}
