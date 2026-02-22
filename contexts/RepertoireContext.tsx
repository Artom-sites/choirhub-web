"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { SimpleSong } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { syncSongs } from "@/lib/db";
import { auth } from "@/lib/firebase";

interface RepertoireContextType {
    songs: SimpleSong[];
    loading: boolean;
    refreshRepertoire: () => Promise<void>;
    getSongById: (id: string) => SimpleSong | undefined;
}

const RepertoireContext = createContext<RepertoireContextType>({
    songs: [],
    loading: true,
    refreshRepertoire: async () => { },
    getSongById: () => undefined,
});

export function useRepertoire() {
    return useContext(RepertoireContext);
}

export function RepertoireProvider({ children }: { children: ReactNode }) {
    const { userData } = useAuth();
    const [songs, setSongs] = useState<SimpleSong[]>(() => {
        // Eagerly try to load from cache on first render (before auth is ready)
        if (typeof window !== 'undefined') {
            try {
                const storedChoirId = localStorage.getItem('choir_last_choirId');
                if (storedChoirId) {
                    const cached = localStorage.getItem(`choir_songs_v2_${storedChoirId}`);
                    if (cached) {
                        return JSON.parse(cached);
                    }
                }
            } catch (e) { /* ignore */ }
        }
        return [];
    });
    const [loading, setLoading] = useState(() => {
        // If we got songs from eager cache, don't show loading
        if (typeof window !== 'undefined') {
            try {
                const storedChoirId = localStorage.getItem('choir_last_choirId');
                if (storedChoirId) {
                    const cached = localStorage.getItem(`choir_songs_v2_${storedChoirId}`);
                    if (cached && JSON.parse(cached).length > 0) return false;
                }
            } catch (e) { /* ignore */ }
        }
        return true;
    });
    const [hasSynced, setHasSynced] = useState(false);

    // Sync cache when choirId becomes available, and persist choirId for eager loading
    useEffect(() => {
        if (typeof window !== 'undefined' && userData?.choirId) {
            localStorage.setItem('choir_last_choirId', userData.choirId);

            const CACHE_KEY = `choir_songs_v2_${userData.choirId}`;
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    setSongs(JSON.parse(cached));
                } else {
                    setSongs([]);
                }
                setLoading(false);
            } catch (e) {
                console.warn("[Repertoire] Failed to load cache", e);
                setSongs([]);
            }
        } else if (!userData?.choirId && userData !== undefined) {
            setSongs([]);
        }
    }, [userData?.choirId]);

    const performSync = useCallback(async (force = false) => {
        if (!userData?.choirId) return;

        const CACHE_KEY = `choir_songs_v2_${userData.choirId}`;
        const SYNC_KEY = `choir_sync_v2_${userData.choirId}`;
        const lastSync = localStorage.getItem(SYNC_KEY);
        const lastSyncTime = lastSync ? parseInt(lastSync) : 0;

        // Debounce: Don't sync if checked less than 60 seconds ago, unless forced
        if (!force && Date.now() - lastSyncTime < 60000) {
            console.log("[Repertoire] Skipping sync (recent)");
            setLoading(false);
            return;
        }

        console.log("[Repertoire] Starting Delta Sync...");

        try {
            if (auth.currentUser) {
                const token = await auth.currentUser.getIdTokenResult();
                console.log(`[Repertoire] Syncing for Choir: ${userData.choirId}`);

                // Auto-Fix: If claim is missing, force sync and refresh
                const claims = token.claims.choirs as Record<string, unknown> | undefined;

                // If claims object is missing OR specific choir claim is missing
                if (!claims || !claims[userData.choirId]) {
                    console.error(`[CRITICAL] Claims Mismatch! Missing ${userData.choirId}. Attempting auto-fix...`);

                    const { forceSyncClaims } = await import('@/lib/db');
                    await forceSyncClaims();

                    // Refresh token again
                    await auth.currentUser.getIdToken(true);
                    console.log("[Repertoire] Auto-fix complete. Retrying sync...");

                    // Recursive retry with strict force=true to bypass debounce
                    return performSync(true);
                }
            }

            const { songs: updatedSongs, deletedIds } = await syncSongs(userData.choirId, lastSyncTime);

            if (updatedSongs.length > 0 || deletedIds.length > 0) {
                setSongs(prev => {
                    const currentMap = new Map(prev.map(s => [s.id, s]));

                    // Remove deleted
                    deletedIds.forEach(id => currentMap.delete(id));

                    // Add/Update modified
                    updatedSongs.forEach(s => currentMap.set(s.id, s));

                    const merged = Array.from(currentMap.values())
                        .sort((a, b) => a.title.localeCompare(b.title, 'uk'));

                    // Update Cache
                    localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
                    return merged;
                });
                console.log(`[Repertoire] Delta Sync: +${updatedSongs.length}, -${deletedIds.length}`);
            } else {
                console.log("[Repertoire] Delta Sync: No changes");
            }

            // Update Sync Time
            localStorage.setItem(SYNC_KEY, Date.now().toString());

        } catch (error) {
            console.error("[Repertoire] Sync failed:", error);
        } finally {
            setLoading(false);
        }
    }, [userData?.choirId]);

    // Initial Sync (run once per session/mount)
    useEffect(() => {
        if (userData?.choirId && !hasSynced) {
            setHasSynced(true);
            performSync();
        }
    }, [userData?.choirId, hasSynced, performSync]);

    const getSongById = useCallback((id: string) => {
        return songs.find(s => s.id === id);
    }, [songs]);

    return (
        <RepertoireContext.Provider value={{
            songs,
            loading,
            refreshRepertoire: () => performSync(true),
            getSongById
        }}>
            {children}
        </RepertoireContext.Provider>
    );
}
