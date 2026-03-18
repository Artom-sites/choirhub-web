const admin = require("firebase-admin");
try {
  admin.initializeApp({ projectId: "choirhub-8bfa2" });
} catch(e) {}
const db = admin.firestore();

async function check() {
    console.log("Fetching the current user document Wt4BWJN6tmhlaPfPU4UYntRitrH2...");
    const userSnap = await db.collection("users").doc("Wt4BWJN6tmhlaPfPU4UYntRitrH2").get();
    const data = userSnap.data() || {};
    console.log(`User ${data.name} tokens:`, data.fcmTokens);
}
check().catch(console.error);
