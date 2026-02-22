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
    const services = await db.collection(`choirs/${choir.id}/services`).where('date', '==', '2026-02-22').get();
    for (const service of services.docs) {
      console.log('Choir:', choir.id, 'Service:', service.id);
      console.log('Data:', JSON.stringify(service.data(), null, 2));
    }
  }
}
check().catch(console.error);
