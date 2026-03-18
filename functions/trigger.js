const https = require('https');
const data = JSON.stringify({ data: {} });

const req = https.request({
  hostname: 'us-central1-choirhub-8bfa2.cloudfunctions.net',
  path: '/backfillChoirIds',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
