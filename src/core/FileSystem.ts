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

    // 2. Public Folder Fetch (Demo Files)
    // Supports:
    // - '/docs/doc1.html'
    // - 'docs/doc1.html'
    // - 'doc1.html' (legacy)
    // - remote http(s)
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
                    return await res.text();
                }
            } catch {
                // Keep trying next candidate.
            }
        }
    }

    throw new Error(`File not found: ${path}`);
}
