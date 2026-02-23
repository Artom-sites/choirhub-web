import { Capacitor } from '@capacitor/core';

export const hapticLight = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
            await Haptics.impact({ style: ImpactStyle.Light });
        } catch (e) { /* haptics not available */ }
    }
};

export const hapticMedium = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
            await Haptics.impact({ style: ImpactStyle.Medium });
        } catch (e) { /* haptics not available */ }
    }
};

export const hapticSuccess = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            const { Haptics, NotificationType } = await import('@capacitor/haptics');
            await Haptics.notification({ type: NotificationType.Success });
        } catch (e) { /* haptics not available */ }
    }
};

export const hapticWarning = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            const { Haptics, NotificationType } = await import('@capacitor/haptics');
            await Haptics.notification({ type: NotificationType.Warning });
        } catch (e) { /* haptics not available */ }
    }
};
