import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

admin.initializeApp();
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// --- DUPLICATE EMAIL DETECTION ---
/**
 * Warns when a new users/{uid} document has an email that already exists.
 * This is a safety net — the frontend should prevent duplicates via account linking.
 */
exports.onUserProfileCreated = functions.firestore
    .document('users/{uid}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const email = data?.email;
        if (!email || email.endsWith('@privaterelay.appleid.com')) return;

        const existing = await db.collection('users')
            .where('email', '==', email).get();

        if (existing.size > 1) {
            const uids = existing.docs.map(d => d.id);
            console.warn(`⚠️ DUPLICATE EMAIL DETECTED: "${email}" has ${existing.size} user docs: [${uids.join(', ')}]`);
        }
    });

// --- CLAIMS UTILITY ---

/**
 * Sync user's choir memberships into Firebase Custom Claims.
 * Must be called after every join/leave/role-change operation.
 * Claims structure: { choirs: { "choirId": "role" }, superAdmin?: true }
 */
async function syncUserClaims(userId: string): Promise<void> {
    const userDoc = await db.collection("users").doc(userId).get();
    const data = userDoc.data();

    if (!data) {
        // User deleted or doesn't exist — clear claims
        await admin.auth().setCustomUserClaims(userId, {});
        return;
    }

    const memberships = data.memberships || [];
    const choirs: Record<string, string> = {};

    for (const m of memberships) {
        if (m.choirId && m.role) {
            choirs[m.choirId] = m.role;
        }
    }

    // Fallback: if user has choirId but empty memberships (legacy)
    if (Object.keys(choirs).length === 0 && data.choirId && data.role) {
        choirs[data.choirId] = data.role;
    }

    const isSuperAdmin = ['artom.devv@gmail.com', 'artemdula0@gmail.com']
        .includes(data.email || '');

    const claims: Record<string, any> = { choirs };
    if (isSuperAdmin) claims.superAdmin = true;

    console.log(`[DEBUG] Setting claims for ${userId}:`, JSON.stringify(claims, null, 2));
    await admin.auth().setCustomUserClaims(userId, claims);
    console.log(`[DEBUG] Claims set successfully for ${userId}`);
}

/**
 * forceSyncClaims
 * Callable function to manually trigger a claims sync for the current user.
 * Useful for self-healing permission mismatches.
 */
// Force Sync Claims (Self-healing)
export const forceSyncClaims = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in");
    }
    const userId = context.auth.uid;
    await syncUserClaims(userId);
    return { success: true };
});



// --- ATOMIC OPERATIONS ---

/**
 * atomicCreateChoir
 * Creates a new choir and adds the creator as the owner/head.
 * Syncs claims immediately to prevent permission errors.
 */
export const atomicCreateChoir = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in");
    }
    const userId = context.auth.uid;
    const { name, choirType } = data;

    if (!name || typeof name !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "Choir name is required");
    }

    if (!choirType || !['msc', 'standard'].includes(choirType)) {
        throw new functions.https.HttpsError("invalid-argument", "Valid choirType is required ('msc' or 'standard')");
    }

    const memberCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const regentCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Auto-generate ID or let Firestore do it? 
    // We need the ID for the batch. Let's use a ref.
    const choirRef = db.collection("choirs").doc();
    const choirId = choirRef.id;

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};

    const batch = db.batch();

    // 1. Create Choir Document
    const choirData: any = {
        name: name.trim(),
        choirType,
        memberCode,
        regentCode,
        ownerId: userId,
        creatorId: userId,
        formerAdmins: [userId],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        regents: [userData.name || "Head"],
        members: [{
            id: userId,
            name: userData.name || "Користувач",
            photoURL: userData.photoURL || null,
            role: 'head',
            hasAccount: true,
            accountUid: userId
        }],
        membersCount: 1
    };
    batch.set(choirRef, choirData);

    // 2. Create Member Subcollection Document (Crucial for Rules Fallback)
    const memberRef = choirRef.collection("members").doc(userId);
    batch.set(memberRef, {
        id: userId,
        name: userData.name || "Користувач",
        photoURL: userData.photoURL || null,
        role: 'head',
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        hasAccount: true,
        accountUid: userId
    });

    // 3. Update User Document
    const newMembership = {
        choirId: choirId,
        choirName: name.trim(),
        role: 'head',
        choirType
    };

    // Updates
    batch.set(userRef, {
        choirId: choirId, // Set as active
        choirName: name.trim(),
        role: 'head',
        memberships: admin.firestore.FieldValue.arrayUnion(newMembership),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();

    // 4. Sync Claims
    await syncUserClaims(userId);

    return { success: true, choirId };
});

/**
 * atomicJoinChoir
 * Adds a user to a choir using an invite code (Member, Regent, or Admin).
 * Supports role upgrades if user is already a member.
 */
export const atomicJoinChoir = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in");
    }
    const userId = context.auth.uid;
    const { inviteCode } = data;

    if (!inviteCode) {
        throw new functions.https.HttpsError("invalid-argument", "Missing invite code");
    }

    const codeUpper = inviteCode.toUpperCase();

    // 1. Find Choir by Code
    const choirsRef = db.collection("choirs");
    let choirId = "";
    let role = "member"; // Default
    let choirName = "";
    let permissions: string[] = [];

    // Check Member Code
    const qMember = await choirsRef.where("memberCode", "==", codeUpper).limit(1).get();
    if (!qMember.empty) {
        const doc = qMember.docs[0];
        choirId = doc.id;
        choirName = doc.data().name;
        role = "member";
    }

    // Check Regent Code
    if (!choirId) {
        const qRegent = await choirsRef.where("regentCode", "==", codeUpper).limit(1).get();
        if (!qRegent.empty) {
            const doc = qRegent.docs[0];
            choirId = doc.id;
            choirName = doc.data().name;
            role = "regent";
        }
    }

    // Check Admin Codes (Scan fallback - unavoidable with current schema)
    if (!choirId) {
        // Limiting scan for safety. In production, schemas should be optimized.
        const qAll = await choirsRef.orderBy("createdAt", "desc").limit(500).get();
        for (const doc of qAll.docs) {
            const cData = doc.data();
            const adminCodes = cData.adminCodes || [];
            const match = adminCodes.find((ac: any) => ac.code === codeUpper);
            if (match) {
                choirId = doc.id;
                choirName = cData.name;
                role = "member";
                permissions = match.permissions || [];
                break;
            }
        }
    }

    if (!choirId) {
        throw new functions.https.HttpsError("not-found", "Invalid invite code");
    }

    // 2. Perform Join/Upgrade Logic
    const result = await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(userId);
        const choirRef = db.collection("choirs").doc(choirId);

        const userDoc = await transaction.get(userRef);
        const choirDoc = await transaction.get(choirRef);

        if (!choirDoc.exists) throw new functions.https.HttpsError("not-found", "Choir not found");

        const choirData = choirDoc.data()!;
        const userData = userDoc.exists ? userDoc.data()! : {};
        const existingMemberships = userData.memberships || [];

        // Check if already member
        const existingMembership = existingMemberships.find((m: any) => m.choirId === choirId);

        const currentRole = existingMembership ? existingMembership.role : null;
        const currentPermissions = userData.permissions || [];

        // Determine if upgrade needed
        let newRole = currentRole || role;
        // Upgrade logic: member -> regent/head
        if (role === 'regent' && currentRole === 'member') newRole = 'regent';
        if (role === 'head' && currentRole !== 'head') newRole = 'head';

        // Merge permissions
        const newPermissions = [...(currentPermissions), ...permissions];
        const uniquePermissions = [...new Set(newPermissions)];

        const isUpgrade = (newRole !== currentRole) || (uniquePermissions.length > currentPermissions.length);

        if (existingMembership && !isUpgrade) {
            // Even if already a member, return unlinked members so they can claim a legacy entry if needed
            const members = choirData.members || [];
            const unlinkedMembers = members
                .filter((m: any) => !m.hasAccount && !m.accountUid && m.id !== userId)
                .map((m: any) => ({ id: m.id, name: m.name, voice: m.voice || "" }));

            return { success: true, message: "Already a member", choirId, unlinkedMembers };
        }

        // --- UPDATE USER ---

        let updatedMemberships = [...existingMemberships];
        if (existingMembership) {
            updatedMemberships = updatedMemberships.map((m: any) => {
                if (m.choirId === choirId) return { ...m, role: newRole };
                return m;
            });
        } else {
            updatedMemberships.push({
                choirId: choirId,
                choirName: choirName,
                role: newRole,
                choirType: choirData.choirType || 'msc'
            });
        }

        // If user is switching active choir to this one (or has no active choir)
        const updates: any = {
            memberships: updatedMemberships,
            permissions: uniquePermissions,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Always switch active choir to the newly joined one
        updates.choirId = choirId;
        updates.choirName = choirName;
        updates.role = newRole;

        transaction.set(userRef, updates, { merge: true }); // Use set with merge to create if new

        // --- UPDATE CHOIR MEMBER LIST ---
        // Only update if user already exists in roster (e.g. previously linked).
        // Do NOT create new entries — new users appear only in "Користувачі" tab.
        const members = choirData.members || [];
        const memberIndex = members.findIndex((m: any) =>
            m.id === userId || m.accountUid === userId || (m.linkedUserIds || []).includes(userId)
        );



        const choirUpdates: any = {
            emptySince: admin.firestore.FieldValue.delete(),
            deletionStage: admin.firestore.FieldValue.delete(),
            deletionScheduledAt: admin.firestore.FieldValue.delete()
        };

        if (['head', 'regent', 'admin'].includes(newRole)) {
            choirUpdates.formerAdmins = admin.firestore.FieldValue.arrayUnion(userId);
        }

        if (memberIndex >= 0) {
            const updatedMembers = [...members];
            updatedMembers[memberIndex] = {
                ...updatedMembers[memberIndex],
                role: newRole,
                permissions: uniquePermissions,
                hasAccount: true
            };
            choirUpdates.members = updatedMembers;
            choirUpdates.membersCount = updatedMembers.length;
        } else if (members.length === 0) {
            // Resurrect empty choir
            const newMember = {
                id: userId,
                name: userData.name || "Користувач",
                photoURL: userData.photoURL || null,
                role: newRole,
                hasAccount: true,
                accountUid: userId
            };
            choirUpdates.members = [newMember];
            choirUpdates.membersCount = 1;
        } else {
            choirUpdates.membersCount = members.length;
        }
        transaction.update(choirRef, choirUpdates);
        // If memberIndex < 0: user is new → NO entry created in members[]

        // Collect unlinked members for client-side "Claim Member" UI
        // Use original members array (before our write) — the new auto-created entry is excluded by filter
        const unlinkedMembers = members
            .filter((m: any) => !m.hasAccount && !m.accountUid && m.id !== userId)
            .map((m: any) => ({ id: m.id, name: m.name, voice: m.voice || "" }));

        // Also return ALL members (including those with accounts) for name matching
        // This allows the client to show "Is this you?" even for linked members
        const allMembers = members
            .filter((m: any) => m.id !== userId && !m.isDuplicate)
            .map((m: any) => ({ id: m.id, name: m.name, voice: m.voice || "", hasAccount: !!m.hasAccount }));

        return { success: true, message: isUpgrade ? "Role Upgraded" : "Joined", choirId, unlinkedMembers, allMembers };
    });

    // ✅ Sync claims AFTER transaction commits
    await syncUserClaims(userId);

    return result;
});

