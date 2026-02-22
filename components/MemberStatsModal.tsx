"use client";

import { X, Calendar, TrendingDown, Check, AlertCircle, Loader2 } from "lucide-react";
import { ChoirMember, Service, StatsSummary } from "@/types";
import { useEffect, useState } from "react";
import { getMemberAbsences } from "@/lib/db";

interface Props {
    member: ChoirMember;
    services: Service[];       // Legacy, kept for compatibility if needed elsewhere
    choirId: string;
    onClose: () => void;
    globalStats?: StatsSummary | null;
}

export default function MemberStatsModal({ member, choirId, onClose, globalStats }: Props) {
    const [absences, setAbsences] = useState<Service[]>([]);
    const [loadingAbsences, setLoadingAbsences] = useState(true);

    useEffect(() => {
        if (!choirId || !member.id) return;
        setLoadingAbsences(true);
        // Fetch only 20 most recent missed services optimally
        getMemberAbsences(choirId, member.id).then(data => {
            setAbsences(data);
            setLoadingAbsences(false);
        });
    }, [choirId, member.id]);

    // O(1) lookup from the new backend-generated summary document
    const stats = globalStats?.memberStats?.[member.id] || {
        attendanceRate: 100,
        presentCount: 0,
        absentCount: 0,
        servicesWithRecord: 0
    };

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
                <div className="flex items-center justify-between mb-6">
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

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                    <div className="p-3 bg-surface-highlight rounded-2xl text-center">
                        <div className="text-2xl font-bold text-primary mb-1">{stats.attendanceRate}%</div>
                        <div className="text-[10px] text-text-secondary uppercase tracking-wider">Явка за весь час</div>
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
                        Останні пропуски
                    </h4>

                    {loadingAbsences ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                    ) : absences.length > 0 ? (
                        <div className="space-y-2">
                            {absences.map(absence => (
                                <div
                                    key={absence.id}
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
                    ) : stats.absentCount === 0 ? (
                        <div className="text-center py-8 text-text-secondary">
                            <Check className="w-12 h-12 mx-auto mb-3 text-primary opacity-50" />
                            <p className="font-medium">Чудова відвідуваність!</p>
                            <p className="text-sm mt-1 opacity-70">Немає жодних пропусків</p>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-text-secondary">
                            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-orange-400 opacity-50" />
                            <p className="font-medium">{stats.absentCount} пропусків зафіксовано</p>
                            <p className="text-sm mt-1 opacity-70">Деталі завантажуються...</p>
                        </div>
                    )}
                </div>

                {/* Footer info */}
                <div className="mt-4 pt-4 border-t border-border text-center text-xs text-text-secondary">
                    {stats.servicesWithRecord > 0
                        ? `${stats.servicesWithRecord} з ${globalStats?.totalServices || 0} служінь з відміткою`
                        : 'Немає даних за обраний період'
                    }
                </div>
            </div>
        </div>
    );
}
