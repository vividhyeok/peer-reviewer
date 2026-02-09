# Release Notes - v0.2.0 (Structure & Insight Update)

## New Features
- **Smart Structure Parsing**: Automatically detects Table of Contents, Figures, and Tables from document HTML.
- **Enhanced Sidebar**: Added "Structure" tab (Outline) to navigate complex papers easily.
- **Rich Media Rendering**: 
    - Images are now extracted and centered with captions.
    - Tables are preserved with scrollable containers.
    - Added "Explain Image" placeholder triggers for future AI integration.
- **Smart Citations**: 
    - Citations like `[1]` and `(Author, 2024)` are automatically detected and linked.
    - Clicking a citation highlights the source text (UI link established).

## Technical Improvements
- **ReaderParser Refactor**: Moved from simple text splitting to true semantic HTML parsing (`ReaderParser.ts`).
- **Type System**: Expanded `ParagraphData` to support `image`, `table`, `heading` types.
- **Performance**: Optimized rendering for large documents by protecting structure during translation alignment.

## MVP Status
Implemented items from "Essential 20" list:
- [x] #11 Paper Structure (TOC)
- [x] #4 Image Explanation (UI/Detection)
- [x] #8 Smart Citation (Extraction/Linking)
- [x] #13 Table Analysis (Rendering)

## Known Issues
- Build process (Vite) runs successfully but may exit silently on some low-memory environments. TypeScript checks pass 100%.
