"use client";

import { useState, useCallback, useRef } from 'react';
import { savePdf, getPdf, isCached, getCachedStatus, clearExpired } from '@/lib/offlineDb';

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
    parts?: Array<{ pdfUrl?: string }>;
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
        // Use proxy to avoid CORS issues
        const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, { signal });

        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status}`);
        }

        const blob = await response.blob();

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
        await clearExpired();

        // Check which songs need caching
        const songIds = songs.map(s => s.id);
        const cachedStatus = await getCachedStatus(songIds);
        const songsToCache = songs.filter(s => !cachedStatus[s.id]);

        if (songsToCache.length === 0) {
            console.log('All songs already cached');
            return true;
        }

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
                // Get PDF URL from song data
                const pdfUrl = song.pdfUrl || song.parts?.[0]?.pdfUrl;

                if (!pdfUrl) {
                    console.warn(`No PDF URL for song: ${song.title}`);
                    continue;
                }

                // Fetch and convert to Base64
                const pdfBase64 = await fetchPdfAsBase64(pdfUrl, signal);

                // Save to IndexedDB
                await savePdf(song.id, serviceId, song.title, pdfBase64);

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
     * Get cached PDF for a song
     */
    const getCachedPdf = useCallback(async (songId: string): Promise<string | null> => {
        return getPdf(songId);
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