/**
 * atomicLeaveChoir
 * Removes a user from a specific choir.
 */
export const atomicLeaveChoir = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const userId = context.auth.uid;
    const { choirId } = data;

    if (!choirId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing choirId");
    }

    const userRef = db.collection("users").doc(userId);
    const choirRef = db.collection("choirs").doc(choirId);

    const result = await db.runTransaction(async (transaction) => {
        // --- READS ---
        const choirDoc = await transaction.get(choirRef);
        if (!choirDoc.exists) throw new functions.https.HttpsError("not-found", "Choir not found");

        const userDoc = await transaction.get(userRef);
        // userDoc existence check can happen later or we assume it exists for auth user

        // --- LOGIC ---
        const choirData = choirDoc.data()!;
        const members = choirData.members || [];
        const updatedMembers = members.filter((m: any) => m.id !== userId);

        const userData = userDoc.exists ? userDoc.data()! : null;

        // --- WRITES ---
        // 1. Update Choir
        if (updatedMembers.length !== members.length) {
            const choirUpdates: any = {
                members: updatedMembers,
                membersCount: updatedMembers.length
            };
            if (updatedMembers.length === 0) {
                choirUpdates.emptySince = admin.firestore.FieldValue.serverTimestamp();
                choirUpdates.deletionStage = "empty";
            }
            transaction.update(choirRef, choirUpdates);
        }

        // 2. Update User
        if (userData) {
            const memberships = userData.memberships || [];
            const updatedMemberships = memberships.filter((m: any) => m.choirId !== choirId);

            const updates: any = { memberships: updatedMemberships };

            // If active choir is this one, clear it
            if (userData.choirId === choirId) {
                updates.choirId = admin.firestore.FieldValue.delete();
                updates.choirName = admin.firestore.FieldValue.delete();
                updates.role = admin.firestore.FieldValue.delete();
                updates.permissions = admin.firestore.FieldValue.delete();
            }
            transaction.update(userRef, updates);
        }

        return { success: true };
    });

    // ✅ Sync claims AFTER transaction commits
    await syncUserClaims(userId);

    return result;
});

/**
 * atomicDeleteSelf
 * Self-deletion ONLY. Always deletes context.auth.uid.
 * Ignores all client-side data to prevent any manipulation.
 */
export const atomicDeleteSelf = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const userId = context.auth.uid;

    try {
        console.log("atomicDeleteSelf: triggered for user", userId);
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            console.log("atomicDeleteSelf: user doc not found, deleting auth only");
            try { await admin.auth().deleteUser(userId); } catch (e) { console.error("Auth delete error:", e); }
            return { success: true };
        }

        const userData = userSnap.data()!;
        const memberships = userData.memberships || [];
        console.log(`atomicDeleteSelf: found ${memberships.length} memberships`);

        if (memberships.length === 0 && userData.choirId) {
            memberships.push({ choirId: userData.choirId });
        }

        const batch = db.batch();

        for (const membership of memberships) {
            if (!membership.choirId) continue;
            console.log("atomicDeleteSelf: processing choir", membership.choirId);

            const choirRef = db.collection("choirs").doc(membership.choirId);
            const choirSnap = await choirRef.get();
            if (choirSnap.exists) {
                const choirData = choirSnap.data()!;
                const currentMembers = choirData.members || [];

                // If they are the ONLY member, completely remove them so the choir becomes empty.
                // Otherwise, mark them as hasAccount: false so regents see they left.
                let updatedMembers;
                if (currentMembers.length === 1 && (currentMembers[0].id === userId || currentMembers[0].accountUid === userId)) {
                    updatedMembers = [];
                } else {
                    updatedMembers = currentMembers.map((m: any) => {
                        // Check strict ID match OR linked account match
                        if (m.id === userId || m.accountUid === userId) {
                            // Keep member but remove account link
                            const { accountUid, fcmTokens, ...rest } = m;
                            return {
                                ...rest,
                                hasAccount: false
                            };
                        }
                        return m;
                    });
                }

                const choirUpdates: any = {
                    members: updatedMembers,
                    membersCount: updatedMembers.length
                };
                if (updatedMembers.length === 0) {
                    choirUpdates.emptySince = admin.firestore.FieldValue.serverTimestamp();
                    choirUpdates.deletionStage = "empty";
                }
                batch.update(choirRef, choirUpdates);
            }

            const memberRef = choirRef.collection("members").doc(userId);
            batch.delete(memberRef);
        }

        batch.delete(userRef);
        console.log("atomicDeleteSelf: committing batch...");
        await batch.commit();
        console.log("atomicDeleteSelf: batch committed");

        try {
            await admin.auth().deleteUser(userId);
            // Explicitly clear claims (though deleteUser technically invalidates them, this is safer for edge cases)
            // Note: Cannot set claims for deleted user, but if delete fails, we ensure they have no power.
            // If user is deleted, claims are gone. If we want to be paranoid, clear claims BEFORE delete.
        } catch (e) {
            console.log("Error deleting auth:", e);
        }

        // Ensure no claims remain if auth deletion failed weirdly or if account is restored
        try {
            // We can't set claims on a deleted user. 
            // But if deleteUser threw, user might exist.
            await admin.auth().setCustomUserClaims(userId, { choirs: {} });
        } catch (e) {
            // Ignore if user not found
        }

        return { success: true };
    } catch (error) {
        console.error("Self-delete error:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Failed to delete account");
    }
});

/**
 * adminDeleteUser
 * Admin-only: deletes ANOTHER user's account.
 * Strict validation prevents any accidental self-deletion.
 */
