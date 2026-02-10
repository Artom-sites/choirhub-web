"use client";

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

type StatusBarStyle = 'light' | 'dark';

/**
 * Hook to temporarily set the status bar style for the current page.
 * Automatically restores to the theme-based style on unmount.
 * 
 * @param style 'light' = white status bar with dark icons (for white backgrounds)
 *              'dark' = dark status bar with light icons (for dark backgrounds)
 */
export function useStatusBar(style: StatusBarStyle) {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const applyStyle = async () => {
            try {
                if (style === 'light') {
                    // White background - need dark icons
                    await StatusBar.setStyle({ style: Style.Light });
                    await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
                } else {
                    // Dark background - need light icons
                    await StatusBar.setStyle({ style: Style.Dark });
                    await StatusBar.setBackgroundColor({ color: '#09090b' });
                }
            } catch (e) {
                console.error('[useStatusBar] Error:', e);
            }
        };

        applyStyle();

        // Cleanup: restore to theme-based style
        return () => {
            const restoreThemeStyle = async () => {
                try {
                    const theme = document.documentElement.getAttribute('data-theme');
                    if (theme === 'dark') {
                        await StatusBar.setStyle({ style: Style.Dark });
                        await StatusBar.setBackgroundColor({ color: '#09090b' });
                    } else {
                        await StatusBar.setStyle({ style: Style.Light });
                        await StatusBar.setBackgroundColor({ color: '#F1F5F9' });
                    }
                } catch (e) {
                    console.error('[useStatusBar] Restore Error:', e);
                }
            };
            restoreThemeStyle();
        };
    }, [style]);
}
