#!/usr/bin/env npx tsx

/**
 * LIRA.org.ua Music Import Script — Full Pipeline
 * 
 * Supports two modes:
 *   Phase 1 (metadata-only): Scrape titles, themes, categories from lira.org.ua
 *   Phase 2 (full-approved):  Download PDFs, upload to R2, link in Firestore
 * 
 * Safety:
 *   - Conservative batching (150 docs max)
 *   - 200ms fetch delay between requests
 *   - Deduplication by sourceUrl + normalizedTitle
 *   - Global kill switch via isEnabled field
 *   - Rollback support to disable/re-enable
 * 
 * Usage:
 *   node scripts/run-lira.js [options]
 * 
 * Options:
 *   --dry-run            Preview without writing
 *   --metadata-only      Phase 1: metadata import only (default)
 *   --phase2             Phase 2: download PDFs, upload to R2, update Firestore
 *   --rollback           Disable all LIRA songs (isEnabled=false, importStatus=disabled)
 *   --re-enable          Re-enable previously disabled LIRA songs
 *   --limit=N            Limit number of songs to process
 *   --letter=А           Process a single letter only
 *   --resume             (Implied by upsert/merge behavior)
 */

import 'dotenv/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { JSDOM } from 'jsdom';

// ============ CONFIGURATION ============

const LIRA_BASE = 'https://www.lira.org.ua';
const LETTERS = 'АБВГДЕЄЖЗІЙКЛМНОПРСТУФХЦЧШЩЯ'.split('');
const FETCH_DELAY_MS = 200;
const BATCH_SIZE = 50;

// ============ TYPES ============

interface LiraSongMeta {
    songId: string;
    title: string;
    rawTitle: string;
    normalizedTitle: string;
    theme: string;
    performers: string;
    category: string;
    subcategory?: string;
    keywords: string[];
    source: 'lira';
    sourceUrl: string;
    viewUrl: string;
    downloadUrl: string;
    importStatus: 'metadata-only' | 'full-approved' | 'disabled';
    isEnabled: boolean;
    externalOnly: boolean;
    parts: Array<{ name: string; pdfUrl: string }>;
    importedAt?: any;
    updatedAt?: any;
}

interface LiraFileInfo {
    fid: string;
    name: string;
    format: string;
}

interface RunSummary {
    parsedSongsCount: number;
    writtenSongsCount: number;
    updatedSongsCount: number;
    skippedSongsCount: number;
    unknownCategoryCount: number;
    duplicateCandidatesCount: number;
    failedSongsCount: number;
    uploadedFilesCount: number;
    disabledSongsCount: number;
    rollbackCount: number;
    unknownCategories: Set<string>;
    failedPages: string[];
    failedFiles: string[];
}

// ============ HELPERS ============

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^\wа-яїієґ]/gi, '').trim();
}

function generateKeywords(title: string, theme: string): string[] {
    const keywords = new Set<string>();

    const themeWords = theme.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    themeWords.forEach(w => keywords.add(w));

    // Parse bracketed original/russian titles
    const bracketedMatch = title.match(/\((.*?)\)/);
    if (bracketedMatch) {
        const brWords = bracketedMatch[1].toLowerCase().replace(/[^\wа-яїієґ]/gi, ' ').split(/\s+/).filter(w => w.length > 2);
        brWords.forEach(w => keywords.add(w));
    }

    const mainTitle = title.replace(/\(.*?\)/g, '').trim().toLowerCase();
    const titleWords = mainTitle.replace(/[^\wа-яїієґ]/gi, ' ').split(/\s+/).filter(w => w.length > 2);
    titleWords.forEach(w => keywords.add(w));

    return Array.from(keywords);
}

function cleanTitle(title: string): string {
    return title.replace(/\(.*?\)/g, '').trim();
}

function mapLiraCategory(liraPerformers: string): { category: string; subcategory?: string; unknown?: boolean } {
    const str = (liraPerformers || '').trim().toLowerCase();

    if (str.includes('дит.') || str.includes('дитячий')) return { category: 'choir', subcategory: 'children' };
    if (str === 'жіночий хор') return { category: 'choir', subcategory: 'female' };
    if (str.includes('змішаний') || str === 'загальний спів') return { category: 'choir', subcategory: 'mixed' };
    if (str.includes('молодіжний') || str.includes('підлітковий')) return { category: 'choir', subcategory: 'youth' };
    if (str === 'чоловічий хор') return { category: 'choir', subcategory: 'male' };

    if (str === 'соло') return { category: 'ensemble', subcategory: 'solo' };
    if (str === 'дует' || str === 'тріо' || str === 'квартет') return { category: 'ensemble', subcategory: 'other' };

    return { category: 'choir', subcategory: 'mixed', unknown: true };
}

