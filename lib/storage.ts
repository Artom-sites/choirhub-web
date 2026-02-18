/**
 * Upload a file to R2 via the API (using Presigned URL)
 */
export async function uploadFileToR2(key: string, file: File | Blob): Promise<string> {
    // 1. Get Presigned URL via Direct HTTP Cloud Function (Bypass Client SDK to resolve internal errors)
    const { auth, app } = await import("@/lib/firebase");

    const user = auth.currentUser;
    if (!user) throw new Error("User must be logged in");

    const token = await user.getIdToken();
    const projectId = app.options.projectId;
    const region = "us-central1"; // Default region
    const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/generateUploadUrl`;

    try {
        const res = await fetch(functionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ key, contentType: file.type, size: file.size })
        });

        if (!res.ok) {
            const errorText = await res.text();
            let errorMessage = "Failed to get upload URL";
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorMessage;
            } catch (e) {
                errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
            }
            throw new Error(errorMessage);
        }

        const { signedUrl, publicUrl } = await res.json();

        // 2. Upload to R2 directly (CORS is handled by R2 bucket settings)
        const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file
        });

        if (!uploadRes.ok) throw new Error("Failed to upload file to R2");

        return publicUrl;

    } catch (error: any) {
        console.error("Upload failed details:", error);
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
