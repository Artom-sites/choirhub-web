const admin = require('firebase-admin');
const serviceAccount = require('./credentials.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function check() {
  const email = 'artemdula0@gmail.com';
  try {
    const user = await admin.auth().getUserByEmail(email);
    console.log('User UID:', user.uid);
    console.log('Custom claims:', JSON.stringify(user.customClaims, null, 2));
  } catch(e) {
    console.error(e);
  }
}
check();
