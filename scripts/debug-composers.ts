import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkEmptyComposers() {
    const snapshot = await db.collection('global_songs').limit(1000).get();
    let emptyCount = 0;

    console.log(`Checking ${snapshot.size} songs...`);

    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data.composer || data.composer.trim() === '') {
            emptyCount++;
            if (emptyCount <= 5) {
                console.log(`Song without composer: "${data.title}" (Source ID: ${data.sourceId})`);
                // Fetch details from API to debug
                if (data.sourceId) {
                    try {
                        const res = await fetch(`https://mscmusic.org/api/v2/works/${data.sourceId}`);
                        const json = await res.json();
                        console.log(`API Data for ${data.sourceId}:`, JSON.stringify(json.composers, null, 2));
                    } catch (e) {
                        console.log(`Failed to fetch API for ${data.sourceId}`);
                    }
                }
            }
        }
    }

    console.log(`Total songs without composer in sample: ${emptyCount}`);
}

checkEmptyComposers().catch(console.error);
