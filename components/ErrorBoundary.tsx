"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Music2, WifiOff, RefreshCw, CalendarDays, AlertTriangle } from "lucide-react";

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleRefresh = () => {
        window.location.reload();
    };

    handleGoToService = () => {
        window.location.href = "/?tab=services";
    };

    handleClearCacheAndReload = async () => {
        try {
            // Clear all caches
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            }
            // Unregister service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
            }
            // Clear localStorage error state
            localStorage.removeItem('app_error_count');
        } catch (e) {
            console.error('Failed to clear cache:', e);
        }
        // Force reload
        window.location.href = "/";
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-24 h-24 bg-[#18181b] rounded-3xl flex items-center justify-center mb-8 border border-white/10 shadow-2xl">
                        <Music2 className="w-10 h-10 text-white" />
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-orange-400" />
                        <h1 className="text-2xl font-bold text-white">Щось пішло не так</h1>
                    </div>

                    <p className="text-[#a1a1aa] mb-8 max-w-sm">
                        Виникла помилка. Спробуйте оновити сторінку або очистити кеш.
                    </p>

                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <button
                            onClick={this.handleRefresh}
                            className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Оновити сторінку
                        </button>

                        <button
                            onClick={this.handleClearCacheAndReload}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500/20 text-orange-400 font-medium rounded-xl hover:bg-orange-500/30 active:scale-95 transition-all border border-orange-500/30"
                        >
                            <AlertTriangle className="w-5 h-5" />
                            Очистити кеш і перезавантажити
                        </button>

                        <button
                            onClick={this.handleGoToService}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 active:scale-95 transition-all border border-white/10"
                        >
                            <CalendarDays className="w-5 h-5" />
                            Перейти до служіння
                        </button>
                    </div>

                    <p className="text-xs text-[#71717a] mt-8">
                        Якщо проблема повторюється, спробуйте видалити та перевстановити додаток
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
