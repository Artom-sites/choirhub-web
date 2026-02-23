import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    documentId,
    Timestamp,
    serverTimestamp,
    updateDoc,
    arrayUnion,
    arrayRemove,
    deleteField,
    Query
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, functions, auth } from "./firebase";
export { db, functions, auth };
import { httpsCallable } from "firebase/functions";
import {
    Service, SimpleSong, Choir, UserData, ServiceSong,
    GlobalSong, LocalSong, SongMeta, SongCategory, SongSource,
    PendingSong, SongSubmissionStatus
} from "@/types";
import { getCachedSongs, setCachedSongs, getCachedServices, setCachedServices, isOffline } from "./offlineDataCache";

// ============ SAFETY HELPERS ============

/**
 * Safe wrapper around getDocs that guards against accidental full-collection reads.
 * Logs read counts in dev mode. Throws if snapshot exceeds max.
 */
async function safeGetDocs(q: Query, label: string, max = 2000) {
    const snapshot = await getDocs(q);
    if (process.env.NODE_ENV === 'development') {
        console.log(`📊 [${label}] Read ${snapshot.size} docs`);
    }
    if (snapshot.size > max) {
        console.error(`🚨 [${label}] Read ${snapshot.size} docs — exceeds safety limit of ${max}!`);
        throw new Error(`Collection read exceeded safety limit: ${snapshot.size}/${max}`);
    }
    return snapshot;
}

// Converters to handle Timestamp <-> Date/String conversions
const songConverter = {
    toFirestore: (data: any) => data,
    fromFirestore: (snap: any) => {
        const data = snap.data();
        return {
            id: snap.id,
            ...data,
            // addedAt might be a Timestamp
            addedAt: data.addedAt?.toDate?.()?.toISOString() || data.addedAt,
        } as SimpleSong;
    }
};

const serviceConverter = {
    toFirestore: (data: any) => data,
    fromFirestore: (snap: any) => {
        const data = snap.data();
        return {
            id: snap.id,
            ...data,
            // date might be stored as string or timestamp, ensure consistency if needed
        } as Service;
    }
};

// ============ SONGS ============


// Helper to remove undefined fields (Firestore doesn't like them)
function removeUndefined(obj: any) {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    });
    return newObj;
}
export async function addSong(choirId: string, song: Omit<SimpleSong, "id">): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, `choirs/${choirId}/songs`), {
            ...removeUndefined(song),
            addedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding song:", error);
        throw error;
    }
}

export async function deleteSong(choirId: string, songId: string): Promise<void> {
    try {
        // Soft delete
        const docRef = doc(db, `choirs/${choirId}/songs`, songId);
        await updateDoc(docRef, {
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error deleting song:", error);
        throw error;
    }
}

// Batch fetch songs by IDs (Optimized)
export async function getSongsByIds(choirId: string, songIds: string[]): Promise<SimpleSong[]> {
    if (!choirId || songIds.length === 0) return [];

    // If offline, check cache first? No, specific IDs usually imply we need fresh data or check specific subset.
    // But we can check cache if we want. For background cache, we might want fresh?
    // Actually, background cache is for offline.
    // Let's implement robust fetching:

    const uniqueIds = Array.from(new Set(songIds));
    const results: SimpleSong[] = [];

    // Firestore 'in' query supports max 10 items
    const chunkSize = 10;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const batch = uniqueIds.slice(i, i + chunkSize);
        try {
            const q = query(
                collection(db, `choirs/${choirId}/songs`),
                where(documentId(), "in", batch)
            );
            const snapshot = await getDocs(q);
            const batchSongs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimpleSong));
            results.push(...batchSongs);
        } catch (e) {
            console.error(`Error fetching songs batch ${i}:`, e);
        }
    }
    return results;
}

export async function getSongs(choirId: string): Promise<SimpleSong[]> {
    if (!choirId) return [];

    // If offline, return cached data immediately
    if (isOffline()) {
        const cached = getCachedSongs(choirId);
        if (cached) {
            console.log('[DB] Serving songs from offline cache');
            return cached;
        }
        console.warn('[DB] Offline but no cached songs');
        return [];
    }

    try {
        const q = query(
            collection(db, `choirs/${choirId}/songs`),
            orderBy("title")
        );
        const snapshot = await safeGetDocs(q, `getSongs(${choirId})`, 500);
        const songs = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as SimpleSong))
            .filter(song => !song.deletedAt);

        // Cache for offline use
        setCachedSongs(choirId, songs);

        return songs;
    } catch (error) {
        console.error("Error fetching songs:", error);
        // Try cache as fallback
        const cached = getCachedSongs(choirId);
        if (cached) {
            console.log('[DB] Firestore failed, serving songs from cache');
            return cached;
        }
        return [];
    }
}

