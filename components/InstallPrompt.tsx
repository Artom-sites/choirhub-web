"use client";

import { useState, useEffect } from "react";
import { Share, X, PlusSquare, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        // Check if running in standalone mode (already installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isStandalone) return;

        // Check if running on iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        // Check if running on Android
        const isAndroidDevice = /Android/.test(navigator.userAgent);

        const hasDismissed = localStorage.getItem("install_prompt_dismissed");
        if (hasDismissed) return;

        if (isIOSDevice) {
            setIsIOS(true);
            const timer = setTimeout(() => setShowPrompt(true), 3000);
            return () => clearTimeout(timer);
        }

        if (isAndroidDevice) {
            setIsAndroid(true);

            // Listen for beforeinstallprompt event
            const handleBeforeInstallPrompt = (e: Event) => {
                e.preventDefault();
                setDeferredPrompt(e as BeforeInstallPromptEvent);
                setTimeout(() => setShowPrompt(true), 3000);
            };

            window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        }
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowPrompt(false);
            localStorage.setItem("install_prompt_dismissed", "true");
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem("install_prompt_dismissed", "true");
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[100] animate-in slide-in-from-bottom duration-500">
            <div className="bg-[#1c1c1e]/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl relative">
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 p-1 text-text-secondary hover:text-white bg-white/5 rounded-full"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-4 pr-6">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                        <img src="/apple-touch-icon.png" alt="Icon" className="w-full h-full rounded-xl object-cover" onError={(e) => (e.currentTarget.src = "/favicon.png")} />
                    </div>
                    <div>
                        <h4 className="font-bold text-white text-sm mb-1">Інсталюйте застосунок</h4>
                        <p className="text-xs text-text-secondary leading-relaxed">
                            Додайте на головний екран для повноекранного режиму та швидкого доступу.
                        </p>
                    </div>
                </div>

                {/* Android - one-click install button */}
                {isAndroid && deferredPrompt && (
                    <button
                        onClick={handleInstall}
                        className="mt-4 w-full py-3 bg-primary text-background font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    >
                        <Download className="w-5 h-5" />
                        Встановити
                    </button>
                )}

                {/* iOS - manual instructions */}
                {isIOS && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2 text-sm text-text-secondary">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6">
                                <Share className="w-5 h-5 text-blue-400" />
                            </span>
                            <span>1. Натисніть кнопку <b>Поділитись</b></span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6">
                                <PlusSquare className="w-5 h-5 text-gray-400" />
                            </span>
                            <span>2. Виберіть <b>На початковий екран</b></span>
                        </div>
                    </div>
                )}

                {/* Pointer to the bottom center (Safari standard bar location) */}
                {isIOS && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#1c1c1e]/90 border-r border-b border-white/10 rotate-45 transform"></div>
                )}
            </div>
        </div>
    );
}
