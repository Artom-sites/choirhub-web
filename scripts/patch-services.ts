import * as admin from 'firebase-admin';
import * as path from 'path';

// --- CONFIGURATION ---
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to true
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../choirhub-8bfa2-firebase-adminsdk-fbsvc-2cd25b3eee.json');

console.log(`🚀 Starting Service Patch Script`);
console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (No changes will be saved)' : 'LIVE RUN (Changes WILL be saved)'}`);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(SERVICE_ACCOUNT_PATH)
    });
}

const db = admin.firestore();

async function patchAllServices() {
    let totalChoirs = 0;
    let totalServices = 0;
    let malformedCount = 0;
    let errorCount = 0;

    try {
        const choirsSnapshot = await db.collection('choirs').get();
        totalChoirs = choirsSnapshot.size;
        console.log(`🔍 Found ${totalChoirs} choirs.`);

        for (const choirDoc of choirsSnapshot.docs) {
            const choirId = choirDoc.id;
            const choirName = choirDoc.data().name || 'Unknown';
            
            const servicesRef = db.collection('choirs').doc(choirId).collection('services');
            const servicesSnapshot = await servicesRef.get();
            
            totalServices += servicesSnapshot.size;

            for (const serviceDoc of servicesSnapshot.docs) {
                const data = serviceDoc.data();
                const songs = data.songs;
                const isArray = Array.isArray(songs);

                if (!isArray) {
                    malformedCount++;
                    console.log(`⚠️  [MALFORMED] Choir: ${choirName} (${choirId}) | Service: "${data.title}" (${serviceDoc.id}) | songsValue:`, songs);

                    if (!DRY_RUN) {
                        try {
                            await serviceDoc.ref.update({
                                songs: []
                            });
                            console.log(`✅ [FIXED] Updated service "${data.title}"`);
                        } catch (e: any) {
                            errorCount++;
                            console.error(`❌ [ERROR] Failed to update service "${data.title}":`, e.message);
                        }
                    }
                }
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Total Choirs Matched: ${totalChoirs}`);
        console.log(`Total Services Scanned: ${totalServices}`);
        console.log(`Malformed Services Found: ${malformedCount}`);
        if (!DRY_RUN) {
            console.log(`Successful Fixes: ${malformedCount - errorCount}`);
            console.log(`Errors Encountered: ${errorCount}`);
        }
        console.log(`----------------\n`);

    } catch (e: any) {
        console.error(`🔴 CRITICAL ERROR:`, e.message);
    }
}

patchAllServices().then(() => {
    console.log('🏁 Patch operation complete.');
    process.exit(0);
});
