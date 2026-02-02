"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Monitor } from "lucide-react";

export default function ThemeSettings() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="bg-surface-highlight rounded-2xl p-4 mb-4">
            <h3 className="text-text-primary font-bold mb-3 flex items-center gap-2 text-sm">
                <Monitor className="w-4 h-4 text-accent" />
                Тема оформлення
            </h3>
            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === 'light'
                        ? 'bg-surface text-text-primary border-accent shadow-sm'
                        : 'bg-surface/50 text-text-secondary border-transparent hover:bg-surface'
                        }`}
                >
                    <Sun className="w-5 h-5" />
                    <span className="text-xs font-medium">Світла</span>
                </button>
                <button
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === 'dark'
                        ? 'bg-surface text-text-primary border-accent shadow-sm'
                        : 'bg-surface/50 text-text-secondary border-transparent hover:bg-surface'
                        }`}
                >
                    <Moon className="w-5 h-5" />
                    <span className="text-xs font-medium">Темна</span>
                </button>
                <button
                    onClick={() => setTheme('system')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === 'system'
                        ? 'bg-surface text-text-primary border-accent shadow-sm'
                        : 'bg-surface/50 text-text-secondary border-transparent hover:bg-surface'
                        }`}
                >
                    <Monitor className="w-5 h-5" />
                    <span className="text-xs font-medium">Системна</span>
                </button>
            </div>
        </div>
    );
}
