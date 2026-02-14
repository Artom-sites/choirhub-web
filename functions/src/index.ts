import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

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

    await admin.auth().setCustomUserClaims(userId, claims);
    console.log(`Claims synced for ${userId}:`, JSON.stringify(claims));
}

// --- ATOMIC OPERATIONS ---

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
            return { success: true, message: "Already a member" };
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
                role: newRole
            });
        }

        // If user is switching active choir to this one (or has no active choir)
        const updates: any = {
            memberships: updatedMemberships,
            permissions: uniquePermissions,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (!userData.choirId || userData.choirId === choirId) {
            updates.choirId = choirId;
            updates.choirName = choirName;
            updates.role = newRole;
        }

        transaction.set(userRef, updates, { merge: true }); // Use set with merge to create if new

        // --- UPDATE CHOIR MEMBER LIST ---

        const members = choirData.members || [];
        const memberIndex = members.findIndex((m: any) => m.id === userId);

        const userName = userData.name || "Unknown";
        const userVoice = userData.voice || "Soprano";

        const memberData = {
            id: userId,
            name: userName,
            role: newRole,
            voice: userVoice,
            permissions: uniquePermissions,
            hasAccount: true
        };

        if (memberIndex >= 0) {
            const updatedMembers = [...members];
            updatedMembers[memberIndex] = { ...updatedMembers[memberIndex], ...memberData };
            transaction.update(choirRef, { members: updatedMembers });
        } else {
            transaction.update(choirRef, {
                members: admin.firestore.FieldValue.arrayUnion(memberData)
            });
        }

        return { success: true, message: isUpgrade ? "Role Upgraded" : "Joined", choirId };
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
        const choirDoc = await transaction.get(choirRef);
        if (!choirDoc.exists) throw new functions.https.HttpsError("not-found", "Choir not found");

        const choirData = choirDoc.data()!;
        const members = choirData.members || [];

        const updatedMembers = members.filter((m: any) => m.id !== userId);

        if (updatedMembers.length !== members.length) {
            transaction.update(choirRef, { members: updatedMembers });
        }

        const userDoc = await transaction.get(userRef);
        if (userDoc.exists) {
            const userData = userDoc.data()!;
            const memberships = userData.memberships || [];
            const updatedMemberships = memberships.filter((m: any) => m.choirId !== choirId);

            const updates: any = { memberships: updatedMemberships };
            // If active choir is this one, clear it
            if (userData.choirId === choirId) {
                updates.choirId = admin.firestore.FieldValue.delete();
                updates.choirName = admin.firestore.FieldValue.delete();
                updates.role = admin.firestore.FieldValue.delete();
                // We keep permissions global?
                // Or clear them?
                // Assuming permissions are reset if leaving main choir
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
 * atomicDeleteUser
 * Deletes user and removes them from all choirs securely.
 */
export const atomicDeleteUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const userId = context.auth.uid;

    try {
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            try { await admin.auth().deleteUser(userId); } catch (e) { }
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

            // Read the choir document to get the current members array
            const choirSnap = await choirRef.get();
            if (choirSnap.exists) {
                const choirData = choirSnap.data()!;
                const currentMembers = choirData.members || [];

                // Update the member object: keep history, mark as deleted account
                const updatedMembers = currentMembers.map((m: any) => {
                    if (m.id === userId) {
                        return {
                            ...m,
                            hasAccount: false,
                            // We can optionally append (Deleted) to name if desired, but user asked to preserve props.
                        };
                    }
                    return m;
                });

                batch.update(choirRef, { members: updatedMembers });
            }

            // Remove from Members subcollection if exists (Legacy cleanup)
            const memberRef = choirRef.collection("members").doc(userId);
            batch.delete(memberRef);
        }

        batch.delete(userRef);
        await batch.commit();

        try {
            await admin.auth().deleteUser(userId);
        } catch (e) {
            console.log("Error deleting auth:", e);
        }

        return { success: true };

    } catch (error) {
        console.error("Delete user error:", error);
        throw new functions.https.HttpsError("internal", "Failed to delete account");
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
        const updatedMembers = members.filter((m: any) => m.id !== fromMemberId);

        if (updatedMembers.length !== members.length) {
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
 * atomicUpdateMember
 * Updates a choir member's details (role, voice, name).
 * Syncs changes to the User document if the member has an account.
 * Admin only.
 */
export const atomicUpdateMember = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Locked");

    const { choirId, memberId, updates } = data; // updates: { name, voice, role, permissions? }

    // ✅ Claims-based permission check (no Firestore read)
    const callerChoirs = (context.auth.token as any).choirs || {};
    const callerRole = callerChoirs[choirId];
    if (!callerRole || !['admin', 'regent', 'head'].includes(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "Unauthorized");
    }

    const result = await db.runTransaction(async (transaction) => {
        const choirRef = db.collection("choirs").doc(choirId);
        const choirDoc = await transaction.get(choirRef);

        if (!choirDoc.exists) throw new functions.https.HttpsError("not-found", "Choir not found");

        const choirData = choirDoc.data()!;
        const members = choirData.members || [];
        const memberIndex = members.findIndex((m: any) => m.id === memberId);

        if (memberIndex === -1) throw new functions.https.HttpsError("not-found", "Member not found");

        const oldMember = members[memberIndex];
        const newMember = { ...oldMember, ...updates }; // Apply updates

        // Update Choir Doc
        const updatedMembers = [...members];
        updatedMembers[memberIndex] = newMember;
        transaction.update(choirRef, { members: updatedMembers });

        // If member has account, sync to User Doc
        if (oldMember.hasAccount || newMember.hasAccount) {
            const targetUserRef = db.collection("users").doc(memberId);
            const targetUserDoc = await transaction.get(targetUserRef);

            if (targetUserDoc.exists) {
                const targetUserData = targetUserDoc.data()!;

                // Update memberships array
                const memberships = targetUserData.memberships || [];
                const updatedMemberships = memberships.map((m: any) => {
                    if (m.choirId === choirId) {
                        return { ...m, role: newMember.role }; // Sync role
                    }
                    return m;
                });

                const userUpdates: any = { memberships: updatedMemberships };

                // Sync active role if this is their active choir
                if (targetUserData.choirId === choirId) {
                    userUpdates.role = newMember.role;
                    userUpdates.voice = newMember.voice;
                    if (updates.permissions) {
                        userUpdates.permissions = updates.permissions; // dangerous? caller is admin.
                        // But we should be careful. 
                        // For now, let's allow syncing permissions if provided
                    }
                }

                if (updates.permissions && targetUserData.choirId !== choirId) {
                    // Even if not active, we might want to update global permissions?
                    // Or permissions are per-choir in memberships? My schema has global permissions.
                    // Logic in atomicJoinChoir merges them.
                    // Here we OVERWRITE them?
                    // Let's assume permissions are global.
                    if (updates.permissions) userUpdates.permissions = updates.permissions;
                }

                transaction.update(targetUserRef, userUpdates);
            }
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
