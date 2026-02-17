const admin = require('firebase-admin');
const fs = require('fs');

// Initialize app
if (fs.existsSync('./service-account.json')) {
    try {
        const serviceAccount = require('./service-account.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Using service-account.json credentials.");
    } catch (e) {
        console.error("Error loading service-account.json:", e);
        process.exit(1);
    }
} else {
    console.log("No service-account.json found. Trying default application credentials with explicit project ID...");
    try {
        admin.initializeApp({
            projectId: 'choirhub-8bfa2'
        });
    } catch (e) {
        console.error("Init failed:", e);
        admin.initializeApp();
    }
}

const uid = process.argv[2];

if (!uid) {
    console.error("Please provide a UID as an argument.");
    process.exit(1);
}

async function checkClaims() {
    try {
        const user = await admin.auth().getUser(uid);
        console.log("--- User Record ---");
        console.log("UID:", user.uid);
        console.log("Email:", user.email);
        console.log("--- Custom Claims ---");
        console.log(JSON.stringify(user.customClaims, null, 2));
        console.log("---------------------");
    } catch (error) {
        console.error("Error fetching user:", error);
    }
}

checkClaims();
