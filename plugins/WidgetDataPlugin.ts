import { registerPlugin } from '@capacitor/core';

export interface WidgetDataPluginInterface {
    updateServiceData(options: {
        title: string;
        date: string;
        time?: string;
        type?: string;
        serviceId: string;
        choirId: string;
        choirName: string;
        voteStatus: 'confirmed' | 'absent' | 'pending';
        confirmedCount: number;
        pendingCount: number;
        absentCount: number;
        totalMembers: number;
        songs: string[];
        userId: string;
    }): Promise<{ success: boolean }>;

    clearData(): Promise<{ success: boolean }>;
}

const WidgetData = registerPlugin<WidgetDataPluginInterface>('WidgetData');

export default WidgetData;
