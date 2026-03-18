import { Capacitor } from '@capacitor/core';
import { Choir, Service } from '@/types';
import { getAuthLazy } from '@/lib/firebase';

let syncTimeout: NodeJS.Timeout | null = null;
let widgetSyncLockRef = false;

let memTotalMembers = 0;
let memChoirName = 'MyChoir';
let memChoirId = '';
let lastPayloadString = '';

// Map serviceId → choirId from the last pushed widget payload, so vote sync
// can route votes to the correct choir even after a profile-driven choir switch.
export let lastPayloadServiceMap: Record<string, string> = {};

let syncSuspendedUntil = 0;

export let currentVotedServiceId: string | null = null;
let currentVotedAction: 'confirmed' | 'absent' | null = null;
export const trackVotedService = (serviceId: string, action: 'confirmed' | 'absent') => {
    currentVotedServiceId = serviceId;
    currentVotedAction = action;
    console.log(`[WidgetSync:Trace] Now tracking voted service: ${serviceId}, action: ${action}`);
};

export const suspendWidgetSync = (durationMs = 5000) => {
    syncSuspendedUntil = Date.now() + durationMs;
    console.log(`[WidgetSync] Sync suspended for ${durationMs}ms to allow Firestore propagation`);
};

export const resumeWidgetSync = () => {
    syncSuspendedUntil = 0;
    console.log(`[WidgetSync] Sync resumed immediately (fresh data available)`);
};

