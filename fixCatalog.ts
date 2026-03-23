import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const b64Key = process.env.FIREBASE_PRIVATE_KEY_B64 || '';
const privateKey = b64Key ? Buffer.from(b64Key, 'base64').toString('utf8').replace(/\\n/g, '\n') : '';

if (!privateKey) {
  console.error("Missing FIREBASE_PRIVATE_KEY_B64");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
});

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection("mscCatalog").get();
  console.log(`Found ${snapshot.size} songs in mscCatalog.`);
  
  if (snapshot.size === 0) return;

  const batch = db.batch();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const newDocRef = db.collection("global_songs").doc();
    batch.set(newDocRef, data);
    batch.delete(doc.ref);
    console.log(`Moving: ${data.title}`);
  }
  
  await batch.commit();
  console.log("Migration complete!");
}

run().catch(console.error);
