"use client";

import { X, Calendar, Check, AlertCircle, Loader2 } from "lucide-react";
import { ChoirMember, Service, StatsSummary } from "@/types";
import { useEffect, useState, useMemo } from "react";
import { getMemberAbsences } from "@/lib/db";

type Period = '30' | '90' | 'all';

const voiceLabels: Record<string, string> = {
    Soprano: 'Сопрано', Alto: 'Альт', Tenor: 'Тенор', Bass: 'Бас',
};

const voiceColors: Record<string, { bg: string; text: string }> = {
    Soprano: { bg: 'bg-pink-500/15', text: 'text-pink-400' },
    Alto: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
    Tenor: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
    Bass: { bg: 'bg-green-500/15', text: 'text-green-400' },
};

interface Props {
    member: ChoirMember;
    services: Service[];
    choirId: string;
    onClose: () => void;
    globalStats?: StatsSummary | null;
}

export default function MemberStatsModal({ member, choirId, onClose, globalStats }: Props) {
    const [absences, setAbsences] = useState<Service[]>([]);
    const [loadingAbsences, setLoadingAbsences] = useState(true);
    const [period, setPeriod] = useState<Period>('all');

    useEffect(() => {
        if (!choirId || !member.id) return;
        setLoadingAbsences(true);
        getMemberAbsences(choirId, member.id).then(data => {
            setAbsences(data);
            setLoadingAbsences(false);
        }).catch(() => {
            setLoadingAbsences(false);
        });
    }, [choirId, member.id]);

    const stats = globalStats?.memberStats?.[member.id] || {
        attendanceRate: 100, presentCount: 0, absentCount: 0, servicesWithRecord: 0
    };

    const filteredAbsences = useMemo(() => {
        if (period === 'all') return absences;
        const days = parseInt(period);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        return absences.filter(a => a.date >= cutoffStr);
    }, [absences, period]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'short',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    };

    const periodLabels: Record<Period, string> = { '30': '30 дн', '90': '90 дн', 'all': 'Весь час' };
    const vc = voiceColors[member.voice || ''];
    const attendanceColor = stats.attendanceRate >= 80 ? '#4ade80' : stats.attendanceRate >= 50 ? '#fbbf24' : '#f87171';

    return (
        <div
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-surface w-full max-w-sm rounded-t-3xl sm:rounded-3xl border border-border border-b-0 sm:border-b p-5 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[85vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${vc ? `${vc.bg} ${vc.text}` : 'bg-surface-highlight text-text-primary'
                            }`}>
                            {member.photoURL ? (
                                <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover rounded-full" />
                            ) : (
                                member.voice ? member.voice[0] : (member.name?.[0]?.toUpperCase() || '?')
                            )}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-text-primary">{member.name}</h3>
                            <p className="text-xs text-text-secondary">
                                {voiceLabels[member.voice || ''] || 'Без голосу'} • {member.role === 'regent' ? 'Регент' : member.role === 'head' ? 'Керівник' : 'Хорист'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-highlight rounded-full transition-colors -mr-1">
                        <X className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                {/* Attendance Ring + Stats */}
                <div className="flex items-center gap-4 mb-4 p-3 bg-surface-highlight/50 rounded-2xl">
                    {/* Ring */}
                    <div className="relative w-16 h-16 flex-shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface-highlight)" strokeWidth="3" />
                            <circle
                                cx="18" cy="18" r="15" fill="none"
                                stroke={attendanceColor}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={`${stats.attendanceRate * 0.942} 100`}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-text-primary">{stats.attendanceRate}%</span>
                        </div>
                    </div>
                    {/* Numbers */}
                    <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1">
                        <div>
                            <span className="text-lg font-bold text-green-400">{stats.presentCount}</span>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider">Присутній</p>
                        </div>
                        <div>
                            <span className="text-lg font-bold text-orange-400">{stats.absentCount}</span>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider">Пропусків</p>
                        </div>
                        <div className="col-span-2">
                            <span className="text-[11px] text-text-secondary">
                                {stats.servicesWithRecord > 0
                                    ? `${stats.servicesWithRecord} з ${globalStats?.totalServices || 0} служінь`
                                    : 'Немає даних'
                                }
                            </span>
                        </div>
                    </div>
                </div>

                {/* Period Filter */}
                <div className="flex gap-1 p-0.5 bg-surface-highlight rounded-lg mb-3">
                    {(['30', '90', 'all'] as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${period === p
                                ? 'bg-primary text-background shadow-sm'
                                : 'text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            {periodLabels[p]}
                        </button>
                    ))}
                </div>

                {/* Absences List */}
                <div className="flex-1 overflow-y-auto -mx-1 px-1">
                    {loadingAbsences ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        </div>
                    ) : filteredAbsences.length > 0 ? (
                        <div className="space-y-1">
                            {filteredAbsences.map(absence => (
                                <div
                                    key={absence.id}
                                    className="flex items-center gap-3 py-2 px-2.5 rounded-xl hover:bg-surface-highlight/50 transition-colors"
                                >
                                    <div className="w-1 h-8 bg-orange-400/40 rounded-full flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] text-text-primary font-medium truncate">{absence.title}</p>
                                        <p className="text-[11px] text-text-secondary flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(absence.date)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : stats.absentCount === 0 ? (
                        <div className="text-center py-6 text-text-secondary">
                            <Check className="w-10 h-10 mx-auto mb-2 text-green-400/50" />
                            <p className="text-sm font-medium">Чудова відвідуваність!</p>
                            <p className="text-xs mt-0.5 opacity-60">Немає жодних пропусків</p>
                        </div>
                    ) : absences.length > 0 && filteredAbsences.length === 0 ? (
                        <div className="text-center py-6 text-text-secondary">
                            <Check className="w-10 h-10 mx-auto mb-2 text-primary/50" />
                            <p className="text-sm font-medium">Немає пропусків за цей період</p>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-text-secondary">
                            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-orange-400/50" />
                            <p className="text-sm font-medium">{stats.absentCount} пропусків зафіксовано</p>
                            <p className="text-xs mt-0.5 opacity-60">Деталі завантажуються...</p>
                        </div>
                    )}
                </div>

                {/* Safe area spacer for mobile bottom sheet */}
                <div className="h-2 sm:h-0 flex-shrink-0" />
            </div>
        </div>
    );
}
