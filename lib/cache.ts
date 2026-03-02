import { openDB, DBSchema } from 'idb';
import { getPdf as getOfflinePdf } from './offlineDb';

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

export async function getBase64FromBlob(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error("Failed to read blob as base64"));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Intercepts URLs for native viewers. Returns base64 or original URL.
export async function resolvePdfUrlToBase64(url: string, songId?: string): Promise<string> {
    // Priority 1: Data URLs are ready to go
    if (url.startsWith('data:')) return url;

    // Priority 2: Precise URL cache
    const cachedBlob = await getPdfFromCache(url);
    if (cachedBlob) {
        return await getBase64FromBlob(cachedBlob);
    }

    // Priority 3: Fallback to song-level IndexedDB cache
    if (songId) {
        const offlinePdfStr = await getOfflinePdf(songId);
        // offlinePdf returns a blob URL which we just fetch back as blob
        if (offlinePdfStr && offlinePdfStr.startsWith('blob:')) {
            try {
                const res = await fetch(offlinePdfStr);
                const blob = await res.blob();
                return await getBase64FromBlob(blob);
            } catch (e) {
                console.error("[Cache] Failed to fetch offline db blob URL:", e);
            }
        }
    }

    // Fallback: original remote URL
    return url;
}
