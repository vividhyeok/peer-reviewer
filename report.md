# Peer Reviewer — 입력 포맷 비교 리포트

## 분석 대상

| 파일 | 형식 | 크기 | `imt-state` |
|------|------|------|-------------|
| `2501.12948v2-ko-dual (1).html` | 이중언어 HTML (배경 회색) | 3,550.9 KB | `dual` |
| `2501.12948v2-ko-dual.html` | 이중언어 HTML (기본) | 3,550.8 KB | `dual` |
| `2501.12948v2-ko-translation.html` | 번역전용 HTML | 2,128.8 KB | `translation` |
| `2501.12948v2.pdf` | 원본 PDF | 4,917 KB | N/A |

---

## 1. 이중언어 HTML (Dual)

### 구조
```
<html lang="ko" imt-state=dual>
  <head> ... ~168KB CSS (Ant Design + Immersive Translate) ... </head>
  <div class="original-body _pdf-content_wb4da_109" id="pdf-pro-content">
    <div id="preview"><div id="preview-content">
      <h1 data-imt-p="1">
        영어 원문
        <font class="notranslate immersive-translate-target-wrapper" lang="ko">
          <br>
          <font class="...immersive-translate-target-inner...">
            한국어 번역
          </font>
        </font>
      </h1>
      <div data-imt-p="1">
        영어 원문 단락...
        <font class="notranslate immersive-translate-target-wrapper" lang="ko">
          <br>
          <font class="...immersive-translate-target-inner...">
            한국어 번역 단락...
          </font>
        </font>
      </div>
```

### 핵심 특징
- **원문(영어) + 번역(한국어)** 모두 하나의 요소 안에 포함
- 원문은 요소의 text node, 번역은 `<font class="immersive-translate-target-wrapper">` 내부
- `data-imt-p` 속성으로 번역 대상 단락 마킹
- 수학 수식: `<latex>`, `<asciimath>`, `<mathml>`, `<mjx-container>` (SVG) 모두 포함
- 이미지: `<img>` 태그 22개
- 테이블: `<table>` 태그 15개
- 섹션 제목: `<h2 class="section-title">` 74개
- **단락 구분**: `<div data-imt-p>` (p 태그는 3개뿐, 대부분 div)

### 파싱 호환성 (현재 ReaderParser)
| 항목 | 상태 |
|------|------|
| 이중언어 분리 | ✅ `extractBilingualContent()` — wrapper/inner 셀렉터로 한/영 분리 |
| 단락 수집 | ✅ `data-imt-p` 감지 → `collectBlockNodes()` 블록 인식 |
| 수식 처리 | ✅ `<latex>` → `$...$` 변환, MathJax SVG/MathML 제거 |
| 이미지/테이블 | ✅ atomic block 인식 |
| 노이즈 제거 | ✅ Ant Design CSS, 숨김 요소, script/style 제거 |
| 인용 추출 | ✅ 텍스트 기반 `(Author, Year)` 패턴 |

### 두 Dual 파일의 차이
- `(1)` 파일: `class="original-body _pdf-content_wb4da_109 dualBackgroundGrey"` (배경 회색 클래스 추가)
- 기본 파일: `class="original-body _pdf-content_wb4da_109"` (배경 클래스 없음)
- **내용상 차이 없음** — 19 바이트 차이는 이 클래스명뿐
- **결론: 동일 포맷, 스타일링 옵션 차이만 존재**

---

## 2. 번역전용 HTML (Translation)

### 구조
```
<html lang="ko" imt-state=translation>
  <head> ... ~168KB CSS ... </head>
  <div class="original-body _pdf-content_wb4da_109" id="pdf-pro-content">
    <div id="preview"><div id="preview-content">
      <h1 data-imt-p="1" data-imt-translation-only="1">
        한국어 번역만 표시
      </h1>
      <div data-imt-p="1" data-imt-translation-only="1">
        한국어 번역 단락...
      </div>
```

### 핵심 특징
- **번역(한국어)만 포함**, 영어 원문 없음
- `data-imt-translation-only="1"` 속성으로 번역 전용 요소 마킹
- `immersive-translate-target-wrapper` 극소수 (21개 vs dual의 915개)
- 수학 수식: `<math>` 397개 (dual의 749개의 약 절반 — 원문 수식 미포함)
- 파일 크기 40% 절감 (3,550 KB → 2,128 KB)
- 나머지 구조(이미지, 테이블, 섹션)는 동일

### 파싱 호환성 (현재 ReaderParser)
| 항목 | 상태 |
|------|------|
| 이중언어 분리 | ⚠️ 영어 원문 없음 → `enText` 빈 문자열, `koText`에만 내용 |
| 단락 수집 | ✅ `data-imt-p` 동일 작동 |
| 수식 처리 | ✅ 동일 |
| 인용 추출 | ✅ 한국어 텍스트에서도 `(Author, Year)` 패턴 추출 가능 |

### 문제점
1. **영어 원문이 없어** AI 분석 품질 저하 — 학술 논문의 정밀한 기술 용어가 번역 과정에서 손실
2. 현재 UI가 `enText` / `koText` 이중 표시를 전제 → 한쪽만 있으면 빈 영역 발생
3. AI에 원문 컨텍스트 제공 불가 → 용어 오역 검증 불가

---

## 3. PDF 직접 파싱

