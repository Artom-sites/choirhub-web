"use client";

import { useEffect } from "react";

/**
 * Hook to register the app Service Worker for offline support
 */
export function useServiceWorker() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) {
            console.log("[SW] Service Workers not supported");
            return;
        }

        // Register our app SW (separate from Firebase messaging SW)
        navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .then((registration) => {
                console.log("[SW] App Service Worker registered:", registration.scope);

                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000); // Every hour
            })
            .catch((error) => {
                console.error("[SW] Registration failed:", error);
            });

        // Handle SW updates
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            console.log("[SW] Controller changed - new SW active");
        });
    }, []);
}
