"use client";

import { Service } from "@/types";

// ── Types ──────────────────────────────────────────────

interface ServiceAttendanceRecord {
    date: string;
    title: string;
    confirmed: string[];  // member IDs who were present
    absent: string[];     // member IDs who were absent
}

interface AttendanceCache {
    version: 1;
    updatedAt: string;
    services: Record<string, ServiceAttendanceRecord>;
}

export interface MemberAttendanceStats {
    totalServices: number;       // total services in the cache for this period
    servicesWithRecord: number;  // services where this member has a record
    presentCount: number;
    absentCount: number;
    attendanceRate: number;      // percentage (0-100)
    absences: { serviceId: string; date: string; title: string }[];
}

// ── Cache Key ──────────────────────────────────────────

function getCacheKey(choirId: string): string {
    return `attendance_cache_v1_${choirId}`;
}

// ── Read / Write ───────────────────────────────────────

function readCache(choirId: string): AttendanceCache {
    try {
        const raw = localStorage.getItem(getCacheKey(choirId));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.version === 1) return parsed;
        }
    } catch (e) {
        console.warn("[AttendanceCache] Failed to read cache:", e);
    }
    return { version: 1, updatedAt: new Date().toISOString(), services: {} };
}

function writeCache(choirId: string, cache: AttendanceCache): void {
    try {
        cache.updatedAt = new Date().toISOString();
        localStorage.setItem(getCacheKey(choirId), JSON.stringify(cache));
    } catch (e) {
        console.warn("[AttendanceCache] Failed to write cache:", e);
    }
}

// ── Public API ─────────────────────────────────────────

/**
 * Merge attendance data from services into the cache.
 * Only updates services that have attendance records (confirmed or absent members).
 * Safe to call frequently — skips services without attendance data.
 */
export function updateAttendanceCache(choirId: string, services: Service[]): void {
    if (!choirId || !services.length) return;

    const cache = readCache(choirId);
    let updated = false;

    for (const s of services) {
        if (s.deletedAt) continue;

        const hasAttendance =
            (s.confirmedMembers && s.confirmedMembers.length > 0) ||
            (s.absentMembers && s.absentMembers.length > 0);

        if (!hasAttendance) continue;

        // Always overwrite — attendance may have been edited
        cache.services[s.id] = {
            date: s.date,
            title: s.title,
            confirmed: s.confirmedMembers || [],
            absent: s.absentMembers || [],
        };
        updated = true;
    }

    if (updated) {
        writeCache(choirId, cache);
        console.log(`[AttendanceCache] Updated. Total services: ${Object.keys(cache.services).length}`);
    }
}

/**
 * Get attendance stats for a specific member from the cache.
 * Optionally filter by time period.
 */
export function getAttendanceStats(
    choirId: string,
    memberId: string,
    periodStart?: Date
): MemberAttendanceStats {
    const cache = readCache(choirId);
    const entries = Object.entries(cache.services);

    // Filter by period
    const filtered = periodStart
        ? entries.filter(([, r]) => {
            const [y, m, d] = r.date.split('-').map(Number);
            return new Date(y, m - 1, d) >= periodStart;
        })
        : entries;

    let presentCount = 0;
    let absentCount = 0;
    const absences: MemberAttendanceStats["absences"] = [];

    for (const [serviceId, record] of filtered) {
        if (record.confirmed.includes(memberId)) {
            presentCount++;
        } else if (record.absent.includes(memberId)) {
            absentCount++;
            absences.push({
                serviceId,
                date: record.date,
                title: record.title,
            });
        }
    }

    // Sort absences by date descending
    absences.sort((a, b) => {
        const [ya, ma, da] = a.date.split('-').map(Number);
        const [yb, mb, db] = b.date.split('-').map(Number);
        return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
    });

    const servicesWithRecord = presentCount + absentCount;
    const attendanceRate = servicesWithRecord > 0
        ? Math.round((presentCount / servicesWithRecord) * 100)
        : 100;

    return {
        totalServices: filtered.length,
        servicesWithRecord,
        presentCount,
        absentCount,
        attendanceRate,
        absences,
    };
}

/**
 * Get total number of cached services for a choir.
 */
export function getCachedServiceCount(choirId: string): number {
    const cache = readCache(choirId);
    return Object.keys(cache.services).length;
}
