import { registerPlugin } from '@capacitor/core';

export interface PencilKitAnnotatorPlugin {
    openNativePdfViewer(options: {
        pdfUrl: string;
        songId: string;
        userUid: string;
        title?: string;
    }): Promise<void>;
}

export const PencilKitAnnotator = registerPlugin<PencilKitAnnotatorPlugin>('PencilKitAnnotator');
