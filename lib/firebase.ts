// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported, Messaging } from "firebase/messaging";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check"; // App Check Import

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCPBASol-Zd6dLF3XsRNTUFTMyJMptFJRA",
    authDomain: "choirhub-8bfa2.firebaseapp.com",
    projectId: "choirhub-8bfa2",
    storageBucket: "choirhub-8bfa2.firebasestorage.app",
    messagingSenderId: "536668000416",
    appId: "1:536668000416:web:3a35d3674134409d2eb9c5",
    measurementId: "G-6V0SSJM7Y3"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize services with PERSISTENCE
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
const auth = getAuth(app);
const storage = getStorage(app);

// Analytics (only supported in browser environment)
let analytics = null;
let messaging: Messaging | null = null;

if (typeof window !== "undefined") {
    isSupported().then((supported) => {
        if (supported) {
            analytics = getAnalytics(app);
        }
    });

    // Initialize messaging only in browser
    isMessagingSupported().then((supported) => {
        if (supported) {
            messaging = getMessaging(app);
        }
    });

    // Initialize App Check (DDoS Protection) - Only in production
    // if (process.env.NODE_ENV === 'production') {
    //     try {
    //         initializeAppCheck(app, {
    //             provider: new ReCaptchaV3Provider("6LfBilssAAAAAHMCpCUhm3kI-FBLh4pdpCFGaCZ0"),
    //             isTokenAutoRefreshEnabled: true
    //         });
    //         console.log("App Check initialized");
    //     } catch (e) {
    //         console.error("App Check init failed:", e);
    //     }
    // }
}

// Helper function to get messaging instance (for use in hooks)
export const getMessagingInstance = async (): Promise<Messaging | null> => {
    if (typeof window === "undefined") return null;
    const supported = await isMessagingSupported();
    if (!supported) return null;
    return getMessaging(app);
};

export { app, db, auth, storage, analytics, messaging, getToken, onMessage };