export const adminDeleteUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }

    const callerUid = context.auth.uid;
    const targetUid = data?.targetUid;

    // --- VALIDATION ---
    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "targetUid is required");
    }
    if (targetUid === callerUid) {
        throw new functions.https.HttpsError("invalid-argument", "Cannot delete yourself via admin path. Use self-delete.");
    }

    // Claims-based permission check with Firestore fallback
    const callerChoirs = (context.auth.token as any).choirs || {};
    let hasAdminRole = Object.values(callerChoirs).some(
        (role: any) => ['head', 'regent'].includes(role)
    );

    // Fallback: if claims are empty (e.g. after account restore), check Firestore
    if (!hasAdminRole) {
        const callerDoc = await db.collection("users").doc(callerUid).get();
        if (callerDoc.exists) {
            const callerData = callerDoc.data()!;
            hasAdminRole = ['head', 'regent'].includes(callerData.role);
        }
    }

    if (!hasAdminRole) {
        throw new functions.https.HttpsError("permission-denied", "Only head/regent can delete users");
    }

    // --- EXECUTION ---
    try {
        const userRef = db.collection("users").doc(targetUid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            // Still clean up Auth if it exists
            try { await admin.auth().deleteUser(targetUid); } catch (e) { }
            return { success: true };
        }

        const userData = userSnap.data()!;
        const memberships = userData.memberships || [];

        if (memberships.length === 0 && userData.choirId) {
            memberships.push({ choirId: userData.choirId });
        }

        const batch = db.batch();

        for (const membership of memberships) {
            if (!membership.choirId) continue;

            const choirRef = db.collection("choirs").doc(membership.choirId);
            const choirSnap = await choirRef.get();
            if (choirSnap.exists) {
                const choirData = choirSnap.data()!;
                const currentMembers = choirData.members || [];
                // Mark member as deleted but preserve in list
                const updatedMembers = currentMembers.map((m: any) => {
                    // Check strict ID match OR linked account match
                    if (m.id === targetUid || m.accountUid === targetUid) {
                        const { accountUid, fcmTokens, ...rest } = m;
                        return {
                            ...rest,
                            hasAccount: false
                        };
                    }
                    return m;
                });
                const choirUpdates: any = {
                    members: updatedMembers,
                    membersCount: updatedMembers.length
                };
                if (updatedMembers.length === 0) {
                    choirUpdates.emptySince = admin.firestore.FieldValue.serverTimestamp();
                    choirUpdates.deletionStage = "empty";
                }
                batch.update(choirRef, choirUpdates);
            }

            const memberRef = choirRef.collection("members").doc(targetUid);
            batch.delete(memberRef);
        }

        // Delete Firestore user doc
        batch.delete(userRef);
        await batch.commit();

        // Delete Firebase Auth record
        try { await admin.auth().deleteUser(targetUid); } catch (e) {
            console.log("Error deleting target auth:", e);
        }

        return { success: true, deletedUid: targetUid };
    } catch (error) {
        console.error("Admin delete user error:", error);
        throw new functions.https.HttpsError("internal", "Failed to delete user");
    }
});

/**
 * atomicMergeMembers
 * Merges statistics and services from one member to another.
 * Admin only.
 */
export const atomicMergeMembers = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Locked");

    const { choirId, fromMemberId, toMemberId } = data;

    // ✅ Claims-based permission check (no Firestore read)
    const callerChoirs = (context.auth.token as any).choirs || {};
    const callerRole = callerChoirs[choirId];
    if (!callerRole || !['admin', 'regent', 'head'].includes(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "Unauthorized");
    }

    const servicesSnap = await db.collection(`choirs/${choirId}/services`).get();

    const batch = db.batch();
    let batchOpCount = 0;

    servicesSnap.docs.forEach(doc => {
        const sData = doc.data();
        let changed = false;
        let newConfirmed = sData.confirmedMembers || [];
        let newAbsent = sData.absentMembers || [];

        if (newConfirmed.includes(fromMemberId)) {
            newConfirmed = newConfirmed.filter((id: string) => id !== fromMemberId);
            if (!newConfirmed.includes(toMemberId)) newConfirmed.push(toMemberId);
            changed = true;
        }
        if (newAbsent.includes(fromMemberId)) {
            newAbsent = newAbsent.filter((id: string) => id !== fromMemberId);
            if (!newAbsent.includes(toMemberId)) newAbsent.push(toMemberId);
            changed = true;
        }

        if (changed) {
            batch.update(doc.ref, {
                confirmedMembers: newConfirmed,
                absentMembers: newAbsent
            });
            batchOpCount++;
        }
    });

    // Update Choir Members array
    const choirRef = db.collection("choirs").doc(choirId);
    const choirSnap = await choirRef.get();
    if (choirSnap.exists) {
        const cData = choirSnap.data()!;
        const members = cData.members || [];
        const fromMember = members.find((m: any) => m.id === fromMemberId);
        let updatedMembers = members.filter((m: any) => m.id !== fromMemberId);

        // Transfer account data from source to target if source had an account
        if (fromMember?.hasAccount) {
            updatedMembers = updatedMembers.map((m: any) => {
                if (m.id === toMemberId) { // Removed && !m.hasAccount check
                    return {
                        ...m,
                        hasAccount: true,
                        // Ensure accountUid is set so that isUserUnlinked doesn't fail
                        accountUid: m.accountUid || m.id,
                        linkedUserIds: [...(m.linkedUserIds || []), fromMemberId, fromMember.accountUid].filter(Boolean)
                    };
                }
                return m;
            });
        }

        if (updatedMembers.length !== members.length || fromMember?.hasAccount) {
            batch.update(choirRef, { members: updatedMembers });
            batchOpCount++;
        }
    }

    if (batchOpCount > 0) {
        await batch.commit();
    }

    return { success: true, updatedServices: batchOpCount };
});

/**
 * claimMember
 * Links a user's Firebase account to an existing choir member entry.
 * 
 * SAFETY GUARANTEES:
 * - member.id is NEVER mutated
 * - Attendance arrays are NEVER modified
 * - Duplicates are marked, not deleted
 * - All checks happen inside transaction (race-safe)
 * - One UID per choir (no double-linking)
 */
export const claimMember = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }

    const callerUid = context.auth.uid;
    const { choirId, targetMemberId } = data;

    // --- INPUT VALIDATION ---
    if (!choirId || typeof choirId !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "choirId is required");
    }
    if (!targetMemberId || typeof targetMemberId !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "targetMemberId is required");
    }
    if (targetMemberId === callerUid) {
        throw new functions.https.HttpsError("invalid-argument", "Cannot claim your own auto-created entry");
    }

    // --- PERMISSION CHECK: caller must be a member of this choir ---
    const callerChoirs = (context.auth.token as any).choirs || {};
    let isMember = !!callerChoirs[choirId];

    // Firestore fallback if claims are empty (e.g. after account restore)
    if (!isMember) {
        const callerDoc = await db.collection("users").doc(callerUid).get();
        if (callerDoc.exists) {
            const callerData = callerDoc.data()!;
            if (callerData.choirId === choirId) {
                isMember = true;
            } else {
                isMember = (callerData.memberships || []).some((m: any) => m.choirId === choirId);
            }
        }
    }

    if (!isMember) {
        throw new functions.https.HttpsError("permission-denied", "You are not a member of this choir");
    }

    // --- TRANSACTION: all reads before writes ---
    const result = await db.runTransaction(async (transaction) => {
        const choirRef = db.collection("choirs").doc(choirId);
        const choirDoc = await transaction.get(choirRef);

        if (!choirDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Choir not found");
        }

        const choirData = choirDoc.data()!;
        const members: any[] = choirData.members || [];

        // ── STEP 1: Unlink caller from any previous member entry ──
        // If the caller was already linked to a different member, remove from their linkedUserIds
        const previouslyLinkedIndex = members.findIndex((m: any) =>
            m.accountUid === callerUid || (m.linkedUserIds || []).includes(callerUid)
        );

        // ── STEP 2: Find and validate target member ──
        const targetIndex = members.findIndex((m: any) => m.id === targetMemberId);
        if (targetIndex === -1) {
            throw new functions.https.HttpsError("not-found", "Target member not found");
        }

        const target = members[targetIndex];

        // Check if caller is already linked to this exact target — no-op
        const existingLinked = target.linkedUserIds || [];
        if (existingLinked.includes(callerUid) || target.accountUid === callerUid) {
            return { success: true, claimedMember: target.name, alreadyLinked: true };
        }

        // ── BUILD UPDATED MEMBERS ARRAY ──
        const updatedMembers = [...members];

        // Unlink caller from previous member (if any, and if different from target)
        if (previouslyLinkedIndex >= 0 && previouslyLinkedIndex !== targetIndex) {
            const prev = updatedMembers[previouslyLinkedIndex];
            const prevLinked = (prev.linkedUserIds || []).filter((uid: string) => uid !== callerUid);
            updatedMembers[previouslyLinkedIndex] = {
                ...prev,
                accountUid: prev.accountUid === callerUid ? null : prev.accountUid,
                linkedUserIds: prevLinked,
                hasAccount: prevLinked.length > 0 || (prev.accountUid && prev.accountUid !== callerUid)
            };
        }

        // Link target: add callerUid to linkedUserIds, set accountUid if empty
        const targetLinked = [...(target.linkedUserIds || [])];
        if (!targetLinked.includes(callerUid)) {
            targetLinked.push(callerUid);
        }
        updatedMembers[targetIndex] = {
            ...target,
            accountUid: target.accountUid || callerUid,
            linkedUserIds: targetLinked,
            hasAccount: true
        };

        // ── STEP 3: Find auto-created duplicate safely ──
        // Match by: id === callerUid AND no accountUid (auto-created by atomicJoinChoir)
        const dupeIndex = updatedMembers.findIndex(
            (m: any) => m.id === callerUid && !m.accountUid
        );

        if (dupeIndex >= 0 && dupeIndex !== targetIndex) {
            // Mark as duplicate — do NOT delete
            updatedMembers[dupeIndex] = {
                ...updatedMembers[dupeIndex],
                isDuplicate: true
            };
        }

        // ── SINGLE WRITE ──
        transaction.update(choirRef, { members: updatedMembers });

        return {
            success: true,
            claimedMember: target.name,
            duplicateMarked: dupeIndex >= 0 && dupeIndex !== targetIndex
        };
    });

    return result;
});

