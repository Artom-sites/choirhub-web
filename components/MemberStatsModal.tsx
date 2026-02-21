"use client";

import { X, Calendar, TrendingDown, Check, AlertCircle, Loader2 } from "lucide-react";
import { ChoirMember, Service } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { getAttendanceStats, getCachedServiceCount, updateAttendanceCache } from "@/lib/attendanceCache";
import { getServices } from "@/lib/db";

interface Props {
    member: ChoirMember;
    services: Service[];       // still passed for live cache update
    choirId: string;
    onClose: () => void;
}

type Period = 'month' | 'quarter' | 'year' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
    month: 'Місяць',
    quarter: 'Квартал',
    year: 'Рік',
    all: 'Все',
};

function getPeriodStart(period: Period): Date | undefined {
    const now = new Date();
    switch (period) {
        case 'month':
            return new Date(now.getFullYear(), now.getMonth(), 1);
        case 'quarter':
            return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        case 'year':
            return new Date(now.getFullYear(), 0, 1);
        case 'all':
            return undefined;
    }
}

// Key to track if we've already done the full fetch for this choir
const BOOTSTRAP_KEY = (choirId: string) => `attendance_bootstrapped_v1_${choirId}`;

export default function MemberStatsModal({ member, services, choirId, onClose }: Props) {
    const [period, setPeriod] = useState<Period>('all');
    const [isBootstrapping, setIsBootstrapping] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Ensure current services are in cache (live merge)
    useMemo(() => {
        if (choirId && services.length) {
            updateAttendanceCache(choirId, services);
        }
    }, [choirId, services]);

    // One-time full history load — only runs once per choir, then flag is saved in localStorage
    useEffect(() => {
        if (!choirId) return;

        const alreadyBootstrapped = localStorage.getItem(BOOTSTRAP_KEY(choirId));
        if (alreadyBootstrapped) return;

        const bootstrap = async () => {
            setIsBootstrapping(true);
            try {
                const allServices = await getServices(choirId);
                updateAttendanceCache(choirId, allServices);
                localStorage.setItem(BOOTSTRAP_KEY(choirId), new Date().toISOString());
                setRefreshTrigger(t => t + 1); // trigger re-read of stats
                console.log(`[MemberStatsModal] Bootstrapped ${allServices.length} services into attendance cache`);
            } catch (e) {
                console.error("[MemberStatsModal] Bootstrap failed:", e);
            } finally {
                setIsBootstrapping(false);
            }
        };

        bootstrap();
    }, [choirId]);

    // Read stats from persistent cache
    const stats = useMemo(() => {
        const periodStart = getPeriodStart(period);
        return getAttendanceStats(choirId, member.id, periodStart);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [choirId, member.id, period, services, refreshTrigger]);

    const cachedTotal = useMemo(() => getCachedServiceCount(choirId), [choirId, services, refreshTrigger]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'short',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    };

    return (
        <div
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-surface w-full max-w-sm rounded-3xl border border-border p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[80vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-surface-highlight flex items-center justify-center text-text-primary font-bold text-lg">
                            {member.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-text-primary">{member.name}</h3>
                            <p className="text-sm text-text-secondary">
                                {member.voice || 'Без голосу'} • {member.role === 'regent' ? 'Регент' : member.role === 'head' ? 'Керівник' : 'Хорист'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-surface-highlight rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                {/* Period Filter Tabs */}
                <div className="flex gap-1 p-1 bg-surface-highlight rounded-xl mb-4">
                    {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${period === p
                                    ? 'bg-surface text-text-primary shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            {PERIOD_LABELS[p]}
                        </button>
                    ))}
                </div>

                {/* Loading indicator for bootstrap */}
                {isBootstrapping && (
                    <div className="flex items-center gap-2 text-xs text-text-secondary mb-3 px-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Завантаження повної історії...</span>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                    <div className="p-3 bg-surface-highlight rounded-2xl text-center">
                        <div className="text-2xl font-bold text-primary mb-1">{stats.attendanceRate}%</div>
                        <div className="text-[10px] text-text-secondary uppercase tracking-wider">Явка</div>
                    </div>
                    <div className="p-3 bg-surface-highlight rounded-2xl text-center">
                        <div className="text-2xl font-bold text-green-400 mb-1">{stats.presentCount}</div>
                        <div className="text-[10px] text-text-secondary uppercase tracking-wider">Присутній</div>
                    </div>
                    <div className="p-3 bg-surface-highlight rounded-2xl text-center">
                        <div className="text-2xl font-bold text-orange-400 mb-1">{stats.absentCount}</div>
                        <div className="text-[10px] text-text-secondary uppercase tracking-wider">Пропусків</div>
                    </div>
                </div>

                {/* Absences List */}
                <div className="flex-1 overflow-y-auto">
                    <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        Історія пропусків
                    </h4>

                    {stats.absences.length === 0 ? (
                        <div className="text-center py-8 text-text-secondary">
                            <Check className="w-12 h-12 mx-auto mb-3 text-primary opacity-50" />
                            <p className="font-medium">Чудова відвідуваність!</p>
                            <p className="text-sm mt-1 opacity-70">Немає жодних пропусків</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {stats.absences.map(absence => (
                                <div
                                    key={absence.serviceId}
                                    className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                                        <AlertCircle className="w-4 h-4 text-orange-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-text-primary font-medium truncate">{absence.title}</p>
                                        <p className="text-xs text-text-secondary flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(absence.date)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer info */}
                <div className="mt-4 pt-4 border-t border-border text-center text-xs text-text-secondary">
                    {stats.servicesWithRecord > 0
                        ? `${stats.servicesWithRecord} з ${stats.totalServices} служінь з відміткою`
                        : 'Немає даних за обраний період'
                    }
                </div>
            </div>
        </div>
    );
}