// Fetch only songs updated after a certain timestamp
// Fetch only songs updated after a certain timestamp
export async function syncSongs(choirId: string, lastSyncTimestamp: number): Promise<{ songs: SimpleSong[], deletedIds: string[] }> {
    if (!choirId) return { songs: [], deletedIds: [] };
    try {
        let q;

        if (lastSyncTimestamp === 0) {
            // Initial Sync: Fetch ALL songs (including those without updatedAt)
            q = query(
                collection(db, `choirs/${choirId}/songs`)
            );
        } else {
            // Delta Sync: Fetch only changed songs
            const syncTime = Timestamp.fromMillis(lastSyncTimestamp);
            q = query(
                collection(db, `choirs/${choirId}/songs`),
                where("updatedAt", ">", syncTime)
            );
        }

        const snapshot = await safeGetDocs(q, `syncSongs(${choirId})`, 2000);
        const changes = snapshot.docs.map(doc => {
            const data = doc.data();
            // Fallback: If no updatedAt, use addedAt. Do NOT fabricate timestamps.
            const updatedAtVal = data.updatedAt || data.addedAt || null;
            return {
                id: doc.id,
                ...data,
                addedAt: data.addedAt?.toDate?.()?.toISOString() || data.addedAt,
                updatedAt: updatedAtVal?.toDate?.()?.toISOString() || updatedAtVal,
            } as unknown as SimpleSong;
        });

        const songs = changes.filter(s => !s.deletedAt);
        const deletedIds = changes.filter(s => s.deletedAt).map(s => s.id);

        return { songs, deletedIds };
    } catch (error) {
        // If query fails (e.g. missing index), fall back to full sync or empty?
        // Better to return empty and let next full sync handle it, or log error.
        // For "MyChoir", we expect the index to exist.
        console.error("Error syncing songs:", error);
        return { songs: [], deletedIds: [] };
    }
}

export async function getSong(choirId: string, songId: string): Promise<SimpleSong | null> {
    // If offline, try to find song in cached songs list
    if (isOffline()) {
        const cachedSongs = getCachedSongs(choirId);
        if (cachedSongs) {
            const song = cachedSongs.find(s => s.id === songId);
            if (song) {
                console.log('[DB] Serving song from offline cache:', songId);
                return song;
            }
        }
        console.warn('[DB] Offline but song not in cache:', songId);
        return null;
    }

    try {
        const docRef = doc(db, `choirs/${choirId}/songs`, songId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            const data = snapshot.data();
            return {
                id: snapshot.id,
                ...data,
                addedAt: data.addedAt?.toDate?.()?.toISOString() || data.addedAt,
            } as SimpleSong;
        }
        return null;
    } catch (error) {
        console.error("Error fetching song:", error);
        // Try cache as fallback
        const cachedSongs = getCachedSongs(choirId);
        if (cachedSongs) {
            const song = cachedSongs.find(s => s.id === songId);
            if (song) {
                console.log('[DB] Firestore failed, serving song from cache:', songId);
                return song;
            }
        }
        return null;
    }
}

