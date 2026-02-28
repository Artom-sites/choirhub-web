const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
    projectId: "choirhub-d40b3"
});

const db = admin.firestore();

async function checkRecentChoirs() {
    try {
        const choirsRef = db.collection('choirs');
        const snapshot = await choirsRef.orderBy('createdAt', 'desc').limit(2).get();

        if (snapshot.empty) {
            console.log('No choirs found.');
            return;
        }

        snapshot.forEach(doc => {
            console.log('Choir ID:', doc.id);
            const data = doc.data();
            console.log('Choir Name:', data.name);
            console.log('Members Array Length:', data.members ? data.members.length : 0);
            console.log('Members:', JSON.stringify(data.members, null, 2));
            console.log('---');
        });
    } catch (error) {
        console.error('Error fetching choirs:', error);
    }
}

checkRecentChoirs();
