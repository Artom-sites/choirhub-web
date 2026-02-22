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
    if (choir.id !== 'vOuHdELYa0jC60CV4Tx4') continue; // target choir if known, or run for all
    
    console.log(`=== Choir: ${choir.id} ===`);
    const services = await db.collection(`choirs/${choir.id}/services`).where('date', '==', '2026-02-22').get();
    
    for (const service of services.docs) {
      console.log('-- Service:', service.id, '--');
      const data = service.data();
      console.log('isFinalized:', data.isFinalized);
      console.log('absentMembers:', data.absentMembers?.length);
      console.log('confirmedMembers:', data.confirmedMembers?.length);
      console.log('---');
    }
    
    const statsDoc = await db.doc(`choirs/${choir.id}/stats/summary`).get();
    if (statsDoc.exists) {
        const trend = statsDoc.data().attendanceTrend || [];
        const todayTrend = trend.find(t => t.date === '2026-02-22');
        console.log('Stats Trend for 2026-02-22:', todayTrend);
    }
  }
}
check().catch(console.error);
