const admin = require('firebase-admin');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, './choirhub-8bfa2-firebase-adminsdk-fbsvc-2cd25b3eee.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(SERVICE_ACCOUNT_PATH)
    });
}

const db = admin.firestore();

async function inspectDemoChoir() {
    const choirId = 'hHAHcA7fCoh8SIXF8l1L'; // MyChoir
    console.log(`--- Inspecting Choir ${choirId} ---`);
    
    const servicesSnapshot = await db.collection('choirs').doc(choirId).collection('services').get();
    console.log(`Found ${servicesSnapshot.size} services.`);
    
    for (const serviceDoc of servicesSnapshot.docs) {
        const data = serviceDoc.data();
        if (!data.songs || !Array.isArray(data.songs)) {
            console.log(`\n🚨 MALFORMED SERVICE: "${data.title}" (${serviceDoc.id})`);
            console.log(`   songs:`, data.songs);
            console.log(`   full data:`, JSON.stringify(data, null, 2));
        }
        
        // Also check for other fields the user mentioned
        const missingFields = [];
        if (!data.confirmedMembers) missingFields.push('confirmedMembers');
        if (!data.absentMembers) missingFields.push('absentMembers');
        if (!data.program) missingFields.push('program');
        if (!data.date) missingFields.push('date');
        
        if (missingFields.length > 0) {
            console.log(`   ⚠️  Missing fields in "${data.title}":`, missingFields.join(', '));
        }
    }
}

inspectDemoChoir().catch(console.error);