/**
 * mergeAccounts
 * Merges two Firebase user accounts (primaryUid absorbs secondaryUid).
 *
 * SAFETY GUARANTEES:
 * - Entire operation inside Firestore transaction (atomic)
 * - Idempotent: secondary missing → return success
 * - No partial migration: any failure aborts everything
 * - primaryUid !== secondaryUid enforced
 * - Caller must own one UID OR have custom claim isSuperAdmin
 */
export const mergeAccounts = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }

    const callerUid = context.auth.uid;
    const { primaryUid, secondaryUid } = data;

    // ── INPUT VALIDATION ──
    if (!primaryUid || typeof primaryUid !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "primaryUid is required");
    }
    if (!secondaryUid || typeof secondaryUid !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "secondaryUid is required");
    }
    if (primaryUid === secondaryUid) {
        throw new functions.https.HttpsError("invalid-argument", "primaryUid and secondaryUid must differ");
    }

    // ── AUTH CHECK: caller must own one of the two accounts ──
    // During the explicit merge flow, the user may be signed in as either account.
    // Both cases are safe: the user is voluntarily merging their own accounts.
    if (callerUid !== primaryUid && callerUid !== secondaryUid) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Caller must be signed in as one of the accounts being merged"
        );
    }

    const ROLE_RANK: Record<string, number> = { member: 0, regent: 1, head: 2 };

    // ── Pre-transaction reads: find services referencing secondaryUid ──
    // Firestore transactions can only read docs by reference, not run queries,
    // so we identify affected service docs first, then read/write them in the txn.
    const allChoirIds = new Set<string>();

    // Gather choir IDs from both user docs (outside txn, for service discovery only)
    const [prePrimarySnap, preSecondarySnap] = await Promise.all([
        db.collection("users").doc(primaryUid).get(),
        db.collection("users").doc(secondaryUid).get(),
    ]);

    if (!preSecondarySnap.exists) {
        console.log(`mergeAccounts: secondary ${secondaryUid} already gone — idempotent success`);
        return { success: true, alreadyMerged: true };
    }

    const prePrimary = prePrimarySnap.data() || {};
    const preSecondary = preSecondarySnap.data() || {};
    for (const m of (prePrimary.memberships || [])) {
        if (m.choirId) allChoirIds.add(m.choirId);
    }
    for (const m of (preSecondary.memberships || [])) {
        if (m.choirId) allChoirIds.add(m.choirId);
    }
    if (prePrimary.choirId) allChoirIds.add(prePrimary.choirId);
    if (preSecondary.choirId) allChoirIds.add(preSecondary.choirId);

    // Find service docs that reference secondaryUid in attendance arrays
    const affectedServiceRefs: FirebaseFirestore.DocumentReference[] = [];
    for (const cid of allChoirIds) {
        const servicesSnap = await db.collection(`choirs/${cid}/services`).get();
        for (const sDoc of servicesSnap.docs) {
            const sData = sDoc.data();
            const confirmed = sData.confirmedMembers || [];
            const absent = sData.absentMembers || [];
            if (confirmed.includes(secondaryUid) || absent.includes(secondaryUid)) {
                affectedServiceRefs.push(sDoc.ref);
            }
        }
    }

    // ── TRANSACTION ──
    const result = await db.runTransaction(async (transaction) => {
        // Read BOTH user docs AND ALL referenced docs upfront to satisfy Firestore "Reads before Writes" transaction rule
        const primaryRef = db.collection("users").doc(primaryUid);
        const secondaryRef = db.collection("users").doc(secondaryUid);

        const choirRefs = Array.from(allChoirIds).map((cid) => db.collection("choirs").doc(cid));

        const [primarySnap, secondarySnap, choirSnaps, serviceSnaps] = await Promise.all([
            transaction.get(primaryRef),
            transaction.get(secondaryRef),
            Promise.all(choirRefs.map((r) => transaction.get(r))),
            Promise.all(affectedServiceRefs.map((r) => transaction.get(r))),
        ]);

        // Idempotent: secondary gone between pre-check and txn start
        if (!secondarySnap.exists) {
            return { success: true, alreadyMerged: true };
        }

        const secondary = secondarySnap.data()!;
        let primary: any = {};
        let isNewPrimary = false;

        if (!primarySnap.exists) {
            console.log(`[mergeAccounts] Primary doc missing for ${primaryUid}. Auto-creating during merge.`);
            isNewPrimary = true;
            primary = {
                id: primaryUid,
                // Inherit basic profile info from the google account if Apple profile doesn't exist yet
                name: secondary.name || "User",
                email: secondary.email || "",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
        } else {
            primary = primarySnap.data()!;
        }

        // ── MERGE USER FIELDS ──
        // 1. fcmTokens: union + dedupe
        const mergedFcmTokens = [...new Set([
            ...(primary.fcmTokens || []),
            ...(secondary.fcmTokens || []),
        ])];

        // 2. memberships: union by choirId (primary wins on conflict)
        const membershipMap = new Map<string, any>();
        for (const m of (secondary.memberships || [])) {
            if (m.choirId) membershipMap.set(m.choirId, m);
        }
        for (const m of (primary.memberships || [])) {
            if (m.choirId) membershipMap.set(m.choirId, m); // primary overwrites
        }
        const mergedMemberships = Array.from(membershipMap.values());

        // 3. permissions: union + dedupe
        const mergedPermissions = [...new Set([
            ...(primary.permissions || []),
            ...(secondary.permissions || []),
        ])];

        // 4. role: highest privilege wins
        const pRank = ROLE_RANK[primary.role] ?? 0;
        const sRank = ROLE_RANK[secondary.role] ?? 0;
        const mergedRole = sRank > pRank ? secondary.role : primary.role;

        // 5. photoURL: keep primary, fallback to secondary
        const mergedPhoto = primary.photoURL || secondary.photoURL || null;

        // 6. notificationsEnabled: OR
        const mergedNotificationsEnabled =
            !!(primary.notificationsEnabled || secondary.notificationsEnabled);

        // ── CALCULATIONS FOR CHOIRS ──
        interface ChoirUpdate {
            ref: FirebaseFirestore.DocumentReference;
            members: any[];
        }
        const choirUpdates: ChoirUpdate[] = [];

        for (let i = 0; i < choirRefs.length; i++) {
            const snap = choirSnaps[i];
            if (!snap.exists) continue;
            const cData = snap.data()!;
            const members = cData.members || [];
            let changed = false;

            const updatedMembers = members.map((m: any) => {
                if (m.id === secondaryUid || m.accountUid === secondaryUid) {
                    changed = true;
                    return {
                        ...m,
                        id: m.id === secondaryUid ? primaryUid : m.id,
                        accountUid: primaryUid,
                        linkedUserIds: [...new Set([
                            ...(m.linkedUserIds || []).filter((id: string) => id !== secondaryUid),
                            primaryUid,
                        ])],
                        hasAccount: true,
                    };
                }
                if ((m.linkedUserIds || []).includes(secondaryUid)) {
                    changed = true;
                    return {
                        ...m,
                        linkedUserIds: [
                            ...(m.linkedUserIds || []).filter((id: string) => id !== secondaryUid),
                            primaryUid,
                        ],
                    };
                }
                return m;
            });

            // Deduplicate: if primary now has multiple member entries, mark extras
            const primaryEntries = updatedMembers.filter(
                (m: any) => m.id === primaryUid || m.accountUid === primaryUid
            );
            let finalMembers = updatedMembers;
            if (primaryEntries.length > 1) {
                let kept = false;
                finalMembers = updatedMembers.map((m: any) => {
                    if (m.id === primaryUid || m.accountUid === primaryUid) {
                        if (!kept) { kept = true; return m; }
                        return { ...m, isDuplicate: true };
                    }
                    return m;
                });
                changed = true;
            }

            if (changed) {
                choirUpdates.push({
                    ref: choirRefs[i],
                    members: JSON.parse(JSON.stringify(finalMembers))
                });
            }
        }

        // ── CALCULATIONS FOR SERVICES ──
        interface ServiceUpdate {
            ref: FirebaseFirestore.DocumentReference;
            confirmedMembers: string[];
            absentMembers: string[];
        }
        const serviceUpdates: ServiceUpdate[] = [];

        for (let i = 0; i < affectedServiceRefs.length; i++) {
            const sSnap = serviceSnaps[i];
            const sRef = affectedServiceRefs[i];
            if (!sSnap.exists) continue;

            const sData = sSnap.data()!;
            let newConfirmed = [...(sData.confirmedMembers || [])];
            let newAbsent = [...(sData.absentMembers || [])];
            let changed = false;

            if (newConfirmed.includes(secondaryUid)) {
                newConfirmed = newConfirmed.filter((id: string) => id !== secondaryUid);
                if (!newConfirmed.includes(primaryUid)) newConfirmed.push(primaryUid);
                changed = true;
            }
            if (newAbsent.includes(secondaryUid)) {
                newAbsent = newAbsent.filter((id: string) => id !== secondaryUid);
                if (!newAbsent.includes(primaryUid)) newAbsent.push(primaryUid);
                changed = true;
            }

            if (changed) {
                serviceUpdates.push({
                    ref: sRef,
                    confirmedMembers: newConfirmed,
                    absentMembers: newAbsent
                });
            }
        }

        // ── APPLY WRITES IN ORDER ──

        // Calculate active choir inheritance
        let mergedChoirId = primary.choirId;
        let mergedChoirName = primary.choirName;
        if (!mergedChoirId && secondary.choirId) {
            mergedChoirId = secondary.choirId;
            mergedChoirName = secondary.choirName;
        }

        // WRITE 1: update primary user doc
        const primaryUpdateObj: any = {
            fcmTokens: JSON.parse(JSON.stringify(mergedFcmTokens)),
            memberships: JSON.parse(JSON.stringify(mergedMemberships)),
            permissions: JSON.parse(JSON.stringify(mergedPermissions)),
            notificationsEnabled: mergedNotificationsEnabled,
        };
        if (mergedRole !== undefined) primaryUpdateObj.role = mergedRole;
        if (mergedPhoto) primaryUpdateObj.photoURL = mergedPhoto;
        if (mergedChoirId) primaryUpdateObj.choirId = mergedChoirId;
        if (mergedChoirName) primaryUpdateObj.choirName = mergedChoirName;

        if (isNewPrimary) {
            transaction.set(primaryRef, { ...primary, ...primaryUpdateObj });
        } else {
            transaction.update(primaryRef, primaryUpdateObj);
        }

        // WRITE 2: update affected choirs
        for (const update of choirUpdates) {
            transaction.update(update.ref, { members: update.members });
        }

        // WRITE 3: update affected services
        for (const update of serviceUpdates) {
            transaction.update(update.ref, {
                confirmedMembers: update.confirmedMembers,
                absentMembers: update.absentMembers,
            });
        }

        // WRITE 4: backup secondary user (safety snapshot)
        const backupRef = db.collection("mergeBackups").doc(secondaryUid);
        transaction.set(backupRef, {
            ...secondary,
            mergedInto: primaryUid,
            mergedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // WRITE 5: audit log
        const logRef = db.collection("mergeLogs").doc();
        transaction.set(logRef, {
            primaryUid,
            secondaryUid,
            status: "success",
            mergedMemberships: mergedMemberships.length,
            migratedServices: serviceUpdates.length,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        // WRITE 6: sync secondary user doc (DO NOT DELETE)
        transaction.update(secondaryRef, {
            memberships: JSON.parse(JSON.stringify(mergedMemberships)),
            linkedTo: primaryUid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            success: true,
            alreadyMerged: false,
            mergedMemberships: mergedMemberships.length,
            migratedServices: serviceUpdates.length,
        };
    });

    console.log(`✅ mergeAccounts: ${secondaryUid} → ${primaryUid}`, result);
    return result;
});

/**
 * atomicUpdateMember
 * Updates a choir member's details (role, voice, name).
 * Syncs changes to the User document if the member has an account.
 * Admin only.
 */
export const atomicUpdateMember = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Locked");

    const { choirId, memberId, updates } = data; // updates: { name, voice, role, permissions? }

    // ✅ Claims-based permission check with Firestore fallback
    const callerChoirs = (context.auth.token as any).choirs || {};
    let callerRole = callerChoirs[choirId];

    // Fallback: if claims are empty (e.g. after account restore), check Firestore
    if (!callerRole) {
        const callerDoc = await db.collection("users").doc(context.auth.uid).get();
        if (callerDoc.exists) {
            const callerData = callerDoc.data()!;
            if (callerData.choirId === choirId) {
                callerRole = callerData.role;
            } else {
                const membership = (callerData.memberships || []).find((m: any) => m.choirId === choirId);
                if (membership) callerRole = membership.role;
            }
        }
    }

    const isSelfUpdate = memberId === context.auth.uid;
    const isAdmin = callerRole && ['admin', 'regent', 'head'].includes(callerRole);

    if (!isAdmin && !isSelfUpdate) {
        throw new functions.https.HttpsError("permission-denied", "Unauthorized");
    }

    if (!isAdmin && isSelfUpdate) {
        // Restrict what a normal user can update on themselves
        const allowedFields = ['name', 'voice', 'photoURL'];
        for (const key of Object.keys(updates)) {
            if (!allowedFields.includes(key)) {
                throw new functions.https.HttpsError("permission-denied", `Not allowed to update field: ${key}`);
            }
        }
    }
    const result = await db.runTransaction(async (transaction) => {
        const choirRef = db.collection("choirs").doc(choirId);
        const choirDoc = await transaction.get(choirRef);

        if (!choirDoc.exists) throw new functions.https.HttpsError("not-found", "Choir not found");

        const choirData = choirDoc.data()!;
        const members = choirData.members || [];
        // Search by ID, accountUid, or linkedUserIds to prevent duplicates
        const memberIndex = members.findIndex((m: any) =>
            m.id === memberId || m.accountUid === memberId || (m.linkedUserIds || []).includes(memberId)
        );

        if (memberIndex === -1 && !isSelfUpdate) {
            throw new functions.https.HttpsError("not-found", "Member not found");
        }

        // --- ALL READS FIRST (Firestore requirement) ---
        let targetUserDoc: FirebaseFirestore.DocumentSnapshot | null = null;
        const targetUserRef = db.collection("users").doc(memberId);
        // We need the user doc if they have an account (which they do if it's a self-update)
        targetUserDoc = await transaction.get(targetUserRef);

        // --- ALL WRITES AFTER ---

        let newMember: any;
        const updatedMembers = [...members];

        if (memberIndex === -1 && isSelfUpdate) {
            // Self-Registration: They have no stub, so we create one and append it.
            newMember = {
                id: memberId,
                name: updates.name || "Unknown",
                voice: updates.voice || "",
                role: callerRole || 'member',
                permissions: [],
                hasAccount: true,
                accountUid: memberId,
                linkedUserIds: [memberId],
                photoURL: updates.photoURL || null
            };
            updatedMembers.push(newMember);
        } else {
            // Normal Update
            const oldMember = members[memberIndex];
            newMember = {
                ...oldMember,
                ...updates,
                photoURL: updates.photoURL !== undefined ? updates.photoURL : (oldMember.photoURL || null),
                hasAccount: isSelfUpdate ? true : oldMember.hasAccount // Ensure hasAccount is true if self-updating
            };
            updatedMembers[memberIndex] = newMember;
        }

        // Update Choir Doc
        const choirUpdates: any = {
            members: updatedMembers,
            membersCount: updatedMembers.length
        };

        if (updates.role && ['head', 'regent', 'admin'].includes(updates.role)) {
            choirUpdates.formerAdmins = admin.firestore.FieldValue.arrayUnion(memberId);
        }
        if (updatedMembers.length > 0) {
            choirUpdates.emptySince = admin.firestore.FieldValue.delete();
            choirUpdates.deletionStage = admin.firestore.FieldValue.delete();
            choirUpdates.deletionScheduledAt = admin.firestore.FieldValue.delete();
        }
        transaction.update(choirRef, choirUpdates);

        // If member has account, sync to User Doc
        if (targetUserDoc?.exists && newMember.hasAccount) {
            const targetUserData = targetUserDoc.data()!;

            // Update memberships array
            const memberships = targetUserData.memberships || [];
            const updatedMemberships = memberships.map((m: any) => {
                if (m.choirId === choirId) {
                    return { ...m, role: newMember.role }; // Sync role
                }
                return m;
            });

            // Ensure membership exists (in case it fell out of sync)
            if (!updatedMemberships.some((m: any) => m.choirId === choirId)) {
                updatedMemberships.push({
                    choirId: choirId,
                    choirName: targetUserData.choirName || "Unknown Choir",
                    role: newMember.role,
                    choirType: choirData.choirType || 'msc'
                });
            }

            const userUpdates: any = { memberships: updatedMemberships };

            // Sync active role if this is their active choir
            if (targetUserData.choirId === choirId) {
                userUpdates.role = newMember.role;
                if (updates.voice !== undefined) userUpdates.voice = newMember.voice;

                // Only update global name if the user is updating themselves
                // Regents updating a member's name should only affect the choir roster
                if (updates.name !== undefined && isSelfUpdate) {
                    userUpdates.name = newMember.name;
                }

                if (updates.permissions) {
                    userUpdates.permissions = updates.permissions;
                }
            }

            if (updates.permissions && targetUserData.choirId !== choirId) {
                if (updates.permissions) userUpdates.permissions = updates.permissions;
            }

            transaction.update(targetUserRef, userUpdates);
        }

        return { success: true };
    });

    // ✅ If role changed, sync target member's claims
    if (updates.role) {
        await syncUserClaims(memberId);
    }

    return result;
});

// --- MIGRATION ---

/**
 * One-time migration: sync claims for ALL existing users.
 * Call this ONCE before deploying new firestore.rules.
 * SuperAdmin only.
 */
export const migrateAllClaims = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Required");
    }

    // Allow superadmin emails or check existing superAdmin claim
    const email = context.auth.token.email || '';
    const isSuperAdmin = (context.auth.token as any).superAdmin === true ||
        ['artom.devv@gmail.com', 'artemdula0@gmail.com'].includes(email);

    if (!isSuperAdmin) {
        throw new functions.https.HttpsError("permission-denied", "SuperAdmin only");
    }

    const usersSnap = await db.collection("users").get();
    let migrated = 0;
    let errors = 0;

    // Process in batches of 10 to avoid Auth rate limits
    const docs = usersSnap.docs;
    for (let i = 0; i < docs.length; i += 10) {
        const batch = docs.slice(i, i + 10);
        const promises = batch.map(async (doc) => {
            try {
                await syncUserClaims(doc.id);
                migrated++;
            } catch (e) {
                console.error(`Failed to sync claims for ${doc.id}:`, e);
                errors++;
            }
        });
        await Promise.all(promises);
    }

    return { success: true, migrated, errors, total: docs.length };
});
// --- Notification Token Management ---

