import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import * as admin from "firebase-admin";

// Initialize Firebase Admin if not already lazily to avoid Vercel build errors
function getDb() {
    if (!admin.apps.length) {
        const b64Key = process.env.FIREBASE_PRIVATE_KEY_B64 || '';
        const privateKey = b64Key ? Buffer.from(b64Key, 'base64').toString('utf8').replace(/\\n/g, '\n') : '';

        if (b64Key && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL) {
            try {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: privateKey,
                    }),
                });
            } catch (e: any) {
                console.error("FIREBASE INIT ERROR:", e.message);
            }
        } else {
            console.warn("Skipping Firebase Admin init: Missing environment variables (expected during build)");
        }
    }
    return admin.firestore();
}

const INDEX_KEY = "global_songs_index.json";

// Helper to stream to string
const streamToString = (stream: any) =>
    new Promise<string>((resolve, reject) => {
        const chunks: any[] = [];
        stream.on("data", (chunk: any) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
    const db = getDb();

    if (!r2Client) {
        return NextResponse.json({ error: "R2 not configured" }, { status: 503, headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { action, song } = body;
        // action: 'add' | 'update' | 'delete' | 'rebuild'

        if (!action) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: corsHeaders });
        }

        let currentDesc: any[] = [];

        if (action === 'rebuild') {
            // FETCH ALL SONGS from Firestore (One-time heavy read)
            console.log("Rebuilding index from scratch...");
            const snapshot = await db.collection("global_songs").orderBy("title").get();
            currentDesc = snapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    // Global kill switch: exclude songs where isEnabled is explicitly false
                    return data.isEnabled !== false;
                })
                .map(doc => {
                    const data = doc.data();
                    // Serialize Firestore Timestamp to ISO string so JSON round-trips cleanly
                    const updatedAt = data.updatedAt?.toDate?.()?.toISOString()
                        ?? data.addedAt?.toDate?.()?.toISOString()
                        ?? null;
                    return {
                        id: doc.id,
                        title: data.title,
                        category: data.category,
                        subcategory: data.subcategory || null,
                        theme: data.theme || null,
                        composer: data.composer || null,
                        poet: data.poet || null,
                        pdfUrl: data.pdfUrl || data.parts?.[0]?.pdfUrl || null,
                        partsCount: data.parts?.length || 0,
                        updatedAt,
                    };
                });
            console.log(`Fetched ${snapshot.docs.length} songs for index.`);
        } else {
            // Incremental Update (Read existing index first)
            if (!song || !song.id) {
                return NextResponse.json({ error: "Missing song data for incremental update" }, { status: 400, headers: corsHeaders });
            }

            try {
                const getCmd = new GetObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: INDEX_KEY,
                });
                const response = await r2Client.send(getCmd);
                if (response.Body) {
                    const str = await streamToString(response.Body);
                    currentDesc = JSON.parse(str);
                }
            } catch (e: any) {
                console.warn("Index not found or empty, starting fresh.", e.message);
            }

            // Minimal fields for search + updatedAt for client-side delta sync
            const updatedAt = song.updatedAt
                ? (typeof song.updatedAt === 'string'
                    ? song.updatedAt
                    : song.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString())
                : new Date().toISOString();

            const miniSong = {
                id: song.id,
                title: song.title,
                category: song.category,
                subcategory: song.subcategory || null,
                theme: song.theme || null,
                composer: song.composer || null,
                poet: song.poet || null,
                pdfUrl: song.pdfUrl || song.parts?.[0]?.pdfUrl || null,
                partsCount: song.parts?.length || 0,
                updatedAt,
            };

            if (action === 'add' || action === 'update') {
                currentDesc = currentDesc.filter(s => s.id !== song.id);
                currentDesc.push(miniSong);
            } else if (action === 'delete') {
                currentDesc = currentDesc.filter(s => s.id !== song.id);
            }
        }

        // Upload updated index
        const putCmd = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: INDEX_KEY,
            Body: JSON.stringify(currentDesc),
            ContentType: "application/json",
            CacheControl: "no-cache",
        });

        await r2Client.send(putCmd);

        return NextResponse.json({ success: true, count: currentDesc.length }, { headers: corsHeaders });
    } catch (error: any) {
        console.error("Index Update Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
