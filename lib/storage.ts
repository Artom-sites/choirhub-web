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

    // Normalize content type — iOS file picker sometimes returns empty or wrong type
    let contentType = file.type;
    if (!contentType || contentType === 'application/octet-stream') {
        // Infer from key extension
        if (key.endsWith('.pdf')) contentType = 'application/pdf';
        else if (key.endsWith('.png')) contentType = 'image/png';
        else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) contentType = 'image/jpeg';
        else contentType = 'application/octet-stream';
    }

    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                // Exponential backoff: 1s, 2s
                await new Promise(r => setTimeout(r, attempt * 1000));
                console.log(`[Upload] Retry attempt ${attempt} for ${key}`);
            }

            const res = await fetch(functionUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ key, contentType, size: file.size })
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
                headers: { "Content-Type": contentType },
                body: file
            });

            if (!uploadRes.ok) throw new Error("Failed to upload file to R2");

            return publicUrl;

        } catch (error: any) {
            lastError = error;
            console.error(`[Upload] Attempt ${attempt + 1} failed for ${key}:`, error.message);
            if (attempt === maxRetries) break;
        }
    }

    throw new Error(lastError?.message || "Failed to upload file after retries");
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

// Upload a specific part PDF with UUID-based key
export async function uploadSongPartPdf(
    choirId: string,
    songId: string,
    partId: string,
    file: File | Blob
): Promise<string> {
    const key = `choirs/${choirId}/${songId}/parts/${partId}.pdf`;
    return uploadFileToR2(key, file);
}

/**
 * Delete a file from R2 via Cloud Function.
 * Best-effort — logs warning on failure but does not throw.
 */
export async function deleteFileFromR2(key: string): Promise<void> {
    try {
        const { auth, app } = await import("@/lib/firebase");
        const user = auth.currentUser;
        if (!user) return;

        const token = await user.getIdToken();
        const projectId = app.options.projectId;
        const region = "us-central1";
        const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/generateDeleteUrl`;

        const res = await fetch(functionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ key })
        });

        if (!res.ok) {
            console.warn(`[R2 Delete] Failed for key ${key}: ${res.status}`);
        }
    } catch (error) {
        console.warn("[R2 Delete] Best-effort deletion failed:", error);
    }
}

// Delete a specific part PDF from R2
export async function deleteSongPartPdf(
    choirId: string,
    songId: string,
    partId: string
): Promise<void> {
    const key = `choirs/${choirId}/${songId}/parts/${partId}.pdf`;
    await deleteFileFromR2(key);
}