export const registerFcmToken = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in");
    }

    const { token } = data;
    if (!token || typeof token !== "string" || token.length > 4096) {
        throw new functions.https.HttpsError("invalid-argument", "Token must be a valid non-empty string under 4096 chars");
    }

    const userId = context.auth.uid;
    const userRef = db.collection("users").doc(userId);
    const batch = db.batch();

    try {
        // 1. Find ANY user that has this token (including the current one, potentially)
        // We use collectionGroup if users is root, or just collection. `users` is root here.
        const snapshot = await db.collection("users")
            .where("fcmTokens", "array-contains", token)
            .get();

        let removedCount = 0;

        // 2. Remove token from others
        snapshot.docs.forEach((doc) => {
            if (doc.id !== userId) {
                // Determine if this user really needs an update (double check)
                const userData = doc.data();
                if (userData.fcmTokens && userData.fcmTokens.includes(token)) {
                    batch.update(doc.ref, {
                        fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
                    });
                    removedCount++;
                    console.log(`[TokenEnforcement] Removing stolen token from user ${doc.id}`);
                }
            }
        });

        // 3. Add token to current user (idempotent via arrayUnion)
        batch.set(userRef, {
            fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
            notificationsEnabled: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        await batch.commit();

        return { success: true, removedFromOthers: removedCount };
    } catch (error) {
        console.error("[TokenEnforcement] Error registering token:", error);
        throw new functions.https.HttpsError("internal", "Failed to register token");
    }
});

