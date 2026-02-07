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

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-24 h-24 bg-[#18181b] rounded-3xl flex items-center justify-center mb-8 border border-white/10 shadow-2xl">
                        <Music2 className="w-10 h-10 text-white" />
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                        <WifiOff className="w-6 h-6 text-blue-400" />
                        <h1 className="text-2xl font-bold text-white">Немає з'єднання</h1>
                    </div>

                    <p className="text-[#a1a1aa] mb-8 max-w-sm">
                        Але кешовані служіння та PDF все ще доступні!
                    </p>

                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        {/* Primary: Go to cached services */}
                        <a
                            href="/?tab=services"
                            className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all no-underline"
                        >
                            <CalendarDays className="w-5 h-5" />
                            Перейти до служіння
                        </a>

                        {/* Secondary: Try again */}
                        <a
                            href="/"
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 active:scale-95 transition-all border border-white/10 no-underline"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Спробувати знову
                        </a>
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
