"use client";

import { useEffect, useState, useCallback } from "react";
import { getMessagingInstance, getToken, onMessage } from "@/lib/firebase";
import { doc, setDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Capacitor } from "@capacitor/core";

// VAPID key from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export function useFcmToken() {
    const { user, setFcmToken } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | "unsupported">("default");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isNative = Capacitor.isNativePlatform();

    // Check if notifications are supported
    useEffect(() => {
        if (typeof window === "undefined") return;

        if (isNative) {
            // On native, push notifications are always supported via Capacitor plugin
            checkNativePermission();
        } else {
            // Web: check browser support
            if (!("Notification" in window) || !("serviceWorker" in navigator)) {
                setPermissionStatus("unsupported");
                return;
            }
            setPermissionStatus(Notification.permission);
        }
    }, [isNative]);

    // Check native push notification permission
    const checkNativePermission = async () => {
        try {
            const { PushNotifications } = await import("@capacitor/push-notifications");
            const result = await PushNotifications.checkPermissions();
            if (result.receive === "granted") {
                setPermissionStatus("granted");
            } else if (result.receive === "denied") {
                setPermissionStatus("denied");
            } else {
                setPermissionStatus("default");
            }
        } catch (err) {
            console.error("[useFcmToken] Error checking native permissions:", err);
            setPermissionStatus("default");
        }
    };

    // Cleanup Stale Tokens (Offline Queue)
    useEffect(() => {
        const processCleanupQueue = async () => {
            if (typeof window === "undefined") return;
            const queueStr = localStorage.getItem('fcm_cleanup_queue');
            if (!queueStr) return;

            try {
                const queue = JSON.parse(queueStr);
                if (!Array.isArray(queue) || queue.length === 0) return;

                console.log("[useFcmToken] Processing cleanup queue:", queue.length);
                const { doc, updateDoc, arrayRemove, getFirestore } = await import("firebase/firestore");
                const { app } = await import("@/lib/firebase"); // Lazy load
                const db = getFirestore(app);

                const remainingQueue = [];

                for (const item of queue) {
                    if (!item.uid || !item.token) continue;
                    // Expiry: discard items older than 30 days to prevent infinite retries of deleted users
                    if (item.timestamp && Date.now() - item.timestamp > 30 * 24 * 60 * 60 * 1000) continue;

                    try {
                        const userRef = doc(db, "users", item.uid);
                        await updateDoc(userRef, {
                            fcmTokens: arrayRemove(item.token)
                        });
                        console.log("[useFcmToken] Cleaned up stale token for user:", item.uid);
                    } catch (err: any) {
                        console.warn("[useFcmToken] Failed to cleanup token (will retry):", err);
                        // If permission denied (user account deleted?), discard
                        if (err.code === 'permission-denied') {
                            console.log("[useFcmToken] Permission denied, discarding cleanup item");
                            continue;
                        }
                        remainingQueue.push(item);
                    }
                }

                if (remainingQueue.length === 0) {
                    localStorage.removeItem('fcm_cleanup_queue');
                } else {
                    localStorage.setItem('fcm_cleanup_queue', JSON.stringify(remainingQueue));
                }
            } catch (err) {
                console.error("[useFcmToken] Error processing cleanup queue:", err);
            }
        };

        // Run cleanup on mount (once)
        processCleanupQueue();
    }, []);

    // Save token to Firestore (Server-Side Enforcement)
    const saveTokenToFirestore = useCallback(async (fcmToken: string) => {
        if (!user?.uid) return;
        try {
            // Optimization: Prevent redundant Cloud Function calls on every app launch
            if (typeof window !== "undefined") {
                const cached = localStorage.getItem('fcm_registration_cache');
                if (cached) {
                    try {
                        const { token: t, uid: u } = JSON.parse(cached);
                        if (t === fcmToken && u === user.uid) {
                            console.log("[useFcmToken] Token already registered, skipping.");
                            return;
                        }
                    } catch (e) { }
                }
            }

            console.log("[useFcmToken] Registering token via Cloud Function...");
            const { getFunctions, httpsCallable } = await import("firebase/functions");
            const { app } = await import("@/lib/firebase");
            const functions = getFunctions(app);
            const registerToken = httpsCallable(functions, 'registerFcmToken');

            await registerToken({ token: fcmToken });
            console.log("[useFcmToken] Token registered successfully (Single Owner Enforced)");

            // Note: We do NOT need to manually cache or cleanup queue anymore for cross-user privacy,
            // because the server guarantees that if User B registers, User A loses the token immediately.

            if (typeof window !== "undefined") {
                localStorage.setItem('fcm_registration_cache', JSON.stringify({
                    token: fcmToken,
                    uid: user.uid,
                    timestamp: Date.now()
                }));
            }
        } catch (err) {
            console.error("[useFcmToken] Error registering token:", err);
        }
    }, [user?.uid]);

    // Request permission and get token - NATIVE path
    const requestPermissionNative = useCallback(async () => {
        setLoading(true);
        setError(null);
        // User explicitly requested permissions, so clear the disabled flag
        if (typeof window !== "undefined") {
            localStorage.removeItem('fcm_manually_disabled');
        }

        try {
            const { PushNotifications } = await import("@capacitor/push-notifications");

            // Request permission
            const permResult = await PushNotifications.requestPermissions();
            if (permResult.receive !== "granted") {
                setPermissionStatus("denied");
                setError("Дозвіл на сповіщення не надано");
                setLoading(false);
                return null;
            }

            setPermissionStatus("granted");

            // Register for push notifications
            await PushNotifications.register();

            // Listen for registration success
            return new Promise<string | null>((resolve) => {
                const timeout = setTimeout(() => {
                    setError("Не вдалося отримати токен сповіщень");
                    setLoading(false);
                    resolve(null);
                }, 10000);

                // Remove existing listeners to avoid duplicates
                PushNotifications.removeAllListeners();

                PushNotifications.addListener("registration", async (registrationToken) => {
                    clearTimeout(timeout);
                    const fcmToken = registrationToken.value;
                    console.log("[useFcmToken] Native FCM token:", fcmToken);
                    setToken(fcmToken);
                    setFcmToken(fcmToken); // Sync with AuthContext
                    await saveTokenToFirestore(fcmToken);
                    setLoading(false);
                    resolve(fcmToken);
                });

                PushNotifications.addListener("registrationError", (err) => {
                    clearTimeout(timeout);
                    console.error("[useFcmToken] Native registration error:", err);
                    setError("Помилка реєстрації сповіщень");
                    setLoading(false);
                    resolve(null);
                });
            });
        } catch (err) {
            console.error("[useFcmToken] Native push error:", err);
            setError("Помилка налаштування сповіщень");
            setLoading(false);
            return null;
        }
    }, [saveTokenToFirestore, setFcmToken]); // Added setFcmToken dependency

    // Request permission and get token - WEB path
    const requestPermissionWeb = useCallback(async () => {
        if (permissionStatus === "unsupported") {
            setError("Сповіщення не підтримуються на цьому пристрої");
            return null;
        }

        setLoading(true);
        setError(null);
        // User explicitly requested permissions, so clear the disabled flag
        if (typeof window !== "undefined") {
            localStorage.removeItem('fcm_manually_disabled');
        }

        try {
            const permission = await Notification.requestPermission();
            setPermissionStatus(permission);

            if (permission !== "granted") {
                setError("Дозвіл на сповіщення не надано");
                setLoading(false);
                return null;
            }

            // Register service worker
            const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
            console.log("[useFcmToken] Service Worker registered:", registration);

            // Get messaging instance
            const messaging = await getMessagingInstance();
            if (!messaging) {
                setError("Firebase Messaging не підтримується");
                setLoading(false);
                return null;
            }

            // Get FCM token
            const fcmToken = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration,
            });

            if (fcmToken) {
                setToken(fcmToken);
                setFcmToken(fcmToken); // Sync with AuthContext
                await saveTokenToFirestore(fcmToken);
            }

            setLoading(false);
            return fcmToken;
        } catch (err) {
            console.error("[useFcmToken] Error getting FCM token:", err);
            setError("Помилка налаштування сповіщень");
            setLoading(false);
            return null;
        }
    }, [permissionStatus, saveTokenToFirestore, setFcmToken]);

    // Main requestPermission - chooses native vs web path
    const requestPermission = useCallback(async () => {
        if (isNative) {
            return requestPermissionNative();
        } else {
            return requestPermissionWeb();
        }
    }, [isNative, requestPermissionNative, requestPermissionWeb]);

    // Auto-register if already granted
    useEffect(() => {
        // Only auto-register if we have a user and don't have a token yet
        // AND user hasn't manually disabled notifications
        const manuallyDisabled = typeof window !== "undefined" && localStorage.getItem('fcm_manually_disabled') === 'true';

        if (permissionStatus === 'granted' && !token && !loading && user?.uid && !manuallyDisabled) {
            console.log("[useFcmToken] Auto-registering (permission granted + not disabled)");
            requestPermission();
        } else if (manuallyDisabled) {
            console.log("[useFcmToken] Subscribed suppressed (manually disabled)");
        }
    }, [permissionStatus, token, loading, user?.uid, requestPermission]);

    // Listen for foreground messages (native)
    useEffect(() => {
        if (!isNative) return;

        const setupNativeListeners = async () => {
            try {
                const { PushNotifications } = await import("@capacitor/push-notifications");

                // Note: registration listeners are set in requestPermissionNative locally to avoid race conditions.
                // Here we set operational listeners.

                await PushNotifications.removeAllListeners(); // Safety cleanup before adding logic listeners

                PushNotifications.addListener("pushNotificationReceived", (notification) => {
                    console.log("[useFcmToken] Native foreground notification:", notification);
                });

                PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
                    console.log("[useFcmToken] Native notification action:", action);
                });
            } catch (err) {
                console.error("[useFcmToken] Error setting up native listeners:", err);
            }
        };

        setupNativeListeners();
    }, [isNative]);


    // Listen for foreground messages (web)
    useEffect(() => {
        if (typeof window === "undefined" || isNative) return;

        const setupForegroundListener = async () => {
            const messaging = await getMessagingInstance();
            if (!messaging) return;

            const unsubscribe = onMessage(messaging, (payload) => {
                console.log("[useFcmToken] Foreground message received:", payload);

                if (Notification.permission === "granted" && payload.notification) {
                    new Notification(payload.notification.title || "ChoirHub", {
                        body: payload.notification.body,
                        icon: "/icons/icon-192x192.png",
                    });
                }
            });

            return unsubscribe;
        };

        setupForegroundListener();
    }, [isNative]);

    // Unsubscribe (remove token from server)
    const unsubscribe = useCallback(async () => {
        if (!token || !user?.uid) return;
        setLoading(true);
        try {
            const { getFirestore, doc, updateDoc, arrayRemove } = await import("firebase/firestore");
            const { app } = await import("@/lib/firebase");
            const db = getFirestore(app);

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                fcmTokens: arrayRemove(token)
            });

            // Remove from local storage
            localStorage.removeItem('fcm_registration_cache');
            if (typeof window !== "undefined") {
                localStorage.setItem('fcm_manually_disabled', 'true');
            }
            setToken(null);
            setFcmToken(null);
            setPermissionStatus("default"); // Reset status locally to allow re-prompt or show "off"
            console.log("[useFcmToken] Unsubscribed successfully");
        } catch (err) {
            console.error("[useFcmToken] Error unsubscribing:", err);
            setError("Помилка при вимкненні сповіщень");
        } finally {
            setLoading(false);
        }
    }, [token, user?.uid, setFcmToken]);

    return {
        token,
        permissionStatus,
        loading,
        error,
        requestPermission,
        unsubscribe,
        isSupported: isNative || permissionStatus !== "unsupported",
        isGranted: permissionStatus === "granted" && !!token, // Only considered granted if we have a token
    };
}
