import { config } from 'dotenv';
import { resolve } from 'path';
import { spawn } from 'child_process';

const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error('FIREBASE_PROJECT_ID or FIREBASE_PRIVATE_KEY not found in .env.local');
  process.exit(1);
}

console.log('✅ Environment variables loaded.');

// Pass all CLI args through to import-lira.ts
const scriptArgs = process.argv.slice(2);
const child = spawn('npx', ['tsx', 'scripts/import-lira.ts', ...scriptArgs], {
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code) => {
  process.exit(code);
});