export const syncWidgetNearestService = (allServices: Service[], choir?: Choir | null) => {
    if (!Capacitor.isNativePlatform()) return;

    if (Date.now() < syncSuspendedUntil) {
        console.log('[WidgetSync] Update ignored (sync is currently suspended during vote processing)');
        return;
    }

    // Update in-memory choir data if provided
    if (choir) {
        if (choir.id) memChoirId = choir.id;
        if (choir.name) memChoirName = choir.name;
        if (choir.members) memTotalMembers = choir.members.filter((m: any) => m.role !== 'inactive').length;
    }

    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }

    syncTimeout = setTimeout(async () => {
        if (widgetSyncLockRef) return;
        widgetSyncLockRef = true;

        try {
            const { default: WidgetData } = await import('@/plugins/WidgetDataPlugin');
            const auth = getAuthLazy();
            const userId = auth.currentUser?.uid || '';

            console.log('[WidgetSync] Updating nearest service widget (Payload Driven)');

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;

            const upcoming = allServices
                .filter(s => !s.deletedAt && s.date >= todayStr)
                .sort((a, b) => a.date.localeCompare(b.date));

            if (upcoming.length === 0) {
                await WidgetData.clearData();
                widgetSyncLockRef = false;
                return;
            }

            // Build payloads for up to 2 upcoming services
            let topTwo = upcoming.slice(0, 2);
            const originalTopTwoIds = topTwo.map(s => s.id);
            let injectedId: string | null = null;

            // Strategy 2: Guarantee inclusion of recently voted service
            if (currentVotedServiceId) {
                const isAlreadyInTopTwo = topTwo.some(s => s.id === currentVotedServiceId);
                if (!isAlreadyInTopTwo) {
                    const votedService = upcoming.find(s => s.id === currentVotedServiceId);
                    if (votedService) {
                        if (topTwo.length < 2) {
                            topTwo.push(votedService);
                        } else {
                            topTwo[1] = votedService; // Replace 2nd item
                        }
                        injectedId = votedService.id;
                    } else {
                        console.log(`[WidgetSync:Trace] WARNING! Voted service ${currentVotedServiceId} not found in the merged upcoming array.`);
                    }
                }
            }

            console.log(`[WidgetSync:Trace] Payload Selection Selection Summary:`, {
                originalTopTwoIds,
                injectedId,
                finalTopTwoIds: topTwo.map(s => s.id)
            });

            const buildPayload = async (svc: Service) => {
                const confirmed = svc.confirmedMembers || [];
                const absent = svc.absentMembers || [];

                let voteStatus: 'confirmed' | 'absent' | 'pending' = 'pending';
                if (userId) {
                    if (confirmed.includes(userId)) voteStatus = 'confirmed';
                    else if (absent.includes(userId)) voteStatus = 'absent';
                }

                // Override with tracked vote action if stale sibling fetch missed the write
                if (currentVotedServiceId === svc.id && currentVotedAction && voteStatus === 'pending') {
                    console.log(`[WidgetSync:Trace] Overriding stale voteStatus 'pending' → '${currentVotedAction}' for tracked service ${svc.id}`);
                    voteStatus = currentVotedAction;
                }

                const songTitles = svc.program
                    ? svc.program.map((p: any) => p.title || p.songTitle || 'Невідома пісня')
                    : (svc.songs || []).map((s: any) => s.songTitle || 'Невідома пісня');

                // Try to get total members for the service's choir
                let serviceChoirMembers = memTotalMembers;
                let serviceChoirName = memChoirName;
                // We no longer perform ad-hoc network requests here.
                // The canonical choirName is already firmly injected onto the service 
                // by syncWidgetAllChoirs using the user's active memberships.
                const sChoirId = (svc as any).choirId || memChoirId;

                const payload = {
                    title: svc.title,
                    date: svc.date,
                    time: svc.time || '',
                    type: svc.type || 'service',
                    serviceId: svc.id,
                    choirId: sChoirId,
                    choirName: (svc as any).choirName || serviceChoirName,
                    voteStatus,
                    confirmedCount: confirmed.length,
                    pendingCount: Math.max(0, serviceChoirMembers - confirmed.length - absent.length),
                    absentCount: absent.length,
                    totalMembers: serviceChoirMembers,
                    songs: songTitles,
                    userId,
                };

                if (currentVotedServiceId === svc.id) {
                    console.log(`[WidgetSync:Trace] Payload built for voted service ${svc.id}:`, {
                        serviceId: svc.id,
                        choirId: sChoirId,
                        choirName: payload.choirName,
                        currentUserVoteStatusJS: voteStatus,
                        currentUserInConfirmed: confirmed.includes(userId),
                        currentUserInAbsent: absent.includes(userId),
                        confirmedCount: confirmed.length,
                        absentCount: absent.length
                    });
                }

                return payload;
            };

            const payloads = await Promise.all(topTwo.map(buildPayload));
            const payloadObj = payloads[0];

            // Update service→choir routing map for vote sync
            lastPayloadServiceMap = {};
            payloads.forEach((p: any) => { lastPayloadServiceMap[p.serviceId] = p.choirId; });

            const payloadStr = JSON.stringify(payloads);
            if (payloadStr === lastPayloadString) {
                widgetSyncLockRef = false;
                return;
            }

            lastPayloadString = payloadStr;

            // Send primary service for backwards-compatible single-service widgets
            await WidgetData.updateServiceData(payloadObj);

            // Send array of up to 2 services for adaptive large widgets
            try {
                if (currentVotedServiceId) {
                    const votedPayload = payloads.find((p: any) => p.serviceId === currentVotedServiceId);
                    if (votedPayload) {
                        console.log(`[WidgetSync:Trace] BEFORE updateMultipleServices: Voted service exists in outgoing payload. Serialized payload entry:`, JSON.stringify(votedPayload));
                    } else {
                        console.log(`[WidgetSync:Trace] BEFORE updateMultipleServices: WARNING! Voted service ${currentVotedServiceId} is MISSING from the final outgoing top-two payload!`);
                    }
                }
                
                await WidgetData.updateMultipleServices({ servicesJson: JSON.stringify(payloads) });
            } catch (e) {
                console.log('[WidgetSync] updateMultipleServices not available, skipping');
            }

            console.log('[WidgetSync] Successfully synchronized nearest service to WidgetKit (0 Network, 0 Disk)');
        } catch (e) {
            console.log('[WidgetSync] Sync failed:', e);
        } finally {
            widgetSyncLockRef = false;
        }
    }, 1500); // 1.5s debounce
};

