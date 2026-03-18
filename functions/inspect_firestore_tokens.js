const admin = require("firebase-admin");

admin.initializeApp({
    projectId: "choirhub-8bfa2"
});

const db = admin.firestore();

async function check() {
    const choirId = "hHAHcA7fCoh8SIXF8l1L";
    
    console.log(`Checking choir: ${choirId}`);
    
    const choirDoc = await db.collection("choirs").doc(choirId).get();
    const explicitIds = (choirDoc.data()?.members || [])
        .map(m => m.accountUid || m.id)
        .filter(id => !!id);
        
    console.log(`\nExplicit members IDs (${explicitIds.length}):`, explicitIds);
    
    // Dynamic schema
    const usersSnap = await db.collection("users")
        .where("choirIds", "array-contains", choirId)
        .get();
        
    // Legacy fallback query
    const legacySnap = await db.collection("users")
        .where("choirId", "==", choirId)
        .get();
        
    const fetchedDocsMap = new Map();
    usersSnap.docs.forEach(doc => fetchedDocsMap.set(doc.id, doc));
    legacySnap.docs.forEach(doc => fetchedDocsMap.set(doc.id, doc));
    
    const missingIds = explicitIds.filter(id => !fetchedDocsMap.has(id));
    if (missingIds.length > 0) {
        for (let i = 0; i < missingIds.length; i += 100) {
            const chunk = missingIds.slice(i, i + 100);
            const refs = chunk.map(id => db.collection("users").doc(id));
            const missingSnap = await db.getAll(...refs);
            missingSnap.forEach(doc => {
                 if (doc.exists) fetchedDocsMap.set(doc.id, doc);
            });
        }
    }
        
    console.log(`\nFound ${explicitIds.length} explicit members, ${usersSnap.size} dynamically joined (new schema), and ${legacySnap.size} (legacy schema). Total unique valid docs: ${fetchedDocsMap.size}`);
    
    fetchedDocsMap.forEach((doc, id) => {
        const u = doc.data();
        console.log(`\n- User ID: ${id}`);
        console.log(`  Name: ${u.name}`);
        console.log(`  Email: ${u.email}`);
        console.log(`  notificationsEnabled: ${u.notificationsEnabled}`);
        console.log(`  fcmTokens count: ${u.fcmTokens ? u.fcmTokens.length : 0}`);
        if (u.fcmTokens && Array.isArray(u.fcmTokens)) {
            console.log(`  tokens: ${u.fcmTokens.map(t => typeof t === 'string' ? t.substring(0, 15) + "..." : t).join(", ")}`);
        }
        console.log(`  choirId: ${u.choirId}`);
        console.log(`  choirIds: ${u.choirIds ? JSON.stringify(u.choirIds) : 'undefined'}`);
    });
}

check().catch(console.error).then(() => process.exit(0));
