# Paper Reviewer

**Paper Reviewer**는 연구자와 개발자를 위한 **AI 기반 로컬 논문 독해/리뷰 도구**입니다.
복잡한 설치 과정 없이, 웹 브라우저 하나로 로컬 파일을 관리하고 AI의 도움을 받아 논문을 깊이 있게 분석할 수 있습니다.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

## ✨ 특징 (Features)

- **📝 로컬 퍼스트 (Local-First)**: 모든 데이터(문서, 주석, AI 대화)는 내 컴퓨터의 프로젝트 폴더(`paper-reader-data/`)에 저장됩니다. (Dev Server Mode)
- **🤖 멀티 AI 모델 지원**: DeepSeek, Gemini, OpenAI 등 다양한 모델을 **용도에 맞게 섞어서** 사용할 수 있습니다. (예: 설명은 Gemini Flash, 비판은 DeepSeek R1)
- **🔍 강력한 파서**: HTML/Markdown 논문의 구조를 자동으로 분석하여 목차(TOC)와 문단 단위의 인터랙션을 제공합니다. 수식(MathJax/MathML)도 완벽하게 지원합니다.
- **💬 연구 에이전트**: 단순 챗봇이 아닌, 현재 읽고 있는 문단(Context)을 이해하고 토론하는 파트너입니다.
- **⚡ 가볍고 빠름**: 무거운 설치 과정 없이, `start_browser.bat` 파일 하나로 즉시 실행됩니다.

## 🚀 실행 방법 (Getting Started)

### 사전 요구사항
- **Node.js**: (v18 이상 권장) 컴퓨터에 설치되어 있어야 합니다.

### 설치 및 실행
1. 프로젝트 폴더를 엽니다.
2. 처음이라면 의존성을 설치합니다:
   ```bash
   npm install
   ```
   (이미 `node_modules`가 있다면 생략 가능)
3. **원클릭 실행**:
   - `start_browser.bat` 파일을 더블 클릭하세요.
   - 까만 터미널 창(서버)이 열리고, 잠시 후 웹 브라우저가 자동으로 실행됩니다.

## 📖 문서 (Documentation)

- **사용자 가이드**: `help.md` - 프로그램 사용법과 단축키 등을 설명합니다.
- **개발자 가이드**: `dev.md` - 프로젝트 구조와 아키텍처, 작동 원리를 설명합니다.

## 🛠 기술 스택

- **Frontend**: React, TypeScript, TailwindCSS
- **Storage**: Custom Vite Middleware (Local FS Access)
- **AI Integration**: Client-side API Calls (No Backend Proxy needed)

## 📄 라이선스

MIT License
