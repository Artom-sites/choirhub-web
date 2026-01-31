"use client";

import { useEffect, useState, useCallback } from "react";
import { getMessagingInstance, getToken, onMessage } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

// VAPID key from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
// TODO: Replace with actual VAPID key from Firebase Console
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export function useFcmToken() {
    const { user } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | "unsupported">("default");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if notifications are supported
    useEffect(() => {
        if (typeof window === "undefined") return;

        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
            setPermissionStatus("unsupported");
            return;
        }

        setPermissionStatus(Notification.permission);
    }, []);

    // Request permission and get token
    const requestPermission = useCallback(async () => {
        if (permissionStatus === "unsupported") {
            setError("Сповіщення не підтримуються на цьому пристрої");
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            // Request notification permission
            const permission = await Notification.requestPermission();
            setPermissionStatus(permission);

            if (permission !== "granted") {
                setError("Дозвіл на сповіщення не надано");
                setLoading(false);
                return null;
            }

            // Register service worker
            const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
            console.log("Service Worker registered:", registration);

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

                // Save token to Firestore
                if (user?.uid) {
                    const userRef = doc(db, "users", user.uid);
                    await updateDoc(userRef, {
                        fcmTokens: arrayUnion(fcmToken),
                        notificationsEnabled: true,
                    });
                    console.log("FCM Token saved to Firestore");
                }
            }

            setLoading(false);
            return fcmToken;
        } catch (err) {
            console.error("Error getting FCM token:", err);
            setError("Помилка налаштування сповіщень");
            setLoading(false);
            return null;
        }
    }, [permissionStatus, user?.uid]);

    // Listen for foreground messages
    useEffect(() => {
        if (typeof window === "undefined") return;

        const setupForegroundListener = async () => {
            const messaging = await getMessagingInstance();
            if (!messaging) return;

            const unsubscribe = onMessage(messaging, (payload) => {
                console.log("Foreground message received:", payload);

                // Show notification manually for foreground messages
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
    }, []);

    return {
        token,
        permissionStatus,
        loading,
        error,
        requestPermission,
        isSupported: permissionStatus !== "unsupported",
        isGranted: permissionStatus === "granted",
    };
}
