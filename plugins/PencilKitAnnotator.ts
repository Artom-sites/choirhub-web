import { registerPlugin } from '@capacitor/core';

export interface PencilKitAnnotatorPlugin {
    openNativePdfViewer(options: {
        parts: { name: string; pdfUrl: string }[];
        initialPartIndex?: number;
        songId: string;
        userUid: string;
        title?: string;
        isArchive?: boolean;
    }): Promise<{ action: string }>;

    addListener(
        eventName: 'onArchiveAdd',
        listenerFunc: (info: { songId: string }) => void
    ): Promise<import('@capacitor/core').PluginListenerHandle> & import('@capacitor/core').PluginListenerHandle;

    addListener(
        eventName: 'onSettingsTapped',
        listenerFunc: (info: { songId: string }) => void
    ): Promise<import('@capacitor/core').PluginListenerHandle> & import('@capacitor/core').PluginListenerHandle;
}

export const PencilKitAnnotator = registerPlugin<PencilKitAnnotatorPlugin>('PencilKitAnnotator');
