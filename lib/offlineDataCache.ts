"use client";

/**
 * Offline Data Cache
 * Caches Firestore data in localStorage for offline access
 */

const CACHE_KEYS = {
    SONGS: 'offline_cache_songs',
    SERVICES: 'offline_cache_services',
    CHOIR: 'offline_cache_choir',
    TIMESTAMP: 'offline_cache_timestamp',
};

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedData<T> {
    data: T;
    timestamp: number;
    choirId: string;
}

// Helper to check if we're in browser
function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

// Generic cache getter
export function getCached<T>(key: string, choirId: string): T | null {
    if (!isBrowser()) return null;

    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        const cached: CachedData<T> = JSON.parse(raw);

        // Check if same choir
        if (cached.choirId !== choirId) return null;

        // Check if expired
        if (Date.now() - cached.timestamp > CACHE_MAX_AGE_MS) {
            localStorage.removeItem(key);
            return null;
        }

        return cached.data;
    } catch (e) {
        console.warn('[OfflineCache] Read error:', e);
        return null;
    }
}

// Generic cache setter
export function setCache<T>(key: string, choirId: string, data: T): void {
    if (!isBrowser()) return;

    try {
        const cached: CachedData<T> = {
            data,
            timestamp: Date.now(),
            choirId,
        };
        localStorage.setItem(key, JSON.stringify(cached));
    } catch (e) {
        console.warn('[OfflineCache] Write error (possibly quota exceeded):', e);
    }
}

// Clear all cached data for a choir
export function clearCache(choirId?: string): void {
    if (!isBrowser()) return;

    Object.values(CACHE_KEYS).forEach(key => {
        if (choirId) {
            const raw = localStorage.getItem(key);
            if (raw) {
                try {
                    const cached = JSON.parse(raw);
                    if (cached.choirId === choirId) {
                        localStorage.removeItem(key);
                    }
                } catch (e) { }
            }
        } else {
            localStorage.removeItem(key);
        }
    });
}

// Get cached songs
export function getCachedSongs(choirId: string): any[] | null {
    return getCached<any[]>(CACHE_KEYS.SONGS, choirId);
}

// Set cached songs
export function setCachedSongs(choirId: string, songs: any[]): void {
    setCache(CACHE_KEYS.SONGS, choirId, songs);
}

// Get cached services
export function getCachedServices(choirId: string): any[] | null {
    return getCached<any[]>(CACHE_KEYS.SERVICES, choirId);
}

// Set cached services
export function setCachedServices(choirId: string, services: any[]): void {
    setCache(CACHE_KEYS.SERVICES, choirId, services);
}

// Get cached choir
export function getCachedChoir(choirId: string): any | null {
    return getCached<any>(CACHE_KEYS.CHOIR, choirId);
}

// Set cached choir
export function setCachedChoir(choirId: string, choir: any): void {
    setCache(CACHE_KEYS.CHOIR, choirId, choir);
}

// Check if we're offline
export function isOffline(): boolean {
    if (!isBrowser()) return false;
    return !navigator.onLine;
}

// Get cache timestamp
export function getCacheTimestamp(choirId: string): number | null {
    const raw = isBrowser() ? localStorage.getItem(CACHE_KEYS.TIMESTAMP + '_' + choirId) : null;
    return raw ? parseInt(raw, 10) : null;
}

// Set cache timestamp
export function setCacheTimestamp(choirId: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(CACHE_KEYS.TIMESTAMP + '_' + choirId, Date.now().toString());
}
