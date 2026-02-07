"use client";

import { useRouter } from "next/navigation";
import { Music2, WifiOff, RefreshCw, CalendarDays } from "lucide-react";

export default function OfflinePage() {
    const router = useRouter();

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleGoToService = () => {
        // Navigate to home with service tab - cached pages will load
        router.push("/?tab=services");
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
                Схоже, ви офлайн. Але кешовані служіння та PDF досі доступні!
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                    onClick={handleGoToService}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
                >
                    <CalendarDays className="w-5 h-5" />
                    Перейти до служіння
                </button>

                <button
                    onClick={handleRefresh}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 active:scale-95 transition-all border border-white/10"
                >
                    <RefreshCw className="w-5 h-5" />
                    Спробувати знову
                </button>
            </div>

            <p className="text-xs text-[#71717a] mt-8">
                Раніше відвідані сторінки та PDF доступні в кеші
            </p>
        </div>
    );
}
