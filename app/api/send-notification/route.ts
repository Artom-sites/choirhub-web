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
        console.log(`[Notification] Fetching members for choir: ${choirId}`);
        const choirDoc = await db.collection("choirs").doc(choirId).get();
        const choirData = choirDoc.data();
        if (!choirData) {
            console.error("[Notification] Choir not found");
            return NextResponse.json({ error: "Choir not found" }, { status: 404 });
        }

        const memberIds = (choirData.members || []).map((m: any) => m.id);
        console.log(`[Notification] Found ${memberIds.length} members in choir.`);

        // Fetch user docs
        const userRefs = memberIds.map((id: string) => db.collection("users").doc(id));
        const userDocs = await db.getAll(...userRefs);

        const tokens: string[] = [];

        userDocs.forEach(doc => {
            const u = doc.data();
            // Log for debugging (remove in prod if sensitive)
            // console.log(`[Notification] Checking user ${doc.id}: enabled=${u?.notificationsEnabled}, tokens=${u?.fcmTokens?.length}`);

            if (u && u.notificationsEnabled && u.fcmTokens && Array.isArray(u.fcmTokens)) {
                tokens.push(...u.fcmTokens);
            }
        });

        // Filter duplicates
        const uniqueTokens = Array.from(new Set(tokens));
        console.log(`[Notification] Total unique tokens found: ${uniqueTokens.length}`);

        if (uniqueTokens.length === 0) {
            console.warn("[Notification] No valid tokens found. Aborting send.");
            return NextResponse.json({ success: true, message: "No devices to send to (0 tokens)" });
        }

        // 4. Send Multicast Message
        const message = {
            notification: {
                title: title,
                body: body,
            },
            tokens: uniqueTokens,
        };

        console.log(`[Notification] Sending to ${uniqueTokens.length} devices...`);
        const response = await getMessaging(adminApp).sendEachForMulticast(message);
        console.log(`[Notification] Sent! Success: ${response.successCount}, Failed: ${response.failureCount}`);

        // 5. Save Notification to Firestore (for history/unread status)
        await db.collection(`choirs/${choirId}/notifications`).add({
            title,
            body,
            choirId,
            senderId: uid,
            senderName: userData?.name || "Regent",
            createdAt: new Date().toISOString(),
            readBy: [uid]
        });

        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(uniqueTokens[idx]);
                    console.error(`[Notification] Failure for token ${uniqueTokens[idx].substring(0, 10)}...:`, resp.error);
                }
            });
        }

        return NextResponse.json({
            success: true,
            count: response.successCount,
            failed: response.failureCount
        });

    } catch (error: any) {
        console.error("[Notification] Critical error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
