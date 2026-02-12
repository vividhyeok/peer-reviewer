import {
    type ParagraphData,
    type AlignedSentence,
    type Citation,
    type TocItem,
    type PaperStructure
} from '../types/ReaderTypes';

type ParagraphType = ParagraphData['type'];

interface ParserContext {
    index: number;
    seenSignatures: Set<string>;
    toc: TocItem[];
    figures: { id: string; desc: string }[];
    tables: { id: string; desc: string }[];
}

const BLOCK_TAGS = new Set([
    'p', 'div', 'blockquote', 'pre', 'table', 'figure', 'img', 'picture', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'dt', 'dd'
]);

const CONTAINER_TAGS = new Set(['body', 'main', 'article', 'section', 'header', 'footer', 'aside', 'nav']);

const ALLOWED_TAGS = new Set([
    'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'div', 'em', 'figcaption', 'figure',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'mark', 'ol', 'p', 'picture',
    'pre', 's', 'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
    'thead', 'tr', 'u', 'ul'
]);

const TRANSLATION_WRAPPER_SELECTOR = '.immersive-translate-target-wrapper,[class*="immersive-translate-target-wrapper"]';
const TRANSLATION_INNER_SELECTOR = '.immersive-translate-target-inner,[class*="immersive-translate-target-inner"]';
const TRANSLATION_BLOCK_SELECTOR = '[class*="immersive-translate-target-translation-"]';

export class ReaderParser {
    static parse(source: string, baseUrl: string = ''): { paragraphs: ParagraphData[]; structure: PaperStructure } {
        const normalizedSource = this.normalizeSource(source);
        // Pre-strip CSS/base/noise from Immersive Translate HTML before DOM parsing
        const preprocessed = this.preprocessHtml(normalizedSource);
        const parser = new DOMParser();
        const doc = parser.parseFromString(preprocessed, 'text/html');

        // Remove noise BEFORE picking root (so textContent scoring is accurate)
        this.removeGlobalNoise(doc);
        const root = this.pickRoot(doc);

        const context: ParserContext = {
            index: 0,
            seenSignatures: new Set<string>(),
            toc: [],
            figures: [],
            tables: []
        };

        const paragraphs: ParagraphData[] = [];
        const blocks = this.collectBlockNodes(root);

        for (const block of blocks) {
            const paragraph = this.parseBlock(block, baseUrl, context);
            if (!paragraph) continue;
            paragraphs.push(paragraph);
        }

        if (paragraphs.length === 0) {
            const fallbackText = this.normalizeWhitespace(root.textContent || '');
            if (fallbackText) {
                const id = this.generateHash(`fallback-${fallbackText.slice(0, 80)}`);
                paragraphs.push({
                    id,
                    type: 'text',
                    element: 'p',
                    enText: this.escapeHtml(fallbackText),
                    koText: '',
                    sentences: [{ en: this.escapeHtml(fallbackText), ko: '' }],
                    citations: this.extractCitations(fallbackText),
                    index: 0,
                    isReference: false
                });
            }
        }

        this.resolveCitationTargets(paragraphs);

        return {
            paragraphs,
            structure: {
                toc: context.toc,
                figures: context.figures,
                tables: context.tables
            }
        };
    }

    private static normalizeSource(source: string): string {
        if (this.isLikelyMarkdown(source)) {
            return this.markdownToHtml(source);
        }
        return source;
    }

    /**
     * Pre-process Immersive Translate HTML before DOMParser.
     * Strips massive redundant math rendering (MathML, MathJax SVG) from raw string
     * to prevent WebView OOM crash. Preserves <latex> and <asciimath> text tags
     * which carry the actual math content.
     *
     * Typical reduction: 3.5 MB → 1.2 MB (65 %+)
     */
    private static preprocessHtml(html: string): string {
        // 1. Replace entire <head> with minimal charset declaration (~168 KB CSS/meta removed)
        let result = html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, '<head><meta charset="UTF-8"></head>');

        // 2. Remove <mathml> blocks — massive MathML XML, redundant with <latex> tags
        //    Use \b word-boundary so we don't accidentally match <mathmlword>
        result = result.replace(/<mathml\b[^>]*>[\s\S]*?<\/mathml>/gi, '');

        // 3. Remove <mathmlword> blocks — another redundant math representation
        result = result.replace(/<mathmlword\b[^>]*>[\s\S]*?<\/mathmlword>/gi, '');

