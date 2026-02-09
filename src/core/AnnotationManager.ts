import { readFileSafe, writeFileSafe } from './FileSystem';
import type { Annotation } from '../types/ReaderTypes';

export interface AnnotationData {
    sourceFile: string;
    annotations: Annotation[];
}

export class AnnotationManager {
    filePath: string;
    data: AnnotationData | null = null;
    sidecarPath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
        // e.g., "C:/Users/user/Desktop/paper.html" -> "C:/Users/user/Desktop/paper.data.json"
        this.sidecarPath = filePath.replace(/\.html$/i, '.data.json');
    }

    async load(): Promise<Annotation[]> {
        try {
            const content = await readFileSafe(this.sidecarPath);
            this.data = JSON.parse(content);
            return this.data?.annotations || [];
        } catch (e) {
            console.log("Sidecar file not found or invalid, creating new.", e);
            // Initialize if not exists
            this.data = {
                sourceFile: this.filePath,
                annotations: []
            };
            return [];
        }
    }

    async save(annotations: Annotation[]) {
        if (!this.data) this.data = { sourceFile: this.filePath, annotations: [] };
        this.data.annotations = annotations;

        const content = JSON.stringify(this.data, null, 2);
        await writeFileSafe(this.sidecarPath, content);
    }
}
