
export const CS_RESEARCH_PROMPTS = {
  // 1. Strict Explanation (Context-Aware)
  explain: (text: string) => `
선택한 텍스트를 논문 맥락에 맞게 설명해줘.
규칙:
1. 용어면 저자가 사용한 맥락에서 정의해줘.
2. 복잡한 문장이면 논리 구조(원인→결과)를 분해해줘.
3. 1~2문장으로 간결하게. 마크다운 서식(볼드, 리스트, 헤더 등) 절대 사용하지 마. 순수 평문으로만.
4. 한국어로 바로 답변.

텍스트: "${text}"
`,

  // 2. Strict Extraction / Summarization
  summarize: (text: string) => `
Task: Extract the core info from this text.
Rules:
1. Do NOT summarize the entire paper if this is just a paragraph.
2. Focus ONLY on the provided text.
3. Max 3 bullet points.
4. Korean.

Text: "${text}"
`,

  // 3. Simple Analogy
  simplify: (text: string) => `
Explain this concept using a simple CS/Coding analogy.
- Keep it 1 sentence.
- Korean.

Text: "${text}"
`,

  // 4. Critical Analysis (Methodology Focused)
  critique: (text: string) => `
Critique this specific logic/section.
- What is the assumption?
- Is there a missing baseline or logical gap?
- Korean.

Text: "${text}"
`,

  // 6. Q&A
  question: (text: string, question: string) => `
아래 텍스트를 참고하여 질문에 답변해줘.
규칙:
1. 텍스트 내용 기반으로 답변. 없으면 "해당 내용이 텍스트에 없습니다."라고 말해줘.
2. 1~3문장으로 간결하게. 마크다운 서식 사용하지 마. 평문으로만.
3. 한국어로 답변.

텍스트: "${text}"

질문: "${question}"
`,

  // 5. General Agent Prompt (The "Brain")
  agent_system: `
You are a Verification-Based Research Agent. 
Your goal is to answer the user's question by rigorously analyzing the provided document text.

# CRITICAL PROTOCOLS (DO NOT IGNORE)
1. **NO HALLUCINATION**: If asked for Title, Author, or specific data, you must EXTRACT it from the text. If it is not explicit, say "Not found in text". Do NOT invent names.
2. **CONTEXT FIRST**: If the user asks "What is X?", first define X *as it appears in the paper*. Only then add general knowledge.
3. **SCOPE AWARENESS**: 
   - If the user asks about a specific paragraph (Context provided), answer ONLY based on that paragraph.
   - If the user asks about "the paper", scan the Full Document Text.
4. **EXTRACTION vs. GENERATION**:
   - Query: "List examples of X in this text" -> EXTRACT the exact substrings. Do not summarize the paper.
   - Query: "Summarize" -> Generate a summary.

# OUTPUT FORMAT
- Answer directly in Korean.
- If the user asks for a list, use bullet points.
- If quoting the text, use "quotation marks".
`
};
