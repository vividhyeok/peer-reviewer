# 논문리뷰어 (Paper Reader)

HTML 논문을 PDF 뷰어처럼 읽고, AI 기능으로 이해/요약/토론을 돕는 웹 애플리케이션입니다. 문서 라이브러리, 주석, 번역, Obsidian 내보내기까지 한 번에 제공합니다.

## 주요 기능

### 📖 읽기 환경
- **몰입형 리더 UI**: 깔끔한 3단 구성 (라이브러리 + 본문 + 인사이트 패널)
- **정교한 HTML 파싱**: 번역 도구(Immersive Translate 등) 출력물을 완벽 파싱
  - `sup`, `sub`, 수식(KaTeX/LaTeX), 표, 인용구 등 구조 보존
  - 50%, 88% 같은 숫자 분리 방지 (Phase 26)
  - 헤더 인식 및 계층 구조 자동 생성
- **세션 복원**: 마지막 읽던 문서 + 스크롤 위치 자동 복원
- **읽기 진행률**: 실시간 진행률 추적 및 라이브러리 반영
- **가상 파일 시스템**: 업로드한 HTML을 localStorage에 압축 저장

### 🎨 주석 및 하이라이트
- **인라인 하이라이트**: 색상별 배경 렌더링 (노랑/초록/파랑/핑크/오렌지)
- **AI Insight**: 보라색 밑줄 + 마우스 오버 툴팁으로 AI 설명 표시
- **주석 타입**: Highlight / AI Insight / Note / Discussion
- **자동 저장**: 설정 가능한 주기(기본 30초)마다 localStorage 저장
- **주석 내비게이션**: Alt+↓/↑ 단축키로 하이라이트 간 이동

### 🤖 AI 기능
- **AI 설명**: 선택한 구절을 전문적으로 해설 (한국어)
- **AI 요약**: 핵심 내용을 1-2문장으로 압축
- **AI Auto-Highlight**: 논문 전체에서 핵심 문장 5-7개 자동 감지
  - Novelty (보라색): 독창적 기여
  - Method (파란색): 핵심 기법
  - Result (초록색): 주요 발견
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

## 데이터 저장
- 모든 데이터는 브라우저의 localStorage에 저장 (Reader, FloatingToolbar, Paragraph 등)
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
- Research Agent: Multi-agent 분석/토론
- Context-aware 프롬프팅

✅ **주석 시스템**
- Highlight (색상 배경)
- AI Insight (보라색 밑줄 + 툴팁)
- Definition/Note (파란색 배지)
- Discussion (초록색 배지)
- 모든 주석 localStorage 자동 저장

✅ **라이브러리 관리**
- 가상 파일 시스템 (업로드 → localStorage)
- 읽기 진행률 추적
- 마지막 읽은 위치 복원
- 검색 및 정렬

✅ **내보내기**
- Obsidian 마크다운 형식
- 하이라이트 + 주석 포함
- BibTeX 메타데이터

## 주의사항
- 현재 지원 입력 포맷은 HTML(.html/.htm)입니다
- **이미지 처리**: HTML 내 이미지는 자동으로 추출되어 저장됩니다
  - 외부 URL 이미지: 자동 다운로드 후 저장
  - Base64 인라인 이미지: 파일로 변환하여 메모리 최적화
  - 로컬 폴더 사용 시 images/ 하위 폴더에 저장
- 대용량 문서의 경우 초기 로딩에 시간이 소요될 수 있습니다
- **저장소 권장사항**:
  - 브라우저 캐시 삭제로 인한 데이터 손실을 방지하려면 Settings → Storage에서 로컬 폴더를 선택하세요
  - 기존 데이터는 "로컬 폴더로 데이터 복사" 버튼으로 마이그레이션 가능
- 특정 Windows + Node 24 환경에서는 `vite build`가 비정상 종료될 수 있어, 배포 빌드는 Node LTS(권장: 22.x)에서 수행하는 것을 권장합니다

## 라이선스
- 개인/연구용으로 사용 가능. 상업적 사용은 별도 문의.
