const admin = require('firebase-admin');
const serviceAccount = require('../../firebase_credentials.json');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const uids = [
    'ZT4DIb32XicX3ZvIOgjIuhybJIb2',
    'rD5fv0zIdWdldtER08FslQwdxBM2',
    'uGcHF89m3AMV2umCH1R35RMc7pf1',
    'PH8fSF8ugyNUghhM05xAQVuKkEa2'  // the one with no choirId
];

async function check() {
    for (const uid of uids) {
        try {
            const userRecord = await admin.auth().getUser(uid);
            console.log('=== UID:', uid, '===');
            console.log('  displayName:', userRecord.displayName || '<EMPTY>');
            console.log('  email:', userRecord.email || '<NONE>');
            console.log('  phoneNumber:', userRecord.phoneNumber || '<NONE>');
            console.log('  providerId:', userRecord.providerData.map(p => p.providerId).join(', ') || '<NONE>');
            console.log('  disabled:', userRecord.disabled);
            console.log('  createdAt:', userRecord.metadata.creationTime);
            console.log('  lastSignIn:', userRecord.metadata.lastSignInTime);
            console.log('  ---');
        } catch (e) {
            console.log('=== UID:', uid, '=== NOT FOUND IN AUTH');
        }
    }
    process.exit(0);
}

check();