### 필요 기술
- `pdf.js` (Mozilla) 또는 `pdfium` (Rust) 라이브러리 추가 필요
- 텍스트 추출 → 단락 재구성 로직 자체 구현 필요
- 수식: PDF 내부 수식은 이미지/벡터 → OCR 또는 별도 수식 인식 필요
- 이미지/테이블: 위치 기반 추출 필요
- 이중언어: **번역 없음** → 별도 번역 API 연동 필요

### 파싱 호환성
| 항목 | 상태 |
|------|------|
| 이중언어 분리 | ❌ 영어만 추출, 번역 미포함 |
| 단락 수집 | ❌ 줄바꿈/컬럼 재구성 복잡 |
| 수식 처리 | ❌ 벡터/이미지 수식, 텍스트 인식 어려움 |
| 이미지/테이블 | ⚠️ 가능하지만 복잡 |
| 레이아웃 보존 | ❌ 헤더/푸터/각주/2단 레이아웃 분리 필요 |

### 장점
- 파싱 자체에 대한 "스트레스 없음" — 원본 그대로 사용
- Immersive Translate 의존성 제거

### 단점
1. **구현 비용 극대** — pdf.js 통합 + 단락 재구성 + 수식 처리
2. **수식 인식 정확도 낮음** — LaTeX 원본이 없어 $E=mc^2$ 같은 수식이 깨짐
3. **번역 없음** — 번역 API 추가 연동 필요 (비용 + 지연)
4. **페이지 단위 vs 의미 단위** — PDF는 페이지 기반, 단락이 페이지 경계에서 끊김
5. **2단 레이아웃** — 학술 논문 특유의 2단 구조 해석 복잡

---

## 종합 비교

| 평가 항목 | Dual HTML | Translation HTML | PDF |
|-----------|-----------|-----------------|-----|
| 파싱 난이도 | ⭐ 쉬움 | ⭐ 쉬움 | ⭐⭐⭐⭐⭐ 매우 어려움 |
| 이중언어 지원 | ✅ 완벽 | ❌ 번역만 | ❌ 원문만 |
| 수식 품질 | ✅ LaTeX 원본 보존 | ⚠️ 절반만 | ❌ 벡터/이미지 |
| 구조 보존 | ✅ HTML 시맨틱 | ✅ HTML 시맨틱 | ❌ 재구성 필요 |
| 파일 크기 | ⚠️ 3.5MB (CSS 포함) | ✅ 2.1MB | ⚠️ 4.9MB |
| 외부 의존성 | Immersive Translate | Immersive Translate | pdf.js + 번역 API |
| 현재 파서 호환 | ✅ 완벽 호환 | ⚠️ 부분 호환 | ❌ 미지원 |
| AI 분석 품질 | ✅ 원문+번역 모두 활용 | ⚠️ 번역만 활용 | ⚠️ 원문만 활용 |
| 추가 개발 비용 | 0 | 낮음 | 매우 높음 |

---

## 추천: 🏆 이중언어 HTML (Dual)

### 이유

1. **현재 파서와 100% 호환** — 추가 개발 없이 즉시 사용 가능
2. **원문+번역 동시 제공** — AI가 양쪽 언어 컨텍스트를 모두 활용하여 최고 품질 분석
3. **수식 LaTeX 원본 보존** — `<latex>` 태그에서 직접 `$...$` 변환, 정확한 수식 렌더링
4. **구조적 시맨틱 완벽** — 섹션, 테이블, 이미지, 인용이 HTML 태그로 명확히 구분
5. **Immersive Translate가 모든 전처리를 완료** — PDF → 구조화 HTML + 번역을 한 번에 해결

### 파일 크기 최적화 가능
- ~168KB의 CSS가 파일 크기의 약 5% 차지 → 로딩 시 제거하므로 실제 영향 없음
- `dualBackgroundGrey` 유무는 무관 → **두 dual 파일 모두 동일하게 작동**

### 권장 워크플로우
```
1. 사용자가 arxiv에서 PDF 다운로드
2. Immersive Translate (브라우저 확장)로 PDF를 "이중언어 HTML"로 내보내기
3. Peer Reviewer에서 HTML 파일 열기
4. 원문/번역 대조 읽기 + AI 분석
```

### Translation HTML은 언제 유용한가?
- 영어 원문이 불필요한 경우 (순수 한국어 독서용)
- 파일 크기 절약이 중요한 경우
- 현재 파서에서 `enText` 빈 문자열 처리 + UI 한국어 전용 모드 추가 시 지원 가능

### PDF 지원은?
- 투자 대비 효과가 낮음 — Immersive Translate가 PDF→HTML 변환을 이미 고품질로 수행
- 장기적으로 pdf.js 뷰어를 추가하면 "원문 대조" 기능으로 활용 가능
- 하지만 **파싱 + 단락 추출의 핵심 엔진으로는 부적합**

---

## 결론

**이중언어 HTML(Dual)을 표준 입력 포맷으로 확정**하는 것을 강력히 추천합니다.

현재 ReaderParser의 `extractBilingualContent()` → `TRANSLATION_WRAPPER_SELECTOR` / `TRANSLATION_INNER_SELECTOR` 파이프라인이 이 포맷을 완벽하게 처리하며, 추가 개발 비용이 0입니다. 파싱 스트레스 없이 최고 품질의 원문+번역 데이터를 확보할 수 있는 유일한 선택지입니다.
