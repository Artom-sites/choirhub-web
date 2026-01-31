import "server-only";
import admin from "firebase-admin";

interface FirebaseAdminConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

function formatPrivateKey(key: string) {
    return key.replace(/\\n/g, "\n");
}

export function createFirebaseAdminApp(config: FirebaseAdminConfig) {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const cert = {
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: formatPrivateKey(config.privateKey),
    };

    return admin.initializeApp({
        credential: admin.credential.cert(cert),
    });
}

export function getAdmin() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        // Fallback: Check for service account JSON file path if env vars are missing
        // or just return null/throw error if critical
        console.error("Firebase Admin Environment Variables missing.");
        return null;
    }

    return createFirebaseAdminApp({
        projectId,
        clientEmail,
        privateKey,
    });
}
