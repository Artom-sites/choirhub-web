"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
import { SimpleSong } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { syncSongs } from "@/lib/db";
import { getAuthLazy } from "@/lib/firebase";

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

// Fallback for idle callback so iOS WKWebView doesn't block
export const runIdle = (fn: () => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(fn);
    } else {
        setTimeout(fn, 100);
    }
};

export function RepertoireProvider({ children }: { children: ReactNode }) {
    const { userData } = useAuth();
    const [songs, setSongs] = useState<SimpleSong[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasSynced, setHasSynced] = useState(false);
    const syncLockRef = useRef(false);

    // Sync cache when choirId becomes available, and persist choirId for eager loading
    useEffect(() => {
        if (typeof window !== 'undefined' && userData?.choirId) {
            localStorage.setItem('choir_last_choirId', userData.choirId);

            const META_KEY = `choir_songs_meta_v2_${userData.choirId}`;
            const FULL_KEY = `choir_songs_v2_${userData.choirId}`;

            try {
                // 1. Sync load fast metadata (id, title, category, keywords) to unblock UI
                const cachedMeta = localStorage.getItem(META_KEY);
                if (cachedMeta) {
                    const parsedMeta = JSON.parse(cachedMeta);
                    if (Array.isArray(parsedMeta)) {
                        setSongs(parsedMeta);
                        setLoading(false);
                    } else {
                        throw new Error("Cached meta is not an array");
                    }

                    // 2. Async load the massive 7500+ full object payload later
                    runIdle(() => {
                        try {
                            const cachedFull = localStorage.getItem(FULL_KEY);
                            if (cachedFull) {
                                const parsedFull = JSON.parse(cachedFull);
                                if (Array.isArray(parsedFull)) {
                                    setSongs(parsedFull);
                                }
                            }
                        } catch (e) { console.error("Full cache parse error", e); }
                    });
                } else {
                    // Fallback to legacy full cache load if meta doesn't exist yet
                    const cachedFull = localStorage.getItem(FULL_KEY);
                    if (cachedFull) {
                        try {
                            const parsed = JSON.parse(cachedFull);
                            if (Array.isArray(parsed)) {
                                setSongs(parsed);
                                setLoading(false);
                            } else {
                                setSongs([]);
                                setLoading(false);
                            }
                        } catch (e) {
                            setSongs([]);
                            setLoading(false);
                        }
                    } else {
                        setSongs([]);
                        setLoading(false);
                    }
                }
            } catch (e) {
                console.warn("[Repertoire] Failed to load cache", e);
                setSongs([]);
                setLoading(false);
            }
        } else if (!userData?.choirId && userData !== undefined) {
            setSongs([]);
            setLoading(false);
        }
    }, [userData?.choirId]);

    const performSync = useCallback(async (force = false) => {
        if (!userData?.choirId) return;
        if (syncLockRef.current) return;

        const CACHE_KEY = `choir_songs_v2_${userData.choirId}`;
        const SYNC_KEY = `choir_sync_v2_${userData.choirId}`;
        let lastSyncTime = localStorage.getItem(SYNC_KEY) ? parseInt(localStorage.getItem(SYNC_KEY)!) : 0;

        // If forced, do a FULL sync to recover from any stuck cache states
        if (force) {
            lastSyncTime = 0;
            console.log("[Repertoire] Force sync requested. Resetting lastSyncTime to 0 for full sync.");
        } else if (Date.now() - lastSyncTime < 60000) {
            // Debounce: Don't sync if checked less than 60 seconds ago, unless forced
            console.log("[Repertoire] Skipping sync (recent)");
            return;
        }

        syncLockRef.current = true;
        console.log("[Repertoire] Starting Delta Sync...");

        try {
            if (getAuthLazy().currentUser) {
                const token = await getAuthLazy().currentUser!.getIdTokenResult();
                console.log(`[Repertoire] Syncing for Choir: ${userData.choirId}`);

                // Auto-Fix: If claim is missing, force sync and refresh
                const claims = token.claims.choirs as Record<string, unknown> | undefined;

                // If claims object is missing OR specific choir claim is missing
                if (!claims || !claims[userData.choirId]) {
                    console.error(`[CRITICAL] Claims Mismatch! Missing ${userData.choirId}. Attempting auto-fix...`);

                    const { forceSyncClaims } = await import('@/lib/db');
                    await forceSyncClaims();

                    // Refresh token again
                    await getAuthLazy().currentUser!.getIdToken(true);
                    console.log("[Repertoire] Auto-fix complete. Retrying sync...");

                    // Recursive retry with strict force=true to bypass debounce
                    return performSync(true);
                }
            }

            const { songs: updatedSongs, deletedIds } = await syncSongs(userData.choirId, lastSyncTime);

            if (updatedSongs.length > 0 || deletedIds.length > 0 || lastSyncTime === 0) {
                setSongs(prev => {
                    const currentMap = new Map((lastSyncTime === 0 ? [] : prev).map(s => [s.id, s]));

                    // Remove deleted
                    deletedIds.forEach(id => currentMap.delete(id));

                    // Add/Update modified
                    updatedSongs.forEach(s => currentMap.set(s.id, s));

                    const merged = Array.from(currentMap.values())
                        .sort((a, b) => a.title.localeCompare(b.title, 'uk'));

                    // SPLIT CACHE WRITING for optimization
                    // 1. Meta Cache: Just enough to render lists and search
                    const metaSubset = merged.map(s => ({
                        id: s.id,
                        title: s.title,
                        category: s.category,
                        keywords: s.keywords,
                        hasPdf: s.hasPdf,
                        updatedAt: s.updatedAt,
                        conductor: s.conductor,
                        pianist: s.pianist
                    }));

                    localStorage.setItem(`choir_songs_meta_v2_${userData.choirId}`, JSON.stringify(metaSubset));

                    // 2. Full Cache: Everything else including base64 PDFs
                    localStorage.setItem(CACHE_KEY, JSON.stringify(merged));

                    console.log(`[Repertoire] Cache updated (Meta + Full)! Total songs: ${merged.length}`);
                    return merged;
                });
                console.log(`[Repertoire] Delta Sync: +${updatedSongs.length}, -${deletedIds.length}`);
            } else {
                console.log(`[Repertoire] Delta Sync: No changes since ${lastSyncTime}`);
            }

            // Update Sync Time
            localStorage.setItem(SYNC_KEY, Date.now().toString());

        } catch (error) {
            console.error("[Repertoire] Sync failed:", error);
        } finally {
            syncLockRef.current = false;
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
