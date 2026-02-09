import type { Annotation } from '../types/annotation';

type HighlightSegment = {
  start: number;
  end: number;
  color: string;
};

const DEFAULT_HIGHLIGHT = '#fef08a';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeColor(color?: string): string {
  if (!color) return DEFAULT_HIGHLIGHT;
  if (color === 'yellow') return '#fde68a';
  if (color === 'green') return '#86efac';
  if (color === 'blue') return '#93c5fd';
  if (color === 'pink') return '#f9a8d4';
  return color;
}

export function toPlainTextFromHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export function applyHighlightsToHtml(html: string, annotations: Annotation[]): string {
  const highlightSegments = annotations
    .filter((annotation) => annotation.type === 'highlight')
    .map((annotation) => ({
      start: annotation.target.startOffset,
      end: annotation.target.endOffset,
      color: normalizeColor(annotation.color),
    }));

  if (highlightSegments.length === 0) {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="render-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('render-root');
  if (!root) {
    return html;
  }

  const textNodes: Array<{ node: Text; start: number; end: number }> = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let current = walker.nextNode();

  while (current) {
    const textNode = current as Text;
    const value = textNode.textContent ?? '';
    const length = value.length;
    if (length > 0) {
      textNodes.push({ node: textNode, start: cursor, end: cursor + length });
      cursor += length;
    }
    current = walker.nextNode();
  }

  if (cursor === 0) {
    return html;
  }

  const normalized = highlightSegments
    .map((segment) => ({
      start: clamp(segment.start, 0, cursor),
      end: clamp(segment.end, 0, cursor),
      color: segment.color,
    }))
    .filter((segment) => segment.start < segment.end)
    .sort((a, b) => a.start - b.start);

  if (normalized.length === 0) {
    return html;
  }

  for (const entry of textNodes) {
    const intersections = normalized
      .map((segment) => ({
        start: Math.max(segment.start, entry.start),
        end: Math.min(segment.end, entry.end),
        color: segment.color,
      }))
      .filter((segment) => segment.start < segment.end)
      .sort((a, b) => a.start - b.start);

    if (intersections.length === 0) {
      continue;
    }

    const merged: HighlightSegment[] = [];
    for (const segment of intersections) {
      const last = merged.at(-1);
      if (last && segment.start <= last.end) {
        last.end = Math.max(last.end, segment.end);
      } else {
        merged.push({ ...segment });
      }
    }

    const text = entry.node.textContent ?? '';
    const fragment = doc.createDocumentFragment();
    let localCursor = 0;

    for (const segment of merged) {
      const start = segment.start - entry.start;
      const end = segment.end - entry.start;

      if (start > localCursor) {
        fragment.appendChild(doc.createTextNode(text.slice(localCursor, start)));
      }

      const mark = doc.createElement('mark');
      mark.className = 'paper-highlight';
      mark.style.backgroundColor = segment.color;
      mark.textContent = text.slice(start, end);
      fragment.appendChild(mark);
      localCursor = end;
    }

    if (localCursor < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(localCursor)));
    }

    entry.node.parentNode?.replaceChild(fragment, entry.node);
  }

  return root.innerHTML;
}
