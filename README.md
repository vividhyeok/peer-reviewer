# 논문리뷰어 (Paper Reader)

HTML 논문을 PDF 뷰어처럼 읽고, AI 기능으로 이해/요약/토론을 돕는 웹 애플리케이션입니다. 문서 라이브러리, 주석, 번역, Obsidian 내보내기까지 한 번에 제공합니다.

## 주요 기능

### 📖 읽기 환경
- **몰입형 리더 UI**: 깔끔한 3단 구성 (라이브러리 + 본문 + 인사이트 패널)
- **정교한 HTML 파싱**: 번역 도구(Immersive Translate 등) 출력물을 완벽 파싱
  - `sup`, `sub`, 수식(KaTeX/LaTeX), 표, 인용구 등 구조 보존
  - 50%, 88% 같은 숫자 분리 방지 (Phase 26)
  - 헤더 인식 및 계층 구조(TOC) 자동 생성
  - 그림(Figure) 및 캡션 자동 추출 및 내비게이션
- **세션 복원**: 마지막 읽던 문서 + 스크롤 위치 자동 복원
- **읽기 진행률**: 실시간 진행률 추적 및 라이브러리 반영
- **가상 파일 시스템**: 업로드한 HTML을 localStorage에 압축 저장

### 🎨 주석 및 하이라이트
- **인라인 하이라이트**: 색상별 배경 렌더링 (노랑/초록/파랑/핑크/오렌지)
- **AI Insight**: 보라색 밑줄 + 마우스 오버 툴팁으로 AI 설명 표시
- **주석 타입**: Highlight / AI Insight / Note / Discussion
- **자동 저장**: 설정 가능한 주기(기본 30초)마다 localStorage 저장
- **주석 내비게이션**: Alt+↓/↑ 단축키로 하이라이트 간 이동

### 🤖 AI 기능 (Advanced)
- **Multi-LLM Support**: Google Gemini (Pro/Flash), DeepSeek, OpenAI 등 다중 모델 지원
- **Smart Routing**: 작업의 복잡도와 문맥에 따라 최적의 AI 모델을 자동 라우팅 (비용 절감 및 효율성 증대)
- **Context-Aware Suggestions**: 논문 전체 내용을 분석하여 해당 논문의 핵심을 찌르는 맞춤형 질문 세트 자동 생성
- **Persistence (지속성)**: 생성된 AI 요약, 추천 질문, 채팅 내역을 각 논문별로 자동 저장하여 재방문 시 즉시 로드
- **One-Click Regenerate**: 저장된 AI 분석 결과가 만족스럽지 않을 경우 원클릭으로 재생성
- **AI 설명**: 선택한 구절을 전문적으로 해설 (한국어)
- **AI 요약**: 논문의 핵심 기여와 방법론을 1-2문장으로 압축
- **Research Agent**: Multi-agent 오케스트레이션
  - 분석/검색/저자 시뮬레이션/비평/가설 생성
  - 사고 과정 시각화 + 마크다운 결과
- **AI Repair**: 깨진 텍스트 자동 복구 ("5 0 %" → "50%")
- **AI Align**: EN/KO 문장 정렬 자동 보정

### 🔧 번역 및 언어
- **EN/KO 토글**: 문서 전체 또는 문단 단위 번역 전환
- **Ctrl+Hover**: 한국어 모드에서 영어 미리보기
- **언어 우선순위**: 설정에서 기본 언어 지정

### ⚙️ 설정 및 커스터마이징
- **다중 AI 제공자**: OpenAI / Gemini / DeepSeek
- **기능별 모델 할당**: 설명/요약/토론/수식/표 각각 다른 모델 지정 가능
- **커스텀 단축키**: 모든 액션에 단축키 할당 + 중복 검증
- **하이라이트 팔레트**: 사용자 정의 색상 설정
- **자동 저장 주기**: 초 단위로 조절 가능

### 📚 라이브러리 관리
- **파일 업로드**: HTML 문서를 가상 파일 시스템에 저장
- **메타데이터**: 제목/저자/생성일/읽기 진행률 자동 추출
- **검색 및 필터**: 제목/내용 검색 + 정렬
- **최근 문서**: 마지막 읽은 순서대로 정렬

### 📤 내보내기
- **Obsidian 마크다운**: 하이라이트 + 주석 포함 내보내기
- **BibTeX 메타데이터**: 인용 정보 자동 생성

