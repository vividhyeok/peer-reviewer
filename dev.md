# Paper Reviewer 개발 문서 (Developer's Guide)

## 1. 아키텍처 개요 (Architecture Overview)

이 프로젝트는 Vite + React를 기반으로 한 로컬 퍼스트(Local-First) 웹 애플리케이션입니다. 
Tauri 없이도 웹 브라우저(`start_browser.bat`)만으로 로컬 파일 시스템에 접근할 수 있도록 설계되었습니다.

### 주요 구성 요소
1. **Frontend**: React 18, TypeScript, TailwindCSS
2. **Build Tool**: Vite (Middleware를 통해 Backend 역할 수행)
3. **AI Integration**: DeepSeek, Gemini, OpenAI API 직접 호출 (클라이언트 사이드)

### 저장소 전략 (Hybrid Storage)
- **Dev Mode (Browser)**: Vite 설정(`vite.config.ts`)에 포함된 커스텀 미들웨어를 사용하여 프로젝트 내 `paper-reader-data/` 폴더에 직접 파일을 읽고 씁니다.
- **Production**: File System Access API를 통해 사용자가 지정한 로컬 폴더를 샌드박스 형태로 사용합니다.

---

## 2. 프로젝트 구조 (Directory Structure)

```text
peer-reviewer/
  ├── paper-reader-data/      # [자동 생성] 문서, 주석, 캐시가 저장되는 실제 로컬 저장소
  ├── public/                 # 정적 리소스 (아이콘, 테스트용 HTML)
  ├── src/
  │   ├── components/         # React UI 컴포넌트
  │   │   ├── Reader.tsx      # 핵심: 문서 뷰어 및 인터랙션 로직
  │   │   ├── Sidebar.tsx     # 서재 및 에이전트 패널
  │   │   └── ...
  │   ├── core/               # 비지니스 로직 (UI 독립적)
  │   │   ├── ReaderParser.ts     # HTML/Markdown 파싱 및 정제 (DOM-based)
  │   │   ├── LocalStorageManager.ts # 저장소 추상화 (DevServer vs BrowserFS)
  │   │   └── AIClient.ts         # LLM API 통신
  │   ├── types/              # TypeScript 타입 정의
  │   └── App.tsx             # 메인 라우터 및 글로벌 상태
  ├── vite.config.ts          # 로컬 파일 시스템 서버 미들웨어 설정 (/api/fs)
  └── start_browser.bat       # 실행 스크립트
```

## 3. 핵심 모듈 상세

### 3.1. ReaderParser (`src/core/ReaderParser.ts`)
- **역할**: 원본 HTML/Markdown을 읽기 좋은 형태(PaperStructure)로 변환합니다.
- **특징**: 
  - Regex 기반 파싱에서 **DOM Traversal** 방식으로 전환하여 안정성 확보.
  - MathML(`<math>`), SVG, LaTeX 보존을 위한 허용 및 필터링 로직 포함.
  - 불필요한 스타일, 스크립트, 광고성 태그 자동 제거.

### 3.2. LocalStorageManager (`src/core/LocalStorageManager.ts`)
- **역할**: 파일 I/O 추상화 계층.
- **동작**:
  - 앱 시작 시 `/api/fs/list` 핑을 보내 Dev Server 존재 여부 확인.
  - 연결 성공 시, 모든 파일 읽기/쓰기/삭제 요청을 `/api/fs` 엔드포인트로 중계.
  - 연결 실패 시, 메모리 모드 또는 File System Access API(설정 시)로 폴백.

### 3.3. AdvancedSettings (`src/components/AdvancedSettings.tsx`)
- **역할**: AI 모델, API 키, UI 설정 관리.
- **특징**: `AIFeature` 타입에 따라 "읽기 도구(빠름)"와 "심층 분석(똑똑함)" 모델을 분리하여 할당.

---

## 4. 커스텀 규칙 및 컨벤션

- **스타일링**: TailwindCSS 유틸리티 클래스 우선 사용. 다크 모드(`dark:`) 필수 지원.
- **상태 관리**: 복잡한 전역 상태보다 React Context 또는 Custom Hook(`useDocumentLoader`, `useUndoableState`) 활용.
- **아이콘**: `lucide-react` 라이브러리 사용.

## 5. 빌드 및 배포

- **로컬 실행**:
  ```bash
  start_browser.bat
  # 또는
  npm run dev:browser
  ```
- **프로덕션 빌드**:
  ```bash
  npm run build
  ```
