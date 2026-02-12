// Light-weight fallback for Public Assets and Memory Files
// For persistent storage, use LocalStorageManager

const memoryRegistry = new Map<string, File>();

export async function registerBrowserFile(path: string, file: File) {
    memoryRegistry.set(path, file);
    try {
        const text = await file.text();
        localStorage.setItem(`cached-file:${path}`, text);
    } catch {
        // Ignore cache failures (quota/private mode)
    }
}

export async function readFileSafe(path: string): Promise<string> {
    // 1. Memory Cache (Drag & Drop)
    if (memoryRegistry.has(path)) {
        return await memoryRegistry.get(path)!.text();
    }

    // 1.5 Persistent cache for virtual files across reload
    const cached = localStorage.getItem(`cached-file:${path}`);
    if (cached) {
        return cached;
    }

    // Skip fetch-based fallback in Tauri (SPA routing returns index.html for any path)
    const isTauri = typeof window !== 'undefined' &&
        Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
    if (isTauri) {
        throw new Error(`File not found (Tauri): ${path}`);
    }

    // 2. Public Folder Fetch (Demo Files - Browser/Dev only)
    const lower = path.toLowerCase();
    if (lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.md')) {
        const normalized = path.replace(/\\/g, '/').trim();
        const basename = normalized.split('/').pop() || normalized;

        const candidates = Array.from(new Set([
            normalized,
            normalized.startsWith('/') ? normalized : `/${normalized}`,
            `/${basename}`,
            `/docs/${basename}`
        ]));

        for (const candidate of candidates) {
            try {
                const res = await fetch(candidate);
                if (res.ok) {
                    const text = await res.text();
                    // Guard: Detect SPA fallback (index.html returned instead of actual file)
                    if (text.includes('<div id="root">') && text.includes('Paper Reviewer')) {
                        continue; // This is the app shell, not the document
                    }
                    return text;
                }
            } catch {
                // Keep trying next candidate.
            }
        }
    }

    throw new Error(`File not found: ${path}`);
}
