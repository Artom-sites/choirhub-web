"use client";

import { useState, useEffect } from "react";
import { Share, X, PlusSquare } from "lucide-react";

export default function InstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if running on iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

        // Check if running in standalone mode (already installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

        if (isIOSDevice && !isStandalone) {
            setIsIOS(true);
            // Check if user has dismissed it previously
            const hasDismissed = localStorage.getItem("install_prompt_dismissed");
            // Show if not dismissed, or maybe show every X days? 
            // For now, let's respect the dismiss forever or until cache clear
            if (!hasDismissed) {
                // Delay slightly to not annoy immediately on load
                const timer = setTimeout(() => setShowPrompt(true), 3000);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem("install_prompt_dismissed", "true");
    };

    if (!showPrompt || !isIOS) return null;

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

                {/* Pointer to the bottom center (Safari standard bar location) */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#1c1c1e]/90 border-r border-b border-white/10 rotate-45 transform"></div>
            </div>
        </div>
    );
}
