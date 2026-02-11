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
      // Fix for "Model Not Exist" error
      // When users select a generic model ID but route to DeepSeek, ensuring we map it correctly.
      // However, usually the modelId passed here is already correct ('deepseek-chat', etc.)
      // The error log showed "deepseek / gpt-4o-mini", which means the provider was forced to deepseek 
      // but the model ID was passed from a setting that had 'gpt-4o-mini' selected.
      
      // Safety check: if provider is deepseek but modelId is not a deepseek model, force a valid deepseek model.
      let safeModelId = modelId;
      if (!modelId.startsWith('deepseek-')) {
          console.warn(`Model mismatch: ${modelId} cannot be used with DeepSeek. Swapping to deepseek-chat.`);
          safeModelId = 'deepseek-chat';
      }

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: safeModelId,
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
      let chatMessages = messages.filter(m => m.role !== 'system');

      // Gemini requires specific role alternation and checks.
      // Ensure specific compatibility quirks.
      
      const body: any = {
        contents: chatMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          // Remove maxOutputTokens constraint that might represent "unknown" for some models
        },
      };

      if (systemMessage) {
        body.system_instruction = {
          parts: [{ text: systemMessage.content }]
        };
      } else if (body.contents.length === 0) {
          // If no system instructions & no contents?? 
          throw new Error("Gemini request must have at least one message.");
      }

      // Fix for "No Candidates" or "400 Bad Request" when contents is empty but system_instruction exists
      // Gemini `generateContent` requires `contents` to be non-empty list of turn-based messages.
      if (body.contents.length === 0) {
         // If we only have a system message, convert it to a user message because 
         // we basically want to "complete" this prompt.
         if (systemMessage) {
             body.contents = [{ 
                 role: 'user', 
                 parts: [{ text: systemMessage.content }] 
             }];
             delete body.system_instruction;
         } else {
             throw new Error("Gemini: Message history is empty.");
         }
      }
      
      // Safety Settings to avoid "FinishReason: SAFETY" on academic papers
      body.safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ];

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

  // Helper: Robust JSON Extraction
  private extractJson(text: string): any {
    // 1. Try Simple Parse
    try { return JSON.parse(text); } catch (e) {}

    // 2. Try stripping markdown code blocks
    const clean = text.replace(/```json\s*|```/gi, '').trim();
    try { return JSON.parse(clean); } catch (e) {}

    // 3. Robust Extraction using Bracket Counting
    // This handles cases where AI adds text before or after the JSON, e.g., "Here is the JSON: { ... }"
    let startIdx = -1;
    let endIdx = -1;
    
    // Determine if we are looking for an object or an array based on which comes first
    const firstOpenBrace = clean.indexOf('{');
    const firstOpenBracket = clean.indexOf('[');
    
    if (firstOpenBrace === -1 && firstOpenBracket === -1) {
        throw new Error("No JSON start found");
    }

    const isObject = (firstOpenBrace !== -1) && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket);
    startIdx = isObject ? firstOpenBrace : firstOpenBracket;
    
    let depth = 0;
    for (let i = startIdx; i < clean.length; i++) {
        const char = clean[i];
        if (isObject) {
            if (char === '{') depth++;
            else if (char === '}') depth--;
        } else {
            if (char === '[') depth++;
            else if (char === ']') depth--;
        }
        
        // found the matching closing brace
        if (depth === 0) {
            endIdx = i + 1;
            break;
        }
    }
    
    if (startIdx !== -1 && endIdx !== -1) {
        const potentialJson = clean.slice(startIdx, endIdx);
        try { 
            return JSON.parse(potentialJson); 
        } catch (e3) {
             console.warn("Stack-extracted JSON failed parse", e3);
        }
    }
    
    throw new Error("Failed to extract and parse JSON response");
  }

  // --- Agent Orchestration (Reliable Plan-and-Solve) ---

  private getEfficientModel(provider: AIProvider, currentModel: string): string {
    if (provider === 'openai') {
       if (currentModel.includes('gpt-4')) return 'gpt-4o-mini';
    }
    if (provider === 'gemini') {
       // All Gemini models in this app are likely capable, but Flash is the scanner.
       return 'gemini-1.5-flash';
    }
    // DeepSeek is already efficient/cheap.
    return currentModel;
  }

  async orchestrate(
    modelInfo: { provider: AIProvider; modelId: string },
    query: string,
    documentText: string,
    onThought: (thought: AgentThought) => void,
    chatHistory: AIMessage[] = [],
    useExternalKnowledge: boolean = false
  ): Promise<string> {
    const session: AgentSession = {
      id: crypto.randomUUID(),
      query,
      thoughts: []
    };

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
      const lastMsg = chatHistory[chatHistory.length - 1];
      const focusedContext = lastMsg?.context;

      // START LOGIC
      // 1. Local/Specific Query? (If user selected text, skip the scanner)
      if (focusedContext && focusedContext.textSnippet) {
           const solveThought = addThought('analyze', 'Analyzing selected specific context...');
           
           const systemPrompt = `
You are a Context-Aware Research Assistant.
Protocol:
1. Answer based on the provided context if possible.
2. [DEFINITION EXCEPTION] If the user asks for a definition of a term (e.g. "What is X?") that is mentioned but not defined in the text, YOU MAY use general knowledge to explain it briefly. Explicitly state if you are using general knowledge.
${useExternalKnowledge ? '3. [ENABLED] You may use external knowledge to verify or explain concepts.' : '3. [RESTRICTED] Ideally use only the text. If answer is missing, follow Protocol #2 or state it is not in the text.'}
4. Answer in Korean (한국어).

[FOCUS PARAGRAPH]
"${focusedContext.textSnippet}"
`;
           const messages: AIMessage[] = [
               { role: 'system', content: systemPrompt },
               ...chatHistory.slice(0, -1),
               { role: 'user', content: `Query: ${query}` }
           ];

           const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages, { temperature: 0.3 });
           updateThought(solveThought, "Done");
           return response.content;
      }

      // 2. Global Query? (Full Document Scan)
      // Use "Efficient Model" to scan the potentially huge document first.
      
      const cheapModelId = this.getEfficientModel(modelInfo.provider, modelInfo.modelId);
      const isUsingScanner = cheapModelId !== modelInfo.modelId;
      
      let relevantContext = "";
      
      if (isUsingScanner) {
          const scanThought = addThought('search', `Scanning document with fast agent (${cheapModelId})...`);
          
          // Scanner Prompt
          const scannerPrompt = `
User Query: "${query}"

Task: You are a Research Scout. Scan the full document text below and EXTRACT the specific sections/paragraphs that contain the answer to the user's query.
- Copy relevant sentences verbatim.
- **IMPORTANT**: The text contains [[ID:para-...]] markers. YOU MUST PRESERVE THESE MARKERS in your extraction to allow citation.
- If the whole paper is relevant (e.g. "Summarize paper"), output "ALL_BUT_SUMMARIZED".
- If the answer is NOT found, say "NOT_FOUND".

[FULL DOCUMENT TEXT]
${documentText.slice(0, 80000)} ${documentText.length > 80000 ? '...(truncated)' : ''}
`;
          // We use the cheap model for this heavy lifting
          const scanResponse = await this.sendMessage(modelInfo.provider, cheapModelId, [
              { role: 'user', content: scannerPrompt }
          ], { temperature: 0.1 });

          relevantContext = scanResponse.content;
          updateThought(scanThought, "Relevant context extracted.", 'completed');
      } else {
          // If already using a fast model (like DeepSeek), just use the first 30k chars
          relevantContext = documentText.slice(0, 30000); 
      }

      // 3. Final Synthesis (Smart Model)
      const synthThought = addThought('synthesize', 'Formulating final answer...');
      
      let contextForFinal = relevantContext;
      if (relevantContext.includes("ALL_BUT_SUMMARIZED")) {
          // If scanner said "It's everything", we fall back to the first 30-50k chars for the main model
          contextForFinal = documentText.slice(0, 40000); 
      }

      const finalSystemPrompt = `
You are an Advanced Research Agent.
Goal: Answer the user's query accurately using the provided [RELEVANT CONTEXT].

Instructions:
1. **Evidence-Based**: ${useExternalKnowledge ? 'Prioritize the provided context, but you MAY use general knowledge to explain concepts not fully defined in the text.' : 'Use ONLY the provided context. If the answer is not in the text, explicitly state that.'}
2. **Web Mode Optimization**: ${useExternalKnowledge ? 'If the context provided is a SUMMARY, rely on your internal knowledge + summary to answer quickly.' : 'Deeply analyze the text snippets.'}
3. **Citation**: 
   - The context contains [[ID:para-...]] markers. 
   - cite your sources using [Ref](citation:para-ID).
   - **Visual Cleanliness**: If multiple consecutive items come from the SAME paragraph, do NOT repeat the [Ref] for every item. Instead, cite it once at the end of the list or group.
   - Example: 
     * Item A
     * Item B
     * Item C
     [Ref](citation:para-123)
4. **Language**: Answer in Korean (한국어).
5. **Style**: Direct, Academic, Insightful.

[RELEVANT CONTEXT (Extracted from Paper)]
${contextForFinal}
`;

      const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, [
          { role: 'system', content: finalSystemPrompt },
          ...chatHistory.slice(0, -1),
          { role: 'user', content: query }
      ], { temperature: 0.3 });

      updateThought(synthThought, "Complete");
      return response.content;

    } catch (e: any) {
      console.error("Orchestration failed", e);
      addThought('critic', `Error: ${e.message}`);
      return "죄송합니다. 처리 중 오류가 발생했습니다. (API Error)";
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
      return this.extractJson(response.content);
    } catch (e) {
      console.warn('Failed to parse metadata JSON', e);
      return {};
    }
  }

  // New Feature: Context-Aware Question Suggestions
  async suggestQuestions(
    modelInfo: { provider: AIProvider; modelId: string },
    text: string
  ): Promise<string[]> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a Research Mentor. Based on the abstract and intro of the paper provided, suggest 4 insightful, specific questions a researcher should ask about this paper.
        
        Criteria:
        1. Questions must be specific to the paper's topic (not generic).
        2. Cover different angles: Methodology, Results, Implications, or Comparisons.
        3. Phrased as if the user is asking the AI agent.
        4. Return ONLY a JSON array of strings: [ "Question 1?", "Question 2?", ... ]
        5. LANGUAGE: Korean (반드시 한국어로 작성).`
      },
      { role: 'user', content: text.slice(0, 10000) }
    ];

    try {
      const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages, { temperature: 0.7 });
      const questions = this.extractJson(response.content);
      return Array.isArray(questions) ? questions.slice(0, 4) : [];
    } catch (e) {
      console.warn("Question suggestion failed", e);
      return [
        "이 연구의 핵심 기여점은 무엇인가요?",
        "제안된 방법론의 한계점은 무엇인가요?",
        "실험 결과가 통계적으로 유의미한가요?",
        "이 연구가 실제 산업에 어떻게 적용될 수 있나요?"
      ];
    }
  }

  // New Feature: AI Semantic Structure Analysis
  // This analyzes raw text to identify logical components (Title, Heading, Body, Caption)
  async structureDocument(
    modelInfo: { provider: AIProvider; modelId: string },
    text: string
  ): Promise<Array<{ type: 'title' | 'author' | 'abstract' | 'heading' | 'body' | 'caption'; content: string; level?: number }>> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a Scientific Document Structure Analyzer.
Your task is to convert raw PDF text into a Structured Text Format.

1. Analyze the semantic role of each text block.
2. Return a JSON Array of objects:
   [
     { "type": "title", "content": "Paper Title..." },
     { "type": "author", "content": "Author Names..." },
     { "type": "abstract", "content": "Abstract text..." },
     { "type": "heading", "content": "1. Introduction", "level": 1 },
     { "type": "body", "content": "Paragraph text..." },
     { "type": "caption", "content": "Fig 1. ..." }
   ]
3. Group fragmented lines into complete paragraphs.
4. "content" must be the reconstructed text.
5. Return ONLY the JSON Array.`
      },
      // Limit to 25k chars to ensure response fits in output limit even for Flash
      { role: 'user', content: text.slice(0, 25000) } 
    ];

    try {
      const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages, { temperature: 0.1 });
      return this.extractJson(response.content);
    } catch (e) {
      console.warn("Structure analysis failed", e);
      return [];
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
      return this.extractJson(response.content);
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
      return this.extractJson(response.content);
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
2. For EACH field (objective, methodology, results, limitations), provide EXACTLY 4 key points.
3. Start each point with '- '. Do not use Markdown headers (#).
4. Keep the font size consistent by avoiding complex formatting.
5. ALL TEXT VALUES MUST BE IN KOREAN (요약 내용은 반드시 한국어로 작성하세요).`
      },
      { role: 'user', content: fullText.slice(0, 20000) }
    ];

    const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages, { temperature: 0.1 });
    try {
      return this.extractJson(response.content);
    } catch (e) {
      console.warn('Failed to parse paper summary', e);
      // Fallback
      return {
        takeaway: "Summary generation failed due to format error.",
        objective: "",
        methodology: "",
        results: ""
      };
    }
  }

  async repairParagraph(
    modelInfo: { provider: AIProvider; modelId: string },
    enText: string,
    koText: string,
    instruction?: string
  ): Promise<{ en: string; ko: string }> {
    const basePrompt = `You are a precision text repair specialist.
The input text has parsing artifacts:
1. Inline math formulas/SVG paths may appear as "M123 456..." strings.
2. Citation tags may be broken (e.g., "[ 1 2 ]").
3. Words may be randomly split or repeated.

Task:
1. Reconstruct the broken text into clean, readable Markdown/Latex ($...$) or plain text.
2. If you see SVG path data (e.g., "M 32 4..."), replace it with a placeholder like "[Equation]" or reconstruct the math if obvious.
3. Fix mangled numbers/dates (e.g., "2 0 2 4" -> "2024").
4. Return ONLY a JSON object: { "en": "...", "ko": "..." }`;

    const specificInstruction = instruction 
       ? `\n\nSPECIAL INSTRUCTION: ${instruction}\nIf you need to output a Table, use Markdown Table syntax or HTML Table.`
       : '';

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: basePrompt + specificInstruction
      },
      {
        role: 'user',
        content: `Mangled English:\n${enText}\n\nMangled Korean:\n${koText}`
      }
    ];

    const response = await this.sendMessage(modelInfo.provider, modelInfo.modelId, messages, { temperature: 0.1 });
    try {
      return this.extractJson(response.content);
    } catch (e) {
      console.warn('Failed to parse repair JSON', e);
      return { en: enText, ko: koText };
    }
  }
}
