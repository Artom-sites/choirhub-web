const fs = require('fs');
const users = JSON.parse(fs.readFileSync('users.json')).users;
const targetUid = 'wSQhy1X9bkgJStnA1trrTtdPiAk2';
const user = users.find(u => u.localId === targetUid);

if (user) {
    console.log('User found:', user.email);
    console.log('Custom Attributes (Claims):');
    if (user.customAttributes) {
        console.log(JSON.parse(user.customAttributes));
    } else {
        console.log('No custom attributes found.');
    }
} else {
    console.log('User not found.');
}
