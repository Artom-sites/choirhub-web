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
    const { user } = useAuth();
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

    // Save token to Firestore
    const saveTokenToFirestore = useCallback(async (fcmToken: string) => {
        if (!user?.uid) return;
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                console.warn("[useFcmToken] No user profile yet, skipping token save");
                return;
            }
            await setDoc(userRef, {
                fcmTokens: arrayUnion(fcmToken),
                notificationsEnabled: true,
            }, { merge: true });
            console.log("[useFcmToken] FCM Token saved to Firestore");
        } catch (err) {
            console.error("[useFcmToken] Error saving token:", err);
        }
    }, [user?.uid]);

    // Request permission and get token - NATIVE path
    const requestPermissionNative = useCallback(async () => {
        setLoading(true);
        setError(null);

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

                PushNotifications.addListener("registration", async (registrationToken) => {
                    clearTimeout(timeout);
                    const fcmToken = registrationToken.value;
                    console.log("[useFcmToken] Native FCM token:", fcmToken);
                    setToken(fcmToken);
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
    }, [saveTokenToFirestore]);

    // Request permission and get token - WEB path
    const requestPermissionWeb = useCallback(async () => {
        if (permissionStatus === "unsupported") {
            setError("Сповіщення не підтримуються на цьому пристрої");
            return null;
        }

        setLoading(true);
        setError(null);

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
    }, [permissionStatus, saveTokenToFirestore]);

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
        if (permissionStatus === 'granted' && !token && !loading && user?.uid) {
            requestPermission();
        }
    }, [permissionStatus, token, loading, user?.uid, requestPermission]);

    // Listen for foreground messages (native)
    useEffect(() => {
        if (!isNative) return;

        const setupNativeListeners = async () => {
            try {
                const { PushNotifications } = await import("@capacitor/push-notifications");

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

    return {
        token,
        permissionStatus,
        loading,
        error,
        requestPermission,
        isSupported: isNative || permissionStatus !== "unsupported",
        isGranted: permissionStatus === "granted",
    };
}
