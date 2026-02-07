#!/usr/bin/env npx tsx

/**
 * Script to export Global Songs to a single JSON index file.
 * Uploads directly to Cloudflare R2 as `global_songs_index.json`.
 * 
 * FEATURES:
 * - Uses Firebase Admin SDK (Bypasses Firestore Rules!)
 * - Uploads directly to R2 (No manual upload needed)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// ============ CONFIGURATION ============

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

// Firebase Admin Config
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Handle newlines in private key
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

// ============ INITIALIZATION ============

if (!serviceAccount.privateKey) {
    console.error("❌ Missing FIREBASE_PRIVATE_KEY in .env.local");
    process.exit(1);
}

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error("❌ Missing R2 credentials in .env.local");
    process.exit(1);
}

// Init Firebase Admin
if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}
const db = getFirestore();

// Init S3 Client (R2)
const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
});

// ============ MAIN ============

async function main() {
    try {
        console.log("📥 Fetching global songs from Firestore (Admin SDK)...");

        const snapshot = await db.collection('global_songs').get();
        if (snapshot.empty) {
            console.log("⚠️ No songs found in 'global_songs' collection.");
            return;
        }

        const songs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert timestamps to ISO strings if needed, or keep as is
            // Client expects standard JSON. Firestore Timestamps need conversion.
            createdAt: (doc.data().createdAt as any)?.toDate ? (doc.data().createdAt as any).toDate().toISOString() : doc.data().createdAt,
            updatedAt: (doc.data().updatedAt as any)?.toDate ? (doc.data().updatedAt as any).toDate().toISOString() : doc.data().updatedAt,
        }));

        console.log(`✅ Fetched ${songs.length} songs.`);

        // Convert to JSON
        const jsonContent = JSON.stringify(songs);

        // Upload to R2
        console.log("bs Uploading to R2...");

        await S3.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: "global_songs_index.json",
            Body: jsonContent,
            ContentType: "application/json",
            // Public access is handled by bucket policy or custom domain
        }));

        console.log("✅ Successfully uploaded 'global_songs_index.json' to R2!");
        console.log("🚀 The app should now use R2 index automatically.");

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main();
