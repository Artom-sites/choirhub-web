import admin from "firebase-admin";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const b64Key = process.env.FIREBASE_PRIVATE_KEY_B64 || "";
const privateKey = b64Key ? Buffer.from(b64Key, "base64").toString("utf8").replace(/\\n/g, "\n") : "";

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
    });
}
const db = admin.firestore();

async function backfill() {
    console.log("Starting backfill for attendanceReminderSent...");
    const today = new Date().toISOString().split('T')[0];
    
    let updated = 0;
    const batch = db.batch();
    
    // Iterate over all choirs instead of using collectionGroup to avoid missing index error
    const choirsSnap = await db.collection("choirs").get();
    console.log(`Checking services across ${choirsSnap.size} choirs...`);
    
    for (const choirDoc of choirsSnap.docs) {
        const servicesSnap = await choirDoc.ref.collection("services").where("date", ">=", today).get();
        for (const doc of servicesSnap.docs) {
            const data = doc.data();
            if (data.attendanceReminderSent === undefined) {
                batch.update(doc.ref, {
                    attendanceReminderSent: false,
                    attendanceReminderRetryCount: 0
                });
                updated++;
                if (updated % 400 === 0) {
                    await batch.commit();
                }
            }
        }
    }
    if (updated > 0) {
        await batch.commit();
        console.log(`Successfully backfilled ${updated} services.`);
    } else {
        console.log("No services needed backfilling.");
    }
}

backfill().catch(console.error);
