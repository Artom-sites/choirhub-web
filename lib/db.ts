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
    Timestamp,
    serverTimestamp,
    updateDoc,
    arrayUnion,
    arrayRemove,
    deleteField
} from "firebase/firestore";
import { db } from "./firebase";
import {
    Service, SimpleSong, Choir, UserData, ServiceSong,
    GlobalSong, LocalSong, SongMeta, SongCategory, SongSource
} from "@/types";

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

export async function getSongs(choirId: string): Promise<SimpleSong[]> {
    if (!choirId) return [];
    try {
        const q = query(
            collection(db, `choirs/${choirId}/songs`),
            orderBy("title")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as SimpleSong))
            .filter(song => !song.deletedAt);
    } catch (error) {
        console.error("Error fetching songs:", error);
        return [];
    }
}

export async function addSong(choirId: string, song: Omit<SimpleSong, "id">): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, `choirs/${choirId}/songs`), {
            ...song,
            addedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding song:", error);
        throw error;
    }
}

export async function deleteSong(choirId: string, songId: string): Promise<void> {
    try {
        await deleteDoc(doc(db, `choirs/${choirId}/songs`, songId));
    } catch (error) {
        console.error("Error deleting song:", error);
        throw error;
    }
}

export async function getSong(choirId: string, songId: string): Promise<SimpleSong | null> {
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
        return null;
    }
}

export async function updateSong(choirId: string, songId: string, updates: Partial<SimpleSong>): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/songs`, songId);
        await updateDoc(docRef, updates);
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

export async function getServices(choirId: string): Promise<Service[]> {
    if (!choirId) return [];
    try {
        const q = query(
            collection(db, `choirs/${choirId}/services`)
        );
        const snapshot = await getDocs(q);
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

        return [...upcoming, ...past];
    } catch (error) {
        console.error("Error fetching services:", error);
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

// Get deleted services (for trash bin)
export async function getDeletedServices(choirId: string): Promise<Service[]> {
    try {
        const q = query(
            collection(db, `choirs/${choirId}/services`),
            where("deletedAt", "!=", null)
        );
        const snapshot = await getDocs(q);
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

// Delete user account and cleanup references
export async function deleteUserAccount(userId: string): Promise<void> {
    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data() as UserData;

            // Remove from choirs
            const memberships = userData.memberships || [];
            // Fallback for old schema
            if (memberships.length === 0 && userData.choirId) {
                memberships.push({ choirId: userData.choirId, role: userData.role } as any);
            }

            for (const membership of memberships) {
                if (!membership.choirId) continue;

                const choirRef = doc(db, "choirs", membership.choirId);
                const choirSnap = await getDoc(choirRef);

                if (choirSnap.exists()) {
                    const choirData = choirSnap.data();
                    const members = choirData.members || [];
                    const updatedMembers = members.filter((m: any) => m.id !== userId);

                    if (updatedMembers.length !== members.length) {
                        await updateDoc(choirRef, { members: updatedMembers });
                    }
                }
            }
        }

        await deleteDoc(userRef);
    } catch (error) {
        console.error("Error deleting user account:", error);
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

export async function mergeMembers(
    choirId: string,
    fromMemberId: string,
    toMemberId: string
): Promise<void> {
    try {
        // 1. Get all services
        const services = await getServices(choirId);

        // 2. Update each service that contains the old member
        const updates = services.map(async (service) => {
            let changed = false;
            let newConfirmed = service.confirmedMembers || [];
            let newAbsent = service.absentMembers || [];

            // Helper to check and swap
            if (newConfirmed.includes(fromMemberId)) {
                newConfirmed = newConfirmed.filter(id => id !== fromMemberId);
                if (!newConfirmed.includes(toMemberId)) {
                    newConfirmed.push(toMemberId);
                }
                changed = true;
            }

            if (newAbsent.includes(fromMemberId)) {
                newAbsent = newAbsent.filter(id => id !== fromMemberId);
                if (!newAbsent.includes(toMemberId)) {
                    newAbsent.push(toMemberId);
                }
                changed = true;
            }

            if (changed) {
                const serviceRef = doc(db, `choirs/${choirId}/services`, service.id);
                await updateDoc(serviceRef, {
                    confirmedMembers: newConfirmed,
                    absentMembers: newAbsent
                });
            }
        });

        await Promise.all(updates);

        // 3. Remove the old member from the choir member list
        const choirRef = doc(db, "choirs", choirId);
        const choirSnap = await getDoc(choirRef);
        if (choirSnap.exists()) {
            const data = choirSnap.data();
            const members = data.members || [];
            const updatedMembers = members.filter((m: any) => m.id !== fromMemberId);
            await updateDoc(choirRef, { members: updatedMembers });
        }

    } catch (error) {
        console.error("Error merging members:", error);
        throw error;
    }
}

// ============ GLOBAL ARCHIVE ============

/**
 * Get all songs from the global archive (Братство)
 * Optionally filter by category
 */
export async function getGlobalSongs(category?: SongCategory): Promise<GlobalSong[]> {
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
 * Get lightweight metadata for all songs (global + local)
 * Used to build the search index
 */
export async function getSongsMeta(choirId?: string): Promise<SongMeta[]> {
    try {
        const results: SongMeta[] = [];

        // Global songs
        const globalSnapshot = await getDocs(
            query(collection(db, "global_songs"), orderBy("title"))
        );
        globalSnapshot.docs.forEach(doc => {
            const data = doc.data();
            results.push({
                id: doc.id,
                title: data.title,
                composer: data.composer,
                category: data.category,
                subcategory: data.subcategory,
                keywords: data.keywords || [],
                partCount: data.parts?.length || 1,
                source: 'global' as SongSource
            });
        });

        // Local songs (if choirId provided)
        if (choirId) {
            const localSnapshot = await getDocs(
                query(collection(db, `choirs/${choirId}/local_songs`), orderBy("title"))
            );
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
        const docRef = doc(db, `choirs/${choirId}/local_songs`, songId);
        await updateDoc(docRef, {
            deletedAt: new Date().toISOString(),
            deletedBy: userId
        });
    } catch (error) {
        console.error("Error soft-deleting local song:", error);
        throw error;
    }
}

export async function restoreLocalSong(choirId: string, songId: string): Promise<void> {
    try {
        const docRef = doc(db, `choirs/${choirId}/local_songs`, songId);
        await updateDoc(docRef, {
            deletedAt: deleteField(),
            deletedBy: deleteField()
        });
    } catch (error) {
        console.error("Error restoring local song:", error);
        throw error;
    }
}

export async function permanentDeleteLocalSong(choirId: string, songId: string): Promise<void> {
    try {
        await deleteDoc(doc(db, `choirs/${choirId}/local_songs`, songId));
    } catch (error) {
        console.error("Error permanently deleting local song:", error);
        throw error;
    }
}

export async function getDeletedLocalSongs(choirId: string): Promise<LocalSong[]> {
    try {
        const q = query(
            collection(db, `choirs/${choirId}/local_songs`),
            where("deletedAt", "!=", null),
            orderBy("deletedAt", "desc")
        );
        const snapshot = await getDocs(q);
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

