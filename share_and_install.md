# AI 논문리뷰어 설치 및 공유 가이드

이 문서는 다른 PC에서 'AI 논문리뷰어' 환경을 구축하고 실행하는 방법을 안내합니다. 이전 PC의 데이터(논문 목록, 설정 등)는 복제하지 않고, 프로그램 자체를 구동하는 데 중점을 둡니다.

## 1. 사전 준비 (Prerequisites)

새로운 PC에 아래 프로그램이 설치되어 있어야 합니다.

*   **Node.js**: [https://nodejs.org/](https://nodejs.org/) 에서 **LTS 버전**을 설치하세요.
*   **Web Browser**: Chrome 혹은 Edge 브라우저 사용을 권장합니다.

## 2. 파일 내려받기 (Download/Clone)

1.  이 소스 코드 폴더(`immersive-reader-tauri`) 전체를 압축하여 USB나 클라우드를 통해 새 PC로 복사합니다.
2.  새 PC의 원하는 위치에 압축을 풉니다.
    *   *참고: Git을 사용 중이라면 `git clone [저장소 주소]`를 사용하세요.*

## 3. 의존성 설치 (Install)

터미널(PowerShell 또는 명령 프롬프트)을 열고 해당 폴더로 이동한 뒤 다음 명령어를 입력합니다.

```bash
cd immersive-reader-tauri
npm install
```
*이 과정에서 `package.json`에 명세된 라이브러리(React, Vite, Lucide 등)가 설치됩니다.*

## 4. 프로그램 실행 (Run)

설치가 완료되면 다음 명령어로 로컬 서버를 실행합니다.

```bash
npm run dev
```

터미널에 표시되는 주소(예: `http://localhost:5173`)를 브라우저 주소창에 입력하여 접속합니다.

## 5. 초기 설정 팁

*   **API Key 입력**: 새 PC에서 처음 실행하면 API 키 설정이 비어있습니다. **Settings (Alt+S)** 메뉴를 열어 Gemini 또는 DeepSeek API 키를 다시 입력해야 AI 기능을 사용할 수 있습니다.
*   **논문 추가**: 기존 논문 데이터는 연동되지 않으므로, 새 PC의 브라우저에서 읽고 싶은 `.html` 논문 파일을 드래그 앤 드롭하여 추가하세요.

## 6. 문제 해결

*   `npm install` 중 에러가 발생하면 Node.js 버전이 너무 낮지 않은지 확인하세요. (v18 이상 권장)
*   브라우저 보안 설정으로 인해 로컬 파일 읽기가 제한될 경우, `npm run dev`를 통해 실행된 주소로 접속했는지 확인하세요.
