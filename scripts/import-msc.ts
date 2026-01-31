#!/usr/bin/env npx tsx

/**
 * MSC Music Import Script
 * 
 * Fetches all musical works from mscmusic.org API and imports them into Firestore.
 * 
 * Usage:
 *   npx tsx scripts/import-msc.ts [options]
 * 
 * Options:
 *   --dry-run       Preview what would be imported without writing to Firestore
 *   --category      Filter by category: choir, ensemble, orchestra (default: all)
 *   --limit         Limit number of items to import (default: all)
 *   --verbose       Show detailed output
 * 
 * API Reference:
 *   - List works: /api/works?pageNum=1&pageSize=300&sortBy=titleLower&sortDir=ASC
 *   - Filter by vocals: &vocals=choir_mixed
 *   - Work details: /api/works/{idx}
 *   - File downloads: /files/{idx}/{file_location}
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, Timestamp, writeBatch } from 'firebase/firestore';

// ============ CONFIGURATION ============

const MSC_API_BASE = 'https://mscmusic.org/api';
const MSC_FILES_BASE = 'https://mscmusic.org/files';
const PAGE_SIZE = 300;

// Mapping MSC vocals to our categories
const VOCALS_TO_CATEGORY: Record<string, { category: string; subcategory?: string }> = {
    'choir_mixed': { category: 'choir', subcategory: 'mixed' },
    'choir_men': { category: 'choir', subcategory: 'male' },
    'choir_women': { category: 'choir', subcategory: 'female' },
    'choir_youth': { category: 'choir', subcategory: 'youth' },
    'choir_kids': { category: 'choir', subcategory: 'children' },
    'choir_mixed_kids': { category: 'choir', subcategory: 'children' },
};

const INSTRUMENTS_TO_CATEGORY: Record<string, { category: string; subcategory?: string }> = {
    // Orchestra
    'symphonic_band': { category: 'orchestra', subcategory: 'symphonic' },
    'brass_band': { category: 'orchestra', subcategory: 'wind' },
    'brass_band_kids': { category: 'orchestra', subcategory: 'wind' },
    'orni_adults': { category: 'orchestra', subcategory: 'folk' },
    'orni_kids': { category: 'orchestra', subcategory: 'folk' },

    // Ensemble
    'chamber_ensemble': { category: 'orchestra', subcategory: 'chamber' }, // Mapped to orchestra > chamber in UI
    'chamber_ensemble_kids': { category: 'orchestra', subcategory: 'chamber' },
    'brass_ensemble': { category: 'ensemble', subcategory: 'brass' },
    'erni': { category: 'ensemble', subcategory: 'folk' },
    'guitar_ensemble': { category: 'ensemble', subcategory: 'guitar' },
    // others: 'string_quartet' etc might exist but weren't in the list
};

// ============ TYPES ============

interface MSCWork {
    id: number;
    idx: string;
    title: string;
    titleOriginal?: string;
    vocals?: Array<{ id: string; title: string }>;
    instruments?: Array<{ id: string; title: string }>;
    composers?: Array<{ id: number; fullName: string }>;
    lyricists?: Array<{ id: number; fullName: string }>;
    topics?: Array<{ id: string; title: string }>;
    files?: Array<{ name: string; format: string; location: string }>;
    publishYear?: number;
}

interface MSCListResponse {
    content: MSCWork[];
    totalElements: number;
    totalPages: number;
    number: number;  // current page
}

interface GlobalSong {
    title: string;
    composer?: string;
    category: string;
    subcategory?: string;
    keywords: string[];
    parts: Array<{ name: string; pdfUrl: string }>;
    sourceUrl: string;
    sourceId: string;  // MSC idx for reference
    createdAt?: any;
    updatedAt?: any;
}

// ============ HELPERS ============

function generateKeywords(work: MSCWork): string[] {
    const keywords = new Set<string>();

    // Title words (lowercase, remove punctuation)
    const titleWords = (work.title || '').toLowerCase()
        .replace(/[^\wа-яїієґ\s]/gi, '')
        .split(/\s+/)
        .filter(w => w.length > 2);
    titleWords.forEach(w => keywords.add(w));

    // Original title words
    if (work.titleOriginal) {
        const origWords = work.titleOriginal.toLowerCase()
            .replace(/[^\wа-яїієґ\s]/gi, '')
            .split(/\s+/)
            .filter(w => w.length > 2);
        origWords.forEach(w => keywords.add(w));
    }

    // Composer names (first and last name)
    work.composers?.forEach(c => {
        const names = c.fullName.toLowerCase().split(/\s+/);
        names.forEach(n => keywords.add(n));
    });

    // Topics
    work.topics?.forEach(t => {
        keywords.add(t.title.toLowerCase());
    });

    return Array.from(keywords);
}

function determineCategoryFromWork(work: MSCWork): { category: string; subcategory?: string } | null {
    // Check vocals first (for choirs)
    if (work.vocals && work.vocals.length > 0) {
        for (const vocal of work.vocals) {
            if (VOCALS_TO_CATEGORY[vocal.id]) {
                return VOCALS_TO_CATEGORY[vocal.id];
            }
        }
    }

    // Check instruments (for orchestras/ensembles)
    if (work.instruments && work.instruments.length > 0) {
        for (const inst of work.instruments) {
            if (INSTRUMENTS_TO_CATEGORY[inst.id]) {
                return INSTRUMENTS_TO_CATEGORY[inst.id];
            }
        }
    }

    return null;
}

function convertWorkToGlobalSong(work: MSCWork): GlobalSong | null {
    // Only import songs with Cyrillic titles
    const hasCyrillicTitle = /^[\u0400-\u04FF]/.test(work.title?.trim() || '');
    if (!hasCyrillicTitle) {
        return null;  // Skip Latin titles
    }

    const categoryInfo = determineCategoryFromWork(work);
    if (!categoryInfo) {
        return null;  // Skip works without matching category
    }

    // Build parts from PDF files only
    const parts = (work.files || [])
        .filter(f => f.format === 'pdf')
        .map(f => ({
            name: f.name || work.title,
            pdfUrl: `${MSC_FILES_BASE}/${work.idx}/${encodeURIComponent(f.location)}`
        }));

    // Only import songs that have PDF files
    if (parts.length === 0) {
        return null;
    }

    return {
        title: work.title,
        composer: work.composers?.map(c => c.fullName).join(', '),
        category: categoryInfo.category,
        subcategory: categoryInfo.subcategory,
        keywords: generateKeywords(work),
        parts,
        sourceUrl: `https://mscmusic.org/works/${work.idx}`,
        sourceId: work.idx,
    };
}

// ============ API FUNCTIONS ============

async function fetchWorks(pageNum: number, vocalFilter?: string, instrumentFilter?: string): Promise<MSCListResponse> {
    const params = new URLSearchParams({
        pageNum: pageNum.toString(),
        pageSize: PAGE_SIZE.toString(),
        sortBy: 'titleLower',
        sortDir: 'ASC',
    });

    if (vocalFilter) {
        params.append('vocals', vocalFilter);
    }
    if (instrumentFilter) {
        params.append('instruments', instrumentFilter);
    }

    const url = `${MSC_API_BASE}/works?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch works: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch detailed info for a single work (includes full file list)
 * The list API doesn't return complete file data, so we need this for PDF info
 */
