const admin = require('firebase-admin');
const serviceAccount = require('../../firebase_credentials.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function merge() {
  const choirRef = db.collection('choirs').doc('IFnsKWKiRaCzgOy9niwE');
  const choirDoc = await choirRef.get();
  const members = choirDoc.data().members;

  const vyTgIdx = members.findIndex(m => m.name === 'Vy Tg');
  const targetIdx = members.findIndex(m => m.name && m.name.includes('Віталік'));

  if (vyTgIdx === -1) { console.log('Vy Tg not found'); process.exit(1); }
  if (targetIdx === -1) { console.log('Target not found'); process.exit(1); }

  const source = members[vyTgIdx];
  const target = members[targetIdx];

  console.log('Source:', source.name, '- id:', source.id);
  console.log('Target:', target.name, '- id:', target.id);

  if (!target.linkedUserIds) target.linkedUserIds = [];
  if (!target.linkedUserIds.includes(source.id)) target.linkedUserIds.push(source.id);
  if (source.accountUid && !target.linkedUserIds.includes(source.accountUid)) {
    target.linkedUserIds.push(source.accountUid);
  }
  target.hasAccount = true;

  source.isDuplicate = true;
  source.mergedInto = target.id;

  await choirRef.update({ members });
  console.log('MERGE COMPLETE!');
  console.log('Target linkedUserIds:', target.linkedUserIds);
  process.exit(0);
}

merge().catch(e => { console.error(e); process.exit(1); });
