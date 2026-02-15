import { registerPlugin } from '@capacitor/core';

export interface PencilKitAnnotatorPlugin {
    startAnnotating(options: { songId: string; userUid: string; topOffset?: number }): Promise<void>;
    stopAnnotating(options: { songId: string; userUid: string }): Promise<void>;
    clearCanvas(): Promise<void>;
}

export const PencilKitAnnotator = registerPlugin<PencilKitAnnotatorPlugin>('PencilKitAnnotator');
