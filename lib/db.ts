import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp,
    arrayUnion,
    arrayRemove
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

// ============ SERVICES ============

export async function getServices(choirId: string): Promise<Service[]> {
    if (!choirId) return [];
    try {
        const q = query(
            collection(db, `choirs/${choirId}/services`)
        );
        const snapshot = await getDocs(q);
        const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
        // Client-side sort to be safe with date strings/timestamps mix
        return services.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
    // Firestore arrayRemove only works for exact primitive match or object match. 
    // Since we modifying the list index or might have duplicates, usually typically easier to just replace the whole array.
    try {
        const docRef = doc(db, `choirs/${choirId}/services`, serviceId);
        await updateDoc(docRef, {
            songs: updatedSongs
        });
    } catch (error) {
        console.error("Error updating service songs:", error);
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

export async function updateChoirIcon(choirId: string, iconBase64: string): Promise<void> {
    try {
        const docRef = doc(db, "choirs", choirId);
        await updateDoc(docRef, {
            icon: iconBase64
        });
    } catch (error) {
        console.error("Error updating choir icon:", error);
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

// ============ USER ============

export async function createUser(userId: string, data: Partial<UserData>): Promise<void> {
    try {
        await setDoc(doc(db, "users", userId), {
            ...data,
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
