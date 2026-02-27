const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../../firebase_credentials.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const CHOIR_ID = 'msc_zht_0';

// ========== STEP 1: BACKUP ==========
async function backup() {
    console.log('=== STARTING BACKUP ===');
    const backupData = {};

    // Backup top-level collections
    const topCollections = ['users', 'choirs'];
    for (const colName of topCollections) {
        const snapshot = await db.collection(colName).get();
        backupData[colName] = {};
        snapshot.forEach(doc => {
            backupData[colName][doc.id] = doc.data();
        });
        console.log(`  ✓ ${colName}: ${snapshot.size} docs`);
    }

    // Backup subcollections of choirs (services)
    const choirsSnapshot = await db.collection('choirs').get();
    backupData['choir_services'] = {};
    for (const choirDoc of choirsSnapshot.docs) {
        const servicesSnapshot = await db.collection('choirs').doc(choirDoc.id).collection('services').get();
        if (servicesSnapshot.size > 0) {
            backupData['choir_services'][choirDoc.id] = {};
            servicesSnapshot.forEach(sDoc => {
                backupData['choir_services'][choirDoc.id][sDoc.id] = sDoc.data();
            });
            console.log(`  ✓ choirs/${choirDoc.id}/services: ${servicesSnapshot.size} docs`);
        }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(__dirname, '..', `firestore-backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`\n✓ BACKUP SAVED to: ${backupPath}`);
    console.log(`  Size: ${(fs.statSync(backupPath).size / 1024).toFixed(1)} KB\n`);
}

// ========== STEP 2: MERGE Vy Tg -> Цигольник Віталій ==========
async function mergeVyTg() {
    console.log('=== STARTING MERGE ===');
    const choirRef = db.collection('choirs').doc(CHOIR_ID);
    const choirDoc = await choirRef.get();

    if (!choirDoc.exists) {
        console.error('Choir not found:', CHOIR_ID);
        return;
    }

    const members = choirDoc.data().members || [];
    console.log(`  Total members: ${members.length}`);

    // Find Vy Tg (source)
    const vyTgIndex = members.findIndex(m =>
        m.name && m.name.toLowerCase().replace(/\s+/g, ' ').trim() === 'vy tg'
    );

    // Find Цигольник (target)
    const realIndex = members.findIndex(m =>
        m.name && m.name.toLowerCase().includes('цигольник')
    );

    if (realIndex === -1) {
        console.error('  ✗ Could not find Цигольник in members');
        console.log('  Members with ц:', members.filter(m => m.name && m.name.toLowerCase().includes('ц')).map(m => m.name));
        return;
    }

    const target = members[realIndex];
    console.log(`  Target: "${target.name}" (id: ${target.id}, voice: ${target.voice})`);

    if (vyTgIndex !== -1) {
        // Vy Tg is in the members array
        const source = members[vyTgIndex];
        console.log(`  Source: "${source.name}" (id: ${source.id})`);

        if (!target.linkedUserIds) target.linkedUserIds = [];
        if (!target.linkedUserIds.includes(source.id)) {
            target.linkedUserIds.push(source.id);
        }
        if (source.linkedUserIds) {
            source.linkedUserIds.forEach(uid => {
                if (!target.linkedUserIds.includes(uid)) target.linkedUserIds.push(uid);
            });
        }
        if (source.accountUid && !target.linkedUserIds.includes(source.accountUid)) {
            target.linkedUserIds.push(source.accountUid);
        }
        target.hasAccount = true;
        source.isDuplicate = true;
        source.mergedInto = target.id;

        await choirRef.update({ members });
        console.log('  ✓ MERGE COMPLETE (from members array)');
    } else {
        // Check users collection
        console.log('  Vy Tg not in members array, checking users...');
        const usersSnap = await db.collection('users').where('choirId', '==', CHOIR_ID).get();
        let vyTgUser = null;
        usersSnap.forEach(doc => {
            const d = doc.data();
            if (d.name && d.name.toLowerCase().replace(/\s+/g, ' ').trim() === 'vy tg') {
                vyTgUser = { id: doc.id, ...d };
            }
        });

        if (vyTgUser) {
            console.log(`  Found in users: "${vyTgUser.name}" (uid: ${vyTgUser.id})`);
            if (!target.linkedUserIds) target.linkedUserIds = [];
            if (!target.linkedUserIds.includes(vyTgUser.id)) {
                target.linkedUserIds.push(vyTgUser.id);
            }
            target.hasAccount = true;
            await choirRef.update({ members });
            console.log('  ✓ MERGE COMPLETE (from users collection)');
        } else {
            console.log('  ✗ Could not find Vy Tg anywhere');
            console.log('  Users:', usersSnap.docs.map(d => d.data().name).join(', '));
        }
    }
}

// ========== RUN ==========
(async () => {
    try {
        await backup();
        await mergeVyTg();
        console.log('\n=== ALL DONE ===');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
})();
