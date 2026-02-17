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
                        const { PushNotifications } = await import("@capacitor/push-notifications");
                        const result = await PushNotifications.checkPermissions();
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
                const { PushNotifications } = await import("@capacitor/push-notifications");

                // CRITICAL: Remove listeners only ONCE globally
                await PushNotifications.removeAllListeners();

                // Permanent Listeners
                await PushNotifications.addListener("pushNotificationReceived", (notification) => {
                    console.log("[FCM] Foreground:", notification);
                });

                await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
                    console.log("[FCM] Action:", action);
                });

                // Registration Listener (Handles all token updates)
                await PushNotifications.addListener("registration", async (registrationToken) => {
                    console.log("[FCM] Native Registration Success:", registrationToken.value);
                    handleTokenReceived(registrationToken.value);
                });

                await PushNotifications.addListener("registrationError", (err) => {
                    console.error("[FCM] Registration Error:", err);
                });
            } catch (err) {
                console.error("[FCM] Error setting listeners:", err);
                isListenerSetup = false; // Allow retry if failed
            }
        };

        setupGlobalListeners();
    }, [isNative]);


    // ----------------------------------------
    // 3. REGISTRATION (Deduplicated)
    // ----------------------------------------
    // ----------------------------------------
    // 3. REGISTRATION (Deduplicated)
    // ----------------------------------------
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
                    const { PushNotifications } = await import("@capacitor/push-notifications");

                    // 2. Request Permission (if needed)
                    // We check first to avoid unnecessary prompts if already granted/denied
                    let status = globalPermissionStatus;
                    if (status === 'default') {
                        const perm = await PushNotifications.requestPermissions();
                        status = perm.receive === 'granted' ? 'granted' : 'denied';
                        globalPermissionStatus = status;
                        setPermissionStatus(status);
                    }

                    if (status !== 'granted') {
                        throw new Error("Permission denied");
                    }

                    // 3. Register (Race against timeout)
                    return new Promise<string | null>((resolve, reject) => {
                        let isResolved = false;
                        const timeoutId = setTimeout(() => {
                            if (!isResolved) {
                                isResolved = true;
                                console.warn("[useFcmToken] Registration timeout - likely Simulator");
                                reject(new Error("Registration timed out"));
                            }
                        }, 10000);

                        const listener = (t: string | null) => {
                            if (!isResolved && t) {
                                isResolved = true;
                                clearTimeout(timeoutId);
                                resolve(t);
                            }
                        };
                        tokenListeners.add(listener);

                        // Trigger Native Register
                        PushNotifications.register().catch(e => {
                            if (!isResolved) {
                                isResolved = true;
                                clearTimeout(timeoutId);
                                reject(e);
                            }
                        });
                    });
                } else {
                    // Web Flow
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
                // IMPORTANT: Do NOT disable fcm_enabled here? 
                // If it was a network error, we might want to retry later.
                // But if permission denied, maybe?
                // For now, keep preference 'true' so next app start might retry if it was transient.
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

            // 4. Native Unregister? (Optional, usually not needed if we delete from DB)
            if (isNative) {
                const { PushNotifications } = await import("@capacitor/push-notifications");
                // Capacitor doesn't expose strict 'unregister' in all versions or it might be buggy.
                // Simply dropping the token from DB is the standard way to "stop" notifications.
                await PushNotifications.removeAllListeners();
                // Restoring listeners is tricky if we re-enable. 
                // Better to just leave listeners but we simply won't have a valid token in DB.

                // Actually, we SHOULD remove listeners to be clean?
                // But our useEffect adds them back only on mount.
                // Let's keep listeners active, just drop the token.
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

            // Only register if we have permission AND enabled
            // Actually, if 'fcm_enabled' is true, we should try to register (which asks permission if needed)
            // But usually 'fcm_enabled' implies we successfully enabled it before.
            console.log("[useFcmToken] Auto-registering...");
            hasAutoRegistered = true;
            enableNotifications("auto-register");
        };

        performAutoRegister();
    }, [user?.uid, enableNotifications]);

    // ... Helpers ...



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