function makeSongDocId(songId: string, normalizedTitle: string): string {
    return songId ? `lira_${songId}` : `lira_${normalizedTitle.slice(0, 40)}`;
}

// ============ R2 UPLOAD ============

function initR2(): S3Client {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
        console.error('❌ Missing R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).');
        process.exit(1);
    }
    return new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
    });
}

async function uploadPdfToR2(r2: S3Client, songId: string, fid: string, pdfBuffer: Buffer): Promise<string> {
    const bucket = process.env.R2_BUCKET_NAME || 'msc-catalog';
    const key = `archive/lira/${songId}/${fid}.pdf`;
    const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';

    await r2.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        CacheControl: 'public, max-age=31536000',
    }));

    return `${publicBase}/${key}`;
}

// ============ FIREBASE ============

function initFirestore() {
    if (getApps().length === 0) {
        if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
            console.error('❌ Missing FIREBASE env vars (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY).');
            process.exit(1);
        }
        // Private key comes from .env.local with literal \\n and possibly wrapped in quotes
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        // Strip surrounding quotes if present
        privateKey = privateKey.replace(/^["']|["']$/g, '');
        // Convert literal \n to real newlines
        privateKey = privateKey.replace(/\\n/g, '\n');

        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey,
            }),
        });
    }
    return getFirestore();
}

// ============ SCRAPER: PHASE 1 — LIST PAGES ============

async function scrapeLetter(letter: string, summary: RunSummary, limit?: number): Promise<LiraSongMeta[]> {
    const url = `${LIRA_BASE}/content.php?ch=${encodeURIComponent(letter)}`;
    console.log(`\n📄 Fetching songs for letter: ${letter}`);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();

        const dom = new JSDOM(html);
        const rows = Array.from(dom.window.document.querySelectorAll('tr.list-content'));

        const songs: LiraSongMeta[] = [];
        let parsed = 0;

        for (const row of rows) {
            if (limit && summary.parsedSongsCount >= limit) break;

            const cells = row.querySelectorAll('td');
            if (cells.length < 5) continue;

            const idCell = cells[0];
            const songId = idCell.getAttribute('id');
            const rawTitle = idCell.textContent?.trim() || '';
            const title = cleanTitle(rawTitle);

            const theme = cells[1].textContent?.trim() || '';
            const performers = cells[2].textContent?.trim() || '';

            if (!songId || !title) {
                summary.failedSongsCount++;
                continue;
            }

            const catMap = mapLiraCategory(performers);
            if (catMap.unknown) {
                summary.unknownCategoryCount++;
                summary.unknownCategories.add(performers);
            }

            const sourceUrl = `${LIRA_BASE}/show-note.php?nid=${songId}`;
            const viewUrl = `${LIRA_BASE}/open-pdf.php?nid=${songId}`;
            const downloadUrl = `${LIRA_BASE}/load-note.php?nid=${songId}`;

            songs.push({
                songId,
                title,
                rawTitle,
                normalizedTitle: normalizeTitle(title),
                theme,
                performers,
                category: catMap.category,
                subcategory: catMap.subcategory,
                keywords: generateKeywords(rawTitle, theme),
                source: 'lira',
                sourceUrl,
                viewUrl,
                downloadUrl,
                importStatus: 'metadata-only',
                isEnabled: true,
                externalOnly: false,
                parts: [],
            });

            summary.parsedSongsCount++;
            parsed++;
        }

        console.log(`  Parsed ${parsed} songs.`);
        await delay(FETCH_DELAY_MS);
        return songs;

    } catch (e: any) {
        console.error(`❌ Error fetching letter ${letter}:`, e.message);
        summary.failedPages.push(`letter:${letter}`);
        return [];
    }
}

// ============ SCRAPER: PHASE 2 — DETAIL PAGES + PDF DOWNLOAD ============

