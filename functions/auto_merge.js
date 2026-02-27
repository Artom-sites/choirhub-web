const admin = require('firebase-admin');
const serviceAccount = require('../../credentials.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function mergeAutomagically() {
    const email = 'artemdula0@gmail.com';
    console.log('--- AUTO MERGE CHECK FOR', email, '---');
    try {
        const user = await admin.auth().getUserByEmail(email);
        const userId = user.uid;

        const userDoc = await db.collection('users').doc(userId).get();
        const choirId = userDoc.data().choirId;

        let oldMemberId = null;
        let newMemberId = userId;

        const membersSnap = await db.collection('choirs').doc(choirId).collection('members').get();
        for (const d of membersSnap.docs) {
            const data = d.data();
            // Look for virtual member (no accountUid, or old accountUid that doesn't match current)
            // Actually, when he deleted his account, the old member doc might still be there but disconnected!
            if (d.id !== userId && data.name && (data.name.includes('Artem') || data.name.includes('Артем'))) {
                console.log("Found matching old member:", d.id, data.name, data.hasAccount, data.accountUid);
                oldMemberId = d.id;
                break;
            }
        }

        if (!oldMemberId) {
            console.log("No old member found to merge. User is fresh or already merged.");
            process.exit(0);
        }

        console.log("Found old member", oldMemberId, "to merge into new member", newMemberId);

        // Instead of doing it manually, let's call the atomicMergeMembers Cloud Function directly so all song/service votes are moved safely.
        // Wait, we can just do it in this script.

        const choirRef = db.collection('choirs').doc(choirId);

        // 1. Update services
        console.log("Updating services...");
        const servicesSnap = await choirRef.collection('services').get();
        for (const sDoc of servicesSnap.docs) {
            const sData = sDoc.data();
            let updated = false;
            const cMembers = sData.confirmedMembers || [];
            const aMembers = sData.absentMembers || [];

            if (cMembers.includes(oldMemberId)) {
                cMembers.splice(cMembers.indexOf(oldMemberId), 1);
                if (!cMembers.includes(newMemberId)) cMembers.push(newMemberId);
                updated = true;
            }
            if (aMembers.includes(oldMemberId)) {
                aMembers.splice(aMembers.indexOf(oldMemberId), 1);
                if (!aMembers.includes(newMemberId)) aMembers.push(newMemberId);
                updated = true;
            }

            const lMembers = sData.lateMembers || {};
            if (lMembers[oldMemberId]) {
                lMembers[newMemberId] = lMembers[oldMemberId];
                delete lMembers[oldMemberId];
                updated = true;
            }

            if (updated) {
                await sDoc.ref.update({
                    confirmedMembers: cMembers,
                    absentMembers: aMembers,
                    lateMembers: lMembers
                });
                console.log("Updated service", sDoc.id);
            }
        }

        // 2. Update song votes/status
        console.log("Updating songs...");
        const songsSnap = await choirRef.collection('songs').get();
        for (const songDoc of songsSnap.docs) {
            const songData = songDoc.data();
            let sUpdated = false;

            const knownMembers = songData.knownByMembers || [];
            if (knownMembers.includes(oldMemberId)) {
                knownMembers.splice(knownMembers.indexOf(oldMemberId), 1);
                if (!knownMembers.includes(newMemberId)) knownMembers.push(newMemberId);
                sUpdated = true;
            }

            const learningMembers = songData.learningMembers || [];
            if (learningMembers.includes(oldMemberId)) {
                learningMembers.splice(learningMembers.indexOf(oldMemberId), 1);
                if (!learningMembers.includes(newMemberId)) learningMembers.push(newMemberId);
                sUpdated = true;
            }

            if (sUpdated) {
                await songDoc.ref.update({
                    knownByMembers: knownMembers,
                    learningMembers: learningMembers
                });
                console.log("Updated song", songDoc.id);
            }
        }

        // 3. Remove old member from members array in choir doc
        const choirDoc = await choirRef.get();
        let mainMembers = choirDoc.data().members || [];
        mainMembers = mainMembers.filter((m) => m.id !== oldMemberId && m.accountUid !== oldMemberId);
        await choirRef.update({ members: mainMembers });

        // 4. Delete old member doc from subcollection
        await choirRef.collection('members').doc(oldMemberId).delete();

        console.log("SUCCESSFULLY MERGED old profile into new profile!");

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

mergeAutomagically();
