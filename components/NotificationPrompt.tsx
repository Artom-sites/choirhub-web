"use client";

import { useEffect, useRef } from "react";
import { useFcmToken } from "@/hooks/useFcmToken";
import { Dialog } from "@capacitor/dialog";

export default function NotificationPrompt() {
    const { permissionStatus, requestPermission, isSupported, isPreferenceEnabled } = useFcmToken();
    const hasPrompted = useRef(false);

    useEffect(() => {
        // 1. Check if supported
        if (!isSupported) return;

        // 2. If user already enabled notifications (FCM registered), never show
        if (isPreferenceEnabled) return;

        // 3. Check if already granted or denied at browser level
        if (permissionStatus !== 'default') return;

        // 4. Check if FCM token was already registered (survives permission resets on iOS)
        const fcmCache = localStorage.getItem('fcm_reg_cache');
        if (fcmCache) return;

        // 5. Check if dismissed recently (show again after 7 days, not 3)
        const dismissedAt = localStorage.getItem('notification_prompt_dismissed');
        if (dismissedAt) {
            const date = new Date(parseInt(dismissedAt));
            const now = new Date();
            const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
            if (diffDays < 7) return;
        }

        if (hasPrompted.current) return;

        // Show prompt after a small delay
        const timer = setTimeout(async () => {
            if (hasPrompted.current) return;
            hasPrompted.current = true;
            
            try {
                const { value } = await Dialog.confirm({
                    title: 'Важливі сповіщення',
                    message: 'Увімкніть сповіщення, щоб не пропускати повідомлення про зміни в розкладі та нові пісні.',
                    okButtonTitle: 'Увімкнути',
                    cancelButtonTitle: 'Не зараз'
                });

                if (value) {
                    try {
                        await requestPermission("NotificationPrompt");
                    } catch (e) {
                        console.warn("NotificationPrompt enable failed:", e);
                    }
                } else {
                    localStorage.setItem('notification_prompt_dismissed', Date.now().toString());
                }
            } catch (err) {
                console.error("Failed to show dialog:", err);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [permissionStatus, isSupported, isPreferenceEnabled, requestPermission]);

    return null;
}
