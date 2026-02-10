// Browser-only File System Implementation
// Stores files in memory (browserFileRegistry) or localStorage (mock-fs)

// Store File objects for browser drag-and-drop support
const browserFileRegistry = new Map<string, File>();

export async function registerBrowserFile(path: string, file: File) {
    browserFileRegistry.set(path, file);
    try {
        const text = await file.text();
        localStorage.setItem(`cached-file:${path}`, text);
    } catch (e) {
        console.warn('Failed to persist file to localStorage', e);
    }
}

export async function readFileSafe(path: string): Promise<string> {
    // 1. Check browser registry (drag-and-drop files in current session)
    if (browserFileRegistry.has(path)) {
        const file = browserFileRegistry.get(path)!;
        return await file.text();
    }

    // 2. Check persistent cache (for virtual files across refreshes)
    const cached = localStorage.getItem(`cached-file:${path}`);
    if (cached) return cached;

    try {
        // 3. Browser fallback (public folder / basic fetch)
        if (path.toLowerCase().endsWith('.html')) {
            const basename = path.split(/[\\/]/).pop();
            const fetchPath = `/${basename}`; // e.g. /doc1.html

            const response = await fetch(fetchPath);
            if (response.ok) return await response.text();
            console.warn(`Fetch failed for ${fetchPath}`);
        }

        // 4. Mock JSON fallback (localStorage)
        if (path.endsWith('.json')) {
            const basename = path.split(/[\\/]/).pop();
            const stored = localStorage.getItem(`mock-fs:${basename}`);
            if (stored) return stored;
            return JSON.stringify({ annotations: [] }); // default empty annotations
        }

        throw new Error(`File not found: ${path}`);
    } catch (e) {
        console.warn(`readFileSafe failed for ${path}`, e);
        throw e;
    }
}

export async function writeFileSafe(path: string, content: string): Promise<void> {
    try {
        // Fallback to localStorage for JSON
        if (path.endsWith('.json')) {
            const basename = path.split(/[\\/]/).pop();
            localStorage.setItem(`mock-fs:${basename}`, content);
        } else {
            console.warn('Writing to disk is not supported in browser mode', path);
        }
    } catch (e) {
        console.error(`writeTextFile failed for ${path}`, e);
    }
}
