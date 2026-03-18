const admin = require('firebase-admin');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, './choirhub-8bfa2-firebase-adminsdk-fbsvc-2cd25b3eee.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(SERVICE_ACCOUNT_PATH)
    });
}

const db = admin.firestore();

async function cleanLinkedTo() {
    console.log('--- Cleaning linkedTo field from Users ---');
    const usersSnapshot = await db.collection('users').get();
    let updatedCount = 0;
    
    for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        if (data.linkedTo) {
            console.log(`Found linkedTo in user: ${doc.id} (linkedTo: ${data.linkedTo})`);
            await doc.ref.update({
                mergedInto: data.linkedTo,
                linkedTo: admin.firestore.FieldValue.delete()
            });
            console.log(`  -> Migrated linkedTo to mergedInto and deleted linkedTo from ${doc.id}`);
            updatedCount++;
        }
    }
    
    console.log(`\nUpdated ${updatedCount} user documents.`);
}

cleanLinkedTo()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
