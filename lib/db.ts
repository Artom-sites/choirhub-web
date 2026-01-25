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
import { Service, SimpleSong, Choir, UserData, ServiceSong } from "@/types";

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
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimpleSong));
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

import { uploadPdfToSupabase } from "./supabase";

export async function uploadSongPdf(choirId: string, songId: string, file: File | Blob): Promise<string> {
    try {
        // Upload to Supabase Storage
        const downloadUrl = await uploadPdfToSupabase(choirId, songId, file);

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
        const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));

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

export async function deleteService(choirId: string, serviceId: string): Promise<void> {
    try {
        await deleteDoc(doc(db, `choirs/${choirId}/services`, serviceId));
    } catch (error) {
        console.error("Error deleting service:", error);
        throw error;
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
        // Upload to Supabase Storage (using 'icons' bucket or folder)
        const { supabase } = await import("./supabase");
        const fileName = `choirs/${choirId}/icon.jpg`;

        const { error: uploadError } = await supabase.storage
            .from('songs')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true,
                contentType: 'image/jpeg'
            });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
            .from('songs')
            .getPublicUrl(fileName);

        const downloadUrl = urlData.publicUrl;

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
