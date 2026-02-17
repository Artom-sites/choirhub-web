"use client";

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUpcomingServices, getSongsByIds } from '@/lib/db';
import { useOfflineCache } from './useOfflineCache';
import { useRepertoire } from '@/contexts/RepertoireContext';
import { useRouter } from 'next/navigation';

/**
 * Background caching hook that automatically caches 
 * upcoming service PDFs when the app starts.
 * 
 * This runs once on app mount (when user is authenticated)
 * and caches up to 2 nearest upcoming services.
 */
export function useBackgroundCache() {
    const { userData } = useAuth();
    const { songs: repertoireSongs } = useRepertoire();
    const { cacheServiceSongs, progress } = useOfflineCache();
    const router = useRouter();
    const hasRunRef = useRef(false);

    useEffect(() => {
        // Only run once per session, when user is logged in
        if (!userData?.choirId || hasRunRef.current) return;
        if (progress.isRunning) return; // Don't start if already caching

        hasRunRef.current = true;

        const cacheUpcomingServices = async () => {
            try {
                console.log('[BackgroundCache] Starting background cache...');

                // Prefetch main routes to ensure chunks are in browser cache
                if (typeof navigator !== 'undefined' && navigator.onLine) {
                    console.log('[BackgroundCache] Prefetching app routes...');
                    router.prefetch('/');
                    router.prefetch('/?tab=songs');
                    router.prefetch('/?tab=members');
                }

                // Get nearest upcoming services (fetch a few more to handle today's passed services)
                const candidateServices = await getUpcomingServices(userData.choirId!, 5);

                const now = new Date();
                const upcomingServices = candidateServices
                    .filter(s => {
                        const serviceDate = new Date(s.date);
                        if (s.time) {
                            const [hours, minutes] = s.time.split(':').map(Number);
                            serviceDate.setHours(hours, minutes, 0, 0);
                        } else {
                            serviceDate.setHours(23, 59, 59, 999);
                        }
                        return serviceDate > now;
                    })
                    // Already sorted by DB, but good to be safe if client logic differs
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .slice(0, 2); // Cache up to 2 nearest services

                if (upcomingServices.length === 0) {
                    console.log('[BackgroundCache] No upcoming services to cache');
                    return;
                }

                console.log(`[BackgroundCache] Caching ${upcomingServices.length} upcoming service(s)...`);

                // Extract all song IDs needed
                // Extract all song IDs needed
                const songIds = new Set<string>();
                upcomingServices.forEach(s => {
                    s.songs.forEach(song => {
                        if (song.songId) songIds.add(song.songId);
                    });
                });

                if (songIds.size === 0) {
                    console.log('[BackgroundCache] No songs to cache in upcoming services');
                    return;
                }

                // Filter out songs we already have in repertoire
                const missingSongIds = Array.from(songIds).filter(id => !repertoireSongs.find(s => s.id === id));

                let fetchedSongs: any[] = [];
                if (missingSongIds.length > 0) {
                    console.log(`[BackgroundCache] Fetching ${missingSongIds.length} missing songs...`);
                    fetchedSongs = await getSongsByIds(userData.choirId!, missingSongIds);
                }

                // Combine repertoire songs and fetched songs
                const allNeededSongs = [
                    ...repertoireSongs.filter(s => songIds.has(s.id)),
                    ...fetchedSongs
                ];



                // Cache each service's songs
                for (const service of upcomingServices) {
                    const songsToCache = service.songs
                        .map(s => {
                            const fullSong = allNeededSongs.find(song => song.id === s.songId);
                            if (fullSong && (fullSong.pdfUrl || (fullSong.parts && fullSong.parts.length > 0))) {
                                return {
                                    id: fullSong.id,
                                    title: fullSong.title,
                                    pdfUrl: fullSong.pdfUrl,
                                    parts: fullSong.parts
                                };
                            }
                            return null;
                        })
                        .filter(Boolean) as any[];

                    if (songsToCache.length > 0) {
                        console.log(`[BackgroundCache] Caching ${songsToCache.length} songs for service: ${service.title}`);
                        await cacheServiceSongs(service.id, songsToCache);
                    }
                }

                console.log('[BackgroundCache] Background caching complete!');
            } catch (error) {
                console.error('[BackgroundCache] Error during background cache:', error);
            }
        };

        // Delay slightly to not block initial render
        const timeout = setTimeout(cacheUpcomingServices, 2000);

        return () => clearTimeout(timeout);
    }, [userData?.choirId, cacheServiceSongs, progress.isRunning]);

    return { progress };
}