// --- R2 STORAGE UTILITY ---

// r2Client initialized lazily inside function to prevent cold start crashes
// if env vars are missing

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'msc-catalog';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';

const cors = require('cors')({ origin: true });

/**
 * generateUploadUrl
 * Generates a presigned URL for uploading files to R2 storage.
 * HTTP Function (onRequest) to bypass client SDK complexity and handle CORS manually.
 */
export const generateUploadUrl = functions.https.onRequest((req, res) => {
    // 1. Handle CORS (options and others)
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: "Method Not Allowed" });
            return;
        }

        try {
            // 2. Verify Authorization Header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ error: "Unauthenticated" });
                return;
            }

            const token = authHeader.split('Bearer ')[1];
            let decodedToken;
            try {
                decodedToken = await admin.auth().verifyIdToken(token);
            } catch (e) {
                console.error("Token verification failed:", e);
                res.status(403).json({ error: "Invalid Token" });
                return;
            }

            const userId = decodedToken.uid;
            const { key, contentType, size } = req.body; // onRequest uses req.body directly

            // --- SECURITY VALIDATION ---

            // A. Basic Presence
            if (!key || !contentType) {
                res.status(400).json({ error: "Missing key or contentType" });
                return;
            }

            // B. Directory Traversal
            if (key.includes("..")) {
                console.warn(`[Security] Directory traversal attempt by ${userId}: ${key}`);
                res.status(400).json({ error: "Invalid key" });
                return;
            }

            // C. Content-Type Whitelist
            const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
            if (!ALLOWED_TYPES.includes(contentType)) {
                console.warn(`[Security] Invalid content-type attempt by ${userId}: ${contentType}`);
                res.status(400).json({ error: "Invalid file type. Only PDF, JPEG, and PNG are allowed." });
                return;
            }

            // D. Max Size (10MB)
            // Note: This relies on client honesty unless using signed POST policies.
            // But strict clients (like ours) will send it and respect the rejection.
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB
            if (size && typeof size === 'number' && size > MAX_SIZE) {
                res.status(400).json({ error: "File too large. Max 10MB." });
                return;
            }

            // Authorization Rules
            const isSuperAdmin = (decodedToken.superAdmin === true);

            // Rule A: Choir Resources (choirs/{choirId}/...)
            if (key.startsWith("choirs/")) {
                const parts = key.split("/");
                if (parts.length < 3) throw new Error("Invalid key format");
                const choirId = parts[1];

                // Check claims first
                const userRole = (decodedToken.choirs as any)?.[choirId];
                let canUpload = isSuperAdmin || ['admin', 'regent', 'head'].includes(userRole);

                // Fallback to Firestore if claims missing
                if (!canUpload && !userRole) {
                    const userDoc = await db.collection("users").doc(userId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data()!;
                        if (userData.choirId === choirId) {
                            canUpload = ['admin', 'regent', 'head'].includes(userData.role);
                        } else {
                            canUpload = (userData.memberships || []).some((m: any) =>
                                m.choirId === choirId && ['admin', 'regent', 'head'].includes(m.role)
                            );
                        }
                    }
                }

                if (!canUpload) {
                    res.status(403).json({ error: "Insufficient permissions for this choir" });
                    return;
                }
            }
            // Rule B: Pending Songs (pending/...)
            else if (key.startsWith("pending/")) {
                // Any authenticated user can upload pending songs
                // token verification passed
            }
            // Rule C: Global Resources or checks
            else {
                if (!isSuperAdmin) {
                    res.status(403).json({ error: "Root/Global access denied" });
                    return;
                }
            }

            // Lazy Init R2 Client
            if (!process.env.R2_ACCOUNT_ID) {
                console.error("[generateUploadUrl] Missing R2_ACCOUNT_ID env var");
                throw new Error("Server Misconfiguration: Missing R2 Credentials");
            }

            const r2Client = new S3Client({
                region: "auto",
                endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
                    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
                },
            });

            const command = new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: key,
                ContentType: contentType,
                // Optional: Pass ContentLength to constrain the signed URL if supported by S3/R2 implementation
                // ContentLength: size 
            });

            // Generate Presigned URL (valid for 1 hour)
            const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
            const publicUrl = `${R2_PUBLIC_URL}/${key}`;

            console.log("[generateUploadUrl] Success", { publicUrl });
            res.status(200).json({ signedUrl, publicUrl });

        } catch (error: any) {
            console.error("R2 Presign Error:", error);
            res.status(500).json({ error: "Failed to generate upload URL" });
        }
    });
});

// --- AUTO-CLEANUP: Delete old notifications (30+ days) ---
// Runs daily at 3:00 AM UTC
export const cleanupOldNotifications = functions.pubsub
    .schedule("0 3 * * *")
    .timeZone("UTC")
    .onRun(async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoff = thirtyDaysAgo.toISOString();

        console.log(`[cleanupOldNotifications] Deleting notifications older than ${cutoff}`);

        try {
            const choirsSnapshot = await db.collection("choirs").get();
            let totalDeleted = 0;

            for (const choirDoc of choirsSnapshot.docs) {
                const notificationsRef = choirDoc.ref.collection("notifications");
                const oldNotifs = await notificationsRef
                    .where("createdAt", "<", cutoff)
                    .limit(500)
                    .get();

                if (oldNotifs.empty) continue;

                const batch = db.batch();
                oldNotifs.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();

                totalDeleted += oldNotifs.size;
                console.log(`[cleanupOldNotifications] Deleted ${oldNotifs.size} from choir ${choirDoc.id}`);
            }

            console.log(`[cleanupOldNotifications] Total deleted: ${totalDeleted}`);
        } catch (error) {
            console.error("[cleanupOldNotifications] Error:", error);
        }
    });
// --- STATISTICS AGGREGATION ---
export { onServiceWrite } from "./statsAggregator";
export { backfillStats } from "./backfillStats";

