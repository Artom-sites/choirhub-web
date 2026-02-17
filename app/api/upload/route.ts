import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL, isR2Configured } from "@/lib/r2";

export async function POST(request: NextRequest) {
    try {
        // Check if R2 is configured
        if (!isR2Configured || !r2Client) {
            return NextResponse.json(
                { error: "R2 storage is not configured" },
                { status: 503 }
            );
        }

        // 1. Verify Authorization
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];

        // Lazy load admin to prevent cold start issues if possible, or just standard import
        const { getAdmin } = await import("@/lib/firebase-admin");
        const adminApp = getAdmin();

        if (!adminApp) {
            console.error("Firebase Admin not initialized (missing env vars)");
            return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
        }

        let decodedToken;
        try {
            decodedToken = await adminApp.auth().verifyIdToken(token);
        } catch (e) {
            console.error("Token verification failed:", e);
            return NextResponse.json({ error: "Invalid Token" }, { status: 403 });
        }

        const { key, contentType } = await request.json();

        if (!key || !contentType) {
            return NextResponse.json({ error: "Missing key or contentType" }, { status: 400 });
        }

        // Validate Key - prevent escaping directory
        if (key.includes("..")) {
            return NextResponse.json({ error: "Invalid key" }, { status: 400 });
        }

        // 2. Authorization Rules
        const isSuperAdmin = decodedToken.superAdmin === true;

        // Rule A: Choir Resources (choirs/{choirId}/...)
        if (key.startsWith("choirs/")) {
            const parts = key.split("/");
            if (parts.length < 3) return NextResponse.json({ error: "Invalid key format" }, { status: 400 });
            const choirId = parts[1];

            const userRole = decodedToken.choirs?.[choirId];
            const canUpload = isSuperAdmin || ['admin', 'regent', 'head'].includes(userRole);

            if (!canUpload) {
                return NextResponse.json({ error: "Insufficient permissions for this choir" }, { status: 403 });
            }
        }
        // Rule B: Pending Songs (pending/...)
        else if (key.startsWith("pending/")) {
            // Any authenticated user can upload pending songs
            if (!decodedToken.uid) {
                return NextResponse.json({ error: "Must be logged in" }, { status: 401 });
            }
        }
        // Rule C: Global Resources (global/...) or anything else
        else {
            if (!isSuperAdmin) {
                return NextResponse.json({ error: "Root/Global access denied" }, { status: 403 });
            }
        }

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        // Generate Presigned URL (valid for 1 hour)
        const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
        const publicUrl = `${R2_PUBLIC_URL}/${key}`;

        return NextResponse.json({ signedUrl, publicUrl });
    } catch (error: any) {
        console.error("R2 Presign Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

