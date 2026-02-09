# Future Roadmap: "Immersive Research Reader" - The Final Vision

## Phase 25: Academic Paper Layout (2026-02-09) ✅
**Goal**: Transform the reader into a true academic paper experience

**Changes Implemented**:

### 1. **CSS Typography Overhaul** (`index.css`)
- **Layout Variables**:
  - Reader max-width: 860px → **760px** (more focused reading column)
  - Line height: 1.85 → **1.8** (academic standard)
  - Added `--paragraph-spacing: 1.2em` and `--heading-spacing: 2.5em`
  - Enhanced serif font stack: Added Georgia as fallback
  - Improved font smoothing with `text-rendering: optimizeLegibility`

- **Heading Hierarchy** (LaTeX-inspired):
  ```
  H1: 2.4em, center-aligned, gradient effect, 2em bottom margin
  H2: 1.75em, border-bottom, 2.5em top margin
  H3: 1.4em, 2em top margin
  H4: 1.15em, 1.8em top margin
  H5: 1.05em, italic style
  H6: 1em, uppercase, letter-spacing
  ```

- **Paragraph Styling**:
  - `text-align: justify` with `text-justify: inter-word`
  - Auto hyphenation
  - Orphans/widows control (3 lines)
  - Optional paragraph indentation (`.indent-paragraphs`)

- **Block Elements**:
  - Blockquotes: Left border accent, italic, background tint
  - Lists: Proper nesting and spacing
  - Code blocks: Syntax-friendly background, monospace
  - Inline code: Purple accent (`#a78bfa`)

- **Math & Equations**:
  - KaTeX display: 2em vertical margin
  - Proper overflow handling

- **Figures & Tables**:
  - Figure captions: Italic, secondary color
  - Tables: Border-collapse, hover effects
  - Image shadows and rounded corners

- **Academic Sections**:
  - `.abstract` class with auto-label
  - Border accent and background differentiation

### 2. **prose-reader Class Enhancement**
- Unified all `.reader-content` styles into `.prose-reader`
- Applied full typography system
- Ensured consistent heading, paragraph, code, and table styling
- Max-width tied to CSS variable for easy adjustment

### 3. **Reader Component Layout** (`Reader.tsx`)
- Container padding: `py-20 px-12` (top/bottom: 80px, sides: 48px)
- Removed outer `max-w-3xl` wrapper (now handled by `.prose-reader`)
- Cleaner DOM structure:
  ```
  <div className="prose-reader mx-auto py-20 px-12">
    {paragraphs.map(...)}
  </div>
  ```
- Added conditional `font-sans` class for headings in paragraph loop

### 4. **Paragraph Component Refinement** (`Paragraph.tsx`)
- **Spacing Logic**:
  - Headings: `mb-4` (16px bottom margin)
  - Body text: `mb-2` (8px bottom margin)
  - Removed excessive rounded corners and padding from body paragraphs

- **Action Bar**:
  - Now hidden for headings (only shows on body paragraphs)
  - Maintains AI Repair and AI Align features

- **Typography**:
  - Removed inline font-size overrides
  - Let CSS cascade from `.prose-reader` and `.reader-content`
  - Headings inherit styles from `index.css`

### 5. **Visual Impact**
- **Before**: Cluttered, inconsistent spacing, headings not visually distinct
- **After**: 
  - Clear visual hierarchy (H1 > H2 > H3 immediately recognizable)
  - Professional academic typography
  - Justified text with proper hyphenation
  - Generous whitespace around headings
  - Focused reading column (760px max)

---

## 1. Ultimate Parse Quality (Phase 26+)
- **Deep Formatting Preservation**: Recognizes "Bullet lists", "Tables", and "Blockquotes" natively, rendering them exactly as structured data, not just flattened text.

## 2. True Agentic Intelligence (Backend Integration)
- **Local LLM Integration**: Fully integrate locally-running LLMs (Ollama/Llama.cpp) directly into the Tauri app for privacy-first summarization and Q&A.
- **Research Graph Construction**:
    - **Knowledge Graph**: Every highlighted sentence and concept becomes a node.
    - **Auto-Connect**: The agent automatically finds connections between different loaded papers (e.g., "Paper A cites Paper B regarding Concept X").
    - **Visualization**: A visual graph view showing how your library connects.

## 3. Seamless Sync & Mobile Ecosystem
- **Cloud Syllabus (Supabase/Firebase)**: Sync reading progress, highlights, and notes across Desktop (Tauri) and Mobile (PWA/React Native).
- **"On-the-Go" Mode**: A simplified mobile interface optimized for thumb-scrolling and quick highlighting.

## 4. Production-Grade Export & Collaboration
- **Smart Synthesis Export**:
    - Generate a "Review Paper" or "Literature Review" draft from selected highlights across multiple documents.
    - Auto-citation management (BibTeX export).
- **Public Highlight Sharing**: Generate a shareable link/image of a specific annotated passage with the AI's explanation attached.

## 5. Performance for Massive Libraries
- **Vector Database (Local)**:
    - Embed all document text locally using a small embedding model.
    - Enable "Semantic Search": Search for *concepts* ("how to improve transformer efficiency") rather than just keywords.
- **Virtual Scrolling Optimization**: Handle libraries with 10,000+ papers without UI lag.

## Final Goal
To create the **ultimate tool for researchers**—one that transforms the solitary act of reading into an interactive dialogue with knowledge, where the software acts not just as a viewer, but as an active research partner that organizes, connects, and synthesizes information for you.
