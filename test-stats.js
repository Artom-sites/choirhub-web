const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: applicationDefault(),
  projectId: "choirhub-8bfa2"
});
const db = getFirestore();

async function check() {
  const choirs = await db.collection('choirs').get();
  for (const choir of choirs.docs) {
    const statsRef = db.doc(`choirs/${choir.id}/stats/summary`);
    const doc = await statsRef.get();
    console.log('Choir:', choir.id, 'Stats:', doc.exists ? JSON.stringify(doc.data().attendanceTrend, null, 2) : 'No stats');
  }
}
check().catch(console.error);
