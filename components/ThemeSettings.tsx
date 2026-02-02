"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Monitor } from "lucide-react";

export default function ThemeSettings() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex items-center justify-between py-4 border-t border-border">
            <span className="text-lg font-medium text-text-primary">Тема</span>
            <div className="flex items-center gap-1 bg-surface-highlight rounded-full p-1">
                <button
                    onClick={() => setTheme('light')}
                    className={`p-2 rounded-full transition-all ${theme === 'light'
                            ? 'bg-surface text-primary shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                    title="Світла"
                >
                    <Sun className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setTheme('dark')}
                    className={`p-2 rounded-full transition-all ${theme === 'dark'
                            ? 'bg-surface text-primary shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                    title="Темна"
                >
                    <Moon className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setTheme('system')}
                    className={`p-2 rounded-full transition-all ${theme === 'system'
                            ? 'bg-surface text-primary shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                    title="Системна"
                >
                    <Monitor className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