/**
 * Fetch upcoming services from ALL choirs the user belongs to,
 * merge with current choir's services, sort by date, and sync to widget.
 */
export const syncWidgetAllChoirs = async (
    currentChoirServices: Service[],
    currentChoir: Choir | null,
    memberships: { choirId: string; choirName: string; role: string }[],
    currentChoirIdOverride?: string
) => {
    if (!Capacitor.isNativePlatform()) return;

    const currentChoirId = currentChoirIdOverride || currentChoir?.id || '';
    
    // Derive the canonical name exclusively from memberships to avoid stale React state
    const currentMembership = memberships.find(m => m.choirId === currentChoirId);
    const canonicalChoirName = currentMembership?.choirName || currentChoir?.name || memChoirName;

    console.log('[WidgetSync:AllChoirs] Called with:', {
        currentChoirId,
        canonicalChoirName,
        currentServicesCount: currentChoirServices.length,
        memberships: memberships.map(m => ({ choirId: m.choirId, choirName: m.choirName })),
    });

    // Annotate current choir services with strictly canonical data
    const annotated: Service[] = currentChoirServices.map(s => ({
        ...s,
        choirId: currentChoirId,
        choirName: canonicalChoirName,
    } as any));

    // Fetch upcoming services from other choirs
    const otherChoirs = (memberships || []).filter(m => m.choirId && m.choirId !== currentChoirId);

    if (otherChoirs.length === 0) {
        console.log('[WidgetSync:AllChoirs] No other choirs found, syncing current only');
        // No other choirs — just sync current
        syncWidgetNearestService(annotated, currentChoir);
        return;
    }

    console.log('[WidgetSync:AllChoirs] Fetching from', otherChoirs.length, 'other choirs:', otherChoirs.map(c => c.choirName));

    try {
        const { collection, query, where, orderBy, getDocs, limit } = await import('firebase/firestore');
        const { getFirestoreLazy } = await import('@/lib/firebase');
        const db = getFirestoreLazy();

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const fetches = otherChoirs.map(async (m) => {
            try {
                const q = query(
                    collection(db, `choirs/${m.choirId}/services`),
                    where('date', '>=', todayStr),
                    orderBy('date', 'asc'),
                    limit(15) // Buffered up from 3 to prevent soft-delete clipping
                );
                const snap = await getDocs(q);
                
                const rawDocs = snap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    choirId: m.choirId,
                    choirName: m.choirName,
                } as any as Service));
                
                const filteredDocs = rawDocs.filter((s: any) => !s.deletedAt);
                
                console.log(`[WidgetSync:Trace] Sibling choir '${m.choirName}' fetch:`, {
                    rawFetched: rawDocs.length,
                    deletedFiltered: rawDocs.length - filteredDocs.length,
                    finalUsable: filteredDocs.length
                });

                return filteredDocs;
            } catch (e) {
                console.log(`[WidgetSync] Failed to fetch services for choir ${m.choirName}:`, e);
                return [];
            }
        });

        const otherResults = await Promise.all(fetches);
        const allServices = [...annotated, ...otherResults.flat()];

        console.log('[WidgetSync:AllChoirs] Merge result:', {
            annotatedCount: annotated.length,
            otherResultsCounts: otherResults.map((r, i) => ({ choir: otherChoirs[i]?.choirName, services: r.length })),
            totalMerged: allServices.length,
            mergedDates: allServices.map(s => ({ date: (s as any).date, choir: (s as any).choirName })),
        });

        syncWidgetNearestService(allServices, currentChoir);
    } catch (e) {
        console.log('[WidgetSync] syncWidgetAllChoirs error, falling back to current choir:', e);
        syncWidgetNearestService(annotated, currentChoir);
    }
};
