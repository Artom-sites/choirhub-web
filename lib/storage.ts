import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Upload a file to Firebase Storage
 * @param path - Storage path (e.g., "pending/songId/filename.pdf")
 * @param file - File to upload
 * @returns Download URL of the uploaded file
 */
export async function uploadFile(path: string, file: File | Blob): Promise<string> {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
}

/**
 * Upload a PDF for a pending song submission
 */
export async function uploadPendingSongPdf(songId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'pdf';
    const path = `pending_songs/${songId}/${Date.now()}.${ext}`;
    return uploadFile(path, file);
}

/**
 * Upload a choir icon
 */
export async function uploadChoirIcon(choirId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'png';
    const path = `choirs/${choirId}/icon.${ext}`;
    return uploadFile(path, file);
}

/**
 * Upload a PDF for a choir's local song
 */
export async function uploadPdf(choirId: string, songId: string, file: File | Blob): Promise<string> {
    return uploadFile(`choirs/${choirId}/${songId}.pdf`, file);
}

// Legacy R2 functions (kept for backwards compatibility, will use Firebase instead)
export const uploadFileToR2 = uploadFile;
export const uploadChoirIconToR2 = uploadChoirIcon;
