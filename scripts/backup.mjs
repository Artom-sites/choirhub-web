#!/usr/bin/env node
/**
 * Firestore Backup Script
 * 
 * Exports all Firestore collections to JSON and uploads to R2.
 * Run weekly via GitHub Actions.
 * 
 * Usage: node scripts/backup.mjs
 * 
 * Required env vars:
 * - FIREBASE_SERVICE_ACCOUNT (JSON string of service account)
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Config
const BACKUP_RETENTION_DAYS = 14;
const COLLECTIONS_TO_BACKUP = ['choirs', 'users'];

// Initialize Firebase Admin
function initFirebase() {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
        credential: cert(serviceAccount)
    });
    return getFirestore();
}

// Initialize R2 Client
function initR2() {
    return new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });
}

// Recursively fetch all documents from a collection (including subcollections)
async function backupCollection(db, collectionPath) {
    const snapshot = await db.collection(collectionPath).get();
    const data = [];

    for (const doc of snapshot.docs) {
        const docData = {
            id: doc.id,
            data: doc.data(),
            subcollections: {}
        };

        // Get subcollections for this document
        const subcollections = await doc.ref.listCollections();
        for (const subcol of subcollections) {
            const subcolPath = `${collectionPath}/${doc.id}/${subcol.id}`;
            docData.subcollections[subcol.id] = await backupCollection(db, subcolPath);
        }

        data.push(docData);
    }

    return data;
}

// Upload backup to R2
async function uploadToR2(r2, data, filename) {
    const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `backups/${filename}`,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
    });

    await r2.send(command);
    console.log(`✅ Uploaded backup: backups/${filename}`);
}

// Delete old backups (older than BACKUP_RETENTION_DAYS)
async function cleanupOldBackups(r2) {
    const listCommand = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: 'backups/',
    });

    const response = await r2.send(listCommand);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);

    if (!response.Contents) {
        console.log('No existing backups found.');
        return;
    }

    for (const object of response.Contents) {
        if (object.LastModified && object.LastModified < cutoffDate) {
            const deleteCommand = new DeleteObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: object.Key,
            });
            await r2.send(deleteCommand);
            console.log(`🗑️ Deleted old backup: ${object.Key}`);
        }
    }
}

// Main backup function
async function main() {
    console.log('🚀 Starting Firestore backup...');
    console.log(`📅 Date: ${new Date().toISOString()}`);

    // Initialize services
    const db = initFirebase();
    const r2 = initR2();

    // Backup all collections
    const backup = {
        timestamp: new Date().toISOString(),
        collections: {}
    };

    for (const collection of COLLECTIONS_TO_BACKUP) {
        console.log(`📦 Backing up collection: ${collection}`);
        backup.collections[collection] = await backupCollection(db, collection);
        console.log(`   └── ${backup.collections[collection].length} documents`);
    }

    // Generate filename with date
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `backup-${date}.json`;

    // Upload to R2
    await uploadToR2(r2, backup, filename);

    // Cleanup old backups
    console.log('\n🧹 Cleaning up old backups...');
    await cleanupOldBackups(r2);

    console.log('\n✨ Backup completed successfully!');
}

main().catch((error) => {
    console.error('❌ Backup failed:', error);
    process.exit(1);
});