export async function updateSong(choirId: string, songId: string, updates: Partial<SimpleSong>): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/songs`, songId);
        await updateDoc(docRef, {
            ...removeUndefined(updates),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error updating song:", error);
        throw error;
    }
}

import { uploadPdf as uploadPdfToR2 } from "./storage";

export async function uploadSongPdf(choirId: string, songId: string, file: File | Blob): Promise<string> {
    try {
        // Upload to R2 Storage
        const downloadUrl = await uploadPdfToR2(choirId, songId, file);

        // Update the song document in Firestore with the URL
        await updateSong(choirId, songId, {
            hasPdf: true,
            pdfUrl: downloadUrl
        });

        return downloadUrl;
    } catch (error) {
        console.error("Error uploading PDF:", error);
        throw error;
    }
}

// ============ SERVICES ============

// Get only upcoming services (Optimized for background cache)
export async function getUpcomingServices(choirId: string, limitCount = 5): Promise<Service[]> {
    if (!choirId) return [];
    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // "YYYY-MM-DD" assuming local timezone matches or is close enough

        const q = query(
            collection(db, `choirs/${choirId}/services`),
            where("date", ">=", todayStr),
            orderBy("date", "asc"),
            limit(limitCount)
        );

        const snapshot = await safeGetDocs(q, `getUpcomingServices(${choirId})`, limitCount);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
    } catch (error) {
        console.error("Error fetching upcoming services:", error);
        return [];
    }
}

export async function getServices(choirId: string): Promise<Service[]> {
    if (!choirId) return [];

    // If offline, return cached data immediately
    if (isOffline()) {
        const cached = getCachedServices(choirId);
        if (cached) {
            console.log('[DB] Serving services from offline cache');
            return cached;
        }
        console.warn('[DB] Offline but no cached services');
        return [];
    }

    try {
        const q = query(
            collection(db, `choirs/${choirId}/services`),
            orderBy("date", "desc"),
            limit(200)
        );
        const snapshot = await safeGetDocs(q, `getServices(${choirId})`, 200);
        const services = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Service))
            .filter(s => !s.deletedAt); // Exclude soft-deleted services

        // Smart Sort: Upcoming (Ascending), then Past (Descending)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = services.filter(s => new Date(s.date) >= today)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const past = services.filter(s => new Date(s.date) < today)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const sorted = [...upcoming, ...past];

        // Cache for offline use
        setCachedServices(choirId, sorted);

        return sorted;
    } catch (error) {
        console.error("Error fetching services:", error);
        // Try cache as fallback
        const cached = getCachedServices(choirId);
        if (cached) {
            console.log('[DB] Firestore failed, serving services from cache');
            return cached;
        }
        return [];
    }
}



export async function addService(choirId: string, service: Omit<Service, "id">): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, `choirs/${choirId}/services`), service);

        return docRef.id;
    } catch (error) {
        console.error("Error adding service:", error);
        throw error;
    }
}

export async function updateService(choirId: string, serviceId: string, updates: Partial<Service>): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/services`, serviceId);
        await updateDoc(docRef, updates);

    } catch (error) {
        console.error("Error updating service:", error);
        throw error;
    }
}

// Soft-delete service (moves to trash)
export async function deleteService(choirId: string, serviceId: string): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/services`, serviceId);
        await updateDoc(docRef, {
            deletedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error soft-deleting service:", error);
        throw error;
    }
}

// Permanently delete service (for cleanup)
export async function permanentlyDeleteService(choirId: string, serviceId: string): Promise<void> {
    try {
        await deleteDoc(doc(db, `choirs/${choirId}/services`, serviceId));

    } catch (error) {
        console.error("Error permanently deleting service:", error);
        throw error;
    }
}

// Restore service from trash
export async function restoreService(choirId: string, serviceId: string): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/services`, serviceId);
        await updateDoc(docRef, {
            deletedAt: deleteField()
        });

    } catch (error) {
        console.error("Error restoring service:", error);
        throw error;
    }
}

// Finalize service (locks attendance, triggers stats recalculation)
export async function finalizeService(choirId: string, serviceId: string, userId: string): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/services`, serviceId);
        await updateDoc(docRef, {
            isFinalized: true,
            finalizedAt: new Date().toISOString(),
            finalizedBy: userId,
        });
    } catch (error) {
        console.error("Error finalizing service:", error);
        throw error;
    }
}

// Un-finalize service (unlocks for editing, triggers stats recalculation)
export async function unfinalizeService(choirId: string, serviceId: string): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/services`, serviceId);
        await updateDoc(docRef, {
            isFinalized: deleteField(),
            finalizedAt: deleteField(),
            finalizedBy: deleteField(),
        });
    } catch (error) {
        console.error("Error unfinalizing service:", error);
        throw error;
    }
}

// Get deleted services (for trash bin)
export async function getDeletedServices(choirId: string): Promise<Service[]> {
    try {
        const q = query(
            collection(db, `choirs/${choirId}/services`),
            where("deletedAt", "!=", null),
            limit(100)
        );
        const snapshot = await safeGetDocs(q, `getDeletedServices(${choirId})`, 100);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Service[];
    } catch (error) {
        console.error("Error getting deleted services:", error);
        return [];
    }
}