async function fetchSongFiles(songId: string, summary: RunSummary): Promise<LiraFileInfo[]> {
    const url = `${LIRA_BASE}/show-note.php?nid=${songId}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();

        const dom = new JSDOM(html);
        const doc = dom.window.document;

        // Find file rows: <TD class='list-content-header file' id='{fid}'>pdf ...</TD>
        const fileCells = Array.from(doc.querySelectorAll('td.list-content-header.file'));
        const files: LiraFileInfo[] = [];

        for (const cell of fileCells) {
            const fid = cell.getAttribute('id');
            // The cell text looks like: "pdf (6/4)" — extract just the format
            const rawText = cell.textContent?.trim() || '';
            const format = rawText.split(/\s/)[0].toLowerCase();
            if (!fid || format !== 'pdf') continue;

            // Get the name from the sibling cell: <TD id='{fid}'><b>Name</b></TD>
            const nameCell = cell.nextElementSibling;
            let name = 'Партитура';
            if (nameCell) {
                const boldEl = nameCell.querySelector('b');
                name = boldEl?.textContent?.trim() || nameCell.textContent?.trim() || name;
            }

            files.push({ fid, name, format });
        }

        await delay(FETCH_DELAY_MS);
        return files;

    } catch (e: any) {
        console.error(`  ⚠️ Failed to fetch detail page for song ${songId}:`, e.message);
        summary.failedPages.push(`detail:${songId}`);
        return [];
    }
}

async function downloadPdf(fid: string, summary: RunSummary): Promise<Buffer | null> {
    const url = `${LIRA_BASE}/download.php?fid=${fid}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Basic sanity: PDF files start with %PDF
        if (buffer.length < 10 || buffer.slice(0, 4).toString() !== '%PDF') {
            console.warn(`  ⚠️ File fid=${fid} does not look like a valid PDF (${buffer.length}b). Skipping.`);
            summary.failedFiles.push(`fid:${fid}:invalid`);
            return null;
        }

        return buffer;

    } catch (e: any) {
        console.error(`  ⚠️ Failed to download PDF fid=${fid}:`, e.message);
        summary.failedFiles.push(`fid:${fid}:${e.message}`);
        return null;
    }
}

// ============ IMPORT MODES ============

async function importMetadata(songs: LiraSongMeta[], dryRun: boolean, summary: RunSummary) {
    if (dryRun) {
        console.log('\n=== DRY RUN OUTPUT SAMPLES ===');
        songs.slice(0, 5).forEach((s, i) => {
            console.log(`\n${i + 1}. ${s.title}`);
            console.log(`   Source: ${s.sourceUrl}`);
            console.log(`   Category: ${s.category}/${s.subcategory}`);
            console.log(`   Keywords: ${s.keywords.join(', ')}`);
            console.log(`   isEnabled: ${s.isEnabled}`);
        });
        if (songs.length > 5) console.log(`\n...and ${songs.length - 5} more.`);
        return;
    }

    const db = initFirestore();
    console.log(`\n📝 Writing ${songs.length} metadata records to Firestore (batch-safe)...`);

    let batch = db.batch();
    let batchCount = 0;

    for (const song of songs) {
        const docId = makeSongDocId(song.songId, song.normalizedTitle);
        const docRef = db.collection('global_songs').doc(docId);

        // Don't overwrite parts if they already exist (Phase 2 may have run before)
        const { songId: _sid, rawTitle: _rt, performers: _perf, ...firestoreData } = song;

        batch.set(docRef, {
            ...firestoreData,
            importedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        }, { merge: true });

        summary.writtenSongsCount++;
        batchCount++;

        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`  ✅ Committed batch of ${BATCH_SIZE}...`);
            batch = db.batch();
            batchCount = 0;
            await delay(100);
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        console.log(`  ✅ Committed final batch of ${batchCount}.`);
    }
}

