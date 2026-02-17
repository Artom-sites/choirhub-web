/**
 * Upload a file to R2 via the API (using Presigned URL)
 */
export async function uploadFileToR2(key: string, file: File | Blob): Promise<string> {
    // 1. Get Presigned URL
    // Get auth token from current user
    const { auth } = await import("@/lib/firebase");
    const token = await auth.currentUser?.getIdToken();

    if (!token) {
        throw new Error("You must be logged in to upload files.");
    }

    const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ key, contentType: file.type })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to get upload URL");
    }

    const { signedUrl, publicUrl } = await res.json();

    // 2. Upload to R2
    const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
    });

    if (!uploadRes.ok) throw new Error("Failed to upload file to R2");

    return publicUrl;
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