## 기술 스택
- React 19 + TypeScript
- Vite + Tailwind CSS
- framer-motion / sonner / react-markdown / katex
- localStorage for data persistence

## 설치 및 실행
1) 의존성 설치
```bash
npm install
```

2) 개발 모드 실행
```bash
npm run dev
```

브라우저에서 http://localhost:5173 접속

## 빌드
```bash
npm run build
```

빌드된 파일은 `dist/` 폴더에 생성됩니다.

Node 24 환경에서 Vite가 비정상 종료되면:
```bash
npm run build:stable
```

## 사용 방법
1) 좌측 상단 `+` 버튼으로 HTML 논문 열기 (또는 샘플 문서 사용)
2) 본문에서 텍스트 선택 → 툴바로 하이라이트/노트/AI 설명/AI 요약 실행
3) 우측 Research Agent에서 문서 전체 질문/분석
4) 상단 Export 버튼으로 Obsidian 마크다운 내보내기
5) Settings(⚙️)에서 API 키/모델/단축키/리더 설정

## AI 기능 사용 전 설정
1. Settings(⚙️) → API Keys 탭
2. 사용할 AI 제공자의 API 키 입력 (OpenAI / Gemini / DeepSeek)
3. Models 탭에서 기능별 모델 선택
   - Explain: AI 설명 생성 모델
   - Summarize: AI 요약 생성 모델
   - Discussion: Research Agent 모델
4. 저장 후 텍스트 선택 → AI 기능 사용 가능

## 데이터 저장 (Dual Strategy)
- **로컬 폴더 모드 (권장)**
  - 사용자가 선택한 폴더에 파일 직접 저장
  - 구조:
    - `/SelectedFolder/`
      - `*.html` (논문 파일)
      - `paper-reader-data/`
        - `settings.json` (설정)
        - `annotations/` (문서별 주석)
  - 장점: 브라우저 청소에도 데이터 유지, 파일 백업 용이

- **브라우저 모드 (기본)**
  - `localStorage` 및 `IndexedDB` 사용
  - 설치 없이 즉시 사용 가능하나, 데이터 영구 보존에 취약

    core/              # 파서, 저장, AI 클라이언트 등 핵심 로직
    hooks/             # 단축키 등 커스텀 훅
    types/             # TypeScript 타입 정의
  public/              # 정적 파일 및 샘플 문서
```

## 기능 요약
✅ **파싱 & 렌더링**
- HTML 번역 논문 파싱 (Immersive Translate 등)
- EN/KO 문장 단위 정렬 및 토글
- 수식(KaTeX), 인용, 내부 링크 지원
- 50%, 88% 같은 숫자 분리 방지 (Phase 26)

✅ **AI 기능**
- 선택 텍스트 AI 설명/요약 (인라인 저장)
- Auto-Highlight: 핵심 문장 자동 감지
- Research Agent: Multi-agent 분석/토론 (Chat 모드 추가)
- Smart Routing: 모델 최적화 (GPT-4o / DeepSeek / Gemini)

✅ **주석 시스템**
- Highlight (색상 배경)
- AI Insight (보라색 밑줄 + 툴팁)
- Definition/Note (파란색 배지)
- Discussion (초록색 배지)
- 모든 주석 로컬 파일(JSON) 자동 저장

✅ **라이브러리 관리**
- 로컬 폴더 연동 (FileSystem Access API)
- 파일 업로드 필요 없음 (폴더 내 파일 자동 감지)
- 읽기 진행률 추적
- 마지막 읽은 위치 복원
- 검색 및 정렬

✅ **내보내기**
- Obsidian 마크다운 형식
- 하이라이트 + 주석 포함
- BibTeX 메타데이터

## 주의사항
- **지원 브라우저**: 로컬 폴더 기능은 Chrome, Edge 등 Chromium 기반 브라우저(PC)에서 최적으로 작동합니다.
- **이미지 처리**: HTML 내 이미지는 자동으로 추출되어 로컬 폴더의 `images/` 하위 폴더에 저장됩니다. (로컬 폴더 모드 사용 시)
- **API 키 관리**: 사용자의 API 키는 오직 사용자의 로컬 환경(settings.json)에만 저장되며 외부로 전송되지 않습니다.

## 라이선스
- 개인/연구용으로 사용 가능. 상업적 사용은 별도 문의.