// --- TEMPORARY: Fix user data (role + isDuplicate) ---
export const fixUserData = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Must be logged in");

    const callerUid = context.auth.uid;
    const targetUid = data.targetUid || callerUid;
    const newRole = data.role || 'head';

    // Only allow the target user or an admin to run this
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const callerData = callerDoc.data();
    if (callerUid !== targetUid && callerData?.role !== 'head') {
        throw new functions.https.HttpsError("permission-denied", "Only the head can fix other users");
    }

    const userRef = db.collection("users").doc(targetUid);
    const userDoc = await db.collection("users").doc(targetUid).get();
    if (!userDoc.exists) throw new functions.https.HttpsError("not-found", "User not found");
    const userData = userDoc.data()!;
    const choirId = userData.choirId;

    if (!choirId) throw new functions.https.HttpsError("not-found", "User has no choir");

    // 1. Fix user doc role
    const updates: any = { role: newRole };
    if (userData.memberships) {
        updates.memberships = userData.memberships.map((m: any) => {
            if (m.choirId === choirId) return { ...m, role: newRole };
            return m;
        });
    }
    await userRef.update(updates);

    // 2. Fix choir member entry: clear isDuplicate, set role
    const choirRef = db.collection("choirs").doc(choirId);
    const choirDoc = await choirRef.get();
    if (!choirDoc.exists) throw new functions.https.HttpsError("not-found", "Choir not found");

    const members = choirDoc.data()!.members || [];
    const memberIndex = members.findIndex((m: any) =>
        m.id === targetUid || m.accountUid === targetUid || (m.linkedUserIds || []).includes(targetUid)
    );

    let memberInfo = "No member entry found";
    if (memberIndex >= 0) {
        const updatedMembers = [...members];
        const member = { ...updatedMembers[memberIndex] };
        delete member.isDuplicate;
        member.role = newRole;
        member.hasAccount = true;
        updatedMembers[memberIndex] = member;
        await choirRef.update({ members: updatedMembers });
        memberInfo = `Fixed member at index ${memberIndex}: ${member.name} (id=${member.id})`;
    }

    // 3. Sync claims
    await syncUserClaims(targetUid);

    return {
        success: true,
        message: `Role set to ${newRole}. ${memberInfo}`,
        userData: { name: userData.name, email: userData.email, choirId }
    };
});

/**
 * sendNotification
 * Sends push notifications to all choir members via FCM.
 * Called via httpsCallable from the client — bypasses CORS/CDN entirely.
 */