export async function addSongToService(
    choirId: string,
    serviceId: string,
    serviceSong: ServiceSong
): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/services`, serviceId);
        await updateDoc(docRef, {
            songs: arrayUnion(serviceSong)
        });

    } catch (error) {
        console.error("Error adding song to service:", error);
        throw error;
    }
}

export async function removeSongFromService(
    choirId: string,
    serviceId: string,
    updatedSongs: ServiceSong[]
): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/services`, serviceId);
        await updateDoc(docRef, {
            songs: updatedSongs
        });

    } catch (error) {
        console.error("Error updating service songs:", error);
    }
}

export async function setServiceAttendance(
    choirId: string,
    serviceId: string,
    userId: string,
    status: 'present' | 'absent' | 'unknown'
): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/services`, serviceId);

        // We need to atomically update both arrays to avoid inconsistent state
        // If present: add to confirmed, remove from absent
        // If absent: add to absent, remove from confirmed
        // If unknown: remove from both

        const updates: any = {};

        if (status === 'present') {
            updates.confirmedMembers = arrayUnion(userId);
            updates.absentMembers = arrayRemove(userId);
        } else if (status === 'absent') {
            updates.absentMembers = arrayUnion(userId);
            updates.confirmedMembers = arrayRemove(userId);
        } else {
            updates.confirmedMembers = arrayRemove(userId);
            updates.absentMembers = arrayRemove(userId);
        }

        await updateDoc(docRef, updates);

    } catch (error) {
        console.error("Error setting attendance:", error);
        throw error;
    }
}

// ============ CHOIR & MEMBERS ============

export async function getChoir(choirId: string): Promise<Choir | null> {
    try {
        const docRef = doc(db, "choirs", choirId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as Choir;
        }
        return null;
    } catch (error) {
        console.error("Error fetching choir:", error);
        return null;
    }
}

export async function uploadChoirIcon(choirId: string, file: File | Blob): Promise<string> {
    try {
        // Upload to R2 Storage
        const { uploadChoirIconToR2 } = await import("./storage");
        const downloadUrl = await uploadChoirIconToR2(choirId, file as File);

        const docRef = doc(db, "choirs", choirId);
        await updateDoc(docRef, {
            icon: downloadUrl
        });
        return downloadUrl;
    } catch (error) {
        console.error("Error uploading choir icon:", error);
        throw error;
    }
}

export async function updateChoirMembers(choirId: string, members: any[]): Promise<void> {
    try {
        const docRef = doc(db, "choirs", choirId);
        await updateDoc(docRef, {
            members: members
        });
    } catch (error) {
        console.error("Error updating choir members:", error);
        throw error;
    }
}

export async function updateChoir(choirId: string, updates: Partial<Choir>): Promise<void> {
    try {
        const docRef = doc(db, "choirs", choirId);
        await updateDoc(docRef, updates);
    } catch (error) {
        console.error("Error updating choir:", error);
        throw error;
    }
}

export async function addKnownConductor(choirId: string, name: string): Promise<void> {
    try {
        const docRef = doc(db, "choirs", choirId);
        await updateDoc(docRef, {
            knownConductors: arrayUnion(name)
        });
    } catch (error) {
        console.error("Error adding known conductor:", error);
        throw error;
    }
}

export async function removeKnownConductor(choirId: string, name: string): Promise<void> {
    try {
        const docRef = doc(db, "choirs", choirId);
        await updateDoc(docRef, {
            knownConductors: arrayRemove(name)
        });
    } catch (error) {
        console.error("Error removing known conductor:", error);
        throw error;
    }
}

export async function addKnownCategory(choirId: string, category: string): Promise<void> {
    try {
        const docRef = doc(db, "choirs", choirId);
        await updateDoc(docRef, {
            knownCategories: arrayUnion(category)
        });
    } catch (error) {
        console.error("Error adding known category:", error);
        throw error;
    }
}

export async function addKnownPianist(choirId: string, name: string): Promise<void> {
    try {
        const docRef = doc(db, "choirs", choirId);
        await updateDoc(docRef, {
            knownPianists: arrayUnion(name)
        });
    } catch (error) {
        console.error("Error adding known pianist:", error);
        throw error;
    }
}

export async function removeKnownPianist(choirId: string, name: string): Promise<void> {
    try {
        const docRef = doc(db, "choirs", choirId);
        await updateDoc(docRef, {
            knownPianists: arrayRemove(name)
        });
    } catch (error) {
        console.error("Error removing known pianist:", error);
        throw error;
    }
}

export async function deleteAdminCode(choirId: string, codeToDelete: string): Promise<void> {
    try {
        const choirRef = doc(db, "choirs", choirId);
        const choirSnap = await getDoc(choirRef);

        if (!choirSnap.exists()) throw new Error("Choir not found");

        const data = choirSnap.data();
        const adminCodes = data.adminCodes || [];
        const updatedCodes = adminCodes.filter((ac: any) => ac.code !== codeToDelete);

        await updateDoc(choirRef, { adminCodes: updatedCodes });
    } catch (error) {
        console.error("Error deleting admin code:", error);
        throw error;
    }
}

// ============ NOTIFICATIONS ============

export async function getChoirNotifications(choirId: string): Promise<any[]> {
    try {
        const q = query(
            collection(db, `choirs/${choirId}/notifications`),
            orderBy("createdAt", "desc"),
            limit(100)
        );
        const snapshot = await safeGetDocs(q, `getChoirNotifications(${choirId})`, 100);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return [];
    }
}

export async function markNotificationAsRead(choirId: string, notificationId: string, userId: string): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/notifications`, notificationId);
        await updateDoc(docRef, {
            readBy: arrayUnion(userId)
        });
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
}

