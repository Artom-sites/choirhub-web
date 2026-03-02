"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getMessagingInstance, getToken, onMessage } from "@/lib/firebase";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";

// ------------------------------------------------------------------
// MODULE-LEVEL SINGLETON STATE (Global across all hook instances)
// ------------------------------------------------------------------
let globalPermissionStatus: NotificationPermission | "unsupported" | "default" = "default";
let globalToken: string | null = null;
let globalPreference = typeof window !== "undefined" ? localStorage.getItem('fcm_enabled') === 'true' : false;
let isListenerSetup = false;
let hasAutoRegistered = false;

// Token State Listeners (Pub/Sub)
const tokenListeners = new Set<(token: string | null) => void>();
const preferenceListeners = new Set<(enabled: boolean) => void>();

const broadcastTokenUpdate = (newToken: string | null) => {
    globalToken = newToken;
    tokenListeners.forEach(listener => listener(newToken));
};

const broadcastPreferenceUpdate = (enabled: boolean) => {
    globalPreference = enabled;
    preferenceListeners.forEach(listener => listener(enabled));
};

// Promise Deduplication
let initPromise: Promise<any> | null = null;
let registerPromise: Promise<string | null> | null = null;

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

// Debug Module ID to detect multiple instances
const MODULE_ID = Math.random().toString(36).substring(7);
console.log(`[useFcmToken] Module Loaded. ID: ${MODULE_ID}`);

