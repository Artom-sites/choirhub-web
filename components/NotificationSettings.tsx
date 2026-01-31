"use client";

import { Bell, BellOff, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useFcmToken } from "@/hooks/useFcmToken";

export default function NotificationSettings() {
    const {
        permissionStatus,
        loading,
        error,
        requestPermission,
        isSupported,
        isGranted,
    } = useFcmToken();

    if (!isSupported) {
        return (
            <div className="p-4 bg-surface border border-white/5 rounded-2xl">
                <div className="flex items-center gap-3 text-text-secondary">
                    <BellOff className="w-5 h-5" />
                    <div>
                        <p className="text-white font-medium">Сповіщення недоступні</p>
                        <p className="text-sm">Ваш пристрій або браузер не підтримує пуш-сповіщення</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-surface border border-white/5 rounded-2xl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {isGranted ? (
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-green-400" />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                            <BellOff className="w-5 h-5 text-text-secondary" />
                        </div>
                    )}
                    <div>
                        <p className="text-white font-medium">Сповіщення</p>
                        <p className="text-sm text-text-secondary">
                            {isGranted ? "Увімкнено" : "Отримуйте нагадування про служіння"}
                        </p>
                    </div>
                </div>

                {!isGranted && (
                    <button
                        onClick={requestPermission}
                        disabled={loading || permissionStatus === "denied"}
                        className="px-4 py-2 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {permissionStatus === "denied" ? "Заблоковано" : "Увімкнути"}
                    </button>
                )}

                {isGranted && (
                    <div className="flex items-center gap-1 text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        <span>Активовано</span>
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            )}

            {permissionStatus === "denied" && (
                <div className="mt-3 p-3 bg-amber-500/10 rounded-xl">
                    <p className="text-amber-400 text-sm">
                        Сповіщення заблоковані в налаштуваннях браузера.
                        Відкрийте налаштування сайту і дозвольте сповіщення.
                    </p>
                </div>
            )}
        </div>
    );
}
