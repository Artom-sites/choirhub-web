import { registerPlugin } from '@capacitor/core';

export interface PencilKitAnnotatorPlugin {
    openNativePdfViewer(options: {
        parts: { name: string; pdfUrl: string }[];
        initialPartIndex?: number;
        songId: string;
        userUid: string;
        title?: string;
    }): Promise<void>;
}

export const PencilKitAnnotator = registerPlugin<PencilKitAnnotatorPlugin>('PencilKitAnnotator');
