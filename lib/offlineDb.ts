"use client";

/**
 * Offline Database for caching PDFs
 * Uses IndexedDB for large file storage (up to 500MB)
 */

const DB_NAME = 'choirAppOffline';
const DB_VERSION = 1;
const STORE_NAME = 'cachedPdfs';
const CACHE_EXPIRY_DAYS = 7;

interface CachedPdf {
    id: string;              // Song ID
    serviceId: string;       // Service ID for which it was cached
    title: string;           // Song title for display
    pdfBase64: string;       // PDF data in Base64
    cachedAt: number;        // Timestamp when cached
    expiresAt: number;       // Auto-cleanup timestamp
}

let dbInstance: IDBDatabase | null = null;

/**
 * Open or create the IndexedDB database
 */
export const openDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('serviceId', 'serviceId', { unique: false });
                store.createIndex('expiresAt', 'expiresAt', { unique: false });
            }
        };
    });
};

/**
 * Save a PDF to the cache
 */
export const savePdf = async (
    songId: string,
    serviceId: string,
    title: string,
    pdfBase64: string
): Promise<void> => {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const now = Date.now();
        const expiresAt = now + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        const data: CachedPdf = {
            id: songId,
            serviceId,
            title,
            pdfBase64,
            cachedAt: now,
            expiresAt
        };

        const request = store.put(data);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get a cached PDF by song ID
 */
export const getPdf = async (songId: string): Promise<string | null> => {
    try {
        const db = await openDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(songId);

            request.onsuccess = () => {
                const result = request.result as CachedPdf | undefined;
                if (result && result.expiresAt > Date.now()) {
                    resolve(result.pdfBase64);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('getPdf error:', e);
        return null;
    }
};

/**
 * Check if a song is cached
 */
export const isCached = async (songId: string): Promise<boolean> => {
    try {
        const db = await openDb();

        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(songId);

            request.onsuccess = () => {
                const result = request.result as CachedPdf | undefined;
                resolve(result !== undefined && result.expiresAt > Date.now());
            };
            request.onerror = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
};

/**
 * Check multiple songs cache status
 */
export const getCachedStatus = async (songIds: string[]): Promise<Record<string, boolean>> => {
    try {
        const db = await openDb();
        const result: Record<string, boolean> = {};

        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);

            let completed = 0;
            const now = Date.now();

            songIds.forEach(id => {
                const request = store.get(id);
                request.onsuccess = () => {
                    const data = request.result as CachedPdf | undefined;
                    result[id] = data !== undefined && data.expiresAt > now;
                    completed++;
                    if (completed === songIds.length) {
                        resolve(result);
                    }
                };
                request.onerror = () => {
                    result[id] = false;
                    completed++;
                    if (completed === songIds.length) {
                        resolve(result);
                    }
                };
            });

            if (songIds.length === 0) resolve(result);
        });
    } catch (e) {
        return {};
    }
};

/**
 * Delete a cached PDF
 */
export const deletePdf = async (songId: string): Promise<void> => {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(songId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Delete all cached PDFs for a specific service
 */
export const deleteServiceCache = async (serviceId: string): Promise<void> => {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('serviceId');
        const request = index.openCursor(IDBKeyRange.only(serviceId));

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Clear expired cache entries
 */
export const clearExpired = async (): Promise<number> => {
    const db = await openDb();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('expiresAt');
        const now = Date.now();
        const request = index.openCursor(IDBKeyRange.upperBound(now));

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                cursor.delete();
                deletedCount++;
                cursor.continue();
            } else {
                resolve(deletedCount);
            }
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get total cache size in bytes (approximate)
 */
export const getCacheSize = async (): Promise<{ count: number; sizeBytes: number }> => {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        let count = 0;
        let sizeBytes = 0;

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                count++;
                const data = cursor.value as CachedPdf;
                // Base64 is ~33% larger than binary, but this gives a rough estimate
                sizeBytes += data.pdfBase64.length;
                cursor.continue();
            } else {
                resolve({ count, sizeBytes });
            }
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Clear all cached data
 */
export const clearAllCache = async (): Promise<void> => {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get all cached songs info (without PDF data)
 */
export const getCachedSongsInfo = async (): Promise<Array<{
    id: string;
    serviceId: string;
    title: string;
    cachedAt: number;
    expiresAt: number;
}>> => {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        const results: Array<{
            id: string;
            serviceId: string;
            title: string;
            cachedAt: number;
            expiresAt: number;
        }> = [];

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                const data = cursor.value as CachedPdf;
                results.push({
                    id: data.id,
                    serviceId: data.serviceId,
                    title: data.title,
                    cachedAt: data.cachedAt,
                    expiresAt: data.expiresAt
                });
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = () => reject(request.error);
    });
};
