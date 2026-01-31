import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";

export async function POST(request: NextRequest) {
    try {
        const { key, contentType } = await request.json();

        if (!key || !contentType) {
            return NextResponse.json({ error: "Missing key or contentType" }, { status: 400 });
        }

        // Validate Key - prevent escaping directory
        if (key.includes("..")) {
            return NextResponse.json({ error: "Invalid key" }, { status: 400 });
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
