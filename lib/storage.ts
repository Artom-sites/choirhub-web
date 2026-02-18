/**
 * Upload a file to R2 via the API (using Presigned URL)
 */
export async function uploadFileToR2(key: string, file: File | Blob): Promise<string> {
    // 1. Get Presigned URL via Callable Function (Works on Mobile & Web)
    const { functions } = await import("@/lib/firebase");
    const { httpsCallable } = await import("firebase/functions");

    const generateUploadUrl = httpsCallable(functions, 'generateUploadUrl');

    try {
        const result = await generateUploadUrl({ key, contentType: file.type });
        const { signedUrl, publicUrl } = result.data as { signedUrl: string, publicUrl: string };

        // 2. Upload to R2 directly (CORS is handled by R2 bucket settings)
        const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file
        });

        if (!uploadRes.ok) throw new Error("Failed to upload file to R2");

        return publicUrl;
    } catch (error: any) {
        console.error("Upload failed:", error);
        throw new Error(error.message || "Failed to upload file");
    }
}

export async function uploadPdf(choirId: string, songId: string, file: File | Blob): Promise<string> {
    return uploadFileToR2(`choirs/${choirId}/${songId}.pdf`, file);
}

export async function uploadChoirIconToR2(choirId: string, file: File): Promise<string> {
    // Preserve extension if possible, or default to generic
    const ext = file.name.split('.').pop() || 'png';
    const key = `choirs/${choirId}/icon.${ext}`;
    return uploadFileToR2(key, file);
}

// Alias for pending songs
export async function uploadPendingSongPdf(songId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'pdf';
    const key = `pending/${songId}/${Date.now()}.${ext}`;
    return uploadFileToR2(key, file);
}
