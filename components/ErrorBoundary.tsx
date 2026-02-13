"use client";

import React from "react";
import { Music2, RefreshCw, CalendarDays, WifiOff } from "lucide-react";

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

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleRefresh = () => {
        // Force hard reload
        window.location.href = '/';
    };

    handleGoToServices = () => {
        // Navigate to home with services tab
        window.location.href = '/#services';
    };

    render() {
        if (this.state.hasError) {
            const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

            return (
                <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-24 h-24 bg-[#18181b] rounded-3xl flex items-center justify-center mb-8 border border-white/10 shadow-2xl">
                        {isOffline ? <WifiOff className="w-10 h-10 text-blue-400" /> : <Music2 className="w-10 h-10 text-red-500" />}
                    </div>

                    <div className="flex flex-col items-center gap-2 mb-4">
                        <h1 className="text-2xl font-bold text-white">
                            {isOffline ? "Немає з'єднання" : "Щось пішло не так"}
                        </h1>
                        {!isOffline && this.state.error && (
                            <p className="text-xs text-red-400 font-mono bg-red-950/30 p-2 rounded max-w-xs break-words">
                                {this.state.error.message}
                            </p>
                        )}
                    </div>

                    <p className="text-[#a1a1aa] mb-8 max-w-sm">
                        {isOffline
                            ? "Але кешовані служіння та PDF все ще доступні!"
                            : "Спробуйте оновити сторінку або перевірте з'єднання."}
                    </p>

                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        {/* Primary: Go to cached services */}
                        <button
                            onClick={this.handleGoToServices}
                            className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
                        >
                            <CalendarDays className="w-5 h-5" />
                            Перейти до служіння
                        </button>

                        {/* Secondary: Try again */}
                        <button
                            onClick={this.handleRefresh}
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

        return this.props.children;
    }
}