export async function deleteNotification(choirId: string, notificationId: string): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/notifications`, notificationId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting notification:", error);
        throw error;
    }
}

// ============ USER ============

export async function createUser(userId: string, data: Partial<UserData>): Promise<void> {
    try {
        // Filter out undefined values - Firestore doesn't accept them
        const cleanData: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                cleanData[key] = value;
            }
        }

        await setDoc(doc(db, "users", userId), {
            ...cleanData,
            createdAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error("Error creating user:", error);
        throw error;
    }
}

// Self-delete: always deletes the currently authenticated user
export async function deleteMyAccount(): Promise<void> {
    try {
        console.log("Calling atomicDeleteSelf function...");
        const deleteFn = httpsCallable(functions, 'atomicDeleteSelf');
        const result = await deleteFn({});
        console.log("atomicDeleteSelf completed, result:", result);

        // Force client-side signout to ensure UI updates immediately
        // even if server-side auth deletion takes time to propagate
        console.log("Forcing client-side signout...");
        await signOut(auth);
        console.log("Client-side signout complete");
    } catch (error) {
        console.error("Error deleting own account:", error);
        throw error;
    }
}

export async function createChoir(name: string): Promise<string> {
    try {
        const createFn = httpsCallable(functions, 'atomicCreateChoir');
        const result = await createFn({ name });
        const data = result.data as any;

        // Force token refresh to pick up new claims immediately
        if (auth.currentUser) {
            const tokenResult = await auth.currentUser.getIdTokenResult(true);
            console.log("[DEBUG] Refreshed Token Claims:", tokenResult.claims);
            if (!tokenResult.claims.choirs) {
                console.warn("[WARNING] 'choirs' claim is MISSING in new token!");
            } else {
                console.log("[DEBUG] 'choirs' claim content:", tokenResult.claims.choirs);
            }
        }

        return data.choirId;
    } catch (error) {
        console.error("Error creating choir:", error);
        throw error;
    }
}

// Force Sync Claims (Self-healing)
export async function forceSyncClaims(): Promise<void> {
    try {
        const syncFn = httpsCallable(functions, 'forceSyncClaims');
        await syncFn();
        // Force token refresh to pick up new claims immediately
        if (auth.currentUser) {
            await auth.currentUser.getIdToken(true);
        }
    } catch (error) {
        console.error("Error forcing claims sync:", error);
        throw error;
    }
}

// Admin-delete: deletes another user by their UID
export async function adminDeleteUser(targetUid: string): Promise<void> {
    try {
        const deleteFn = httpsCallable(functions, 'adminDeleteUser');
        await deleteFn({ targetUid });
    } catch (error) {
        console.error("Error deleting user:", error);
        throw error;
    }
}



export async function getUserProfile(userId: string): Promise<UserData | null> {
    try {
        const docRef = doc(db, "users", userId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as UserData;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user:", error);
        return null;
    }
}

// Get registered users for a specific choir
// ✅ Reads choir doc (1 read) + batch-fetches user docs (max 10 per batch)
// Instead of scanning entire users collection
export async function getChoirUsers(choirId: string): Promise<UserData[]> {
    try {
        const choir = await getChoir(choirId);
        if (!choir?.members) return [];

        // Filter for members who have an account and deduplicate by ID
        const dedupedMembers = Array.from(new Map(choir.members.map(m => [m.id, m])).values());
        return dedupedMembers
            .filter(m => m.hasAccount)
            .map(m => ({
                id: m.id,
                name: m.name,
                role: m.role,
                choirId: choirId,
                choirName: choir.name,
                // Note: email and createdAt are not available in choir.members
                // Permissions might be available in member object
                permissions: m.permissions,
                // We don't have createdAt, so sorting in UI might treat it as undefined
            }));
    } catch (error) {
        console.error("Error fetching choir users:", error);
        return [];
    }
}

export async function mergeMembers(
    choirId: string,
    fromMemberId: string,
    toMemberId: string
): Promise<void> {
    try {
        const mergeFn = httpsCallable(functions, 'atomicMergeMembers');
        await mergeFn({ choirId, fromMemberId, toMemberId });
    } catch (error) {
        console.error("Error merging members:", error);
        throw error;
    }
}

export async function claimMember(choirId: string, targetMemberId: string): Promise<any> {
    try {
        const claimFn = httpsCallable(functions, 'claimMember');
        const result = await claimFn({ choirId, targetMemberId });
        return result.data;
    } catch (error) {
        console.error("Error claiming member:", error);
        throw error;
    }
}

// ============ ATOMIC JOIN/LEAVE ============

export async function joinChoir(inviteCode: string): Promise<any> {
    try {
        const joinFn = httpsCallable(functions, 'atomicJoinChoir');
        const result = await joinFn({ inviteCode });
        // Force token refresh to pick up new Custom Claims
        await auth.currentUser?.getIdToken(true);
        return result.data;
    } catch (error) {
        console.error("Error joining choir:", error);
        throw error;
    }
}

export async function leaveChoir(choirId: string): Promise<void> {
    try {
        const leaveFn = httpsCallable(functions, 'atomicLeaveChoir');
        await leaveFn({ choirId });
        // Force token refresh to pick up updated Custom Claims
        await auth.currentUser?.getIdToken(true);
    } catch (error) {
        console.error("Error leaving choir:", error);
        throw error;
    }
}

export async function updateMember(choirId: string, memberId: string, updates: Record<string, any>): Promise<void> {
    try {
        const updateFn = httpsCallable(functions, 'atomicUpdateMember');
        await updateFn({ choirId, memberId, updates });
    } catch (error) {
        console.error("Error updating member:", error);
        throw error;
    }
}

// ============ GLOBAL ARCHIVE ============

/**
 * ⚠️ DEPRECATED — DO NOT USE IN CLIENT UI
 * Reads entire global_songs collection (7000+ docs = 7000+ reads per call).
 * Use R2 JSON index (global_songs_index.json) instead.
 * GlobalArchive.tsx already uses R2 → Cache → Firestore fallback correctly.
 * This function is kept only for admin scripts.
 */
export async function getGlobalSongs(category?: SongCategory): Promise<GlobalSong[]> {
    console.warn('⚠️ getGlobalSongs() is deprecated — use R2 index instead. This reads 7000+ docs!');
    try {
        let q;
        if (category) {
            q = query(
                collection(db, "global_songs"),
                where("category", "==", category),
                orderBy("title")
            );
        } else {
            q = query(
                collection(db, "global_songs"),
                orderBy("title")
            );
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        } as GlobalSong));
    } catch (error) {
        console.error("Error fetching global songs:", error);
        return [];
    }
}

/**
 * Get a single song from global archive
 */
export async function getGlobalSong(songId: string): Promise<GlobalSong | null> {
    try {
        const docRef = doc(db, "global_songs", songId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            const data = snapshot.data();
            return {
                id: snapshot.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            } as GlobalSong;
        }
        return null;
    } catch (error) {
        console.error("Error fetching global song:", error);
        return null;
    }
}

/**
 * Add a song to the global archive (admin only)
 */
export async function addGlobalSong(song: Omit<GlobalSong, "id">): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, "global_songs"), {
            ...song,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding global song:", error);
        throw error;
    }
}

/**
 * Update a song in the global archive (admin only)
 */
export async function updateGlobalSong(songId: string, updates: Partial<GlobalSong>): Promise<void> {
    try {
        const docRef = doc(db, "global_songs", songId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error updating global song:", error);
        throw error;
    }
}

// ============ PENDING SONGS (Community Submissions) ============

/**
 * Submit a song for approval to the global archive
 */
export async function submitSong(song: Record<string, any>): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, "pending_songs"), {
            ...song,
            status: 'pending' as SongSubmissionStatus,
            submittedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error submitting song:", error);
        throw error;
    }
}

/**
 * Get all pending songs (for admin review)
 */
export async function getPendingSongs(): Promise<PendingSong[]> {
    try {
        const q = query(
            collection(db, "pending_songs"),
            where("status", "==", "pending"),
            orderBy("submittedAt", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submittedAt: doc.data().submittedAt?.toDate?.()?.toISOString() || doc.data().submittedAt,
        } as PendingSong));
    } catch (error) {
        console.error("Error fetching pending songs:", error);
        return [];
    }
}

/**
 * Approve a pending song:
 * 1. Add to global_songs
 * 2. Delete from pending_songs (or mark approved)
 */
export async function approveSong(pendingSong: PendingSong, adminId: string): Promise<void> {
    try {
        // 1. Prepare global song data
        const { id, status, submittedBy, submittedByName, submittedChoirId, submittedAt, reviewedBy, reviewedAt, rejectionReason, ...songData } = pendingSong;

        const globalSongData = {
            ...songData,
            sortTitle: songData.title.toUpperCase(), // Critical for catalog sorting
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // 2. Add to global catalog (mscCatalog)
        await addDoc(collection(db, "mscCatalog"), globalSongData);

        // 3. Mark pending song as approved (or delete it if you prefer cleanup)
        // We'll mark it approved to keep history for the user
        const pendingRef = doc(db, "pending_songs", pendingSong.id!);
        await updateDoc(pendingRef, {
            status: 'approved',
            reviewedBy: adminId,
            reviewedAt: serverTimestamp()
        });

    } catch (error) {
        console.error("Error approving song:", error);
        throw error;
    }
}

/**
 * Reject a pending song
 */
export async function rejectSong(songId: string, adminId: string, reason: string): Promise<void> {
    try {
        const docRef = doc(db, "pending_songs", songId);
        await updateDoc(docRef, {
            status: 'rejected',
            reviewedBy: adminId,
            reviewedAt: serverTimestamp(),
            rejectionReason: reason
        });
    } catch (error) {
        console.error("Error rejecting song:", error);
        throw error;
    }
}

// ============ LOCAL SONGS (Choir's private repertoire) ============

/**
 * Get all local songs for a choir
 */
export async function getLocalSongs(choirId: string): Promise<LocalSong[]> {
    if (!choirId) return [];
    try {
        const q = query(
            collection(db, `choirs/${choirId}/local_songs`),
            where("deletedAt", "==", null), // Only active songs
            orderBy("title")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        } as LocalSong));
    } catch (error) {
        console.error("Error fetching local songs:", error);
        return [];
    }
}

/**
 * Add a song to choir's local repertoire
 */
export async function addLocalSong(
    choirId: string,
    song: Omit<LocalSong, "id" | "choirId">,
    userId: string
): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, `choirs/${choirId}/local_songs`), {
            ...song,
            choirId,
            addedBy: userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding local song:", error);
        throw error;
    }
}

// ============ SONG METADATA (for search index) ============

/**
 * Get lightweight metadata for all songs (global from R2 + local from Firestore).
 * Global songs are loaded from R2 JSON index (0 Firestore reads).
 * Local songs are fetched with limit(200).
 */
export async function getSongsMeta(choirId?: string): Promise<SongMeta[]> {
    try {
        const results: SongMeta[] = [];

        // Global songs — from R2 index (0 Firestore reads)
        try {
            const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
            if (publicUrl) {
                const res = await fetch(`${publicUrl}/global_songs_index.json?t=${Date.now()}`);
                if (res.ok) {
                    const globalSongs: GlobalSong[] = await res.json();
                    globalSongs.forEach(song => {
                        results.push({
                            id: song.id || '',
                            title: song.title,
                            composer: song.composer,
                            category: song.category as SongCategory,
                            subcategory: song.subcategory,
                            keywords: song.keywords || [],
                            partCount: song.parts?.length || 1,
                            source: 'global' as SongSource
                        });
                    });
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`📊 [getSongsMeta] Loaded ${globalSongs.length} global songs from R2 (0 Firestore reads)`);
                    }
                }
            }
        } catch (e) {
            console.warn('[getSongsMeta] R2 index unavailable, skipping global songs');
        }

        // Local songs (if choirId provided) — from Firestore with limit
        if (choirId) {
            const localQ = query(
                collection(db, `choirs/${choirId}/local_songs`),
                orderBy("title"),
                limit(200)
            );
            const localSnapshot = await safeGetDocs(localQ, `getSongsMeta.local(${choirId})`, 200);
            localSnapshot.docs.forEach(doc => {
                const data = doc.data();
                results.push({
                    id: doc.id,
                    title: data.title,
                    composer: data.composer,
                    category: data.category,
                    subcategory: data.subcategory,
                    keywords: data.keywords || [],
                    partCount: data.parts?.length || 1,
                    source: 'local' as SongSource
                });
            });
        }

        return results;
    } catch (error) {
        console.error("Error fetching songs meta:", error);
        return [];
    }
}

// ============ USER SAVED SONGS ============

/**
 * Add a song to user's saved collection (personal folder)
 */
export async function saveUserSong(
    userId: string,
    songId: string,
    source: SongSource,
    partIndex: number = 0
): Promise<void> {
    try {
        const docRef = doc(db, "users", userId);
        const savedSong = {
            songId,
            source,
            partIndex,
            savedAt: new Date().toISOString()
        };
        await updateDoc(docRef, {
            savedSongs: arrayUnion(savedSong)
        });
    } catch (error) {
        console.error("Error saving song:", error);
        throw error;
    }
}

/**
 * Remove a song from user's saved collection
 */
export async function unsaveUserSong(
    userId: string,
    songId: string,
    source: SongSource
): Promise<void> {
    try {
        // Get current saved songs
        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const savedSongs = userData.savedSongs || [];
        const updatedSongs = savedSongs.filter(
            (s: any) => !(s.songId === songId && s.source === source)
        );

        await updateDoc(doc(db, "users", userId), {
            savedSongs: updatedSongs
        });
    } catch (error) {
        console.error("Error unsaving song:", error);
        throw error;
    }
}

// ============ TRASH BIN (Soft Delete) ============

export async function softDeleteLocalSong(choirId: string, songId: string, userId: string): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/songs`, songId); // Corrected collection
        await updateDoc(docRef, {
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            deletedBy: userId
        });
    } catch (error) {
        console.error("Error soft-deleting local song:", error);
        throw error;
    }
}