async function importPhase2(songs: LiraSongMeta[], dryRun: boolean, summary: RunSummary) {
    const r2 = initR2();
    const db = dryRun ? null : initFirestore();

    console.log(`\n🔗 Phase 2: Downloading PDFs and uploading to R2 for ${songs.length} songs...`);

    let batch = db ? db.batch() : null;
    let batchCount = 0;

    for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        const progress = `[${i + 1}/${songs.length}]`;

        // Step 1: Fetch the detail page to find attached PDFs
        const files = await fetchSongFiles(song.songId, summary);

        if (files.length === 0) {
            console.log(`  ${progress} ${song.title} — no PDF files found. Skipping.`);
            summary.skippedSongsCount++;
            continue;
        }

        // Step 2: Download each PDF and upload to R2
        const parts: Array<{ name: string; pdfUrl: string }> = [];

        for (const file of files) {
            if (dryRun) {
                console.log(`  ${progress} [DRY] Would download fid=${file.fid} "${file.name}"`);
                parts.push({ name: file.name, pdfUrl: `[dry-run] archive/lira/${song.songId}/${file.fid}.pdf` });
                summary.uploadedFilesCount++;
                continue;
            }

            const pdfBuffer = await downloadPdf(file.fid, summary);
            if (!pdfBuffer) continue;

            try {
                const r2Url = await uploadPdfToR2(r2, song.songId, file.fid, pdfBuffer);
                parts.push({ name: file.name, pdfUrl: r2Url });
                summary.uploadedFilesCount++;
                console.log(`  ${progress} ✅ ${file.name} → R2 (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
            } catch (e: any) {
                console.error(`  ${progress} ❌ R2 upload failed for fid=${file.fid}:`, e.message);
                summary.failedFiles.push(`r2:${file.fid}:${e.message}`);
            }

            await delay(FETCH_DELAY_MS);
        }

        // Step 3: Update Firestore with parts and importStatus
        if (!dryRun && parts.length > 0 && db && batch) {
            const docId = makeSongDocId(song.songId, song.normalizedTitle);
            const docRef = db.collection('global_songs').doc(docId);

            batch.update(docRef, {
                parts,
                importStatus: 'full-approved',
                isEnabled: true,
                updatedAt: Timestamp.now(),
            });

            summary.updatedSongsCount++;
            batchCount++;

            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`  ✅ Committed Firestore batch of ${BATCH_SIZE}...`);
                batch = db.batch();
                batchCount = 0;
                await delay(100);
            }
        } else if (dryRun && parts.length > 0) {
            console.log(`  ${progress} [DRY] Would update ${song.title} with ${parts.length} part(s)`);
            summary.updatedSongsCount++;
        }
    }

    // Commit remaining
    if (!dryRun && batchCount > 0 && batch) {
        await batch.commit();
        console.log(`  ✅ Committed final Firestore batch of ${batchCount}.`);
    }
}

async function rollback(dryRun: boolean, summary: RunSummary) {
    const db = initFirestore();
    console.log('\n🔄 Rolling back all LIRA songs...');

    const snapshot = await db.collection('global_songs')
        .where('source', '==', 'lira')
        .get();

    console.log(`  Found ${snapshot.size} LIRA songs.`);

    if (dryRun) {
        console.log(`  [DRY] Would disable ${snapshot.size} songs.`);
        summary.rollbackCount = snapshot.size;
        return;
    }

    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        batch.update(doc.ref, {
            isEnabled: false,
            importStatus: 'disabled',
            parts: [],  // Clear PDF references
            updatedAt: Timestamp.now(),
        });

        summary.disabledSongsCount++;
        summary.rollbackCount++;
        batchCount++;

        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`  ✅ Disabled batch of ${BATCH_SIZE}...`);
            batch = db.batch();
            batchCount = 0;
            await delay(100);
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        console.log(`  ✅ Disabled final batch of ${batchCount}.`);
    }

    console.log(`  🛑 All LIRA songs are now disabled. Run with --re-enable to restore.`);
}

async function reEnable(dryRun: boolean, summary: RunSummary) {
    const db = initFirestore();
    console.log('\n♻️ Re-enabling all disabled LIRA songs...');

    const snapshot = await db.collection('global_songs')
        .where('source', '==', 'lira')
        .where('isEnabled', '==', false)
        .get();

    console.log(`  Found ${snapshot.size} disabled LIRA songs.`);

    if (dryRun) {
        console.log(`  [DRY] Would re-enable ${snapshot.size} songs.`);
        return;
    }

    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        // Re-enable, but set importStatus based on whether it has parts
        const hasContent = data.parts && data.parts.length > 0;

        batch.update(doc.ref, {
            isEnabled: true,
            importStatus: hasContent ? 'full-approved' : 'metadata-only',
            updatedAt: Timestamp.now(),
        });

        batchCount++;

        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`  ✅ Re-enabled batch of ${BATCH_SIZE}...`);
            batch = db.batch();
            batchCount = 0;
            await delay(100);
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        console.log(`  ✅ Re-enabled final batch of ${batchCount}.`);
    }

    console.log(`  ✅ ${snapshot.size} LIRA songs re-enabled.`);
}

// ============ MAIN ============

async function main() {
    const args = process.argv.slice(2);

    const dryRun = args.includes('--dry-run');
    const isPhase2 = args.includes('--phase2');
    const isRollback = args.includes('--rollback');
    const isReEnable = args.includes('--re-enable');
    const metadataOnly = args.includes('--metadata-only') || (!isPhase2 && !isRollback && !isReEnable);

    let limit: number | undefined;
    const limitMatch = args.find(a => a.startsWith('--limit='));
    if (limitMatch) limit = parseInt(limitMatch.split('=')[1]);

    let targetLetter: string | undefined;
    const letterMatch = args.find(a => a.startsWith('--letter='));
    if (letterMatch) targetLetter = letterMatch.split('=')[1];

    const summary: RunSummary = {
        parsedSongsCount: 0,
        writtenSongsCount: 0,
        updatedSongsCount: 0,
        skippedSongsCount: 0,
        unknownCategoryCount: 0,
        duplicateCandidatesCount: 0,
        failedSongsCount: 0,
        uploadedFilesCount: 0,
        disabledSongsCount: 0,
        rollbackCount: 0,
        unknownCategories: new Set(),
        failedPages: [],
        failedFiles: [],
    };

    console.log('🎵 LIRA Import Pipeline');
    if (isRollback) {
        console.log(`Mode: ROLLBACK ${dryRun ? '(DRY-RUN)' : '(LIVE)'}`);
        await rollback(dryRun, summary);
    } else if (isReEnable) {
        console.log(`Mode: RE-ENABLE ${dryRun ? '(DRY-RUN)' : '(LIVE)'}`);
        await reEnable(dryRun, summary);
    } else {
        const mode = isPhase2 ? 'PHASE 2 (Full PDFs)' : 'PHASE 1 (Metadata)';
        console.log(`Mode: ${mode} ${dryRun ? '(DRY-RUN)' : '(LIVE)'}`);
        if (limit) console.log(`Limit: ${limit} songs`);
        if (targetLetter) console.log(`Letter: ${targetLetter}`);

        try {
            const lettersToScrape = targetLetter ? [targetLetter] : LETTERS;
            let allSongs: LiraSongMeta[] = [];

            for (const letter of lettersToScrape) {
                if (limit && summary.parsedSongsCount >= limit) break;
                const songs = await scrapeLetter(letter, summary, limit);
                allSongs.push(...songs);
            }

            if (limit && allSongs.length > limit) {
                allSongs = allSongs.slice(0, limit);
            }

            // Phase 1: Always write metadata first
            await importMetadata(allSongs, dryRun, summary);

            // Phase 2: Fetch PDFs, upload to R2, update Firestore
            if (isPhase2) {
                await importPhase2(allSongs, dryRun, summary);
            }
        } catch (e) {
            console.error('\n❌ Fatal error:', e);
            process.exit(1);
        }
    }

    // ============ FINAL REPORT ============
    console.log('\n📊 IMPORT SUMMARY:');
    console.log(`  Parsed:              ${summary.parsedSongsCount}`);
    console.log(`  Written (metadata):  ${summary.writtenSongsCount}`);
    console.log(`  Updated (phase2):    ${summary.updatedSongsCount}`);
    console.log(`  Skipped (no PDF):    ${summary.skippedSongsCount}`);
    console.log(`  Uploaded files:      ${summary.uploadedFilesCount}`);
    console.log(`  Unknown categories:  ${summary.unknownCategoryCount}`);
    console.log(`  Disabled (rollback): ${summary.disabledSongsCount}`);
    console.log(`  Rollback count:      ${summary.rollbackCount}`);
    console.log(`  Failed songs:        ${summary.failedSongsCount}`);

    if (summary.unknownCategories.size > 0) {
        console.log(`  Unknown values: ${Array.from(summary.unknownCategories).join(', ')}`);
    }
    if (summary.failedPages.length > 0) {
        console.log(`  Failed pages: ${summary.failedPages.join(', ')}`);
    }
    if (summary.failedFiles.length > 0) {
        console.log(`  Failed files: ${summary.failedFiles.join(', ')}`);
    }

    console.log('\n✅ Done.');
}

main();
