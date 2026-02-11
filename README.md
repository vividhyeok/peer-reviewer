# Paper Reviewer

**Paper Reviewer**는 연구자와 개발자를 위한 **AI 기반 로컬 논문 독해/리뷰 도구**입니다.
복잡한 설정 없이 로컬 파일을 관리하고, AI의 도움을 받아 논문을 깊이 있게 분석할 수 있습니다.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

## ✨ 특징 (Features)

- **📝 로컬 퍼스트 (Local-First)**: 모든 데이터는 사용자가 지정한 로컬 폴더에 안전하게 저장됩니다. (Onboarding 시 위치 지정)
- **🖥️ 네이티브 앱 경험**: Tauri 기반의 데스크톱 애플리케이션으로, 시스템 파일 접근과 성능이 최적화되어 있습니다.
- **🤖 멀티 AI 모델 지원**: DeepSeek, Gemini, OpenAI 등 다양한 모델을 **용도에 맞게 섞어서** 사용할 수 있습니다. (예: 설명은 Gemini Flash, 비판은 DeepSeek R1)
- **🔍 강력한 파서**: HTML/Markdown 논문의 구조를 자동으로 분석하여 목차(TOC)와 문단 단위의 인터랙션을 제공합니다. 수식(MathJax/MathML)도 완벽하게 지원합니다.
- **💬 연구 에이전트**: 단순 챗봇이 아닌, 현재 읽고 있는 문단(Context)을 이해하고 토론하는 파트너입니다.

## 🚀 시작하기 (Getting Started)

### 사전 요구사항 (Prerequisites)
- **Node.js**: v18 (LTS) 이상
- **Rust**: (Tauri 빌드 시 필요) [Rust/Cargo 설치](https://www.rust-lang.org/tools/install)
- **VS Build Tools**: (Windows의 경우 C++ 빌드 툴 필요)

### 개발 환경 설정 (Development)

1. 저장소 클론:
   ```bash
   git clone <repository-url>
   cd peer-reviewer
   ```

2. 의존성 설치:
   ```bash
   npm install
   ```

3. 개발 서버 실행:
   ```bash
   npm run tauri dev
   ```
   앱이 디버그 모드로 실행되며, 소스 코드를 수정하면 자동으로 반영됩니다.

### 배포용 빌드 (Build)

Window용 설치 파일(.exe/.msi)을 생성하려면 다음 명령어를 사용하세요:

```bash
npm run tauri build
```
빌드 결과물은 `src-tauri/target/release/bundle/nsis/*.exe` 경로에 생성됩니다.

## 📁 주요기능 가이드

1. **초기 설정 (Onboarding)**
   - 앱 최초 실행 시, 데이터를 저장할 폴더를 선택합니다.
   - 나중에 `설정 > 고급 설정`에서 변경할 수 있습니다.

2. **API 키 설정**
   - 설정 메뉴에서 OpenAI, Gemini, DeepSeek 등의 API 키를 입력하여 AI 기능을 활성화하세요.
   - 키는 로컬 저장소(`settings.json`)에만 저장되며 외부로 전송되지 않습니다.

3. **라이브러리 관리**
   - 왼쪽 사이드바에서 `.html` 또는 `.md` 형식의 논문을 추가하여 관리할 수 있습니다.

## 📖 문서 (Documentation)

- **사용자 가이드**: `help.md`
- **개발자 가이드**: `dev.md`

## 🛠 기술 스택

- **Frontend**: React, TypeScript, TailwindCSS
- **Desktop Framework**: Tauri v2
- **State Management**: React Hooks + Context
- **AI Integration**: Direct Client-side API Calls

## 📄 라이선스

MIT License
