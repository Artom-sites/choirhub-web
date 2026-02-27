const data = require('../firestore-backup-2026-02-26T22-50-29.json');

// Check users collection - who has no name?
console.log('=== USERS WITHOUT NAME (from users collection) ===');
Object.entries(data.users).forEach(([id, u]) => {
    if (!u.name || u.name.trim() === '') {
        console.log('  ID:', id);
        console.log('  email:', u.email);
        console.log('  choirId:', u.choirId);
        console.log('  role:', u.role);
        console.log('  createdAt:', u.createdAt);
        console.log('  ---');
    }
});

// Check choir members without name or with placeholder names
console.log('\n=== CHOIR MEMBERS WITHOUT REAL NAME (Харзевінкель) ===');
const choir = data.choirs['IFnsKWKiRaCzgOy9niwE'];
if (choir && choir.members) {
    choir.members.forEach(m => {
        if (!m.name || m.name.trim() === '' || m.name === 'Unknown' || m.name === 'Anna' || m.name === 'Sofia Sofia' || m.name === 'Vy Tg') {
            console.log('  Name:', JSON.stringify(m.name));
            console.log('  ID:', m.id);
            console.log('  voice:', m.voice);
            console.log('  hasAccount:', m.hasAccount);
            console.log('  role:', m.role);
            console.log('  isDuplicate:', m.isDuplicate);
            console.log('  ---');
        }
    });
}

// Also check ALL users with their names to see what name they have
console.log('\n=== ALL USERS FOR CHOIR IFnsKWKiRaCzgOy9niwE ===');
Object.entries(data.users).forEach(([id, u]) => {
    if (u.choirId === 'IFnsKWKiRaCzgOy9niwE') {
        console.log('  ' + (u.name || '<NO NAME>') + ' | email: ' + (u.email || '<none>') + ' | id: ' + id + ' | role: ' + (u.role || 'member'));
    }
});
