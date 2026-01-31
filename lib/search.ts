/**
 * Search module using Fuse.js for fuzzy search
 * Handles local caching of song metadata for offline search
 */

import Fuse, { IFuseOptions } from 'fuse.js';
import { SongMeta, SongCategory } from '@/types';
import { getSongsMeta } from './db';

// Fuse.js configuration for optimal Ukrainian/Russian text search
const fuseOptions: IFuseOptions<SongMeta> = {
    keys: [
        { name: 'title', weight: 0.5 },
        { name: 'composer', weight: 0.3 },
        { name: 'keywords', weight: 0.2 }
    ],
    threshold: 0.3,          // Lower = stricter matching
    distance: 100,           // How far to search for fuzzy match
    ignoreLocation: true,    // Search anywhere in the string
    minMatchCharLength: 2,   // Minimum characters to match
    includeScore: true,
    shouldSort: true,
};

let fuseInstance: Fuse<SongMeta> | null = null;
let songsCache: SongMeta[] = [];
let lastUpdate: number = 0;

const CACHE_KEY = 'songs_meta_cache';
const CACHE_TIMESTAMP_KEY = 'songs_meta_timestamp';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Initialize or get the Fuse search instance
 */
export async function getSearchInstance(choirId?: string, forceRefresh = false): Promise<Fuse<SongMeta>> {
    const now = Date.now();

    // Return cached instance if valid
    if (fuseInstance && !forceRefresh && (now - lastUpdate) < CACHE_DURATION) {
        return fuseInstance;
    }

    // Try to load from localStorage first (for quick startup)
    if (typeof window !== 'undefined' && !forceRefresh) {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

            if (cached && timestamp && (now - parseInt(timestamp)) < CACHE_DURATION) {
                songsCache = JSON.parse(cached);
                fuseInstance = new Fuse(songsCache, fuseOptions);
                lastUpdate = parseInt(timestamp);

                // Refresh in background
                refreshCacheInBackground(choirId);

                return fuseInstance;
            }
        } catch (e) {
            console.warn('Failed to load search cache from localStorage:', e);
        }
    }

    // Fetch fresh data
    await refreshCache(choirId);

    return fuseInstance!;
}

/**
 * Refresh the search cache from Firestore
 */
async function refreshCache(choirId?: string): Promise<void> {
    try {
        songsCache = await getSongsMeta(choirId);
        fuseInstance = new Fuse(songsCache, fuseOptions);
        lastUpdate = Date.now();

        // Save to localStorage
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(songsCache));
                localStorage.setItem(CACHE_TIMESTAMP_KEY, lastUpdate.toString());
            } catch (e) {
                console.warn('Failed to save search cache to localStorage:', e);
            }
        }
    } catch (error) {
        console.error('Error refreshing search cache:', error);
    }
}

/**
 * Refresh cache in background without blocking
 */
function refreshCacheInBackground(choirId?: string): void {
    setTimeout(() => refreshCache(choirId), 100);
}

/**
 * Search songs by query
 */
export function searchSongs(query: string, limit = 50): SongMeta[] {
    if (!fuseInstance || !query.trim()) {
        return [];
    }

    const results = fuseInstance.search(query, { limit });
    return results.map(r => r.item);
}

/**
 * Search songs with category filter
 */
export function searchSongsFiltered(
    query: string,
    category?: SongCategory,
    source?: 'global' | 'local',
    limit = 50
): SongMeta[] {
    if (!fuseInstance) {
        return [];
    }

    // If no query, return filtered list
    if (!query.trim()) {
        let filtered = songsCache;

        if (category) {
            filtered = filtered.filter(s => s.category === category);
        }
        if (source) {
            filtered = filtered.filter(s => s.source === source);
        }

        return filtered.slice(0, limit);
    }

    // Search first, then filter
    const results = fuseInstance.search(query, { limit: limit * 2 });
    let filtered = results.map(r => r.item);

    if (category) {
        filtered = filtered.filter(s => s.category === category);
    }
    if (source) {
        filtered = filtered.filter(s => s.source === source);
    }

    return filtered.slice(0, limit);
}

/**
 * Get all songs (no search, just filtered list)
 */
export function getAllSongs(
    category?: SongCategory,
    source?: 'global' | 'local',
    limit = 100
): SongMeta[] {
    let filtered = songsCache;

    if (category) {
        filtered = filtered.filter(s => s.category === category);
    }
    if (source) {
        filtered = filtered.filter(s => s.source === source);
    }

    return filtered.slice(0, limit);
}

/**
 * Clear search cache (e.g., on logout)
 */
export function clearSearchCache(): void {
    fuseInstance = null;
    songsCache = [];
    lastUpdate = 0;

    if (typeof window !== 'undefined') {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; lastUpdate: Date | null; isStale: boolean } {
    return {
        count: songsCache.length,
        lastUpdate: lastUpdate ? new Date(lastUpdate) : null,
        isStale: Date.now() - lastUpdate > CACHE_DURATION
    };
}
