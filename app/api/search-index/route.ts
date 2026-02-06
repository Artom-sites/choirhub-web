import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import * as admin from "firebase-admin";

// Initialize Firebase Admin if not already
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}
const db = admin.firestore();

const INDEX_KEY = "global_songs_index.json";

// Helper to stream to string
const streamToString = (stream: any) =>
    new Promise<string>((resolve, reject) => {
        const chunks: any[] = [];
        stream.on("data", (chunk: any) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });

export async function POST(req: NextRequest) {
    if (!r2Client) {
        return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
    }

    try {
        const body = await req.json();
        const { action, song } = body;
        // action: 'add' | 'update' | 'delete' | 'rebuild'

        if (!action) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        let currentDesc: any[] = [];

        if (action === 'rebuild') {
            // FETCH ALL SONGS from Firestore (One-time heavy read)
            console.log("Rebuilding index from scratch...");
            const snapshot = await db.collection("global_songs").orderBy("title").get();
            currentDesc = snapshot.docs.map(doc => {
                const data = doc.data();
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
                };
            });
            console.log(`Fetched ${snapshot.docs.length} songs for index.`);
        } else {
            // Incremental Update (Read existing index first)
            if (!song || !song.id) {
                return NextResponse.json({ error: "Missing song data for incremental update" }, { status: 400 });
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

            // Minimal fields for search
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

        return NextResponse.json({ success: true, count: currentDesc.length });
    } catch (error: any) {
        console.error("Index Update Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
