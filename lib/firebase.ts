// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";

import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from "firebase/firestore";
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, Auth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported, Messaging } from "firebase/messaging";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check"; // App Check Import
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCPBASol-Zd6dLF3XsRNTUFTMyJMptFJRA",
    authDomain: "choirhub-8bfa2.firebaseapp.com",
    projectId: "choirhub-8bfa2",
    storageBucket: "choirhub-8bfa2.firebasestorage.app",
    messagingSenderId: "536668000416",
    appId: "1:536668000416:web:3a35d3674134409d2eb9c5"
};

// Initialize Firebase App synchronously (very fast, doesn't block much)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let dbInstance: any = null;
let authInstance: Auth | null = null;
let storageInstance: any = null;
let functionsInstance: any = null;
let messagingInstance: Messaging | null = null;

// Lazy initialize Firestore
export function getFirestoreLazy() {
    if (!dbInstance) {
        dbInstance = initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        });
    }
    return dbInstance;
}

// Lazy initialize Auth with explicit persistence for iOS Safari reliability
export function getAuthLazy(): Auth {
    if (!authInstance) {
        try {
            authInstance = initializeAuth(app, {
                persistence: [indexedDBLocalPersistence, browserLocalPersistence],
            });
        } catch (e) {
            // If already initialized (e.g. hot reload), fall back to getAuth
            authInstance = getAuth(app);
        }
    }
    return authInstance;
}

export function getStorageLazy() {
    if (!storageInstance) {
        storageInstance = getStorage(app);
    }
    return storageInstance;
}

export function getFunctionsLazy() {
    if (!functionsInstance) {
        functionsInstance = getFunctions(app);
    }
    return functionsInstance;
}

// Analytics (only supported in browser environment)
if (typeof window !== "undefined") {
    // Initialize messaging only in browser
    isMessagingSupported().then((supported) => {
        if (supported) {
            messagingInstance = getMessaging(app);
        }
    });
}

// Helper function to get messaging instance (for use in hooks)
export const getMessagingInstance = async (): Promise<Messaging | null> => {
    if (typeof window === "undefined") return null;
    if (messagingInstance) return messagingInstance;
    const supported = await isMessagingSupported();
    if (!supported) return null;
    try {
        messagingInstance = getMessaging(app);
        return messagingInstance;
    } catch (e) {
        console.warn("[Firebase] Messaging init failed:", e);
        return null;
    }
};

export function getMessagingLazy() {
    if (!messagingInstance) {
        messagingInstance = getMessaging(app);
    }
    return messagingInstance;
}

// Keep `app`, `getToken`, and `onMessage` exported directly.
// Note: legacy exports `db`, `auth`, `storage`, `functions`, `messaging` are intentionally removed to enforce the lazy pattern everywhere.
export { app, getToken, onMessage };

