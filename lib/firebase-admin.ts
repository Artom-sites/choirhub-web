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
        if (!projectId) console.error("Missing FIREBASE_PROJECT_ID");
        if (!clientEmail) console.error("Missing FIREBASE_CLIENT_EMAIL");
        if (!privateKey) console.error("Missing FIREBASE_PRIVATE_KEY");
        return null;
    }

    return createFirebaseAdminApp({
        projectId,
        clientEmail,
        privateKey,
    });
}