export function useFcmToken() {
    const { user, setFcmToken } = useAuth();

    // Local State (Synced with Global via Pub/Sub)
    const [token, setToken] = useState<string | null>(globalToken);
    const [isPreferenceEnabled, setIsPreferenceEnabled] = useState(globalPreference);
    const [permissionStatus, setPermissionStatus] = useState<typeof globalPermissionStatus>(globalPermissionStatus);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Circuit Breaker for Registration Loop (Instance Level)
    const registerCallCount = useRef(0);
    const lastRegisterTime = useRef(0);
    const lastDisableTime = useRef(0);

    // Subscribe to global token updates
    useEffect(() => {
        const tokenListener = (newToken: string | null) => {
            setToken(newToken);
        };
        const prefListener = (enabled: boolean) => {
            setIsPreferenceEnabled(enabled);
        };

        tokenListeners.add(tokenListener);
        preferenceListeners.add(prefListener);

        // Sync immediately in case it changed before effect ran
        if (globalToken !== token) setToken(globalToken);
        if (globalPreference !== isPreferenceEnabled) setIsPreferenceEnabled(globalPreference);

        return () => {
            tokenListeners.delete(tokenListener);
            preferenceListeners.delete(prefListener);
        };
    }, []);

    const isNative = Capacitor.isNativePlatform();

    // ----------------------------------------
    // 1. INITIALIZATION (Once per session lazy-check)
    // ----------------------------------------
    const init = useCallback(async () => {
        if (!initPromise) {
            initPromise = (async () => {
                let status: typeof globalPermissionStatus = "default";
                if (typeof window === "undefined") return "default";

                try {
                    if (isNative) {
                        // Use @capacitor-firebase/messaging for native
                        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
                        const result = await FirebaseMessaging.checkPermissions();
                        if (result.receive === "granted") status = "granted";
                        else if (result.receive === "denied") status = "denied";
                    } else {
                        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
                            status = "unsupported";
                        } else {
                            status = Notification.permission;
                        }
                    }
                } catch (err) {
                    console.error("[useFcmToken] Permission check failed:", err);
                }
                globalPermissionStatus = status;
                return status;
            })();
        }

        const status = await initPromise;
        setPermissionStatus(status);
    }, [isNative]);

    useEffect(() => {
        init();
    }, [init]);


    // ----------------------------------------
    // 2. LISTENER SETUP (Strictly Once Global)
    // ----------------------------------------
    useEffect(() => {
        if (!isNative || isListenerSetup) return;

        // Synchronous Lock to prevent race condition
        isListenerSetup = true;

        const setupGlobalListeners = async () => {
            try {
                const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

                // CRITICAL: Remove listeners only ONCE globally
                await FirebaseMessaging.removeAllListeners();

                // Token refresh listener — FCM may rotate tokens
                await FirebaseMessaging.addListener("tokenReceived", async (event) => {
                    console.log("[FCM] Token received/refreshed:", event.token?.substring(0, 20) + "...");
                    handleTokenReceived(event.token);
                });

                // Foreground notification listener
                await FirebaseMessaging.addListener("notificationReceived", (notification) => {
                    console.log("[FCM] Foreground notification:", notification);
                });

                // Notification action (tap) listener
                await FirebaseMessaging.addListener("notificationActionPerformed", (action) => {
                    console.log("[FCM] Notification action:", action);
                });

                console.log("[FCM] Firebase Messaging listeners set up");
            } catch (err) {
                console.error("[FCM] Error setting listeners:", err);
                isListenerSetup = false; // Allow retry if failed
            }
        };

        setupGlobalListeners();
    }, [isNative]);


    // ----------------------------------------
    // HELPERS (Hoisted)
    // ----------------------------------------

    const saveTokenToFirestore = async (t: string, uid: string) => {
        try {
            const cacheKey = 'fcm_reg_cache';
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const p = JSON.parse(cached);
                if (p.t === t && p.u === uid) return;
            }

            const { getFunctions, httpsCallable } = await import("firebase/functions");
            const { app } = await import("@/lib/firebase");
            const functions = getFunctions(app);
            const registerFn = httpsCallable(functions, 'registerFcmToken');
            await registerFn({ token: t });

            localStorage.setItem(cacheKey, JSON.stringify({ t, u: uid, ts: Date.now() }));
            console.log("[FCM] Token saved to Firestore:", t.substring(0, 20) + "...");
        } catch (e) {
            console.error("[FCM] Save to DB failed", e);
        }
    };

    const handleTokenReceived = async (newToken: string) => {
        broadcastTokenUpdate(newToken);
        setFcmToken(newToken); // Sync AuthContext

        // Server-side registration (Idempotent safe)
        if (user?.uid) {
            await saveTokenToFirestore(newToken, user.uid);
        }
    };

    // ----------------------------------------
    // 3. REGISTRATION (Enable Flow)
    // ----------------------------------------

    const enableNotifications = useCallback(async (caller: string = "unknown"): Promise<string | null> => {
        // 1. Deduplication
        if (registerPromise) {
            console.log(`[useFcmToken] Enable/Register deduplicated. Caller: ${caller}. ID: ${MODULE_ID}`);
            return registerPromise;
        }

        // 2. Circuit Breaker
        const now = Date.now();
        if (now - lastRegisterTime.current > 10000) {
            registerCallCount.current = 0;
        }
        registerCallCount.current++;
        lastRegisterTime.current = now;

        if (registerCallCount.current > 3) {
            console.error(`[useFcmToken] Loop Blocked! Count: ${registerCallCount.current}. ID: ${MODULE_ID}`);
            return null;
        }

        const timeSinceDisable = Date.now() - (lastDisableTime.current || 0);
        if (timeSinceDisable < 2000) {
            console.warn(`[useFcmToken] Enable blocked: Cooldown active (${timeSinceDisable}ms). Caller: ${caller}`);
            return null;
        }

        console.log(`[useFcmToken] ENABLING NOTIFICATIONS. Caller: ${caller}. ID: ${MODULE_ID}`);
        setLoading(true);
        setError(null);

        registerPromise = (async () => {
            try {
                // 1. Persist Preference FIRST
                if (typeof window !== "undefined") {
                    localStorage.setItem('fcm_enabled', 'true');
                    broadcastPreferenceUpdate(true);
                }

                if (isNative) {
                    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

                    // 2. Request Permission (if needed)
                    let status = globalPermissionStatus;
                    if (status === 'default') {
                        const perm = await FirebaseMessaging.requestPermissions();
                        status = perm.receive === 'granted' ? 'granted' : 'denied';
                        globalPermissionStatus = status;
                        setPermissionStatus(status);
                    }

                    if (status !== 'granted') {
                        throw new Error("Permission denied");
                    }

                    // 3. Wait for tokenReceived listener — do NOT call getToken() directly.
                    // getToken() races against didRegisterForRemoteNotificationsWithDeviceToken.
                    // The tokenReceived listener fires only after the native APNs→FCM mapping is complete.
                    if (globalToken) {
                        // Token already received by listener
                        console.log("[FCM] Token already available from listener:", globalToken.substring(0, 20) + "...");
                        await handleTokenReceived(globalToken);
                        return globalToken;
                    }

                    // Wait for listener to deliver the token (max 10s)
                    console.log("[FCM] Waiting for tokenReceived listener...");
                    const fcmToken = await new Promise<string | null>((resolve) => {
                        const timeout = setTimeout(() => {
                            console.warn("[FCM] tokenReceived timeout (10s). Token may arrive later.");
                            resolve(globalToken); // Return whatever we have (may be null)
                        }, 10000);

                        // Subscribe to token broadcast
                        const listener = (token: string | null) => {
                            if (token) {
                                clearTimeout(timeout);
                                tokenListeners.delete(listener);
                                resolve(token);
                            }
                        };
                        tokenListeners.add(listener);
                    });

                    if (fcmToken) {
                        console.log("[FCM] Token received from listener:", fcmToken.substring(0, 20) + "...");
                        await handleTokenReceived(fcmToken);
                    }
                    return fcmToken;
                } else {
                    // Web Flow (unchanged)
                    const perm = await Notification.requestPermission();
                    if (perm !== "granted") throw new Error("Permission denied");

                    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
                    const messaging = await getMessagingInstance();
                    if (!messaging) throw new Error("No messaging");

                    const fcmToken = await getToken(messaging, {
                        vapidKey: VAPID_KEY,
                        serviceWorkerRegistration: registration,
                    });

                    if (fcmToken) {
                        await handleTokenReceived(fcmToken);
                        return fcmToken;
                    }
                    return null;
                }
            } catch (err: any) {
                console.error("[useFcmToken] Enable failed:", err);
                setError(err.message || "Registration failed");
                return null;
            } finally {
                setLoading(false);
                registerPromise = null;
                hasAutoRegistered = true;
            }
        })();

        return registerPromise;
    }, [isNative, user?.uid]);

    // ----------------------------------------
    // 4. DISABLE FLOW (Unsubscribe)
    // ----------------------------------------
    const disableNotifications = useCallback(async (caller: string = "unknown") => {
        setLoading(true);
        lastDisableTime.current = Date.now();
        console.log(`[useFcmToken] DISABLING NOTIFICATIONS. Caller: ${caller}. ID: ${MODULE_ID}`);

        try {
            // 1. Remove from Firestore
            if (token && user?.uid) {
                const { getFirestore, doc, updateDoc, arrayRemove } = await import("firebase/firestore");
                const { app } = await import("@/lib/firebase");
                const db = getFirestore(app);
                await updateDoc(doc(db, "users", user.uid), { fcmTokens: arrayRemove(token) });
            }

            // 2. Update Local State
            broadcastTokenUpdate(null);
            setFcmToken(null);

            // 3. Persist Preference
            localStorage.setItem('fcm_enabled', 'false');
            localStorage.removeItem('fcm_reg_cache');
            broadcastPreferenceUpdate(false);

            // 4. Delete FCM token on native (proper cleanup)
            if (isNative) {
                try {
                    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
                    await FirebaseMessaging.deleteToken();
                    console.log("[FCM] Native token deleted");
                } catch (e) {
                    console.warn("[FCM] Failed to delete native token:", e);
                }
            }

        } catch (e) {
            console.error(e);
            setError("Error disabling notifications");
        } finally {
            setLoading(false);
        }
    }, [token, user?.uid, isNative, setFcmToken]);

    // ----------------------------------------
    // 5. AUTO-REGISTER
    // ----------------------------------------
    useEffect(() => {
        if (hasAutoRegistered || !user?.uid) return;

        const performAutoRegister = async () => {
            const isEnabled = typeof window !== "undefined" && localStorage.getItem('fcm_enabled') === 'true';

            if (!isEnabled) {
                hasAutoRegistered = true;
                return;
            }

            if (globalToken) {
                console.log("[useFcmToken] Syncing existing global token...");
                // Just ensure it's in DB
                saveTokenToFirestore(globalToken, user.uid);
                hasAutoRegistered = true;
                return;
            }

            // Wait for init
            await initPromise;

            console.log("[useFcmToken] Auto-registering...");
            hasAutoRegistered = true;
            enableNotifications("auto-register");
        };

        performAutoRegister();
    }, [user?.uid, enableNotifications]);



    return {
        token,
        permissionStatus,
        loading,
        error,
        requestPermission: enableNotifications, // Alias for backward compat
        unsubscribe: disableNotifications,     // Alias
        isSupported: isNative || permissionStatus !== "unsupported",
        isGranted: permissionStatus === "granted" && !!token, // Technical Success State
        isPreferenceEnabled, // User Intent State
    };

}
