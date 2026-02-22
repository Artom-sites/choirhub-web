/**
 * statsAggregator.ts — Production-grade statistics aggregation
 *
 * Architecture:
 *   onDocumentWritten("choirs/{choirId}/services/{serviceId}")
 *   → Field-change guard (ONLY watches: isFinalized, songs, deletedAt)
 *   → Transaction-wrapped full recalculation
 *   → Write to choirs/{choirId}/stats/summary
 *
 * KEY DESIGN DECISION:
 *   Attendance changes (absentMembers, confirmedMembers) do NOT trigger
 *   recalculation. Only explicit finalization does. This eliminates
 *   write storms during voting (40+ users marking attendance).
 *
 * Guarantees:
 *   ✅ Transaction-safe (no race conditions between parallel triggers)
 *   ✅ Idempotent (same services → same summary, deterministic)
 *   ✅ Soft-delete aware (excludes deletedAt != null, restores re-include)
 *   ✅ Finalization-gated (attendance captured only on finalize)
 *   ✅ Trigger-filtered (skips irrelevant field changes)
 *
 * Scaling notes:
 *   Full recalculate reads ALL services inside a transaction.
 *   Firestore transactions have a 10s timeout and ~500 doc soft limit.
 *   For choirs with >1000 services, consider scheduled aggregation.
 *   For ≤500 services this completes in <1s.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const db = admin.firestore();

// ─── TYPES ───────────────────────────────────────────────

interface ServiceSong {
    songId: string;
    songTitle?: string;
}

interface ServiceData {
    date: string;
    songs: ServiceSong[];
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

interface StatsSummary {
    totalServices: number;
    averageAttendance: number;
    attendanceTrend: AttendanceTrendEntry[];
    topSongs: SongEntry[];
    allSongs: SongEntry[];
    memberStats: Record<string, MemberStatEntry>;
    updatedAt: FirebaseFirestore.FieldValue;
}

// ─── FIELD-CHANGE GUARD ──────────────────────────────────

/**
 * Returns true ONLY if the write affects stats-relevant fields.
 *
 * WATCHED fields:
 *   - isFinalized (the primary trigger — captures final attendance)
 *   - deletedAt (soft-delete / restore)
 *   - songs (on finalized services only — historical correction)
 *
 * IGNORED fields (never trigger recalculation):
 *   - absentMembers, confirmedMembers (voting storm protection)
 *   - title, time, warmupConductor (cosmetic)
 */
function isStatsRelevantChange(
    before: ServiceData | undefined,
    after: ServiceData | undefined
): boolean {
    // Document created or hard-deleted
    if (!before || !after) return true;

    // Finalization state changed (PRIMARY trigger)
    if (Boolean(before.isFinalized) !== Boolean(after.isFinalized)) return true;

    // Soft-delete or restore
    if ((before.deletedAt || null) !== (after.deletedAt || null)) return true;

    // Songs changed on a FINALIZED service (historical correction)
    if (after.isFinalized) {
        const beforeSongs = (before.songs || []).map(s => s.songId).sort().join(",");
        const afterSongs = (after.songs || []).map(s => s.songId).sort().join(",");
        if (beforeSongs !== afterSongs) return true;
    }

    // Everything else → SKIP
    return false;
}

// ─── PURE CALCULATION (DETERMINISTIC) ────────────────────

/**
 * Compute stats from a set of services.
 * Pure function: same input → same output. No side effects.
 *
 * Only FINALIZED, non-deleted services contribute to attendance stats.
 * ALL non-deleted services contribute to song frequency (regardless of finalization).
 */