export async function restoreLocalSong(choirId: string, songId: string): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/songs`, songId); // Corrected collection
        await updateDoc(docRef, {
            deletedAt: deleteField(),
            deletedBy: deleteField(),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error restoring local song:", error);
        throw error;
    }
}

export async function permanentDeleteLocalSong(choirId: string, songId: string): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/songs`, songId); // Corrected collection
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error permanently deleting local song:", error);
        throw error;
    }
}

export async function getDeletedSongs(choirId: string): Promise<SimpleSong[]> {
    try {
        const q = query(
            collection(db, `choirs/${choirId}/songs`),
            where("deletedAt", "!=", null),
            limit(200)
        );
        const snapshot = await safeGetDocs(q, `getDeletedSongs(${choirId})`, 200);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SimpleSong[];
    } catch (error) {
        console.error("Error getting deleted songs:", error);
        return [];
    }
}

export async function getDeletedLocalSongs(choirId: string): Promise<LocalSong[]> {
    try {
        const q = query(
            collection(db, `choirs/${choirId}/local_songs`),
            where("deletedAt", "!=", null),
            orderBy("deletedAt", "desc"),
            limit(200)
        );
        const snapshot = await safeGetDocs(q, `getDeletedLocalSongs(${choirId})`, 200);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        } as LocalSong));
    } catch (error) {
        console.error("Error fetching deleted local songs:", error);
        return [];
    }
}

export async function getMemberAbsences(choirId: string, memberId: string, maxResults: number = 20): Promise<Service[]> {
    try {
        const q = query(
            collection(db, `choirs/${choirId}/services`),
            where("absentMembers", "array-contains", memberId),
            orderBy("date", "desc"),
            limit(maxResults)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
    } catch (e) {
        console.error("Error fetching member absences:", e);
        return [];
    }
}

