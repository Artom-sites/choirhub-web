const admin = require('firebase-admin');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, './choirhub-8bfa2-firebase-adminsdk-fbsvc-2cd25b3eee.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(SERVICE_ACCOUNT_PATH)
    });
}

const db = admin.firestore();

async function inspectServices() {
    console.log('--- Inspecting Services ---');
    const choirsSnapshot = await db.collection('choirs').get();
    
    for (const choirDoc of choirsSnapshot.docs) {
        const choirData = choirDoc.data();
        const choirId = choirDoc.id;
        const choirName = choirData.name;
        
        const servicesSnapshot = await db.collection('choirs').doc(choirId).collection('services').get();
        if (servicesSnapshot.empty) continue;
        
        console.log(`\nChoir: ${choirName} (${choirId})`);
        console.log(`Found ${servicesSnapshot.size} services.`);
        
        for (const serviceDoc of servicesSnapshot.docs) {
            const serviceData = serviceDoc.data();
            const hasSongs = serviceData.songs && Array.isArray(serviceData.songs);
            
            if (!hasSongs) {
                console.log(`\n🚨 MALFORMED SERVICE FOUND: "${serviceData.title}" (${serviceDoc.id}) in Choir "${choirName}"`);
                console.log(`    - songs: ${serviceData.songs}`);
                console.log(`    - full data:`, JSON.stringify(serviceData, null, 2));
            } else if (serviceData.songs.length === 0 && !serviceData.program) {
                 // Potentially okay, but maybe suspicious if it's demo data
                 // console.log(`  Service: "${serviceData.title}" (Empty songs, no program)`);
            }
        }
    }
}

inspectServices().catch(console.error);
