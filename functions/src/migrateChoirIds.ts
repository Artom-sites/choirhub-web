import * as admin from 'firebase-admin';

// Initialize app if not already
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function migrate() {
    console.log("Starting migration to add choirIds array to all users...");
    const usersSnap = await db.collection("users").get();
    let updated = 0;
    
    const batch = db.batch();
    
    usersSnap.docs.forEach(doc => {
        const data = doc.data();
        const memberships = data.memberships || [];
        const choirIds = new Set<string>();
        
        // Add active choir just in case
        if (data.choirId) choirIds.add(data.choirId);
        
        // Add from memberships
        memberships.forEach((m: any) => {
            if (m.choirId) choirIds.add(m.choirId);
        });
        
        if (choirIds.size > 0) {
            batch.update(doc.ref, { choirIds: Array.from(choirIds) });
            updated++;
        }
    });

    if (updated > 0) {
        await batch.commit();
        console.log(`Migration complete. Updated ${updated} users with choirIds array.`);
    } else {
        console.log("No users needed updating.");
    }
}

migrate().catch(console.error);
