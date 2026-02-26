"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixUserData = exports.backfillStats = exports.onServiceWrite = exports.cleanupOldNotifications = exports.generateUploadUrl = exports.registerFcmToken = exports.migrateAllClaims = exports.atomicUpdateMember = exports.claimMember = exports.atomicMergeMembers = exports.adminDeleteUser = exports.atomicDeleteSelf = exports.atomicLeaveChoir = exports.atomicJoinChoir = exports.atomicCreateChoir = exports.forceSyncClaims = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
admin.initializeApp();
const db = admin.firestore();
// --- CLAIMS UTILITY ---
/**
 * Sync user's choir memberships into Firebase Custom Claims.
 * Must be called after every join/leave/role-change operation.
 * Claims structure: { choirs: { "choirId": "role" }, superAdmin?: true }
 */
async function syncUserClaims(userId) {
    const userDoc = await db.collection("users").doc(userId).get();
    const data = userDoc.data();
    if (!data) {
        // User deleted or doesn't exist — clear claims
        await admin.auth().setCustomUserClaims(userId, {});
        return;
    }
    const memberships = data.memberships || [];
    const choirs = {};
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
    const claims = { choirs };
    if (isSuperAdmin)
        claims.superAdmin = true;
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
exports.forceSyncClaims = functions.https.onCall(async (data, context) => {
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
exports.atomicCreateChoir = functions.https.onCall(async (data, context) => {
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
    const choirData = {
        name: name.trim(),
        choirType,
        memberCode,
        regentCode,
        ownerId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        regents: [userData.name || "Head"],
        members: [{
                id: userId,
                name: userData.name || "Користувач",
                photoURL: userData.photoURL || null,
                role: 'head',
                hasAccount: true,
                accountUid: userId
            }]
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
        choirId: choirId,
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
exports.atomicJoinChoir = functions.https.onCall(async (data, context) => {
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
    let permissions = [];
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
            const match = adminCodes.find((ac) => ac.code === codeUpper);
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
        if (!choirDoc.exists)
            throw new functions.https.HttpsError("not-found", "Choir not found");
        const choirData = choirDoc.data();
        const userData = userDoc.exists ? userDoc.data() : {};
        const existingMemberships = userData.memberships || [];
        // Check if already member
        const existingMembership = existingMemberships.find((m) => m.choirId === choirId);
        const currentRole = existingMembership ? existingMembership.role : null;
        const currentPermissions = userData.permissions || [];
        // Determine if upgrade needed
        let newRole = currentRole || role;
        // Upgrade logic: member -> regent/head
        if (role === 'regent' && currentRole === 'member')
            newRole = 'regent';
        if (role === 'head' && currentRole !== 'head')
            newRole = 'head';
        // Merge permissions
        const newPermissions = [...(currentPermissions), ...permissions];
        const uniquePermissions = [...new Set(newPermissions)];
        const isUpgrade = (newRole !== currentRole) || (uniquePermissions.length > currentPermissions.length);
        if (existingMembership && !isUpgrade) {
            // Even if already a member, return unlinked members so they can claim a legacy entry if needed
            const members = choirData.members || [];
            const unlinkedMembers = members
                .filter((m) => !m.hasAccount && !m.accountUid && m.id !== userId)
                .map((m) => ({ id: m.id, name: m.name, voice: m.voice || "" }));
            return { success: true, message: "Already a member", choirId, unlinkedMembers };
        }
        // --- UPDATE USER ---
        let updatedMemberships = [...existingMemberships];
        if (existingMembership) {
            updatedMemberships = updatedMemberships.map((m) => {
                if (m.choirId === choirId)
                    return Object.assign(Object.assign({}, m), { role: newRole });
                return m;
            });
        }
        else {
            updatedMemberships.push({
                choirId: choirId,
                choirName: choirName,
                role: newRole,
                choirType: choirData.choirType || 'msc'
            });
        }
        // If user is switching active choir to this one (or has no active choir)
        const updates = {
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
        // Only update if user already exists in roster (e.g. previously linked).
        // Do NOT create new entries — new users appear only in "Користувачі" tab.
        const members = choirData.members || [];
        const memberIndex = members.findIndex((m) => m.id === userId || m.accountUid === userId || (m.linkedUserIds || []).includes(userId));
        if (memberIndex >= 0) {
            const updatedMembers = [...members];
            updatedMembers[memberIndex] = Object.assign(Object.assign({}, updatedMembers[memberIndex]), { role: newRole, permissions: uniquePermissions, hasAccount: true });
            transaction.update(choirRef, { members: updatedMembers });
        }
        // If memberIndex < 0: user is new → NO entry created in members[]
        // Collect unlinked members for client-side "Claim Member" UI
        // Use original members array (before our write) — the new auto-created entry is excluded by filter
        const unlinkedMembers = members
            .filter((m) => !m.hasAccount && !m.accountUid && m.id !== userId)
            .map((m) => ({ id: m.id, name: m.name, voice: m.voice || "" }));
        return { success: true, message: isUpgrade ? "Role Upgraded" : "Joined", choirId, unlinkedMembers };
    });
    // ✅ Sync claims AFTER transaction commits
    await syncUserClaims(userId);
    return result;
});
/**
 * atomicLeaveChoir
 * Removes a user from a specific choir.
 */
exports.atomicLeaveChoir = functions.https.onCall(async (data, context) => {
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
        if (!choirDoc.exists)
            throw new functions.https.HttpsError("not-found", "Choir not found");
        const userDoc = await transaction.get(userRef);
        // userDoc existence check can happen later or we assume it exists for auth user
        // --- LOGIC ---
        const choirData = choirDoc.data();
        const members = choirData.members || [];
        const updatedMembers = members.filter((m) => m.id !== userId);
        const userData = userDoc.exists ? userDoc.data() : null;
        // --- WRITES ---
        // 1. Update Choir
        if (updatedMembers.length !== members.length) {
            transaction.update(choirRef, { members: updatedMembers });
        }
        // 2. Update User
        if (userData) {
            const memberships = userData.memberships || [];
            const updatedMemberships = memberships.filter((m) => m.choirId !== choirId);
            const updates = { memberships: updatedMemberships };
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
exports.atomicDeleteSelf = functions.https.onCall(async (_data, context) => {
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
            try {
                await admin.auth().deleteUser(userId);
            }
            catch (e) {
                console.error("Auth delete error:", e);
            }
            return { success: true };
        }
        const userData = userSnap.data();
        const memberships = userData.memberships || [];
        console.log(`atomicDeleteSelf: found ${memberships.length} memberships`);
        if (memberships.length === 0 && userData.choirId) {
            memberships.push({ choirId: userData.choirId });
        }
        const batch = db.batch();
        for (const membership of memberships) {
            if (!membership.choirId)
                continue;
            console.log("atomicDeleteSelf: processing choir", membership.choirId);
            const choirRef = db.collection("choirs").doc(membership.choirId);
            const choirSnap = await choirRef.get();
            if (choirSnap.exists) {
                const choirData = choirSnap.data();
                const currentMembers = choirData.members || [];
                const updatedMembers = currentMembers.map((m) => {
                    // Check strict ID match OR linked account match
                    if (m.id === userId || m.accountUid === userId) {
                        // Keep member but remove account link
                        const { accountUid, fcmTokens } = m, rest = __rest(m, ["accountUid", "fcmTokens"]);
                        return Object.assign(Object.assign({}, rest), { hasAccount: false });
                    }
                    return m;
                });
                batch.update(choirRef, { members: updatedMembers });
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
        }
        catch (e) {
            console.log("Error deleting auth:", e);
        }
        // Ensure no claims remain if auth deletion failed weirdly or if account is restored
        try {
            // We can't set claims on a deleted user. 
            // But if deleteUser threw, user might exist.
            await admin.auth().setCustomUserClaims(userId, { choirs: {} });
        }
        catch (e) {
            // Ignore if user not found
        }
        return { success: true };
    }
    catch (error) {
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
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const callerUid = context.auth.uid;
    const targetUid = data === null || data === void 0 ? void 0 : data.targetUid;
    // --- VALIDATION ---
    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "targetUid is required");
    }
    if (targetUid === callerUid) {
        throw new functions.https.HttpsError("invalid-argument", "Cannot delete yourself via admin path. Use self-delete.");
    }
    // Claims-based permission check with Firestore fallback
    const callerChoirs = context.auth.token.choirs || {};
    let hasAdminRole = Object.values(callerChoirs).some((role) => ['head', 'regent'].includes(role));
    // Fallback: if claims are empty (e.g. after account restore), check Firestore
    if (!hasAdminRole) {
        const callerDoc = await db.collection("users").doc(callerUid).get();
        if (callerDoc.exists) {
            const callerData = callerDoc.data();
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
            try {
                await admin.auth().deleteUser(targetUid);
            }
            catch (e) { }
            return { success: true };
        }
        const userData = userSnap.data();
        const memberships = userData.memberships || [];
        if (memberships.length === 0 && userData.choirId) {
            memberships.push({ choirId: userData.choirId });
        }
        const batch = db.batch();
        for (const membership of memberships) {
            if (!membership.choirId)
                continue;
            const choirRef = db.collection("choirs").doc(membership.choirId);
            const choirSnap = await choirRef.get();
            if (choirSnap.exists) {
                const choirData = choirSnap.data();
                const currentMembers = choirData.members || [];
                // Mark member as deleted but preserve in list
                const updatedMembers = currentMembers.map((m) => {
                    // Check strict ID match OR linked account match
                    if (m.id === targetUid || m.accountUid === targetUid) {
                        const { accountUid, fcmTokens } = m, rest = __rest(m, ["accountUid", "fcmTokens"]);
                        return Object.assign(Object.assign({}, rest), { hasAccount: false });
                    }
                    return m;
                });
                batch.update(choirRef, { members: updatedMembers });
            }
            const memberRef = choirRef.collection("members").doc(targetUid);
            batch.delete(memberRef);
        }
        // Delete Firestore user doc
        batch.delete(userRef);
        await batch.commit();
        // Delete Firebase Auth record
        try {
            await admin.auth().deleteUser(targetUid);
        }
        catch (e) {
            console.log("Error deleting target auth:", e);
        }
        return { success: true, deletedUid: targetUid };
    }
    catch (error) {
        console.error("Admin delete user error:", error);
        throw new functions.https.HttpsError("internal", "Failed to delete user");
    }
});
/**
 * atomicMergeMembers
 * Merges statistics and services from one member to another.
 * Admin only.
 */
exports.atomicMergeMembers = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Locked");
    const { choirId, fromMemberId, toMemberId } = data;
    // ✅ Claims-based permission check (no Firestore read)
    const callerChoirs = context.auth.token.choirs || {};
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
            newConfirmed = newConfirmed.filter((id) => id !== fromMemberId);
            if (!newConfirmed.includes(toMemberId))
                newConfirmed.push(toMemberId);
            changed = true;
        }
        if (newAbsent.includes(fromMemberId)) {
            newAbsent = newAbsent.filter((id) => id !== fromMemberId);
            if (!newAbsent.includes(toMemberId))
                newAbsent.push(toMemberId);
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
        const cData = choirSnap.data();
        const members = cData.members || [];
        const fromMember = members.find((m) => m.id === fromMemberId);
        let updatedMembers = members.filter((m) => m.id !== fromMemberId);
        // Transfer account data from source to target if source had an account
        if (fromMember === null || fromMember === void 0 ? void 0 : fromMember.hasAccount) {
            updatedMembers = updatedMembers.map((m) => {
                if (m.id === toMemberId && !m.hasAccount) {
                    return Object.assign(Object.assign({}, m), { hasAccount: true, linkedUserIds: [...(m.linkedUserIds || []), fromMemberId] });
                }
                return m;
            });
        }
        if (updatedMembers.length !== members.length || (fromMember === null || fromMember === void 0 ? void 0 : fromMember.hasAccount)) {
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
exports.claimMember = functions.https.onCall(async (data, context) => {
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
    const callerChoirs = context.auth.token.choirs || {};
    let isMember = !!callerChoirs[choirId];
    // Firestore fallback if claims are empty (e.g. after account restore)
    if (!isMember) {
        const callerDoc = await db.collection("users").doc(callerUid).get();
        if (callerDoc.exists) {
            const callerData = callerDoc.data();
            if (callerData.choirId === choirId) {
                isMember = true;
            }
            else {
                isMember = (callerData.memberships || []).some((m) => m.choirId === choirId);
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
        const choirData = choirDoc.data();
        const members = choirData.members || [];
        // ── STEP 1: Unlink caller from any previous member entry ──
        // If the caller was already linked to a different member, remove from their linkedUserIds
        const previouslyLinkedIndex = members.findIndex((m) => m.accountUid === callerUid || (m.linkedUserIds || []).includes(callerUid));
        // ── STEP 2: Find and validate target member ──
        const targetIndex = members.findIndex((m) => m.id === targetMemberId);
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
            const prevLinked = (prev.linkedUserIds || []).filter((uid) => uid !== callerUid);
            updatedMembers[previouslyLinkedIndex] = Object.assign(Object.assign({}, prev), { accountUid: prev.accountUid === callerUid ? null : prev.accountUid, linkedUserIds: prevLinked, hasAccount: prevLinked.length > 0 || (prev.accountUid && prev.accountUid !== callerUid) });
        }
        // Link target: add callerUid to linkedUserIds, set accountUid if empty
        const targetLinked = [...(target.linkedUserIds || [])];
        if (!targetLinked.includes(callerUid)) {
            targetLinked.push(callerUid);
        }
        updatedMembers[targetIndex] = Object.assign(Object.assign({}, target), { accountUid: target.accountUid || callerUid, linkedUserIds: targetLinked, hasAccount: true });
        // ── STEP 3: Find auto-created duplicate safely ──
        // Match by: id === callerUid AND no accountUid (auto-created by atomicJoinChoir)
        const dupeIndex = updatedMembers.findIndex((m) => m.id === callerUid && !m.accountUid);
        if (dupeIndex >= 0 && dupeIndex !== targetIndex) {
            // Mark as duplicate — do NOT delete
            updatedMembers[dupeIndex] = Object.assign(Object.assign({}, updatedMembers[dupeIndex]), { isDuplicate: true });
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
 * atomicUpdateMember
 * Updates a choir member's details (role, voice, name).
 * Syncs changes to the User document if the member has an account.
 * Admin only.
 */
exports.atomicUpdateMember = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Locked");
    const { choirId, memberId, updates } = data; // updates: { name, voice, role, permissions? }
    // ✅ Claims-based permission check with Firestore fallback
    const callerChoirs = context.auth.token.choirs || {};
    let callerRole = callerChoirs[choirId];
    // Fallback: if claims are empty (e.g. after account restore), check Firestore
    if (!callerRole) {
        const callerDoc = await db.collection("users").doc(context.auth.uid).get();
        if (callerDoc.exists) {
            const callerData = callerDoc.data();
            if (callerData.choirId === choirId) {
                callerRole = callerData.role;
            }
            else {
                const membership = (callerData.memberships || []).find((m) => m.choirId === choirId);
                if (membership)
                    callerRole = membership.role;
            }
        }
    }
    if (!callerRole || !['admin', 'regent', 'head'].includes(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "Unauthorized");
    }
    const result = await db.runTransaction(async (transaction) => {
        const choirRef = db.collection("choirs").doc(choirId);
        const choirDoc = await transaction.get(choirRef);
        if (!choirDoc.exists)
            throw new functions.https.HttpsError("not-found", "Choir not found");
        const choirData = choirDoc.data();
        const members = choirData.members || [];
        const memberIndex = members.findIndex((m) => m.id === memberId);
        if (memberIndex === -1)
            throw new functions.https.HttpsError("not-found", "Member not found");
        const oldMember = members[memberIndex];
        // If updates contains photoURL (from client) use it, otherwise keep old
        // Actually, client might not send it. Let's fetch latest from user doc if possible?
        // For now, assume client sends it OR we just keep old.
        // But better: when admin updates role, they don't change photo.
        // The real fix for photo sync is: when User updates profile, they should trigger a sync to all choirs.
        // BUT here: just ensure we don't lose it if it exists.
        const newMember = Object.assign(Object.assign(Object.assign({}, oldMember), updates), { photoURL: updates.photoURL !== undefined ? updates.photoURL : (oldMember.photoURL || null) }); // Apply updates
        // --- ALL READS FIRST (Firestore requirement) ---
        let targetUserDoc = null;
        const targetUserRef = db.collection("users").doc(memberId);
        if (oldMember.hasAccount || newMember.hasAccount) {
            targetUserDoc = await transaction.get(targetUserRef);
        }
        // --- ALL WRITES AFTER ---
        // Update Choir Doc
        const updatedMembers = [...members];
        updatedMembers[memberIndex] = newMember;
        transaction.update(choirRef, { members: updatedMembers });
        // If member has account, sync to User Doc
        if (targetUserDoc === null || targetUserDoc === void 0 ? void 0 : targetUserDoc.exists) {
            const targetUserData = targetUserDoc.data();
            // Update memberships array
            const memberships = targetUserData.memberships || [];
            const updatedMemberships = memberships.map((m) => {
                if (m.choirId === choirId) {
                    return Object.assign(Object.assign({}, m), { role: newMember.role }); // Sync role
                }
                return m;
            });
            const userUpdates = { memberships: updatedMemberships };
            // Sync active role if this is their active choir
            if (targetUserData.choirId === choirId) {
                userUpdates.role = newMember.role;
                userUpdates.voice = newMember.voice;
                if (updates.permissions) {
                    userUpdates.permissions = updates.permissions;
                }
            }
            if (updates.permissions && targetUserData.choirId !== choirId) {
                if (updates.permissions)
                    userUpdates.permissions = updates.permissions;
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
exports.migrateAllClaims = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Required");
    }
    // Allow superadmin emails or check existing superAdmin claim
    const email = context.auth.token.email || '';
    const isSuperAdmin = context.auth.token.superAdmin === true ||
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
            }
            catch (e) {
                console.error(`Failed to sync claims for ${doc.id}:`, e);
                errors++;
            }
        });
        await Promise.all(promises);
    }
    return { success: true, migrated, errors, total: docs.length };
});
// --- Notification Token Management ---
exports.registerFcmToken = functions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
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
exports.generateUploadUrl = functions.https.onRequest((req, res) => {
    // 1. Handle CORS (options and others)
    cors(req, res, async () => {
        var _a;
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
            }
            catch (e) {
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
                if (parts.length < 3)
                    throw new Error("Invalid key format");
                const choirId = parts[1];
                // Check claims first
                const userRole = (_a = decodedToken.choirs) === null || _a === void 0 ? void 0 : _a[choirId];
                let canUpload = isSuperAdmin || ['admin', 'regent', 'head'].includes(userRole);
                // Fallback to Firestore if claims missing
                if (!canUpload && !userRole) {
                    const userDoc = await db.collection("users").doc(userId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        if (userData.choirId === choirId) {
                            canUpload = ['admin', 'regent', 'head'].includes(userData.role);
                        }
                        else {
                            canUpload = (userData.memberships || []).some((m) => m.choirId === choirId && ['admin', 'regent', 'head'].includes(m.role));
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
            const r2Client = new client_s3_1.S3Client({
                region: "auto",
                endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
                    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
                },
            });
            const command = new client_s3_1.PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: key,
                ContentType: contentType,
                // Optional: Pass ContentLength to constrain the signed URL if supported by S3/R2 implementation
                // ContentLength: size 
            });
            // Generate Presigned URL (valid for 1 hour)
            const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(r2Client, command, { expiresIn: 3600 });
            const publicUrl = `${R2_PUBLIC_URL}/${key}`;
            console.log("[generateUploadUrl] Success", { publicUrl });
            res.status(200).json({ signedUrl, publicUrl });
        }
        catch (error) {
            console.error("R2 Presign Error:", error);
            res.status(500).json({ error: "Failed to generate upload URL" });
        }
    });
});
// --- AUTO-CLEANUP: Delete old notifications (30+ days) ---
// Runs daily at 3:00 AM UTC
exports.cleanupOldNotifications = functions.pubsub
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
            if (oldNotifs.empty)
                continue;
            const batch = db.batch();
            oldNotifs.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            totalDeleted += oldNotifs.size;
            console.log(`[cleanupOldNotifications] Deleted ${oldNotifs.size} from choir ${choirDoc.id}`);
        }
        console.log(`[cleanupOldNotifications] Total deleted: ${totalDeleted}`);
    }
    catch (error) {
        console.error("[cleanupOldNotifications] Error:", error);
    }
});
// --- STATISTICS AGGREGATION ---
var statsAggregator_1 = require("./statsAggregator");
Object.defineProperty(exports, "onServiceWrite", { enumerable: true, get: function () { return statsAggregator_1.onServiceWrite; } });
var backfillStats_1 = require("./backfillStats");
Object.defineProperty(exports, "backfillStats", { enumerable: true, get: function () { return backfillStats_1.backfillStats; } });
// --- TEMPORARY: Fix user data (role + isDuplicate) ---
exports.fixUserData = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const callerUid = context.auth.uid;
    const targetUid = data.targetUid || callerUid;
    const newRole = data.role || 'head';
    // Only allow the target user or an admin to run this
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const callerData = callerDoc.data();
    if (callerUid !== targetUid && (callerData === null || callerData === void 0 ? void 0 : callerData.role) !== 'head') {
        throw new functions.https.HttpsError("permission-denied", "Only the head can fix other users");
    }
    const userRef = db.collection("users").doc(targetUid);
    const userDoc = await db.collection("users").doc(targetUid).get();
    if (!userDoc.exists)
        throw new functions.https.HttpsError("not-found", "User not found");
    const userData = userDoc.data();
    const choirId = userData.choirId;
    if (!choirId)
        throw new functions.https.HttpsError("not-found", "User has no choir");
    // 1. Fix user doc role
    const updates = { role: newRole };
    if (userData.memberships) {
        updates.memberships = userData.memberships.map((m) => {
            if (m.choirId === choirId)
                return Object.assign(Object.assign({}, m), { role: newRole });
            return m;
        });
    }
    await userRef.update(updates);
    // 2. Fix choir member entry: clear isDuplicate, set role
    const choirRef = db.collection("choirs").doc(choirId);
    const choirDoc = await choirRef.get();
    if (!choirDoc.exists)
        throw new functions.https.HttpsError("not-found", "Choir not found");
    const members = choirDoc.data().members || [];
    const memberIndex = members.findIndex((m) => m.id === targetUid || m.accountUid === targetUid || (m.linkedUserIds || []).includes(targetUid));
    let memberInfo = "No member entry found";
    if (memberIndex >= 0) {
        const updatedMembers = [...members];
        const member = Object.assign({}, updatedMembers[memberIndex]);
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
//# sourceMappingURL=index.js.map