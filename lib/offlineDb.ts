"use client";

/**
 * Offline Database for caching PDFs
 * Uses IndexedDB for large file storage (up to 500MB)
 */

const DB_NAME = 'choirAppOffline';
const DB_VERSION = 1;
const STORE_NAME = 'cachedPdfs';
const CACHE_LIMIT_KEY = 'choirApp_cacheLimit';
const DEFAULT_LIMIT = '100'; // 100MB by default

/**
 * Get the user's cache limit preference
 */
export const getCacheLimit = (): string => {
    if (typeof window === 'undefined') return DEFAULT_LIMIT;
    return localStorage.getItem(CACHE_LIMIT_KEY) || DEFAULT_LIMIT;
};

/**
 * Set the user's cache limit preference
 */
export const setCacheLimit = (limit: string): void => {
    localStorage.setItem(CACHE_LIMIT_KEY, limit);
};

/**
 * Get the cache limit in bytes
 */
export const getCacheLimitBytes = (): number => {
    const limit = getCacheLimit();
    if (limit === 'unlimited') return Infinity;
    if (limit === '1gb') return 1024 * 1024 * 1024; // legacy
    if (limit === '500mb') return 500 * 1024 * 1024; // legacy
    if (limit === '50mb') return 50 * 1024 * 1024; // legacy

    // Parse new "100" format representing MB
    const parsed = parseInt(limit, 10);
    if (!isNaN(parsed) && parsed > 0) {
        return parsed * 1024 * 1024;
    }
    return 100 * 1024 * 1024; // default 100MB fallback
};

// Retention period — delete files not used in X days
const CACHE_RETENTION_KEY = 'choirApp_cacheRetention';
const DEFAULT_RETENTION = '30'; // 30 days by default

/**
 * Get the user's retention period preference
 */
export const getCacheRetention = (): string => {
    if (typeof window === 'undefined') return DEFAULT_RETENTION;
    return localStorage.getItem(CACHE_RETENTION_KEY) || DEFAULT_RETENTION;
};

/**
 * Set the user's retention period preference
 */
export const setCacheRetention = (retention: string): void => {
    localStorage.setItem(CACHE_RETENTION_KEY, retention);
};

/**
 * Get retention period in milliseconds (0 = never)
 */
const getRetentionMs = (): number => {
    const r = getCacheRetention();
    if (r === 'never') return 0;
    if (r === '7d') return 7 * 24 * 60 * 60 * 1000; // legacy
    if (r === '30d') return 30 * 24 * 60 * 60 * 1000; // legacy
    if (r === '90d') return 90 * 24 * 60 * 60 * 1000; // legacy

    const parsed = parseInt(r, 10);
    if (!isNaN(parsed) && parsed > 0) {
        return parsed * 24 * 60 * 60 * 1000;
    }
    return 30 * 24 * 60 * 60 * 1000; // default 30 days fallback
};

