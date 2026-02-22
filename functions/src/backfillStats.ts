/**
 * backfillStats.ts — One-time (safe to re-run) backfill for statistics summary docs.
 *
 * Callable function (superAdmin only).
 * Iterates all choirs, reads all services, writes summary.
 *
 * IMPORTANT: Treats ALL existing services as finalized for backfill purposes.
 * This ensures historical data is fully captured in the summary.
 * Going forward, only explicitly finalized services contribute to attendance stats.
 *
 * Safe to re-run: always overwrites with full recalculation.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// ─── TYPES (must match statsAggregator) ──────────────────

interface ServiceData {
    date: string;
    songs: Array<{ songId: string; songTitle?: string }>;
    absentMembers?: string[];
    confirmedMembers?: string[];
    deletedAt?: string | null;
    isFinalized?: boolean;
}

interface AttendanceTrendEntry {
    date: string;
    percentage: number;
    present: number;
    total: number;
}

interface SongEntry {
    title: string;
    songId: string;
    count: number;
}

interface MemberStatEntry {
    presentCount: number;
    absentCount: number;
    servicesWithRecord: number;
    attendanceRate: number;
}

// Same pure calculation as statsAggregator.ts
// For backfill: treats ALL non-deleted services as finalized
function calculateStatsForBackfill(
    services: Array<{ data: ServiceData }>,
    totalMembers: number
) {
    const active = services.filter(s => !s.data.deletedAt);
    // Only count services where attendance was actually saved
    const withAttendance = active.filter(s =>
        (s.data.confirmedMembers || []).length > 0 || (s.data.absentMembers || []).length > 0
    );
    withAttendance.sort((a, b) => a.data.date.localeCompare(b.data.date));

    const totalServices = withAttendance.length;

    // For backfill: only services with saved attendance contribute
    let totalAttendancePercent = 0;
    const attendanceEntries: AttendanceTrendEntry[] = [];

    for (const s of withAttendance) {
        // Strict attendance: Only count those explicitly marked present
        const presentCount = (s.data.confirmedMembers || []).length;

        const percentage = totalMembers > 0
            ? Math.round((presentCount / totalMembers) * 100)
            : 0;

        totalAttendancePercent += percentage;
        attendanceEntries.push({ date: s.data.date, percentage, present: presentCount, total: totalMembers });
    }

    const averageAttendance = totalServices > 0
        ? Math.round(totalAttendancePercent / totalServices)
        : 0;

    const attendanceTrend = attendanceEntries;

    // ── Individual Member Stats (only from services with saved attendance) ──
    const memberStats: Record<string, MemberStatEntry> = {};

    for (const s of withAttendance) {
        const present = s.data.confirmedMembers || [];

        // Those not explicitly marked present are implicitly absent
        for (const pid of present) {
            if (!memberStats[pid]) memberStats[pid] = { presentCount: 0, absentCount: 0, servicesWithRecord: 0, attendanceRate: 100 };
            memberStats[pid].presentCount++;
            memberStats[pid].servicesWithRecord++;
        }

        // To calculate who was absent, we assume totalMembers is tracked elsewhere,
        // but since we don't have the full roster here, we only add "absent" stats
        // for people who explicitly clicked "Absent" or who already exist in the 
        // memberStats array from other services.
        const explicitAbsent = s.data.absentMembers || [];
        for (const aid of explicitAbsent) {
            if (!memberStats[aid]) memberStats[aid] = { presentCount: 0, absentCount: 0, servicesWithRecord: 0, attendanceRate: 100 };
            memberStats[aid].absentCount++;
            memberStats[aid].servicesWithRecord++;
        }
    }

    // Calculate rates
    for (const pid in memberStats) {
        const stats = memberStats[pid];
        stats.attendanceRate = stats.servicesWithRecord > 0
            ? Math.round((stats.presentCount / stats.servicesWithRecord) * 100)
            : 100;
    }

    const songCounts: Record<string, SongEntry> = {};
    for (const s of withAttendance) {
        for (const song of (s.data.songs || [])) {
            const id = song.songId;
            if (!songCounts[id]) {
                songCounts[id] = { title: song.songTitle || id, songId: id, count: 0 };
            }
            songCounts[id].count++;
            if (song.songTitle) songCounts[id].title = song.songTitle;
        }
    }

    const allSongs = Object.values(songCounts).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.songId.localeCompare(b.songId);
    });

    const topSongs = allSongs.slice(0, 20);

    return { totalServices, averageAttendance, attendanceTrend, topSongs, allSongs, memberStats };
}

// ─── CALLABLE FUNCTION ───────────────────────────────────

export const backfillStats = functions.https.onCall(async (_data, context) => {
    // ── SuperAdmin gate ──
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }

    const email = context.auth.token.email || "";
    const isSuperAdmin =
        (context.auth.token as any).superAdmin === true ||
        ["artom.devv@gmail.com", "artemdula0@gmail.com"].includes(email);

    if (!isSuperAdmin) {
        throw new functions.https.HttpsError("permission-denied", "SuperAdmin only");
    }

    console.log("[BackfillStats] Starting backfill...");

    const choirsSnap = await db.collection("choirs").get();
    let processed = 0;
    let errors = 0;
    let servicesMarkedFinalized = 0;

    for (const choirDoc of choirsSnap.docs) {
        try {
            const choirId = choirDoc.id;
            const choirData = choirDoc.data();

            // Determine the true roster count by excluding unlinked app users
            const members = choirData.members || [];
            const realMembers = members.filter((m: any) => {
                if (!m.hasAccount) return true; // Admin-created dummy profile
                if (m.voice && m.voice.trim() !== "") return true; // Assigned a voice
                if (['regent', 'head', 'admin'].includes(m.role)) return true; // Leadership
                return false; // Unlinked app user
            });
            const totalMembers = realMembers.length;

            // Read all services
            const servicesSnap = await db
                .collection(`choirs/${choirId}/services`)
                .get();

            const services = servicesSnap.docs.map(doc => ({
                data: doc.data() as ServiceData,
            }));

            // Mark all existing non-deleted services as finalized
            // (so they contribute to attendance stats going forward)
            const batch = db.batch();
            let batchCount = 0;

            for (const serviceDoc of servicesSnap.docs) {
                const data = serviceDoc.data() as ServiceData;
                if (!data.deletedAt && !data.isFinalized) {
                    batch.update(serviceDoc.ref, { isFinalized: true });
                    batchCount++;
                }
            }

            // Firestore batch limit is 500 — split if needed
            if (batchCount > 0 && batchCount <= 500) {
                await batch.commit();
                servicesMarkedFinalized += batchCount;
            } else if (batchCount > 500) {
                // For very large choirs, mark in chunks
                let chunkBatch = db.batch();
                let chunkCount = 0;
                for (const serviceDoc of servicesSnap.docs) {
                    const data = serviceDoc.data() as ServiceData;
                    if (!data.deletedAt && !data.isFinalized) {
                        chunkBatch.update(serviceDoc.ref, { isFinalized: true });
                        chunkCount++;
                        if (chunkCount >= 500) {
                            await chunkBatch.commit();
                            servicesMarkedFinalized += chunkCount;
                            chunkBatch = db.batch();
                            chunkCount = 0;
                        }
                    }
                }
                if (chunkCount > 0) {
                    await chunkBatch.commit();
                    servicesMarkedFinalized += chunkCount;
                }
            }

            // Calculate stats (for backfill: ALL non-deleted are treated as finalized)
            const stats = calculateStatsForBackfill(services, totalMembers);

            // Write summary
            const statsRef = db.doc(`choirs/${choirId}/stats/summary`);
            await statsRef.set({
                ...stats,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            processed++;
            console.log(
                `[BackfillStats] ✅ ${choirId}: ${stats.totalServices} services, ` +
                `${stats.allSongs.length} unique songs, ${batchCount} marked finalized`
            );
        } catch (e) {
            errors++;
            console.error(`[BackfillStats] ❌ Error processing choir ${choirDoc.id}:`, e);
        }
    }

    console.log(
        `[BackfillStats] Done. Processed: ${processed}, Errors: ${errors}, ` +
        `Services marked finalized: ${servicesMarkedFinalized}`
    );
    return { success: true, processed, errors, total: choirsSnap.size, servicesMarkedFinalized };
});
