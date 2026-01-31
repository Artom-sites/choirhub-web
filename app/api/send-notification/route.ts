import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export async function POST(req: NextRequest) {
    try {
        const { title, body, choirId } = await req.json();
        const authHeader = req.headers.get("Authorization");

        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        const adminApp = getAdmin();

        if (!adminApp) {
            return NextResponse.json(
                { error: "Firebase Admin not configured" },
                { status: 500 }
            );
        }

        // 1. Verify User
        const decodedToken = await getAuth(adminApp).verifyIdToken(token);
        const uid = decodedToken.uid;

        // 2. Check Permissions (Regent or explicit permission)
        const db = getFirestore(adminApp);
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.data();

        // Check membership in choir
        const membership = userData?.memberships?.find((m: any) => m.choirId === choirId);

        if (!membership) {
            return NextResponse.json({ error: "Not a member of this choir" }, { status: 403 });
        }

        // Check role or permissions
        // We need to fetch the choir-specific permissions if they are not in membership
        // Usually auth context has recent perms, but here we trust DB.
        // Let's assume 'regent' role is sufficient.
        // For 'notify_members', we should check userData.permissions (global) or if we store per-choir perms?
        // In `app/page.tsx` we use `userData.permissions`.

        const isRegent = membership.role === 'regent' || membership.role === 'head';
        const hasPermission = userData?.permissions?.includes('notify_members');

        if (!isRegent && !hasPermission) {
            return NextResponse.json({ error: "Permission denied" }, { status: 403 });
        }

        // 3. Fetch Recipients
        // Get all users who are members of this choir AND have notificationsEnabled: true
        // Ideally, we should query users collection where `memberships` contains choirId.
        // But typical NoSQL structure might make this hard if memberships is array of objects.
        // If we can't query easily, we can query users by array-contains? No, object array.

        // Alternative: Get Choir document -> members array -> IDs.
        // Then fetch users by IDs (batches of 10-30).
        const choirDoc = await db.collection("choirs").doc(choirId).get();
        const choirData = choirDoc.data();
        if (!choirData) return NextResponse.json({ error: "Choir not found" }, { status: 404 });

        const memberIds = (choirData.members || []).map((m: any) => m.id);

        // Fetch users in batches (max 10 for 'in' query usually, but logic allows 30 for lookup)
        // Actually we can just fetch all users and filter?? No, too expensive.
        // Best: Iterate IDs and fetch docs.

        const tokens: string[] = [];

        // Chunk IDs to avoid limits (max 10 items in 'in' operator, but getAll accepts array of Refs)
        // Firestore 'getAll' or fetch in parallel.

        const userRefs = memberIds.map((id: string) => db.collection("users").doc(id));

        // Fetch all user docs
        const userDocs = await db.getAll(...userRefs);

        userDocs.forEach(doc => {
            const u = doc.data();
            if (u && u.notificationsEnabled && u.fcmTokens && Array.isArray(u.fcmTokens)) {
                tokens.push(...u.fcmTokens);
            }
        });

        // Filter duplicates
        const uniqueTokens = Array.from(new Set(tokens));

        if (uniqueTokens.length === 0) {
            return NextResponse.json({ success: true, message: "No devices to send to" });
        }

        // 4. Send Multicast Message
        const message = {
            notification: {
                title: title,
                body: body,
            },
            tokens: uniqueTokens,
        };

        const response = await getMessaging(adminApp).sendEachForMulticast(message);

        // Optional: Cleanup invalid tokens from response
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(uniqueTokens[idx]);
                }
            });
            // We could delete these tokens from users, but let's keep it simple for now.
            console.log("Failed tokens:", failedTokens);
        }

        return NextResponse.json({
            success: true,
            count: response.successCount,
            failed: response.failureCount
        });

    } catch (error: any) {
        console.error("Send notification error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
