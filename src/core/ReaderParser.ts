import { type ParagraphData, type AlignedSentence, type Citation, type TocItem, type PaperStructure } from '../types/ReaderTypes';

export class ReaderParser {
    private static isKorean(text: string): boolean {
        return /[\uac00-\ud7af]|[\u1100-\u11ff]|[\u3130-\u318f]|[\ua960-\ua97f]|[\ud7b0-\ud7ff]/.test(text);
    }

    private static cleanHtml(html: string): string {
        const div = document.createElement('div');
        div.innerHTML = html;
        const cleaners = div.querySelectorAll('abbr, font, span.immersive-translate-target-abbr, article, section, br');
        cleaners.forEach(c => {
             if (c.tagName === 'BR') {
                c.replaceWith(document.createTextNode(' '));
                return;
            }
            const fragment = document.createDocumentFragment();
            while (c.firstChild) {
                fragment.appendChild(c.firstChild);
            }
            c.replaceWith(fragment, document.createTextNode(' '));
        });
        const walk = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                let text = node.textContent || '';
                text = text.replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ');
                text = text.replace(/(\d)\s+(?=\d|%)/g, '$1');
                text = text.replace(/%\s+(?=%)/g, '');
                text = text.replace(/\\mathbf\{([\s\S]*?)\}/gi, '$1').replace(/\\%|%/g, '%');
                node.textContent = text;
            } else if (['IMG', 'FIGURE', 'PICTURE', 'SVG', 'MATH', 'SUP', 'SUB', 'SMALL', 'STRONG', 'EM', 'B', 'I'].includes(node.nodeName.toUpperCase())) {
                // preserve
            } else {
                node.childNodes.forEach(walk);
            }
        };
        walk(div);
        return div.innerHTML.trim();
    }

    private static generateHash(text: string): string {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    private static splitIntoSentences(text: string): string[] {
        const tags: string[] = [];
        const placeholderText = text.replace(/<[^>]+>/g, (match) => {
            tags.push(match);
            return `__TAG_${tags.length - 1}__`;
        });
        const regex = /[^.!?\s][^.!?]*(?:[.!?](?!['" ]|$|[^0-9])|(?<=\d)\.(?=\d)|[^.!?])*[.!?]?['"]?(?=\s|$)/g;
        const matches = placeholderText.match(regex);
        if (!matches) {
            const restored = placeholderText.replace(/__TAG_(\d+)__/g, (_, i) => tags[parseInt(i)]);
            return [restored.trim()].filter(s => s.length > 0);
        }
        const refined: string[] = [];
        matches.forEach(s => {
            const trimmed = s.trim();
            if (!trimmed) return;
            const restored = trimmed.replace(/__TAG_(\d+)__/g, (_, i) => tags[parseInt(i)]);
            const temp = document.createElement('div');
            temp.innerHTML = restored;
            const plain = (temp.textContent || '').trim();
            const isMathFragment = /^[\d%\[\]\(\),. \*†‡§#=+\-<>~\\a-z]{1,5}$/i.test(plain);
            const isKoreanParticle = /^[은는이가을를에의로과와, ]{1,3}$/.test(plain);
            const isNoTerminatorShort = plain.length < 10 && !/[.!?]$/.test(plain);
            if ((isMathFragment || isKoreanParticle || isNoTerminatorShort) && refined.length > 0) {
                refined[refined.length - 1] += " " + restored;
            } else {
                refined.push(restored);
            }
        });
        return refined;
    }

    private static alignSentences(enHtml: string, koHtml: string): AlignedSentence[] {
        const enSentences = this.splitIntoSentences(this.cleanHtml(enHtml));
        const koSentences = this.splitIntoSentences(this.cleanHtml(koHtml));
        
        // Strategy: 1:1 Mapping or Fallback
        // If the number of sentences differs significantly (or even slightly), the naive index mapping makes the text essentially unreadable in "Korean Only" mode because specific sentences will drop to English or disappear.
        // User Preference: "Certain 1:1 mapping" -> If we can't guarantee sentence-level 1:1, we should enforce PARAGRAPH-level 1:1.
        // This means treating the entire paragraph content as a single "sentence" block.
        
        if (enSentences.length !== koSentences.length) {
             return [{ en: this.cleanHtml(enHtml), ko: this.cleanHtml(koHtml) }];
        }

        const aligned: AlignedSentence[] = [];
        const maxLen = Math.max(enSentences.length, koSentences.length);
        for (let i = 0; i < maxLen; i++) {
            aligned.push({ en: enSentences[i] || '', ko: koSentences[i] || '' });
        }
        return aligned;
    }

    static parse(html: string, baseUrl: string = ''): { paragraphs: ParagraphData[], structure: PaperStructure } {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Resolve relative paths for images
        if (baseUrl) {
            const images = doc.querySelectorAll('img');
            images.forEach(img => {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('/')) {
                    // Normalize base url to end with slash (remove filename)
                    const lastSlash = baseUrl.lastIndexOf('/');
                    const dir = lastSlash > -1 ? baseUrl.substring(0, lastSlash + 1) : baseUrl + (baseUrl ? '/' : '');
                    img.setAttribute('src', dir + src);
                }
            });
        }

        const results: ParagraphData[] = [];
        const seenHashes = new Set<string>();
        const processedContainers = new Set<Element>();
        
        const toc: TocItem[] = [];
        const figures: { id: string, desc: string }[] = [];
        const tables: { id: string, desc: string }[] = [];

        let index = 0;

        const fallbackSelector = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, pre, div, img, figure, picture, table';

        const pushParagraph = (element: string, enText: string, koText: string, idx: number, rawEl?: Element) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = enText;
            const plain = (tempDiv.textContent || '').trim();
            const img = tempDiv.querySelector('img');

            if (!plain && !koText.trim() && !img) return;

            const rawElement = element.toLowerCase();
            const safeElement = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'figure', 'img', 'picture', 'table'].includes(rawElement)
                ? rawElement
                : (['td', 'th', 'tr', 'tbody', 'thead'].includes(rawElement) ? 'p' : 'div');

            const hash = this.generateHash(`${plain.substring(0, 100)}-${idx}-${safeElement}`);
            if (seenHashes.has(hash)) return;
            seenHashes.add(hash);

            // Determine Type & Metadata
            let type: ParagraphData['type'] = 'text';
            const metadata: ParagraphData['metadata'] = {};

            if (/^h[1-6]/.test(safeElement)) {
                type = 'heading';
                metadata.headingLevel = parseInt(safeElement.replace('h', ''));
                metadata.headingId = rawEl?.id || hash;
                toc.push({ id: metadata.headingId, text: plain, level: metadata.headingLevel, paragraphId: hash });
            } else if (['img', 'figure', 'picture'].includes(safeElement) || img) {
                type = 'image';
                const imageEl = img || (rawEl?.tagName === 'IMG' ? rawEl : rawEl?.querySelector('img'));
                if (imageEl) {
                    metadata.src = imageEl.getAttribute('src') || '';
                    metadata.alt = imageEl.getAttribute('alt') || '';
                }
                const caption = rawEl?.querySelector('figcaption')?.textContent || metadata.alt;
                metadata.caption = caption;
                figures.push({ id: hash, desc: caption || 'Image' });
            } else if (safeElement === 'table' || rawEl?.tagName === 'TABLE') {
                type = 'table';
                metadata.caption = rawEl?.querySelector('caption')?.textContent || '';
                tables.push({ id: hash, desc: metadata.caption || 'Table' });
            }

            const sentences = this.alignSentences(enText, koText);
            const citations: Citation[] = [];
            
            const citationRegex = /\[(\d+(?:,\s*\d+|-\d+)*)\]/g;
            const citationAuthorRegex = /\((?:[A-Za-z\u00C0-\u017F\s\&\.]+,?\s*(?:19|20)\d{2}(?:;\s*)?)+\)/g;

            let match;
            while ((match = citationRegex.exec(plain)) !== null) citations.push({ id: match[0] });
            while ((match = citationAuthorRegex.exec(plain)) !== null) citations.push({ id: match[0] });

            results.push({
                id: hash,
                element: safeElement,
                type,
                metadata,
                enText: enText.trim(),
                koText: this.cleanHtml(koText),
                sentences,
                citations,
                index: idx,
                isReference: plain.toLowerCase().startsWith('reference') || plain.toLowerCase().includes('bibliography')
            });
        };

        const allWrappers = Array.from(doc.querySelectorAll('.immersive-translate-target-wrapper'));
        const translatedElements = allWrappers.filter(wrapper => {
            let parent = wrapper.parentElement;
            while (parent) {
                if (parent.classList.contains('immersive-translate-target-wrapper')) return false;
                parent = parent.parentElement;
            }
            return true;
        });

        if (translatedElements.length > 0) {
            translatedElements.forEach((el) => {
                const container = el.parentElement;
                if (!container || processedContainers.has(container)) return;
                
                // Ancestry check: ensure we don't process if an ancestor is already processed
                // However, for Immersive Translate wrappers, they are usually leaf-ish nodes.
                // But let's be safe.
                processedContainers.add(container);

                const koElements = container.querySelectorAll('.immersive-translate-target-wrapper');
                const koText = Array.from(koElements).map(k => k.innerHTML).join(' ');
                
                const clone = container.cloneNode(true) as HTMLElement;
                clone.querySelectorAll('.immersive-translate-target-wrapper').forEach(w => w.remove());
                const isMedia = ['img', 'figure', 'picture', 'table'].includes(container.tagName.toLowerCase());
                const enText = isMedia ? clone.outerHTML : clone.innerHTML;
                
                pushParagraph(container.tagName.toLowerCase(), this.cleanHtml(enText), this.cleanHtml(koText), index++, container);
            });
        } else {
            const elements = Array.from(doc.querySelectorAll(fallbackSelector));
             // Filter: Exclude elements that are descendants of other elements in the list
            const topLevelElements = elements.filter(el => {
                let parent = el.parentElement;
                while (parent) {
                    if (elements.includes(parent)) return false;
                    parent = parent.parentElement;
                }
                return true;
            });

            topLevelElements.forEach((el) => {
                if (processedContainers.has(el)) return;
                processedContainers.add(el);
                const isMedia = ['img', 'figure', 'picture', 'table'].includes(el.tagName.toLowerCase());
                const content = (isMedia ? el.outerHTML : el.innerHTML || '').trim();
                const plain = el.textContent || '';
                if (this.isKorean(plain)) {
                    pushParagraph(el.tagName.toLowerCase(), content, content, index++, el);
                } else {
                    pushParagraph(el.tagName.toLowerCase(), content, '', index++, el);
                }
            });
        }

        return { paragraphs: results, structure: { toc, figures, tables } };
    }
}
