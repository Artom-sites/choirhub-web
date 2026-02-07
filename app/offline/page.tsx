"use client";

import { Music2, WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-[#18181b] rounded-3xl flex items-center justify-center mb-8 border border-white/10 shadow-2xl">
                <Music2 className="w-10 h-10 text-white" />
            </div>

            <div className="flex items-center gap-3 mb-4">
                <WifiOff className="w-6 h-6 text-orange-400" />
                <h1 className="text-2xl font-bold text-white">Немає з&apos;єднання</h1>
            </div>

            <p className="text-[#a1a1aa] mb-8 max-w-sm">
                Схоже, ви офлайн. Перевірте інтернет-з&apos;єднання та спробуйте ще раз.
            </p>

            <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
                <RefreshCw className="w-5 h-5" />
                Спробувати знову
            </button>

            <p className="text-xs text-[#71717a] mt-8">
                Раніше завантажені PDF доступні в кеші
            </p>
        </div>
    );
}
