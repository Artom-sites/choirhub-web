const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function fixSubcollection() {
    const email = 'artemdula0@gmail.com';
    console.log('--- FIXING SUBCOLLECTION FOR', email, '---');
    try {
        const user = await admin.auth().getUserByEmail(email);
        const userId = user.uid;

        const userDoc = await db.collection('users').doc(userId).get();
        const choirId = userDoc.data().choirId;
        if (!choirId) {
            console.log("No choirId in user doc!");
            process.exit(1);
        }

        // Create the subcollection document
        const memberRef = db.collection('choirs').doc(choirId).collection('members').doc(userId);
        const memberSnap = await memberRef.get();

        const memberData = {
            id: userId,
            name: user.displayName || 'Artem Dula',
            role: 'head',
            hasAccount: true,
            accountUid: userId,
            email: email,
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (memberSnap.exists) {
            console.log("Member doc already exists, updating.");
            await memberRef.update(memberData);
        } else {
            console.log("Member doc does not exist, creating.");
            await memberRef.set(memberData);
        }

        // Also check if there's any disconnected virtual member with this name we can merge?
        // User asked "where is the merge button". The merge button appears when a virtual member has no accountUid but matches name, or simply the user wants to claim a member.
        // If we just create this doc, they will be in the list, but it won't retroactively assign past attendances.
        // Let's find any virtual member named Artem and print it out.
        const membersSnap = await db.collection('choirs').doc(choirId).collection('members').get();
        for (const d of membersSnap.docs) {
            if (d.data().name && d.data().name.includes('Artem') && d.id !== userId) {
                console.log("Found an old virtual member that could be merged:", d.id, d.data());

                // If they want to merge, maybe we should just do it for them?
                // The "Merge" button is visible to admins. Since Artem IS an admin, he should see the "merge" button on other members if he clicks on them.
            }
        }

        console.log('--- DONE ---');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixSubcollection();
