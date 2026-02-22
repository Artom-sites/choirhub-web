const https = require('https');

const req = https.request('https://us-central1-choirhub-8bfa2.cloudfunctions.net/backfillStats', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
});

req.on('error', (e) => console.error(e));
req.write(JSON.stringify({ data: {} }));
req.end();