function calculateStats(
    services: Array<{ data: ServiceData }>,
    totalMembers: number
): Omit<StatsSummary, "updatedAt"> {
    // Filter out soft-deleted
    const active = services.filter(s => !s.data.deletedAt);

    // Sort by date ascending (deterministic)
    active.sort((a, b) => a.data.date.localeCompare(b.data.date));

    const totalServices = active.length;

    // ── Attendance (only from FINALIZED services) ──
    const finalized = active.filter(s => s.data.isFinalized);

    let totalAttendancePercent = 0;
    const attendanceEntries: AttendanceTrendEntry[] = [];

    for (const s of finalized) {
        const absentCount = (s.data.absentMembers || []).length;
        const present = Math.max(0, totalMembers - absentCount);
        const percentage = totalMembers > 0
            ? Math.round((present / totalMembers) * 100)
            : 0;

        totalAttendancePercent += percentage;

        attendanceEntries.push({
            date: s.data.date,
            percentage,
            present,
            total: totalMembers,
        });
    }

    const averageAttendance = finalized.length > 0
        ? Math.round(totalAttendancePercent / finalized.length)
        : 0;

    // Last 10 finalized for trend chart
    const attendanceTrend = attendanceEntries.slice(-10);

    // ── Individual Member Stats (only from FINALIZED services) ──
    const memberStats: Record<string, MemberStatEntry> = {};

    for (const s of finalized) {
        const present = s.data.confirmedMembers || [];
        const absent = s.data.absentMembers || [];

        for (const pid of present) {
            if (!memberStats[pid]) memberStats[pid] = { presentCount: 0, absentCount: 0, servicesWithRecord: 0, attendanceRate: 100 };
            memberStats[pid].presentCount++;
            memberStats[pid].servicesWithRecord++;
        }

        for (const aid of absent) {
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

    // ── Song frequency (ALL non-deleted services) ──
    const songCounts: Record<string, { title: string; songId: string; count: number }> = {};

    for (const s of active) {
        for (const song of (s.data.songs || [])) {
            const id = song.songId;
            if (!songCounts[id]) {
                songCounts[id] = {
                    title: song.songTitle || id,
                    songId: id,
                    count: 0,
                };
            }
            songCounts[id].count++;
            // Keep the latest title (in case song was renamed)
            if (song.songTitle) {
                songCounts[id].title = song.songTitle;
            }
        }
    }

    // Sort deterministically: count DESC, songId ASC (tiebreaker)
    const allSongs = Object.values(songCounts).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.songId.localeCompare(b.songId);
    });

    const topSongs = allSongs.slice(0, 20);

    return {
        totalServices,
        averageAttendance,
        attendanceTrend,
        topSongs,
        allSongs,
        memberStats,
    };
}

// ─── CLOUD FUNCTION TRIGGER ──────────────────────────────

export const onServiceWrite = onDocumentWritten(
    "choirs/{choirId}/services/{serviceId}",
    async (event) => {
        const choirId = event.params.choirId;

        // ── 1. Extract before/after data ──
        const beforeData = event.data?.before?.data() as ServiceData | undefined;
        const afterData = event.data?.after?.data() as ServiceData | undefined;

        // ── 2. Field-change guard ──
        if (!isStatsRelevantChange(beforeData, afterData)) {
            return; // Silent skip — no log spam during voting storms
        }

        console.log(`[StatsAggregator] Recalculating stats for choir ${choirId}`);

        // ── 3. Transaction-wrapped full recalculation ──
        const statsRef = db.doc(`choirs/${choirId}/stats/summary`);

        await db.runTransaction(async (tx) => {
            // Read choir doc for current member count
            const choirDoc = await tx.get(db.doc(`choirs/${choirId}`));
            if (!choirDoc.exists) {
                console.warn(`[StatsAggregator] Choir ${choirId} not found, skipping`);
                return;
            }
            const choirData = choirDoc.data()!;
            const totalMembers = (choirData.members || []).length;

            // Read ALL services (inside transaction for consistency)
            const servicesSnap = await tx.get(
                db.collection(`choirs/${choirId}/services`)
            );

            // ── 4. Performance guard ──
            if (servicesSnap.size > 1000) {
                console.warn(
                    `[StatsAggregator] ⚠️ Choir ${choirId} has ${servicesSnap.size} services. ` +
                    `Transaction may be slow. Consider migrating to scheduled aggregation.`
                );
            }

            // ── 5. Calculate (pure, deterministic) ──
            const services = servicesSnap.docs.map(doc => ({
                data: doc.data() as ServiceData,
            }));

            const stats = calculateStats(services, totalMembers);

            // ── 6. Write summary (idempotent) ──
            const summary: StatsSummary = {
                ...stats,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            tx.set(statsRef, summary);
        });

        console.log(`[StatsAggregator] ✅ Stats updated for choir ${choirId}`);
    }
);
