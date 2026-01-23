// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

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

// Initialize services
// Using initializeFirestore can sometimes prevent duplicate initialization issues or settings conflicts
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Analytics (only supported in browser environment)
let analytics = null;
if (typeof window !== "undefined") {
    isSupported().then((supported) => {
        if (supported) {
            analytics = getAnalytics(app);
        }
    });
}

export { app, db, auth, storage, analytics };
