# Peer Reviewer

**Peer Reviewer**는 연구자를 위한 **AI 기반 로컬 논문 리뷰 데스크톱 앱**입니다.  
HTML/Markdown 논문을 불러와 문단 단위로 AI와 대화하고, 포스트잇 메모를 달고, 레퍼런스를 추적하며 깊이 있게 읽을 수 있습니다.

## 핵심 기능

### 1. AI 연구 에이전트
- 현재 읽고 있는 **문단 컨텍스트를 자동 인식**하여 대화
- AI 답변에 **인라인 레퍼런스 링크** 생성 — 클릭하면 해당 문단으로 즉시 이동
- DeepSeek, Gemini, OpenAI 등 **멀티 모델 지원** — 기능별로 다른 모델 할당 가능 (예: 설명은 Gemini Flash, 비판은 DeepSeek R1)
- AI 답변을 **Notebook에 저장**하여 나중에 열람 가능

### 2. 포스트잇 메모 시스템
- 각 문단 옆에 **드래그 가능한 포스트잇** 부착
- **마크다운 지원** — 서식 있는 메모 작성
- 작성 후 **수정/삭제** 가능
- 설정에서 가로폭 (160–400px) 및 위치 (좌/우/양쪽) 조절
- 레퍼런스 링크를 포스트잇에 붙여넣으면 **클릭 시 해당 문단으로 이동**

### 3. 이중 언어 논문 리더
- Immersive Translate 등으로 번역된 HTML의 **원문/번역문 자동 분리**
- **문장 단위 정렬** — 원문과 번역을 나란히 비교
- 한국어/영어 **주언어 전환** (Ctrl+L)

### 4. 문서 구조 자동 분석
- HTML/Markdown에서 **목차(TOC), 그림, 표** 자동 추출
- 사이드바에서 클릭하면 해당 위치로 점프
- **레퍼런스 번호** ([1], [2] 등) 클릭 시 참고문헌으로 이동

### 5. 로컬 퍼스트 저장
- 모든 데이터는 `AppData/Local` 에 **Rust 백엔드**로 안전하게 저장
- HTML 임포트 시 **이미지도 함께 복사**
- 자동 저장 + 수동 저장 (Ctrl+S)

### 6. 형광펜 & 어노테이션
- 텍스트 드래그 시 **플로팅 툴바** — 형광펜, AI 질문, 정의 검색, 토론 시작
- 색상별 형광펜 (5색 커스텀 가능)
- 하이라이트 목록을 사이드바에서 한눈에 관리

### 7. 유틸리티
- **AI 문단 수리** — 깨진 표, 수식(LaTeX) 자동 복원
- **스마트 내보내기** — Obsidian 연동
- **커맨드 팔레트** (Ctrl+K) — 전체 기능 빠른 접근
- **줌 조절** — 50%~200%

## 시작하기

### 사전 요구사항
- **Node.js** v18+
- **Rust** ([설치](https://www.rust-lang.org/tools/install))
- **VS Build Tools** (Windows C++ 빌드 툴)

### 개발

```bash
git clone https://github.com/vividhyeok/peer-reviewer.git
cd peer-reviewer
npm install
npm run tauri dev
```

### 빌드

```bash
npm run tauri build
```

설치 파일: `src-tauri/target/release/bundle/nsis/Peer Reviewer_0.1.0_x64-setup.exe`

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | React, TypeScript, TailwindCSS, Framer Motion |
| Desktop | Tauri v2 (Rust) |
| AI | DeepSeek, Gemini, OpenAI (Direct API) |
| 파서 | Custom HTML/Markdown → 문단 구조 파서 |
| 수식 | KaTeX, MathML 지원 |

## 라이선스

MIT License
