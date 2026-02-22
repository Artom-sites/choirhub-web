"use client";

import { useState, useEffect } from "react";
import { Bell, X, Check, Loader2 } from "lucide-react";
import { useFcmToken } from "@/hooks/useFcmToken";
import { AnimatePresence, motion } from "framer-motion";

export default function NotificationPrompt() {
    const { permissionStatus, requestPermission, loading, isSupported, isPreferenceEnabled } = useFcmToken();
    const [isVisible, setIsVisible] = useState(false);

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

        // Show prompt after a small delay
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 3000);

        return () => clearTimeout(timer);
    }, [permissionStatus, isSupported, isPreferenceEnabled]);

    const handleEnable = async () => {
        await requestPermission("NotificationPrompt");
        setIsVisible(false);
    };

    const handleLater = () => {
        localStorage.setItem('notification_prompt_dismissed', Date.now().toString());
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-20 left-4 right-4 z-[70] md:left-auto md:right-8 md:w-96"
            >
                <div className="bg-surface card-shadow border border-border rounded-2xl p-5 shadow-2xl">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-text-primary text-sm">Важливі сповіщення</h3>
                                <p className="text-xs text-text-secondary mt-0.5">Від регента хору</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLater}
                            className="text-text-secondary hover:text-text-primary p-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <p className="text-sm text-text-primary mb-4 leading-relaxed">
                        Увімкніть сповіщення, щоб не пропускати повідомлення про <b>зміни в розкладі</b> та <b>нові пісні</b>.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={handleLater}
                            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-highlight transition-colors"
                        >
                            Не зараз
                        </button>
                        <button
                            onClick={handleEnable}
                            disabled={loading}
                            className="flex-1 py-2.5 px-4 bg-primary text-background rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Увімкнути"}
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
