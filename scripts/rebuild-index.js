#!/usr/bin/env node

/**
 * Rebuild the global_songs search index locally.
 * Bypasses Vercel timeout limits by running directly on the machine.
 * 
 * Usage: node scripts/rebuild-index.js
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Init Firebase
if (getApps().length === 0) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    privateKey = privateKey.replace(/^["']|["']$/g, '');
    privateKey = privateKey.replace(/\\n/g, '\n');

    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
        }),
    });
}

const db = getFirestore();

// Init R2
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

async function main() {
    console.log('📦 Fetching all songs from Firestore...');
    const snapshot = await db.collection('global_songs').orderBy('title').get();
    console.log(`  Total documents: ${snapshot.size}`);

    const index = snapshot.docs
        .filter(doc => {
            const data = doc.data();
            return data.isEnabled !== false;
        })
        .map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                category: data.category,
                subcategory: data.subcategory || null,
                theme: data.theme || null,
                composer: data.composer || null,
                poet: data.poet || null,
                pdfUrl: data.pdfUrl || data.parts?.[0]?.pdfUrl || null,
                partsCount: data.parts?.length || 0,
            };
        });

    console.log(`  Enabled songs (in index): ${index.length}`);

    const liraCount = index.filter(s => s.id.startsWith('lira_')).length;
    const liraWithPdf = index.filter(s => s.id.startsWith('lira_') && s.pdfUrl).length;
    console.log(`  LIRA songs: ${liraCount} (${liraWithPdf} with PDF)`);

    console.log('\n📤 Uploading index to R2...');
    const body = JSON.stringify(index);
    console.log(`  Index size: ${(body.length / 1024).toFixed(1)} KB`);

    await r2.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || 'msc-catalog',
        Key: 'global_songs_index.json',
        Body: body,
        ContentType: 'application/json',
        CacheControl: 'no-cache',
    }));

    console.log('\n✅ Search index rebuilt successfully!');
    console.log(`   Total songs: ${index.length}`);
}

main().catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
});
