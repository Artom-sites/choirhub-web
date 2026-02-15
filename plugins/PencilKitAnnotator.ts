import { registerPlugin } from '@capacitor/core';

export interface PencilKitAnnotatorPlugin {
    /**
     * Open the native PencilKit annotator over the PDF.
     * iOS only. No-op on other platforms.
     */
    openAnnotator(options: {
        pdfUrl: string;
        songId: string;
        userUid: string;
    }): Promise<void>;
}

export const PencilKitAnnotator = registerPlugin<PencilKitAnnotatorPlugin>(
    'PencilKitAnnotator'
);
