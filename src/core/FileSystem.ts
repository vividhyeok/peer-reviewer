// Light-weight fallback for Public Assets and Memory Files
// For persistent storage, use LocalStorageManager

const memoryRegistry = new Map<string, File>();

export async function registerBrowserFile(path: string, file: File) {
    memoryRegistry.set(path, file);
}

export async function readFileSafe(path: string): Promise<string> {
    // 1. Memory Cache (Drag & Drop)
    if (memoryRegistry.has(path)) {
        return await memoryRegistry.get(path)!.text();
    }

    // 2. Public Folder Fetch (Demo Files)
    // Only attempt if it looks like a relative web path or simple filename
    if (!path.startsWith('http') && (path.endsWith('.html') || path.endsWith('.md'))) {
        const basename = path.split(/[\\/]/).pop();
        try {
            const res = await fetch(`/${basename}`);
            if (res.ok) {
                return await res.text();
            }
        } catch (e) {
            console.warn(`Failed to fetch public asset: ${basename}`, e);
        }
    }

    throw new Error(`File not found: ${path}`);
}
