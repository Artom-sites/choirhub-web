"use client";

import React from "react";
import { Music2, RefreshCw, CalendarDays, WifiOff } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";

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
            return (
                <ErrorFallbackUI
                    error={this.state.error}
                    onRefresh={this.handleRefresh}
                    onGoToServices={this.handleGoToServices}
                />
            );
        }

        return this.props.children;
    }
}

/** Functional component to enable useTranslation hook inside class ErrorBoundary */
function ErrorFallbackUI({ error, onRefresh, onGoToServices }: {
    error?: Error;
    onRefresh: () => void;
    onGoToServices: () => void;
}) {
    const { t } = useTranslation();
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    return (
        <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-[#18181b] rounded-3xl flex items-center justify-center mb-8 border border-white/10 shadow-2xl">
                {isOffline ? <WifiOff className="w-10 h-10 text-blue-400" /> : <Music2 className="w-10 h-10 text-red-500" />}
            </div>

            <div className="flex flex-col items-center gap-2 mb-4">
                <h1 className="text-2xl font-bold text-white">
                    {isOffline ? t('error.no_connection') : t('error.something_wrong')}
                </h1>
                {!isOffline && error && (
                    <p className="text-xs text-red-400 font-mono bg-red-950/30 p-2 rounded max-w-xs break-words">
                        {error.message}
                    </p>
                )}
            </div>

            <p className="text-[#a1a1aa] mb-8 max-w-sm">
                {isOffline
                    ? t('error.cached_available')
                    : t('error.try_refresh')}
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                    onClick={onGoToServices}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
                >
                    <CalendarDays className="w-5 h-5" />
                    {t('error.go_to_services')}
                </button>

                <button
                    onClick={onRefresh}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 active:scale-95 transition-all border border-white/10"
                >
                    <RefreshCw className="w-5 h-5" />
                    {t('error.try_again')}
                </button>
            </div>

            <p className="text-xs text-[#71717a] mt-8">
                {t('error.cached_pages')}
            </p>
        </div>
    );
}
