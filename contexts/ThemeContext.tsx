"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('dark'); // Default to dark ideally, or system
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
        // Load from localStorage
        const saved = localStorage.getItem('theme') as Theme;
        if (saved) setTheme(saved);
        else setTheme('system'); // Default to system if nothing saved
    }, []);

    useEffect(() => {
        localStorage.setItem('theme', theme);

        const applyTheme = async () => {
            const root = document.documentElement;
            let targetTheme: 'light' | 'dark' = 'dark';

            if (theme === 'system') {
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                targetTheme = systemDark ? 'dark' : 'light';
            } else {
                targetTheme = theme;
            }

            setResolvedTheme(targetTheme);
            root.setAttribute('data-theme', targetTheme);

            // Update Capacitor Status Bar
            if (Capacitor.isNativePlatform()) {
                try {
                    if (targetTheme === 'dark') {
                        await StatusBar.setStyle({ style: Style.Dark });
                        await StatusBar.setBackgroundColor({ color: '#09090b' }); // Dark background
                    } else {
                        await StatusBar.setStyle({ style: Style.Light }); // Light style = Dark text
                        await StatusBar.setBackgroundColor({ color: '#F1F5F9' }); // Light background
                    }
                } catch (e) {
                    console.error("Status Bar Error:", e);
                }
            }
        };

        applyTheme();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            // Re-evaluate if system theme changes and we are in 'system' mode
            if (theme === 'system') applyTheme();
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
