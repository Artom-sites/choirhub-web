import { openDB, DBSchema } from 'idb';

interface PDFCacheDB extends DBSchema {
    pdfs: {
        key: string;
        value: {
            url: string;
            blob: Blob;
            timestamp: number;
        };
    };
}

const DB_NAME = 'choir-pdf-cache';
const STORE_NAME = 'pdfs';

async function getDB() {
    return openDB<PDFCacheDB>(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'url' });
            }
        },
    });
}

export async function savePdfToCache(url: string, blob: Blob): Promise<void> {
    try {
        const db = await getDB();
        await db.put(STORE_NAME, {
            url,
            blob,
            timestamp: Date.now()
        });
        console.log(`[Cache] Saved PDF: ${url}`);
    } catch (error) {
        console.error("[Cache] Failed to save PDF:", error);
    }
}

export async function getPdfFromCache(url: string): Promise<Blob | null> {
    try {
        const db = await getDB();
        const entry = await db.get(STORE_NAME, url);
        if (entry) {
            console.log(`[Cache] Hit for: ${url}`);
            return entry.blob;
        }
        return null;
    } catch (error) {
        console.error("[Cache] Failed to get PDF:", error);
        return null;
    }
}

export async function clearOldCache(maxAgeDays: number = 30): Promise<void> {
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const entries = await store.getAll();

        const now = Date.now();
        const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

        for (const entry of entries) {
            if (now - entry.timestamp > maxAge) {
                await store.delete(entry.url);
            }
        }
        await tx.done;
    } catch (error) {
        console.error("[Cache] Failed to cleanup:", error);
    }
}
