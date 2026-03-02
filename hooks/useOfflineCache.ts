"use client";

import { useState, useCallback, useRef } from 'react';
import { savePdf, isCached, getCachedStatus, enforceLimit } from '@/lib/offlineDb';

interface CacheProgress {
    total: number;
    cached: number;
    current: string | null;
    isRunning: boolean;
    error: string | null;
}

interface SongForCache {
    id: string;
    title: string;
    parts?: Array<{ name?: string, pdfUrl?: string }>;
    pdfUrl?: string;
}

/**
 * Hook for managing offline PDF caching for service songs
 */
export function useOfflineCache() {
    const [progress, setProgress] = useState<CacheProgress>({
        total: 0,
        cached: 0,
        current: null,
        isRunning: false,
        error: null
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * Fetch PDF and convert to Base64
     */
    const fetchPdfAsBase64 = async (url: string, signal?: AbortSignal): Promise<string> => {
        // Direct fetch only (Proxy is removed for static export compatibility)
        // CORS must be handled by the source server (R2/Firebase)

        // Fallback to direct fetch
        try {
            const response = await fetch(url, { signal });
            if (!response.ok) {
                throw new Error(`Failed to fetch PDF: ${response.status}`);
            }
            const blob = await response.blob();
            return await blobToBase64(blob);
        } catch (error) {
            console.error('[OfflineCache] Direct fetch failed:', error);
            throw error;
        }
    };

    // Helper to convert blob to base64
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    /**
     * Cache all songs for a service
     */
    const cacheServiceSongs = useCallback(async (
        serviceId: string,
        songs: SongForCache[]
    ): Promise<boolean> => {
        // Clear expired entries first
        await enforceLimit();

        // Check which songs need caching
        const songIds = songs.map(s => s.id);
        const cachedStatus = await getCachedStatus(songIds);
        const songsToCache = songs.filter(s => !cachedStatus[s.id]);

        if (songsToCache.length === 0) {
            console.log('[OfflineCache] All songs already cached');
            return true;
        }

        console.log(`[OfflineCache] Need to cache ${songsToCache.length} songs:`, songsToCache.map(s => s.title));

        // Setup abort controller for cancellation
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setProgress({
            total: songsToCache.length,
            cached: 0,
            current: null,
            isRunning: true,
            error: null
        });

        let cachedCount = 0;

        for (const song of songsToCache) {
            if (signal.aborted) {
                break;
            }

            setProgress(prev => ({
                ...prev,
                current: song.title
            }));

            try {
                // Get all parts or fallback to single PDF url
                const partsData = (song.parts && song.parts.length > 0)
                    ? song.parts.map(p => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                    : [{ name: 'Головна', pdfUrl: song.pdfUrl }];

                // Filter out empty urls
                const validParts = partsData.filter(p => !!p.pdfUrl);

                if (validParts.length === 0) {
                    console.warn(`No PDF URL for song: ${song.title}`);
                    continue;
                }

                // Fetch and convert all parts to Base64 concurrently
                const resolvedParts = await Promise.all(
                    validParts.map(async (part) => {
                        const base64 = await fetchPdfAsBase64(part.pdfUrl as string, signal);
                        return { name: part.name, pdfBase64: base64 };
                    })
                );

                // Save to IndexedDB
                await savePdf(song.id, serviceId, song.title, resolvedParts);

                cachedCount++;
                setProgress(prev => ({
                    ...prev,
                    cached: cachedCount
                }));

            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.log('Caching aborted');
                    break;
                }
                console.error(`Failed to cache song ${song.title}:`, error);
                // Continue with next song
            }
        }

        setProgress(prev => ({
            ...prev,
            isRunning: false,
            current: null
        }));

        abortControllerRef.current = null;
        return cachedCount === songsToCache.length;
    }, []);

    /**
     * Get cached PDF parts for a song
     */
    const getCachedPdf = useCallback(async (songId: string): Promise<Array<{ name: string; pdfBase64: string }> | null> => {
        const { getPdfParts } = await import('@/lib/offlineDb');
        return getPdfParts(songId);
    }, []);

    /**
     * Check if a song is cached
     */
    const checkIsCached = useCallback(async (songId: string): Promise<boolean> => {
        return isCached(songId);
    }, []);

    /**
     * Check cache status for multiple songs
     */
    const checkCacheStatus = useCallback(async (songIds: string[]): Promise<Record<string, boolean>> => {
        return getCachedStatus(songIds);
    }, []);

    /**
     * Cancel ongoing caching
     */
    const cancelCaching = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    return {
        progress,
        cacheServiceSongs,
        getCachedPdf,
        checkIsCached,
        checkCacheStatus,
        cancelCaching
    };
}
