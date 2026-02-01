import { S3Client } from "@aws-sdk/client-s3";

const hasR2Credentials = !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
);

// Helper to avoid build-time errors if crendentials are missing
export const r2Client = hasR2Credentials
    ? new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
    })
    : null;

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'msc-catalog';
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';
export const isR2Configured = hasR2Credentials;

