"use client";

import { X, Calendar, TrendingDown, Check, AlertCircle } from "lucide-react";
import { ChoirMember, Service } from "@/types";
import { useMemo } from "react";

interface Props {
    member: ChoirMember;
    services: Service[];
    onClose: () => void;
}

export default function MemberStatsModal({ member, services, onClose }: Props) {
    // Calculate stats
    const stats = useMemo(() => {
        const sortedServices = [...services]
            .filter(s => !s.deletedAt)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const absences = sortedServices.filter(s => s.absentMembers?.includes(member.id));
        const confirmations = sortedServices.filter(s => s.confirmedMembers?.includes(member.id));

        // Calculate attendance rate
        const totalWithRecord = absences.length + confirmations.length;
        const attendanceRate = totalWithRecord > 0
            ? Math.round((confirmations.length / totalWithRecord) * 100)
            : 100;

        return {
            totalServices: sortedServices.length,
            absences,
            confirmations,
            attendanceRate,
            totalWithRecord
        };
    }, [member.id, services]);

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
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-4 bg-surface-highlight rounded-2xl text-center">
                        <div className="text-3xl font-bold text-primary mb-1">{stats.attendanceRate}%</div>
                        <div className="text-xs text-text-secondary uppercase tracking-wider">Відвідуваність</div>
                    </div>
                    <div className="p-4 bg-surface-highlight rounded-2xl text-center">
                        <div className="text-3xl font-bold text-orange-400 mb-1">{stats.absences.length}</div>
                        <div className="text-xs text-text-secondary uppercase tracking-wider">Пропусків</div>
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
                            {stats.absences.map(service => (
                                <div
                                    key={service.id}
                                    className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                                        <AlertCircle className="w-4 h-4 text-orange-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-text-primary font-medium truncate">{service.title}</p>
                                        <p className="text-xs text-text-secondary flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(service.date)}
                                            {service.time && ` • ${service.time}`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer info */}
                <div className="mt-4 pt-4 border-t border-border text-center text-xs text-text-secondary">
                    {stats.totalWithRecord > 0
                        ? `Статистика за ${stats.totalWithRecord} ${stats.totalWithRecord === 1 ? 'служіння' : stats.totalWithRecord < 5 ? 'служіння' : 'служінь'}`
                        : 'Статистика ще не доступна'
                    }
                </div>
            </div>
        </div>
    );
}
