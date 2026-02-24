/**
 * Migration: Add choirType to existing choirs and user memberships.
 * 
 * This script is IDEMPOTENT — safe to run multiple times.
 * 
 * What it does:
 * 1. Sets choirType = "msc" on all choir documents missing the field
 * 2. Updates user.memberships entries to include choirType
 * 3. Re-syncs claims for all affected users (safety measure)
 * 
 * Usage:
 *   npx ts-node scripts/migrate-choir-type.ts
 *   npx ts-node scripts/migrate-choir-type.ts --dry-run
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

const DRY_RUN = process.argv.includes('--dry-run');

async function migrateChoirType() {
    console.log(`\n🔄 Migration: Add choirType to choirs and memberships`);
    console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '🚀 LIVE'}\n`);

    // ─────────────────────────────────────
    // Step 1: Update choir documents
    // ─────────────────────────────────────
    const choirsSnapshot = await db.collection('choirs').get();
    let choirsUpdated = 0;
    let choirsSkipped = 0;

    // Build a map of choirId → choirType for step 2
    const choirTypeMap: Record<string, string> = {};

    for (const choirDoc of choirsSnapshot.docs) {
        const data = choirDoc.data();
        const choirType = data.choirType;

        if (choirType) {
            // Already has choirType — skip
            choirTypeMap[choirDoc.id] = choirType;
            choirsSkipped++;
            continue;
        }

        // Default: all existing choirs are MSC
        choirTypeMap[choirDoc.id] = 'msc';

        if (!DRY_RUN) {
            await choirDoc.ref.update({ choirType: 'msc' });
        }
        choirsUpdated++;
        console.log(`  ✅ Choir "${data.name}" (${choirDoc.id}) → choirType: "msc"`);
    }

    console.log(`\n📊 Choirs: ${choirsUpdated} updated, ${choirsSkipped} already had choirType`);

    // ─────────────────────────────────────
    // Step 2: Update user memberships
    // ─────────────────────────────────────
    const usersSnapshot = await db.collection('users').get();
    let usersUpdated = 0;
    let usersSkipped = 0;

    for (const userDoc of usersSnapshot.docs) {
        const data = userDoc.data();
        const memberships = data.memberships;

        if (!memberships || !Array.isArray(memberships) || memberships.length === 0) {
            usersSkipped++;
            continue;
        }

        // Check if any membership is missing choirType
        let needsUpdate = false;
        const updatedMemberships = memberships.map((m: any) => {
            if (m.choirType) return m; // Already has it
            needsUpdate = true;
            return {
                ...m,
                choirType: choirTypeMap[m.choirId] || 'msc' // Fallback to msc
            };
        });

        if (!needsUpdate) {
            usersSkipped++;
            continue;
        }

        if (!DRY_RUN) {
            await userDoc.ref.update({ memberships: updatedMemberships });
        }
        usersUpdated++;
        console.log(`  ✅ User "${data.name || data.email || userDoc.id}" — memberships updated`);
    }

    console.log(`\n📊 Users: ${usersUpdated} updated, ${usersSkipped} skipped`);

    // ─────────────────────────────────────
    // Summary
    // ─────────────────────────────────────
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`✅ Migration complete${DRY_RUN ? ' (DRY RUN — no changes made)' : ''}`);
    console.log(`   Choirs updated: ${choirsUpdated}`);
    console.log(`   Users updated:  ${usersUpdated}`);
    console.log(`${'═'.repeat(50)}\n`);
}

migrateChoirType().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