        // 4. Remove MathJax SVG containers — rendered SVGs, redundant with <latex>
        result = result.replace(/<mjx-container\b[^>]*>[\s\S]*?<\/mjx-container>/gi, '');

        // 5. Remove <base> tags (prevents erroneous URL resolution)
        result = result.replace(/<base[^>]*>/gi, '');

        return result;
    }

    private static isLikelyMarkdown(source: string): boolean {
        const trimmed = source.trim();
        if (!trimmed) return false;
        if (/<(html|head|body|div|p|h1|h2|h3|h4|h5|h6|table|figure|img)\b/i.test(trimmed)) {
            return false;
        }

        return (
            /^#{1,6}\s+/m.test(trimmed) ||
            /^[-*+]\s+/m.test(trimmed) ||
            /^\d+\.\s+/m.test(trimmed) ||
            /\|.+\|/.test(trimmed)
        );
    }

    private static markdownToHtml(markdown: string): string {
        const lines = markdown.replace(/\r\n/g, '\n').split('\n');
        const htmlLines: string[] = [];
        let inList = false;
        let inCode = false;

        const flushList = () => {
            if (!inList) return;
            htmlLines.push('</ul>');
            inList = false;
        };

        for (const rawLine of lines) {
            const line = rawLine.trimEnd();

            if (/^```/.test(line)) {
                if (inCode) {
                    htmlLines.push('</code></pre>');
                } else {
                    flushList();
                    htmlLines.push('<pre><code>');
                }
                inCode = !inCode;
                continue;
            }

            if (inCode) {
                htmlLines.push(this.escapeHtml(rawLine));
                continue;
            }

            const heading = line.match(/^(#{1,6})\s+(.*)$/);
            if (heading) {
                flushList();
                const level = heading[1].length;
                htmlLines.push(`<h${level}>${this.escapeHtml(heading[2].trim())}</h${level}>`);
                continue;
            }

            const listItem = line.match(/^[-*+]\s+(.*)$/);
            if (listItem) {
                if (!inList) {
                    htmlLines.push('<ul>');
                    inList = true;
                }
                htmlLines.push(`<li>${this.escapeHtml(listItem[1].trim())}</li>`);
                continue;
            }

            flushList();
            if (!line.trim()) {
                continue;
            }

            htmlLines.push(`<p>${this.escapeHtml(line.trim())}</p>`);
        }

        flushList();

        if (inCode) {
            htmlLines.push('</code></pre>');
        }

        return `<html><body>${htmlLines.join('\n')}</body></html>`;
    }

    private static pickRoot(doc: Document): Element {
        const candidates = [
            doc.querySelector('#preview-content'),
            doc.querySelector('#setText'),
            doc.querySelector('#pdf-pro-content #preview-content'),
            doc.querySelector('[id*="preview-content"]'),
            doc.querySelector('article'),
            doc.querySelector('main'),
            doc.body,
            doc.documentElement
        ].filter(Boolean) as Element[];

        let best = candidates[0] || (doc.body || doc.documentElement);
        let bestScore = -1;

        for (const candidate of candidates) {
            const score = this.normalizeWhitespace(candidate.textContent || '').length;
            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }

        return best;
    }

    private static removeGlobalNoise(doc: Document): void {
        doc.querySelectorAll(
            'script,style,noscript,iframe,meta,link,object,template,.immersive-translate-input,.immersive-translate-target-abbr'
        ).forEach((node) => node.remove());

        // Remove known garbage classes
        doc.querySelectorAll(
            '.MathJax_Preview,.mjx-assistive-mml,table-markdown,tsv,block-markdown'
        ).forEach((node) => node.remove());

        // Remove elements explicitly hidden via inline styles, BUT preserve math source tags
        doc.querySelectorAll(
            '[style*="display: none"]:not(latex):not(asciimath),[style*="display:none"]:not(latex):not(asciimath)'
        ).forEach((node) => node.remove());
    }

    private static collectBlockNodes(root: Element): Element[] {
        const blocks: Element[] = [];

        const visit = (node: Element) => {
            if (this.shouldSkipNode(node)) return;

            const tag = node.tagName.toLowerCase();

            if (tag === 'ul' || tag === 'ol' || tag === 'dl') {
                Array.from(node.children).forEach((child) => visit(child as Element));
                return;
            }

            if (tag === 'li' || tag === 'dt' || tag === 'dd') {
                const nested = this.getBlockChildren(node);
                if (nested.length === 0) {
                    blocks.push(node);
                    return;
                }
                nested.forEach(visit);
                return;
            }

            if (this.isAtomicBlock(node) || this.isHeading(node)) {
                blocks.push(node);
                return;
            }

            const blockChildren = this.getBlockChildren(node);
            const directText = this.getDirectText(node);
            const hasStructuralHint =
                node.hasAttribute('data-imt-p') ||
                node.classList.contains('abstract') ||
                node.classList.contains('author') ||
                node.classList.contains('caption_table') ||
                node.classList.contains('section-title') ||
                node.classList.contains('sub_section-title');

            const hasUsefulMedia = !!node.querySelector('img,table,figure,picture');

            if (
                (tag === 'p' || tag === 'blockquote' || tag === 'pre') &&
                (directText.length > 0 || hasUsefulMedia || hasStructuralHint)
            ) {
                blocks.push(node);
                return;
            }

            if (
                tag === 'div' &&
                (hasStructuralHint || blockChildren.length === 0) &&
                (directText.length > 0 || hasUsefulMedia)
            ) {
                blocks.push(node);
                return;
            }

            if (blockChildren.length > 0 || CONTAINER_TAGS.has(tag) || tag === 'div') {
                Array.from(node.children).forEach((child) => visit(child as Element));
                return;
            }

            if (directText.length > 0) {
                blocks.push(node);
            }
        };

        Array.from(root.children).forEach((child) => visit(child as Element));

        return blocks;
    }

    private static shouldSkipNode(node: Element): boolean {
        const tag = node.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') return true;
        if (node.closest('head')) return true;
        if (node.classList.contains('immersive-translate-input')) return true;
        if (node.getAttribute('aria-hidden') === 'true') return true;

        const cls = node.className || '';
        if (typeof cls === 'string') {
            if (/\bant-/.test(cls) && !node.hasAttribute('data-imt-p')) return true;
            if (/\bimmersive-translate-modal\b/.test(cls)) return true;
        }

        return false;
    }

    private static isAtomicBlock(node: Element): boolean {
        const tag = node.tagName.toLowerCase();
        if (tag === 'img' || tag === 'figure' || tag === 'picture' || tag === 'table' || tag === 'hr') return true;
        if (node.classList.contains('inline-tabular')) return true;
        return false;
    }

    private static isHeading(node: Element): boolean {
        return /^h[1-6]$/i.test(node.tagName);
    }

    private static getBlockChildren(node: Element): Element[] {
        return Array.from(node.children).filter((child) => {
            const el = child as Element;
            const tag = el.tagName.toLowerCase();
            return BLOCK_TAGS.has(tag) || this.isHeading(el) || this.isAtomicBlock(el);
        }) as Element[];
    }

    private static getDirectText(node: Element): string {
        let text = '';
        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent || '';
            }
        }
        return this.normalizeWhitespace(text);
    }

    private static parseBlock(node: Element, baseUrl: string, context: ParserContext): ParagraphData | null {
        const tag = node.tagName.toLowerCase();
        const { enHtml, koHtml } = this.extractBilingualContent(node);

        let cleanEn = this.sanitizeHtml(enHtml, { preserveSvg: false });
        const cleanKo = this.sanitizeHtml(koHtml, { preserveSvg: false });

        const plainEn = this.toPlainText(cleanEn);
        const plainKo = this.toPlainText(cleanKo);

        const looksEmpty = plainEn.length === 0 && plainKo.length === 0;
        const hasImage = !!node.querySelector('img');
        const hasTable = !!node.querySelector('table');

        if (looksEmpty && !hasImage && !hasTable && tag !== 'hr') {
            return null;
        }

        const typeInfo = this.detectParagraphType(node, cleanEn, plainEn);
        const safeElement = this.normalizeElementTag(tag, typeInfo.type);

        if (typeInfo.type === 'image' && typeInfo.metadata.src) {
            typeInfo.metadata.src = this.resolveAssetUrl(baseUrl, typeInfo.metadata.src);
        }

        if (typeInfo.type === 'table') {
            const tableNode = node.tagName.toLowerCase() === 'table' ? node : node.querySelector('table');
            if (tableNode) {
                cleanEn = this.sanitizeHtml(tableNode.outerHTML, { preserveSvg: true });
            }
        }

        const signatureBase = `${typeInfo.type}|${safeElement}|${this.normalizeWhitespace((plainEn || plainKo).toLowerCase()).slice(0, 220)}`;
        if (context.seenSignatures.has(signatureBase)) {
            return null;
        }
        context.seenSignatures.add(signatureBase);

        const id = this.generateHash(`${signatureBase}|${context.index}`);
        const visibleText = plainEn || plainKo;

        if (typeInfo.type === 'heading') {
            typeInfo.metadata.headingId = node.id || id;
            context.toc.push({
                id: typeInfo.metadata.headingId,
                text: visibleText,
                level: typeInfo.metadata.headingLevel || 1,
                paragraphId: id
            });
        }

        if (typeInfo.type === 'image') {
            context.figures.push({
                id,
                desc: typeInfo.metadata.caption || typeInfo.metadata.alt || 'Figure'
            });
        }

        if (typeInfo.type === 'table') {
            context.tables.push({
                id,
                desc: typeInfo.metadata.caption || visibleText.slice(0, 120) || 'Table'
            });
        }

        const citations = this.extractCitations(visibleText);
        const sentences = this.alignSentences(cleanEn, cleanKo);
        const isReference = this.isReferenceText(visibleText);

        const paragraph: ParagraphData = {
            id,
            type: typeInfo.type,
            element: safeElement,
            enText: cleanEn,
            koText: cleanKo,
            sentences,
            citations,
            index: context.index++,
            metadata: typeInfo.metadata,
            isReference
        };

        return paragraph;
    }

    private static extractBilingualContent(node: Element): { enHtml: string; koHtml: string } {
        const working = node.cloneNode(true) as Element;
        const koChunks: string[] = [];

        const wrappers = Array.from(working.querySelectorAll(TRANSLATION_WRAPPER_SELECTOR)).filter((candidate) => {
            const parent = (candidate as Element).parentElement;
            return !parent || !parent.matches(TRANSLATION_WRAPPER_SELECTOR);
        });
        for (const wrapperNode of wrappers) {
            const wrapper = wrapperNode as Element;
            const innerChunks = Array.from(wrapper.querySelectorAll(TRANSLATION_INNER_SELECTOR))
                .map((inner) => (inner as HTMLElement).innerHTML)
                .map((chunk) => this.normalizeTranslationChunk(chunk))
                .filter(Boolean);

            if (innerChunks.length > 0) {
                koChunks.push(innerChunks.join(' '));
            } else {
                koChunks.push(this.normalizeTranslationChunk(wrapper.innerHTML));
            }

            wrapper.remove();
        }

        working.querySelectorAll(TRANSLATION_BLOCK_SELECTOR).forEach((el) => el.remove());

        const enHtml = (working as HTMLElement).innerHTML || '';
        const koHtml = koChunks.join(' ');

        return { enHtml, koHtml };
    }

    private static normalizeTranslationChunk(html: string): string {
        return html
            .replace(/^\s*<br\s*\/?>/i, '')
            .replace(/<br\s*\/?>\s*$/i, '')
            .trim();
    }

    private static sanitizeHtml(html: string, options: { preserveSvg: boolean }): string {
        if (!html) return '';

        const root = document.createElement('div');
        root.innerHTML = html;

        root.querySelectorAll('script,style,noscript,iframe,object,meta,link,form,input,textarea,select,button').forEach((el) => el.remove());
        root.querySelectorAll('.immersive-translate-input,.immersive-translate-target-abbr').forEach((el) => el.remove());
        
        // Remove hidden elements that escaped global noise removal (e.g. inside chunks)
        root.querySelectorAll('[style*="display: none"],[style*="display:none"],table-markdown,tsv').forEach((el) => el.remove());

        // Prefer plain LaTeX/AsciiMath over large MathJax SVG payload.
        root.querySelectorAll('latex,asciimath').forEach((mathNode) => {
            const text = this.normalizeWhitespace(mathNode.textContent || '');
            if (!text) {
                mathNode.remove();
                return;
            }

            // Wrap in $...$ to indicate math, or just return text. 
            // Given it's from a latex tag, it's likely raw tex.
            // Adding $ helps readability if the renderer supports Markdown/Latex, which it seems to.
            const replacement = document.createTextNode(` $${text}$ `);
            mathNode.replaceWith(replacement);
        });

        root.querySelectorAll('mathml,mathmlword,mjx-assistive-mml').forEach((el) => el.remove());

        if (!options.preserveSvg) {
            root.querySelectorAll('mjx-container,svg,path').forEach((el) => el.remove());
        }

        const nodes = Array.from(root.querySelectorAll('*')).reverse();
        for (const node of nodes) {
            const tag = node.tagName.toLowerCase();

            for (const attr of Array.from(node.attributes)) {
                const name = attr.name.toLowerCase();
                if (
                    name === 'href' ||
                    name === 'src' ||
                    name === 'alt' ||
                    name === 'title' ||
                    name === 'id' ||
                    name === 'class'
                ) {
                    continue;
                }
                node.removeAttribute(attr.name);
            }

            if (!ALLOWED_TAGS.has(tag)) {
                const fragment = document.createDocumentFragment();
                while (node.firstChild) {
                    fragment.appendChild(node.firstChild);
                }
                node.replaceWith(fragment);
            }
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const textNode = walker.currentNode as Text;
            textNode.textContent = this.normalizeWhitespace(textNode.textContent || ' ');
        }

        return root.innerHTML.trim();
    }

    private static detectParagraphType(
        node: Element,
        cleanEn: string,
        plainEn: string
    ): { type: ParagraphType; metadata: NonNullable<ParagraphData['metadata']> } {
        const tag = node.tagName.toLowerCase();
        const metadata: NonNullable<ParagraphData['metadata']> = {};

        if (/^h[1-6]$/.test(tag)) {
            return {
                type: 'heading',
                metadata: {
                    headingLevel: parseInt(tag.slice(1), 10),
                    headingId: node.id || undefined
                }
            };
        }

        if (tag === 'pre' || tag === 'code') {
            return { type: 'code', metadata };
        }

        const tableElement = tag === 'table' ? node : node.querySelector('table');
        if (tableElement) {
            const captionText =
                this.normalizeWhitespace(tableElement.querySelector('caption')?.textContent || '') ||
                this.normalizeWhitespace(node.querySelector('.caption_table')?.textContent || '') ||
                '';
            metadata.caption = captionText;
            return { type: 'table', metadata };
        }

        const imageElement = (tag === 'img' ? node : node.querySelector('img')) as HTMLImageElement | null;
        if (imageElement) {
            metadata.src = imageElement.getAttribute('src') || '';
            metadata.alt = imageElement.getAttribute('alt') || '';
            metadata.caption =
                this.normalizeWhitespace(node.querySelector('figcaption')?.textContent || '') ||
                this.normalizeWhitespace(imageElement.getAttribute('title') || '') ||
                '';
            return { type: 'image', metadata };
        }

        if (plainEn.length === 0 && /<img\b/i.test(cleanEn)) {
            return { type: 'image', metadata };
        }

        return { type: 'text', metadata };
    }

    private static normalizeElementTag(tag: string, type: ParagraphType): string {
        if (type === 'heading' && /^h[1-6]$/.test(tag)) return tag;
        if (type === 'table') return 'table';
        if (type === 'image') return tag === 'figure' || tag === 'picture' || tag === 'img' ? tag : 'figure';
        if (type === 'code') return 'pre';
        if (tag === 'li' || tag === 'blockquote' || tag === 'p') return tag;
        return 'div';
    }

    private static resolveAssetUrl(baseUrl: string, src: string): string {
        const normalizedSrc = src.trim();
        if (!normalizedSrc) return src;

        if (
            normalizedSrc.startsWith('http://') ||
            normalizedSrc.startsWith('https://') ||
            normalizedSrc.startsWith('data:') ||
            normalizedSrc.startsWith('blob:') ||
            normalizedSrc.startsWith('file:') ||
            normalizedSrc.startsWith('/')
        ) {
            return normalizedSrc;
        }

        if (!baseUrl) return normalizedSrc;

        const normalizedBase = baseUrl.replace(/\\/g, '/');
        const baseWithoutQuery = normalizedBase.split('?')[0].split('#')[0];
        const slashIndex = baseWithoutQuery.lastIndexOf('/');
        if (slashIndex < 0) return normalizedSrc;

        const baseDir = baseWithoutQuery.slice(0, slashIndex + 1);
        return `${baseDir}${normalizedSrc}`;
    }

    private static alignSentences(enHtml: string, koHtml: string): AlignedSentence[] {
        const cleanEn = enHtml.trim();
        const cleanKo = koHtml.trim();

        if (!cleanEn && !cleanKo) return [];
        if (!cleanKo) return [{ en: cleanEn, ko: '' }];
        if (!cleanEn) return [{ en: cleanKo, ko: cleanKo }];

        const enSentences = this.splitToPlainSentences(cleanEn);
        const koSentences = this.splitToPlainSentences(cleanKo);

        if (
            enSentences.length > 1 &&
            enSentences.length === koSentences.length &&
            enSentences.length <= 20
        ) {
            return enSentences.map((en, idx) => ({
                en: this.escapeHtml(en),
                ko: this.escapeHtml(koSentences[idx] || '')
            }));
        }

        return [{ en: cleanEn, ko: cleanKo }];
    }

    private static splitToPlainSentences(html: string): string[] {
        const plain = this.toPlainText(html);
        if (!plain) return [];

        const regex = this.isKorean(plain)
            ? /[^.!?\n]+[.!?]?/g
            : /[^.!?]+[.!?]?/g;

        const chunks = (plain.match(regex) || [plain])
            .map((chunk) => this.normalizeWhitespace(chunk))
            .filter(Boolean);

        if (chunks.length === 0) return [plain];
        return chunks;
    }

    private static extractCitations(text: string): Citation[] {
        const citations: Citation[] = [];
        const seen = new Set<string>();

        const numericRegex = /\[(\d{1,3}(?:\s*[-,]\s*\d{1,3})*)\]/g;
        let match: RegExpExecArray | null;
        while ((match = numericRegex.exec(text)) !== null) {
            const id = `[${match[1].replace(/\s+/g, '')}]`;
            if (seen.has(id)) continue;
            seen.add(id);
            citations.push({ id });
        }

        const authorYearRegex = /\(([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'`\-]+(?:\s+et al\.)?,\s*(?:19|20)\d{2}[a-z]?(?:;\s*[A-Z][^)]*)*)\)/g;
        while ((match = authorYearRegex.exec(text)) !== null) {
            const id = `(${this.normalizeWhitespace(match[1])})`;
            if (seen.has(id)) continue;
            seen.add(id);
            citations.push({ id });
        }

        return citations;
    }

    private static resolveCitationTargets(paragraphs: ParagraphData[]): void {
        const referenceStartIndex = paragraphs.findIndex((paragraph) => {
            if (paragraph.type !== 'heading') return false;
            const headingText = (this.toPlainText(paragraph.enText) || this.toPlainText(paragraph.koText)).toLowerCase();
            return headingText.includes('references') || headingText.includes('bibliography') || headingText.includes('참고문헌');
        });

        if (referenceStartIndex < 0) return;

        const numericReferenceMap = new Map<string, string>();

        for (let i = referenceStartIndex + 1; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            const plain = this.toPlainText(paragraph.enText) || this.toPlainText(paragraph.koText);
            if (!plain) continue;

            if (paragraph.type === 'heading' && i > referenceStartIndex + 4 && !paragraph.isReference) {
                break;
            }

            const match = plain.match(/^\s*\[?(\d{1,3})\]?[.)]?\s+/);
            if (match) {
                numericReferenceMap.set(match[1], paragraph.id);
            }
        }

        if (numericReferenceMap.size === 0) return;

        for (const paragraph of paragraphs) {
            paragraph.citations = paragraph.citations.map((citation) => {
                const numeric = citation.id.match(/^\[(\d{1,3})(?:[-,].*)?\]$/);
                if (!numeric) return citation;

                const target = numericReferenceMap.get(numeric[1]);
                if (!target) return citation;

                return { ...citation, paragraphId: target };
            });
        }
    }

    private static isReferenceText(text: string): boolean {
        const lower = text.toLowerCase();
        return (
            lower.includes('references') ||
            lower.includes('bibliography') ||
            lower.includes('참고문헌')
        );
    }

    private static toPlainText(html: string): string {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return this.normalizeWhitespace(div.textContent || '');
    }

    private static normalizeWhitespace(text: string): string {
        return text.replace(/\s+/g, ' ').trim();
    }

    private static isKorean(text: string): boolean {
        return /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(text);
    }

    private static escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private static generateHash(text: string): string {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return (hash >>> 0).toString(16);
    }
}