async function fetchWorkDetails(idx: string): Promise<MSCWork> {
    const url = `${MSC_API_BASE}/works/${idx}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch work ${idx}: ${response.status}`);
    }

    return response.json();
}

async function fetchAllWorks(categoryFilter?: string, limit?: number, verbose = false): Promise<MSCWork[]> {
    const allWorks: MSCWork[] = [];
    const seenIds = new Set<string>();  // Deduplicate

    // Build list of filters to run
    const fetchConfigs: Array<{ vocal?: string; instrument?: string }> = [];

    // 1. Choir (Vocals)
    if (!categoryFilter || categoryFilter === 'choir') {
        Object.keys(VOCALS_TO_CATEGORY).forEach(v => fetchConfigs.push({ vocal: v }));
    }

    // 2. Orchestra & Ensemble (Instruments)
    if (!categoryFilter || categoryFilter === 'orchestra' || categoryFilter === 'ensemble') {
        Object.entries(INSTRUMENTS_TO_CATEGORY).forEach(([instKey, info]) => {
            // Apply category filter if present
            if (!categoryFilter || info.category === categoryFilter) {
                fetchConfigs.push({ instrument: instKey });
            }
        });
    }

    if (fetchConfigs.length === 0) {
        console.warn('⚠️ No filters matched. Use --category [choir|orchestra|ensemble] or leave empty for all.');
        return [];
    }

    for (const config of fetchConfigs) {
        let pageNum = 1;
        let hasMore = true;

        const filterName = config.vocal ? `vocal=${config.vocal}` : `instrument=${config.instrument}`;

        while (hasMore) {
            if (verbose) {
                console.log(`Fetching page ${pageNum} (filter: ${filterName})...`);
            }

            const response = await fetchWorks(pageNum, config.vocal, config.instrument);

            // Deduplicate
            for (const work of response.content) {
                if (!seenIds.has(work.idx)) {
                    seenIds.add(work.idx);
                    allWorks.push(work);
                }
            }

            if (verbose) {
                console.log(`  Got ${response.content.length} items, unique total: ${allWorks.length}`);
            }

            // Check if we've reached the limit
            if (limit && allWorks.length >= limit) {
                if (verbose) {
                    console.log(`Reached limit of ${limit} items`);
                }
                return allWorks.slice(0, limit);
            }

            // Check if there are more pages
            hasMore = pageNum < response.totalPages;
            pageNum++;

            // Rate limiting - small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return allWorks;
}

// Firebase configuration (same as lib/firebase.ts)
const firebaseConfig = {
    apiKey: "AIzaSyCPBASol-Zd6dLF3XsRNTUFTMyJMptFJRA",
    authDomain: "choirhub-8bfa2.firebaseapp.com",
    projectId: "choirhub-8bfa2",
    storageBucket: "choirhub-8bfa2.firebasestorage.app",
    messagingSenderId: "536668000416",
    appId: "1:536668000416:web:3a35d3674134409d2eb9c5"
};

function initFirestore() {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    return getFirestore(app);
}

async function importToFirestore(songs: GlobalSong[], dryRun = false, verbose = false) {
    if (dryRun) {
        console.log('\n=== DRY RUN MODE ===\n');
        console.log(`Would import ${songs.length} songs to global_songs collection\n`);

        // Show first 10 as sample
        songs.slice(0, 10).forEach((song, i) => {
            console.log(`${i + 1}. ${song.title}`);
            console.log(`   Composer: ${song.composer || 'Unknown'}`);
            console.log(`   Category: ${song.category}/${song.subcategory || '-'}`);
            console.log(`   Parts: ${song.parts.length}`);
            console.log(`   Keywords: ${song.keywords.slice(0, 5).join(', ')}${song.keywords.length > 5 ? '...' : ''}`);
            console.log('');
        });

        if (songs.length > 10) {
            console.log(`... and ${songs.length - 10} more`);
        }

        return;
    }

    const db = initFirestore();
    let batch = writeBatch(db);
    let batchCount = 0;
    let totalImported = 0;

    console.log(`\nImporting ${songs.length} songs to Firestore...\n`);

    for (const song of songs) {
        // Use sourceId as document ID for deduplication
        const docRef = doc(collection(db, 'global_songs'), song.sourceId);

        batch.set(docRef, {
            ...song,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        }, { merge: true });  // merge to update existing

        batchCount++;
        totalImported++;

        // Firestore batch limit is 500
        if (batchCount >= 400) {
            if (verbose) {
                console.log(`Committing batch of ${batchCount} documents...`);
            }
            await batch.commit();
            batch = writeBatch(db);  // Create new batch
            batchCount = 0;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        if (verbose) {
            console.log(`Committing final batch of ${batchCount} documents...`);
        }
        await batch.commit();
    }

    console.log(`\n✅ Successfully imported ${totalImported} songs!`);
}

// ============ MAIN ============

async function main() {
    const args = process.argv.slice(2);

    const dryRun = args.includes('--dry-run');
    const verbose = args.includes('--verbose');

    let categoryFilter: string | undefined;
    const categoryIndex = args.indexOf('--category');
    if (categoryIndex !== -1 && args[categoryIndex + 1]) {
        categoryFilter = args[categoryIndex + 1];
    }

    let limit: number | undefined;
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && args[limitIndex + 1]) {
        limit = parseInt(args[limitIndex + 1]);
    }

    console.log('🎵 MSC Music Import Script\n');
    console.log('Options:');
    console.log(`  - Dry run: ${dryRun}`);
    console.log(`  - Category filter: ${categoryFilter || 'all'}`);
    console.log(`  - Limit: ${limit || 'no limit'}`);
    console.log(`  - Verbose: ${verbose}`);
    console.log('');

    try {
        // Step 1: Fetch all works from MSC (basic info only)
        console.log('📥 Fetching works list from mscmusic.org...\n');
        const basicWorks = await fetchAllWorks(categoryFilter, limit, verbose);
        console.log(`\nFetched ${basicWorks.length} works from MSC API\n`);

        // Step 2: Fetch detailed info for each work (to get full file list)
        console.log('📄 Fetching detailed info for each work...\n');
        const songs: GlobalSong[] = [];
        let skipped = 0;
        let processed = 0;

        for (const basicWork of basicWorks) {
            try {
                // Fetch full details to get PDF files
                const work = await fetchWorkDetails(basicWork.idx);
                processed++;

                if (verbose && processed % 50 === 0) {
                    console.log(`  Processed ${processed}/${basicWorks.length}...`);
                }

                const song = convertWorkToGlobalSong(work);
                if (song) {
                    // Apply category filter if specified
                    if (!categoryFilter || song.category === categoryFilter) {
                        songs.push(song);
                    } else {
                        skipped++;
                    }
                } else {
                    skipped++;
                }

                // Rate limiting - small delay between requests
                await new Promise(resolve => setTimeout(resolve, 50));

            } catch (err) {
                console.warn(`  ⚠️ Failed to fetch ${basicWork.idx}: ${err}`);
                skipped++;
            }
        }

        console.log(`\nConverted: ${songs.length} songs`);
        console.log(`Skipped: ${skipped} (no matching category or no PDF)\n`);

        // Step 3: Import to Firestore
        await importToFirestore(songs, dryRun, verbose);

        // Step 4: Summary by category
        console.log('\n📊 Summary by category:');
        const summary: Record<string, number> = {};
        for (const song of songs) {
            const key = `${song.category}/${song.subcategory || 'other'}`;
            summary[key] = (summary[key] || 0) + 1;
        }
        Object.entries(summary).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
            console.log(`  ${key}: ${count}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