export const sendNotification = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = context.auth.uid;
    const { title = "", body, choirId, serviceId, serviceName, enableVoting } = data;

    if (!body || !choirId) {
        throw new functions.https.HttpsError("invalid-argument", "body and choirId are required");
    }

    // 1. Check Permissions
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (!userData) {
        throw new functions.https.HttpsError("not-found", "User not found");
    }

    const membership = (userData.memberships || []).find((m: any) => m.choirId === choirId);
    if (!membership) {
        throw new functions.https.HttpsError("permission-denied", "Not a member of this choir");
    }

    const isRegent = membership.role === 'regent' || membership.role === 'head';
    const hasPermission = (userData.permissions || []).includes('notify_members');

    if (!isRegent && !hasPermission) {
        throw new functions.https.HttpsError("permission-denied", "No permission to send notifications");
    }

    // 2. Fetch Recipients — log per-user token details
    console.log(`[sendNotification] Fetching members for choir: ${choirId}`);
    const choirDoc = await db.collection("choirs").doc(choirId).get();
    const choirData = choirDoc.data();

    if (!choirData) {
        throw new functions.https.HttpsError("not-found", "Choir not found");
    }

    const memberIds = (choirData.members || []).map((m: any) => m.id);
    console.log(`[sendNotification] Found ${memberIds.length} members in choir.`);

    const userRefs = memberIds.map((id: string) => db.collection("users").doc(id));
    const userDocs = await db.getAll(...userRefs);

    // Collect tokens with origin info for debugging
    const tokenOrigins: { token: string; userId: string; userName: string }[] = [];
    userDocs.forEach(doc => {
        const u = doc.data();
        if (u && u.notificationsEnabled && u.fcmTokens && Array.isArray(u.fcmTokens)) {
            for (const t of u.fcmTokens) {
                tokenOrigins.push({ token: t, userId: doc.id, userName: u.name || "?" });
            }
        }
    });

    // Deduplicate tokens (keep first origin for logging)
    const seen = new Set<string>();
    const uniqueOrigins = tokenOrigins.filter(o => {
        if (seen.has(o.token)) return false;
        seen.add(o.token);
        return true;
    });

    console.log(`[sendNotification] Token breakdown:`);
    uniqueOrigins.forEach((o, i) => {
        console.log(`  [${i}] user=${o.userName} (${o.userId.substring(0, 8)}...) token=${o.token.substring(0, 20)}...`);
    });

    const uniqueTokens = uniqueOrigins.map(o => o.token);

    if (uniqueTokens.length === 0) {
        console.warn("[sendNotification] No valid tokens found.");
        return { success: true, count: 0, failed: 0, message: "No devices to send to", errors: [] };
    }

    // 3. Build and log payload
    const choirName = choirData.name || "ChoirHub";
    const senderName = userData.name || "Regent";

    // Format: "[Choir Name] Title" or just "Choir Name"
    const pushTitle = title.trim() ? `[${choirName}] ${title.trim()}` : choirName;

    // Format: "SenderName: Body" (unless title is missing, then maybe just body, but let's be consistent)
    const pushBody = `${senderName}: ${body.trim()}`;

    const message = {
        notification: {
            title: pushTitle,
            body: pushBody
        },
        data: {
            route: '/notifications',
            choirId: choirId
        },
        apns: {
            headers: { "apns-priority": "10", "apns-push-type": "alert" },
            payload: { aps: { sound: "default", badge: 1 } },
        },
        android: {
            priority: "high" as const,
            notification: { sound: "default", channelId: "choir_notifications" },
        },
        tokens: uniqueTokens,
    };

    console.log(`[sendNotification] Payload structure:`, JSON.stringify({
        notification: message.notification,
        apns: message.apns,
        android: message.android,
        tokenCount: uniqueTokens.length
    }, null, 2));

    // 4. Send
    console.log(`[sendNotification] Sending to ${uniqueTokens.length} devices...`);
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[sendNotification] Result: successCount=${response.successCount}, failureCount=${response.failureCount}`);

    // 5. Detailed per-token response logging
    const errors: { tokenPrefix: string; user: string; code: string; message: string }[] = [];
    response.responses.forEach((resp, idx) => {
        const origin = uniqueOrigins[idx];
        const tokenPrefix = origin.token.substring(0, 20) + "...";
        if (resp.success) {
            console.log(`  ✅ [${idx}] ${origin.userName}: delivered (messageId=${resp.messageId})`);
        } else {
            const errCode = resp.error?.code || "unknown";
            const errMsg = resp.error?.message || "no message";
            console.error(`  ❌ [${idx}] ${origin.userName}: FAILED code=${errCode} msg=${errMsg}`);
            errors.push({ tokenPrefix, user: origin.userName, code: errCode, message: errMsg });
        }
    });

    // 6. Save to Firestore
    const notificationData: any = {
        title, body, choirId,
        senderId: uid,
        senderName: userData.name || "Regent",
        createdAt: new Date().toISOString(),
        readBy: [uid]
    };

    if (enableVoting && serviceId && serviceName) {
        notificationData.serviceId = serviceId;
        notificationData.serviceName = serviceName;
        notificationData.enableVoting = enableVoting;
    }

    await db.collection(`choirs/${choirId}/notifications`).add(notificationData);

    // 7. Clean up stale tokens
    const tokensToRemove: string[] = [];
    response.responses.forEach((resp, idx) => {
        if (!resp.success) {
            const errCode = resp.error?.code;
            if (
                errCode === 'messaging/registration-token-not-registered' ||
                errCode === 'messaging/invalid-registration-token' ||
                errCode === 'messaging/invalid-argument'
            ) {
                tokensToRemove.push(uniqueTokens[idx]);
            }
        }
    });

    if (tokensToRemove.length > 0) {
        console.log(`[sendNotification] Cleaning ${tokensToRemove.length} stale tokens...`);
        const staleSnaps = await Promise.all(
            tokensToRemove.map(t =>
                db.collection("users").where("fcmTokens", "array-contains", t).get()
            )
        );
        const batch = db.batch();
        let ops = 0;
        staleSnaps.forEach((snap, i) => {
            snap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(tokensToRemove[i])
                });
                ops++;
            });
        });
        if (ops > 0) {
            await batch.commit();
            console.log(`[sendNotification] Removed ${tokensToRemove.length} stale tokens from ${ops} docs.`);
        }
    }

    return {
        success: true,
        count: response.successCount,
        failed: response.failureCount,
        errors
    };
});

// --- SAFE INACTIVE CHOIR CLEANUP SYSTEM ---

const DRY_RUN = true; // When true, Stage 4 logs but does NOT delete anything

const EMPTY_GRACE_DAYS = 60;
const WARNING_GRACE_DAYS = 7;
const ARCHIVE_GRACE_DAYS = 30;
const MAX_DELETIONS_PER_RUN = 5;

/**
 * processInactiveChoirs
 * State machine to safely clean up abandoned/empty choirs.
 * Runs once a day. Max 5 choirs processed per run to prevent timeout/quota issues.
 */
export const processInactiveChoirs = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async (context) => {
        const runTimestamp = admin.firestore.FieldValue.serverTimestamp();
        let processedCount = 0;

        async function checkKillSwitch() {
            const doc = await db.collection("systemSettings").doc("cleanup").get();
            if (!doc.exists || doc.data()?.enabled !== true) {
                throw new Error("Cleanup disabled via kill switch");
            }
        }

        // Check initially
        await checkKillSwitch();

        // --- STAGE 4: PERMANENT DELETE (from archivedChoirs) ---
        // Do this first to free up space.
        await checkKillSwitch();

        const archiveThreshold = admin.firestore.Timestamp.fromDate(new Date(Date.now() - ARCHIVE_GRACE_DAYS * 24 * 60 * 60 * 1000));
        const toDeleteSnap = await db.collection("archivedChoirs")
            .where("deletionStage", "==", "archived")
            .where("archivedAt", "<", archiveThreshold)
            .orderBy("archivedAt", "asc")
            .limit(MAX_DELETIONS_PER_RUN)
            .get();

        for (const doc of toDeleteSnap.docs) {
            if (processedCount >= MAX_DELETIONS_PER_RUN) break;
            const choirId = doc.id;
            const data = doc.data();

            console.log(JSON.stringify({
                stage: "HARD_DELETE_ATTEMPT",
                choirId,
                membersCount: data.membersCount,
                deletionStage: data.deletionStage,
                emptySince: data.emptySince?.toDate(),
                archivedAt: data.archivedAt?.toDate(),
                timestamp: new Date().toISOString()
            }));

            // Multi-Layer Safety Gate
            if (
                data.membersCount !== 0 ||
                data.deletionStage !== "archived" ||
                !data.emptySince ||
                !data.archivedAt ||
                data.archivedAt.toMillis() >= archiveThreshold.toMillis()
            ) {
                console.log(`[STAGE 4 ABORT] Choir ${choirId} failed safety gate.`);
                continue;
            }

            // --- DRY RUN GUARD ---
            if (DRY_RUN) {
                console.log("[STAGE 4] DRY RUN ACTIVE — No permanent deletion executed");
                console.log(JSON.stringify({
                    dryRun: true,
                    choirId,
                    membersCount: data.membersCount,
                    deletionStage: data.deletionStage,
                    emptySince: data.emptySince?.toDate(),
                    archivedAt: data.archivedAt?.toDate(),
                    wouldDeleteR2: true,
                    wouldDeleteFirestore: true,
                    timestamp: new Date().toISOString()
                }));
                processedCount++;
                continue;
            }

            console.log(`[STAGE 4] Permanently deleting archived choir: ${choirId}`);

            await checkKillSwitch(); // Right before R2

            // 1. Delete associated R2 storage directory
            // This will THROW if it fails. We want that so Firestore delete doesn't run.
            await deleteR2Directory(`choirs/${choirId}/`);

            await checkKillSwitch(); // Right before Firestore delete

            // 2. Delete ALL subcollections deeply
            // `firebase-admin` supports recursive delete:
            await db.recursiveDelete(db.collection("archivedChoirs").doc(choirId));
            console.log(`[STAGE 4] Successfully deleted archived choir ${choirId}`);
            processedCount++;
        }

        if (processedCount >= MAX_DELETIONS_PER_RUN) return null;

        // --- STAGE 2 & 3: SCHEDULED -> ARCHIVE ---
        await checkKillSwitch();

        const scheduledThreshold = admin.firestore.Timestamp.fromDate(new Date(Date.now() - WARNING_GRACE_DAYS * 24 * 60 * 60 * 1000));
        const toArchiveSnap = await db.collection("choirs")
            .where("membersCount", "==", 0)
            .where("deletionStage", "==", "scheduled")
            .where("deletionScheduledAt", "<", scheduledThreshold)
            .orderBy("deletionScheduledAt", "asc")
            .limit(MAX_DELETIONS_PER_RUN - processedCount)
            .get();

        for (const doc of toArchiveSnap.docs) {
            if (processedCount >= MAX_DELETIONS_PER_RUN) break;
            const choirId = doc.id;

            // RE-VALIDATE IN TRANSACTION
            await db.runTransaction(async (transaction) => {
                const liveSnap = await transaction.get(doc.ref);
                if (!liveSnap.exists) return;
                const data = liveSnap.data()!;

                // ABORT check
                if (data.membersCount !== 0 || data.deletionStage !== "scheduled") {
                    console.log(`[STAGE 2/3 ABORT] Choir ${choirId} changed state. membersCount=${data.membersCount}, stage=${data.deletionStage}`);
                    return;
                }

                console.log(`[STAGE 2/3] Archiving choir: ${choirId}`);

                // STAGE 3: COPY TO ARCHIVED (Metadata only)
                const archiveRef = db.collection("archivedChoirs").doc(choirId);
                const archivedData = {
                    ...data,
                    deletionStage: "archived",
                    archivedAt: runTimestamp
                };
                transaction.set(archiveRef, archivedData);

                // STAGE 3: DELETE ORIGINAL DOC (Keep subcollections dangling, they'll be deleted in STAGE 4 along with archive copy)
                transaction.delete(doc.ref);
            });
            processedCount++;
        }

        if (processedCount >= MAX_DELETIONS_PER_RUN) return null;

        // --- STAGE 1: EMPTY -> SCHEDULED ---
        await checkKillSwitch();

        const emptyThreshold = admin.firestore.Timestamp.fromDate(new Date(Date.now() - EMPTY_GRACE_DAYS * 24 * 60 * 60 * 1000));
        const toScheduleSnap = await db.collection("choirs")
            .where("membersCount", "==", 0)
            .where("deletionStage", "==", "empty")
            .where("emptySince", "<", emptyThreshold)
            .orderBy("emptySince", "asc")
            .limit(MAX_DELETIONS_PER_RUN - processedCount)
            .get();

        for (const doc of toScheduleSnap.docs) {
            if (processedCount >= MAX_DELETIONS_PER_RUN) break;
            const choirId = doc.id;
            const choirName = doc.data().name || "Unknown";

            // Validate via transaction
            await db.runTransaction(async (transaction) => {
                const liveSnap = await transaction.get(doc.ref);
                if (!liveSnap.exists) return;
                const data = liveSnap.data()!;

                if (data.membersCount !== 0 || data.deletionStage !== "empty") {
                    return;
                }

                console.log(`[STAGE 1] Scheduling choir for deletion: ${choirId}`);
                transaction.update(doc.ref, {
                    deletionStage: "scheduled",
                    deletionScheduledAt: runTimestamp
                });
            });

            // SEND NOTIFICATIONS
            // Load deterministic targets instead of querying the global users collection
            const liveChoirSnap = await db.collection("choirs").doc(choirId).get();
            const liveChoirData = liveChoirSnap.data() || {};

            const targetIds = new Set<string>();
            if (liveChoirData.creatorId) targetIds.add(liveChoirData.creatorId);
            if (Array.isArray(liveChoirData.formerAdmins)) {
                liveChoirData.formerAdmins.forEach((id: string) => targetIds.add(id));
            }

            const tokens: string[] = [];

            // Load explicitly targeted users safely
            for (const adminId of targetIds) {
                try {
                    const adminDoc = await db.collection("users").doc(adminId).get();
                    if (!adminDoc.exists) continue;

                    const t = adminDoc.data()?.fcmTokens || [];
                    tokens.push(...t);

                    // Write in-app notification
                    await db.collection(`users/${adminId}/notifications`).add({
                        title: "⚠️ Видалення хору",
                        body: `Ваш хор '${choirName}' буде видалено через 7 днів через неактивність. Додайте хоча б одного учасника, щоб скасувати видалення.`,
                        type: "alert",
                        read: false,
                        createdAt: runTimestamp,
                        choirId: choirId
                    });
                } catch (e) {
                    console.error(`Failed to process notification for former admin ${adminId}:`, e);
                }
            }

            if (tokens.length > 0) {
                const uniqueTokens = [...new Set(tokens)];
                try {
                    await admin.messaging().sendEachForMulticast({
                        tokens: uniqueTokens,
                        notification: {
                            title: "⚠️ Хор під загрозою видалення",
                            body: `Хор '${choirName}' буде видалено через 7 днів. Додайте учасника, щоб скасувати!`
                        }
                    });
                } catch (e) {
                    console.error(`Failed to send push notifications for scheduled deletion of ${choirId}:`, e);
                }
            }

            processedCount++;
        }

        return null;
    });

/**
 * Helper to delete an entire folder from R2 bucket.
 */
async function deleteR2Directory(prefix: string): Promise<void> {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
        console.warn("deleteR2Directory: R2_BUCKET_NAME not set. Skipping.");
        return;
    }

    const r2Client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
        }
    });

    // Loop to handle pagination if there are more than 1000 objects
    let isTruncated = true;
    let continuationToken: string | undefined = undefined;

    while (isTruncated) {
        const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken
        });
        const listResponse = await r2Client.send(listCommand);

        const objects = listResponse.Contents;
        if (objects && objects.length > 0) {
            const deleteCommand = new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: objects.map(o => ({ Key: o.Key }))
                }
            });
            await r2Client.send(deleteCommand);
            console.log(`deleteR2Directory: Deleted ${objects.length} files from ${prefix}`);
        }

        isTruncated = listResponse.IsTruncated || false;
        continuationToken = listResponse.NextContinuationToken;
    }
}
