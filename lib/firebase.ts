// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";

import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from "firebase/firestore";
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, Auth } from "firebase/auth";
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

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize services with PERSISTENCE
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
// Initialize Auth with explicit persistence for iOS Safari reliability
// indexedDBLocalPersistence = primary (best multi-tab), browserLocalPersistence = fallback (survives Safari ITP)
let auth: Auth;
if (typeof window !== "undefined") {
    try {
        auth = initializeAuth(app, {
            persistence: [indexedDBLocalPersistence, browserLocalPersistence],
            popupRedirectResolver: browserPopupRedirectResolver,
        });
    } catch (e) {
        // If already initialized (e.g. hot reload), fall back to getAuth
        auth = getAuth(app);
    }
} else {
    // Server-side (SSG build) — no browser APIs available
    auth = getAuth(app);
}
const storage = getStorage(app);
const functions = getFunctions(app);


// Analytics (only supported in browser environment)
let messaging: Messaging | null = null;

if (typeof window !== "undefined") {
    // Initialize messaging only in browser
    isMessagingSupported().then((supported) => {
        if (supported) {
            messaging = getMessaging(app);
        }
    });
}

// Helper function to get messaging instance (for use in hooks)
export const getMessagingInstance = async (): Promise<Messaging | null> => {
    if (typeof window === "undefined") return null;
    const supported = await isMessagingSupported();
    if (!supported) return null;
    return getMessaging(app);
};

export { app, db, auth, storage, messaging, getToken, onMessage, functions };
