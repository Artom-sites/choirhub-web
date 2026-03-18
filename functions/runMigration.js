const admin = require('firebase-admin');
admin.initializeApp({
  projectId: "choirhub-8bfa2"
});

const db = admin.firestore();

async function run() {
    console.log("Starting migration...");
    const usersSnap = await db.collection("users").get();
    let updatedCount = 0;
    const batches = [db.batch()];
    let currentBatchIndex = 0;
    let opsInCurrentBatch = 0;

    usersSnap.docs.forEach(doc => {
        const userData = doc.data();
        const memberships = userData.memberships || [];
        const choirIdsSet = new Set();
        
        if (userData.choirId) choirIdsSet.add(userData.choirId);
        memberships.forEach(m => {
            if (m.choirId) choirIdsSet.add(m.choirId);
        });
        
        const existingChoirIds = userData.choirIds || [];
        const needsUpdate = choirIdsSet.size > 0 && 
            (existingChoirIds.length !== choirIdsSet.size || !existingChoirIds.every(id => choirIdsSet.has(id)));

        if (needsUpdate) {
            batches[currentBatchIndex].update(doc.ref, { choirIds: Array.from(choirIdsSet) });
            opsInCurrentBatch++;
            updatedCount++;

            if (opsInCurrentBatch >= 490) {
                batches.push(db.batch());
                currentBatchIndex++;
                opsInCurrentBatch = 0;
            }
        }
    });

    for (const batch of batches) {
        if (batch._ops?.length > 0 || batch._mutations?.length > 0) {
           await batch.commit();
        }
    }

    console.log(`Processed ${usersSnap.size} users. Updated ${updatedCount} users.`);
}

run().catch(console.error);
