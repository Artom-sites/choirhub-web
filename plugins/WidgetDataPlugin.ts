import { registerPlugin } from '@capacitor/core';

export interface ServicePayload {
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
}

export interface WidgetDataPluginInterface {
    updateServiceData(options: ServicePayload): Promise<{ success: boolean }>;

    updateMultipleServices(options: {
        servicesJson: string;
    }): Promise<{ success: boolean }>;

    clearData(): Promise<{ success: boolean }>;

    getPendingVotes(): Promise<{
        votes: { serviceId: string; action: string; timestamp: number }[]
    }>;
}

const WidgetData = registerPlugin<WidgetDataPluginInterface>('WidgetData');

export default WidgetData;