interface CachedPdf {
    id: string;              // Song ID
    serviceId: string;       // Service ID for which it was cached
    title: string;           // Song title for display
    parts: Array<{
        name: string;        // Part name (e.g. Головна, Альт)
        pdfBase64: string;   // PDF data in Base64
    }>;
    cachedAt: number;        // Timestamp when cached
    expiresAt: number;       // Legacy — managed by size limit now
    lastAccessedAt: number;  // Timestamp when last opened
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
    parts: Array<{ name: string; pdfBase64: string }>
): Promise<void> => {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const now = Date.now();

        const data: CachedPdf = {
            id: songId,
            serviceId,
            title,
            parts,
            cachedAt: now,
            expiresAt: now + (365 * 24 * 60 * 60 * 1000), // Far future — managed by size limit
            lastAccessedAt: now
        };

        const request = store.put(data);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get a cached PDF by song ID (returns array of parts instead of single string)
 */
export const getPdfParts = async (songId: string): Promise<Array<{ name: string; pdfBase64: string }> | null> => {
    try {
        const db = await openDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(songId);

            request.onsuccess = () => {
                const result = request.result as CachedPdf | undefined;
                if (result) {
                    // Update lastAccessedAt silently
                    try {
                        const writeTx = db.transaction(STORE_NAME, 'readwrite');
                        const writeStore = writeTx.objectStore(STORE_NAME);
                        writeStore.put({ ...result, lastAccessedAt: Date.now() });
                    } catch (e) { /* silent */ }
                    resolve(result.parts);
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
                resolve(result !== undefined);
            };
            request.onerror = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
};

/**
 * Get full cached song object (for offline song page)
 */
export const getCachedSong = async (songId: string): Promise<CachedPdf | null> => {
    try {
        const db = await openDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(songId);

            request.onsuccess = () => {
                const result = request.result as CachedPdf | undefined;
                resolve(result || null);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('getCachedSong error:', e);
        return null;
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
                    result[id] = data !== undefined;
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
                const size = data.parts ? data.parts.reduce((acc, part) => acc + (part.pdfBase64?.length || 0), 0) : 0;
                sizeBytes += size;
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
/**
 * Enforce cache size limit by removing oldest entries
 */
export const enforceLimit = async (): Promise<number> => {
    // First: cleanup by retention period
    let totalDeleted = await cleanupByRetention();

    // Then: enforce size limit
    const limitBytes = getCacheLimitBytes();
    if (limitBytes === Infinity) return totalDeleted;

    const { sizeBytes } = await getCacheSize();
    if (sizeBytes <= limitBytes) return totalDeleted;

    // Get all entries sorted by lastAccessedAt (least recently used first)
    const db = await openDb();
    const allEntries = await new Promise<CachedPdf[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        const entries: CachedPdf[] = [];
        req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result;
            if (cursor) {
                entries.push(cursor.value);
                cursor.continue();
            } else {
                resolve(entries);
            }
        };
        req.onerror = () => reject(req.error);
    });

    // Sort by least recently used first
    allEntries.sort((a, b) => (a.lastAccessedAt || a.cachedAt) - (b.lastAccessedAt || b.cachedAt));

    let currentSize = sizeBytes;
    let sizeDeleted = 0;

    for (const entry of allEntries) {
        if (currentSize <= limitBytes) break;
        const entrySize = entry.parts.reduce((acc, p) => acc + (p.pdfBase64?.length || 0), 0);
        await deletePdf(entry.id);
        currentSize -= entrySize;
        sizeDeleted++;
    }

    if (sizeDeleted > 0) {
        console.log(`[OfflineCache] Enforced limit: deleted ${sizeDeleted} LRU entries, freed ${((sizeBytes - currentSize) / 1024 / 1024).toFixed(1)} MB`);
    }
    return totalDeleted + sizeDeleted;
};

/**
 * Clean up cached files not accessed within the retention period
 */
export const cleanupByRetention = async (): Promise<number> => {
    const retentionMs = getRetentionMs();
    if (retentionMs === 0) return 0; // never = no cleanup

    const cutoff = Date.now() - retentionMs;
    const db = await openDb();

    const staleIds = await new Promise<string[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        const ids: string[] = [];
        req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result;
            if (cursor) {
                const data = cursor.value as CachedPdf;
                const lastUsed = data.lastAccessedAt || data.cachedAt;
                if (lastUsed < cutoff) {
                    ids.push(data.id);
                }
                cursor.continue();
            } else {
                resolve(ids);
            }
        };
        req.onerror = () => reject(req.error);
    });

    for (const id of staleIds) {
        await deletePdf(id);
    }

    if (staleIds.length > 0) {
        console.log(`[OfflineCache] Retention cleanup: deleted ${staleIds.length} files not used in ${retentionMs / 86400000} days`);
    }
    return staleIds.length;
};

export const getCachedSongsInfo = async (): Promise<Array<{
    id: string;
    serviceId: string;
    title: string;
    cachedAt: number;
    expiresAt: number;
    sizeBytes: number;
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
            sizeBytes: number;
        }> = [];

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                const data = cursor.value as CachedPdf;
                const entrySize = data.parts ? data.parts.reduce((acc, p) => acc + (p.pdfBase64?.length || 0), 0) : 0;
                results.push({
                    id: data.id,
                    serviceId: data.serviceId,
                    title: data.title,
                    cachedAt: data.cachedAt,
                    expiresAt: data.expiresAt,
                    sizeBytes: entrySize
                });
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = () => reject(request.error);
    });
};
