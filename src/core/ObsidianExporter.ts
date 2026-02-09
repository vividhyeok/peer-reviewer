// Obsidian Export Utility
import type { Annotation, ParagraphData } from '../types/ReaderTypes';
import { toPlainTextFromHtml } from './TextRendering';

declare global {
  interface Window {
    __TAURI__?: any;
  }
}

export class ObsidianExporter {
  static async export(
    filePath: string,
    paragraphs: ParagraphData[],
    annotations: Annotation[]
  ): Promise<void> {
    const markdown = this.generateMarkdown(filePath, paragraphs, annotations);

    // 1. Try Tauri Export (Desktop App Mode)
    try {
      if (window.__TAURI__) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        const savePath = await save({
          defaultPath: this.getDefaultFileName(filePath),
          filters: [{ name: 'Markdown', extensions: ['md'] }]
        });

        if (savePath) {
          await writeTextFile(savePath, markdown);
          return;
        }
      }
    } catch (e) {
      console.warn('Tauri export failed, falling back to browser download', e);
    }

    // 2. Fallback to Browser Download (Web Mode)
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.getDefaultFileName(filePath);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private static getDefaultFileName(filePath: string): string {
    const fileName = filePath.split(/[\\/]/).pop() || 'paper';
    const baseName = fileName.replace(/\.[^.]+$/, '');
    return `${baseName}-notes.md`;
  }

  private static generateMarkdown(
    filePath: string,
    paragraphs: ParagraphData[],
    annotations: Annotation[]
  ): string {
    const lines: string[] = [];
    const fileName = filePath.split(/[\\/]/).pop() || 'Unknown Paper';

    // Header
    lines.push(`# ${fileName}\n`);
    lines.push(`> **Source:** ${filePath}`);
    lines.push(`> **Exported:** ${new Date().toISOString().split('T')[0]}\n`);
    lines.push('---\n');

    // Group annotations by type
    const highlights = annotations.filter(a => a.type === 'highlight');
    const definitions = annotations.filter(a => a.type === 'definition');
    const discussions = annotations.filter(a => a.type === 'discussion');

    // Highlights Section
    if (highlights.length > 0) {
      lines.push('## 📌 Highlights\n');
      highlights.forEach((ann, idx) => {
        const para = paragraphs.find(p => p.id === ann.target.paragraphId);
        lines.push(`### Highlight ${idx + 1}`);
        lines.push(`> ${ann.target.selectedText}\n`);
        if (para) {
          lines.push(`**Context:** ${this.truncate(toPlainTextFromHtml(para.enText), 220)}\n`);
        }
        if (ann.color) {
          lines.push(`**Color:** \`${ann.color}\`\n`);
        }
        lines.push('');
      });
    }

    // Definitions Section
    if (definitions.length > 0) {
      lines.push('## 📖 Definitions & Concepts\n');
      definitions.forEach(ann => {
        lines.push(`### ${ann.target.selectedText}`);
        lines.push(`${ann.content}\n`);
      });
    }

    // Q&A / Discussions Section
    if (discussions.length > 0) {
      lines.push('## 💬 Questions & Discussions\n');
      discussions.forEach((ann, idx) => {
        const para = paragraphs.find(p => p.id === ann.target.paragraphId);
        lines.push(`### Discussion ${idx + 1}`);
        lines.push(`**Text:** "${ann.target.selectedText}"`);
        lines.push(`\n${ann.content}\n`);
        if (para) {
          lines.push(`**Context:** ${this.truncate(toPlainTextFromHtml(para.enText), 220)}\n`);
        }
      });
    }

    // Summary Section
    lines.push('---\n');
    lines.push('## 📊 Summary\n');
    lines.push(`- **Total Highlights:** ${highlights.length}`);
    lines.push(`- **Definitions:** ${definitions.length}`);
    lines.push(`- **Discussions:** ${discussions.length}`);
    lines.push(`- **Total Annotations:** ${annotations.length}\n`);

    return lines.join('\n');
  }

  private static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
