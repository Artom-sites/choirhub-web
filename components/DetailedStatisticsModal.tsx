
import { useState, useMemo, useRef, useEffect } from "react";
import { X, Calendar, Users, TrendingUp, TrendingDown, Filter, Mic2, Trophy, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Choir } from "@/types";

interface AttendanceTrendEntry {
    date: string;
    percentage: number;
    present: number;
    total: number;
}

interface MemberStatEntry {
    presentCount: number;
    absentCount: number;
    servicesWithRecord: number;
    attendanceRate: number;
}

interface DetailedStatisticsModalProps {
    isOpen: boolean;
    onClose: () => void;
    choir: Choir;
    attendanceTrend: AttendanceTrendEntry[];
    memberStats: Record<string, MemberStatEntry>;
}

export default function DetailedStatisticsModal({
    isOpen,
    onClose,
    choir,
    attendanceTrend,
    memberStats
}: DetailedStatisticsModalProps) {
    const [activeTab, setActiveTab] = useState<'services' | 'members'>('services');

    const sortedServices = useMemo(() => {
        // Sort reverse chronological
        return [...attendanceTrend].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [attendanceTrend]);

    const sortedMembers = useMemo(() => {
        const membersList = (choir.members || []).map(m => {
            const stats = memberStats[m.id] || { presentCount: 0, absentCount: 0, servicesWithRecord: 0, attendanceRate: 0 };
            return {
                ...m,
                stats
            };
        });

        // Filter out those with 0 services if desired, or just sort them
        // Sort by attendance rate DESC, then presentCount DESC, then Name ASC
        return membersList.sort((a, b) => {
            if (b.stats.attendanceRate !== a.stats.attendanceRate) return b.stats.attendanceRate - a.stats.attendanceRate;
            if (b.stats.presentCount !== a.stats.presentCount) return b.stats.presentCount - a.stats.presentCount;
            const aName = a.name || "";
            const bName = b.name || "";
            return aName.localeCompare(bName);
        });
    }, [choir.members, memberStats]);

    const [timeFilter, setTimeFilter] = useState<'1m' | '3m' | '6m' | 'all'>('6m');

    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (chartContainerRef.current) {
                chartContainerRef.current.scrollLeft = chartContainerRef.current.scrollWidth;
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [attendanceTrend, timeFilter, activeTab]);

    const filteredAttendanceData = useMemo(() => {
        if (!attendanceTrend) return [];
        let cutoff = new Date();
        if (timeFilter === '1m') cutoff.setMonth(cutoff.getMonth() - 1);
        else if (timeFilter === '3m') cutoff.setMonth(cutoff.getMonth() - 3);
        else if (timeFilter === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
        else cutoff = new Date(0); // all

        return attendanceTrend
            .filter(entry => new Date(entry.date) >= cutoff)
            .map(entry => ({
                ...entry,
                date: new Date(entry.date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }),
            }));
    }, [attendanceTrend, timeFilter]);

    const voiceGroupStats = useMemo(() => {
        const groups: Record<string, { present: number, total: number }> = {
            Soprano: { present: 0, total: 0 },
            Alto: { present: 0, total: 0 },
            Tenor: { present: 0, total: 0 },
            Bass: { present: 0, total: 0 }
        };

        (choir.members || []).forEach(m => {
            const v = m.voice;
            if (v && groups[v]) {
                const stats = memberStats[m.id];
                if (stats && stats.servicesWithRecord > 0) {
                    groups[v].present += stats.presentCount;
                    groups[v].total += stats.servicesWithRecord;
                }
            }
        });

        return [
            { name: 'Сопрано', key: 'Soprano', pct: groups.Soprano.total > 0 ? Math.round((groups.Soprano.present / groups.Soprano.total) * 100) : 0, color: '#f472b6' },
            { name: 'Альт', key: 'Alto', pct: groups.Alto.total > 0 ? Math.round((groups.Alto.present / groups.Alto.total) * 100) : 0, color: '#c084fc' },
            { name: 'Тенор', key: 'Tenor', pct: groups.Tenor.total > 0 ? Math.round((groups.Tenor.present / groups.Tenor.total) * 100) : 0, color: '#60a5fa' },
            { name: 'Бас', key: 'Bass', pct: groups.Bass.total > 0 ? Math.round((groups.Bass.present / groups.Bass.total) * 100) : 0, color: '#4ade80' },
        ].filter(g => g.pct > 0);
    }, [choir.members, memberStats]);

    // ─── Records: best & worst service ───
    const records = useMemo(() => {
        if (!attendanceTrend || attendanceTrend.length === 0) return null;
        const sorted = [...attendanceTrend].sort((a, b) => a.percentage - b.percentage);
        return {
            best: sorted[sorted.length - 1],
            worst: sorted[0],
        };
    }, [attendanceTrend]);

    // ─── Trend: last 5 vs previous 5 ───
    const trendInfo = useMemo(() => {
        if (!attendanceTrend || attendanceTrend.length < 2) return null;
        const sorted = [...attendanceTrend].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const last5 = sorted.slice(-5);
        const prev5 = sorted.slice(-10, -5);
        if (prev5.length === 0) return null;
        const avgLast = Math.round(last5.reduce((s, e) => s + e.percentage, 0) / last5.length);
        const avgPrev = Math.round(prev5.reduce((s, e) => s + e.percentage, 0) / prev5.length);
        const diff = avgLast - avgPrev;
        return { avgLast, avgPrev, diff };
    }, [attendanceTrend]);

    // ─── Monthly averages ───
    const monthlyData = useMemo(() => {
        if (!attendanceTrend || attendanceTrend.length === 0) return [];
        const months: Record<string, { sum: number; count: number }> = {};
        attendanceTrend.forEach(entry => {
            const d = new Date(entry.date);
            const key = `${d.getFullYear()} -${String(d.getMonth() + 1).padStart(2, '0')} `;
            if (!months[key]) months[key] = { sum: 0, count: 0 };
            months[key].sum += entry.percentage;
            months[key].count++;
        });
        return Object.entries(months)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => {
                const [y, m] = key.split('-');
                const monthNames = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
                return {
                    name: `${monthNames[parseInt(m) - 1]} '${y.slice(2)}`,
                    pct: Math.round(val.sum / val.count),
                };
            });
    }, [attendanceTrend]);

    // ─── Activity categories ───
    const activityCategories = useMemo(() => {
        const membersWithStats = (choir.members || []).map(m => {
            const stats = memberStats[m.id];
            return { ...m, rate: stats && stats.servicesWithRecord > 0 ? stats.attendanceRate : -1 };
        }).filter(m => m.rate >= 0);

        const active = membersWithStats.filter(m => m.rate >= 70);
        const atRisk = membersWithStats.filter(m => m.rate >= 40 && m.rate < 70);
        const inactive = membersWithStats.filter(m => m.rate < 40);
        return { active, atRisk, inactive, total: membersWithStats.length };
    }, [choir.members, memberStats]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 z-10 bg-surface/80 backdrop-blur-xl border-b border-border px-4 py-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] flex items-center justify-between">
                <h2 className="font-bold text-lg text-text-primary">Детальна аналітика</h2>
                <button onClick={onClose} className="p-2 hover:bg-surface-highlight rounded-xl">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4 bg-surface border-b border-border flex gap-2">
                <button
                    onClick={() => setActiveTab('services')}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'services' ? 'bg-primary text-background' : 'bg-surface-highlight text-text-secondary hover:text-text-primary'}`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Служіння
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('members')}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'members' ? 'bg-primary text-background' : 'bg-surface-highlight text-text-secondary hover:text-text-primary'}`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Users className="w-4 h-4" />
                        Хористи
                    </div>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeTab === 'services' && (
                    <div className="space-y-4 pb-20">
                        {filteredAttendanceData.length > 0 && (
                            <div className="bg-surface border border-border rounded-3xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold flex items-center gap-2 text-[15px]">
                                        <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                            <TrendingUp className="w-4 h-4 text-orange-400" />
                                        </div>
                                        Графік
                                    </h3>
                                    <div className="flex bg-surface-highlight rounded-lg p-1">
                                        {(['1m', '3m', '6m', 'all'] as const).map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setTimeFilter(f)}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${timeFilter === f ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                            >
                                                {f === '1m' ? '1 міс' : f === '3m' ? '3 міс' : f === '6m' ? '6 міс' : 'Усі'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Dedicated Layout Row for Chart and YAxis */}
                                <div className="flex h-56 w-full mt-2">
                                    {/* Completely Decoupled HTML Y-Axis Column */}
                                    <div className="w-[36px] h-full flex flex-col justify-between text-right pr-2 pb-[24px] pt-[2px] shrink-0">
                                        {[100, 75, 50, 25, 0].map(v => (
                                            <span key={v} className="text-[11px] text-text-secondary leading-none">{v}%</span>
                                        ))}
                                    </div>

                                    {/* Independent Scrollable Chart Container */}
                                    <div ref={chartContainerRef} className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide -ml-2">
                                        <div style={{ minWidth: `${Math.max(100, filteredAttendanceData.length * 15)}%`, height: '100%' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={filteredAttendanceData}>
                                                    <defs>
                                                        <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                                                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                                    <XAxis
                                                        dataKey="date"
                                                        stroke="var(--text-secondary)"
                                                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        interval={0}
                                                        padding={{ right: 20 }}
                                                    />
                                                    <YAxis hide={true} domain={[0, 100]} />
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: 'var(--surface)',
                                                            borderColor: 'var(--border)',
                                                            borderRadius: '12px',
                                                            color: 'var(--text-primary)',
                                                            fontSize: '13px',
                                                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                                                        }}
                                                        itemStyle={{ color: 'var(--text-secondary)' }}
                                                        labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '4px' }}
                                                        formatter={(value: any) => [`${value}%`, 'Явка']}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="percentage"
                                                        stroke="var(--primary)"
                                                        strokeWidth={2.5}
                                                        fillOpacity={1}
                                                        fill="url(#colorPv)"
                                                        dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }}
                                                        activeDot={{ r: 5, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--surface)' }}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Records + Trend Row */}
                        {records && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-surface border border-border rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                                            <Trophy className="w-3.5 h-3.5 text-green-400" />
                                        </div>
                                        <span className="text-xs text-text-secondary font-medium">Найкраща</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-400">{records.best.percentage}%</p>
                                    <p className="text-[11px] text-text-secondary mt-0.5">{new Date(records.best.date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                </div>
                                <div className="bg-surface border border-border rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                        </div>
                                        <span className="text-xs text-text-secondary font-medium">Найгірша</span>
                                    </div>
                                    <p className="text-2xl font-bold text-red-400">{records.worst.percentage}%</p>
                                    <p className="text-[11px] text-text-secondary mt-0.5">{new Date(records.worst.date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                </div>
                            </div>
                        )}

                        {/* Trend indicator */}
                        {trendInfo && (
                            <div className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-text-secondary font-medium mb-1">Тренд (останні 5 вс попередні 5)</p>
                                    <p className="text-sm text-text-secondary">
                                        {trendInfo.avgPrev}% → {trendInfo.avgLast}%
                                    </p>
                                </div>
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm ${trendInfo.diff > 0 ? 'bg-green-500/10 text-green-400' :
                                    trendInfo.diff < 0 ? 'bg-red-500/10 text-red-400' :
                                        'bg-surface-highlight text-text-secondary'
                                    }`}>
                                    {trendInfo.diff > 0 ? <ArrowUpRight className="w-4 h-4" /> :
                                        trendInfo.diff < 0 ? <ArrowDownRight className="w-4 h-4" /> :
                                            <Minus className="w-4 h-4" />}
                                    {trendInfo.diff > 0 ? '+' : ''}{trendInfo.diff}%
                                </div>
                            </div>
                        )}

                        {/* Monthly averages chart */}
                        {monthlyData.length > 1 && (
                            <div className="bg-surface border border-border rounded-3xl p-5">
                                <h3 className="font-bold mb-4 flex items-center gap-2 text-[15px]">
                                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                        <Calendar className="w-4 h-4 text-blue-400" />
                                    </div>
                                    Середня явка по місяцях
                                </h3>
                                <div className="h-48 w-full -ml-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                stroke="var(--text-secondary)"
                                                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                stroke="var(--text-secondary)"
                                                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                                                tickLine={false}
                                                axisLine={false}
                                                unit="%"
                                                domain={[0, 100]}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'var(--surface-highlight)', opacity: 0.4 }}
                                                contentStyle={{
                                                    backgroundColor: 'var(--surface)',
                                                    borderColor: 'var(--border)',
                                                    borderRadius: '12px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '13px',
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                                                }}
                                                itemStyle={{ color: 'var(--text-secondary)' }}
                                                labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '4px' }}
                                                formatter={(value: any) => [`${value}%`, 'Середня явка']}
                                            />
                                            <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={40} fill="var(--primary)" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <h3 className="font-bold px-1 pt-2 flex items-center gap-2 text-[15px]">
                                <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-orange-400" />
                                </div>
                                Хронологія служінь
                            </h3>
                            {sortedServices.map((service, idx) => (
                                <div key={idx} className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-text-primary font-bold">{new Date(service.date).toLocaleDateString('uk-UA', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                                        <div className="text-sm text-text-secondary mt-1">Присутні: {service.present} з {service.total}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-xl font-bold ${service.percentage >= 70 ? 'text-green-400' : service.percentage >= 40 ? 'text-orange-400' : 'text-danger'}`}>
                                            {service.percentage}%
                                        </div>
                                        <div className="text-[10px] text-text-secondary uppercase tracking-wider">Явка</div>
                                    </div>
                                </div>
                            ))}
                            {sortedServices.length === 0 && (
                                <div className="text-center py-12 text-text-secondary">
                                    У вас ще немає збережених служінь із зазначеною відвідуваністю.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="space-y-4 pb-20">
                        {voiceGroupStats.length > 0 && (
                            <div className="bg-surface border border-border rounded-3xl p-5">
                                <h3 className="font-bold mb-4 flex items-center gap-2 text-[15px]">
                                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                        <Mic2 className="w-4 h-4 text-purple-400" />
                                    </div>
                                    Відвідуваність по партіям
                                </h3>
                                <div className="h-56 w-full -ml-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={voiceGroupStats} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                stroke="var(--text-secondary)"
                                                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                stroke="var(--text-secondary)"
                                                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                                tickLine={false}
                                                axisLine={false}
                                                unit="%"
                                                domain={[0, 100]}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'var(--surface-highlight)', opacity: 0.4 }}
                                                contentStyle={{
                                                    backgroundColor: 'var(--surface)',
                                                    borderColor: 'var(--border)',
                                                    borderRadius: '12px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '13px',
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                                                }}
                                                itemStyle={{ color: 'var(--text-secondary)' }}
                                                labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '4px' }}
                                                formatter={(value: any) => [`${value}%`, 'Середня явка']}
                                            />
                                            <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={50}>
                                                {voiceGroupStats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Activity Categories */}
                        {activityCategories.total > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-surface border border-border rounded-2xl p-3 text-center">
                                    <div className="w-3 h-3 rounded-full bg-green-400 mx-auto mb-2"></div>
                                    <p className="text-xl font-bold text-green-400">{activityCategories.active.length}</p>
                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider mt-0.5">Активні (&gt;70%)</p>
                                </div>
                                <div className="bg-surface border border-border rounded-2xl p-3 text-center">
                                    <div className="w-3 h-3 rounded-full bg-orange-400 mx-auto mb-2"></div>
                                    <p className="text-xl font-bold text-orange-400">{activityCategories.atRisk.length}</p>
                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider mt-0.5">Під ризиком</p>
                                </div>
                                <div className="bg-surface border border-border rounded-2xl p-3 text-center">
                                    <div className="w-3 h-3 rounded-full bg-red-400 mx-auto mb-2"></div>
                                    <p className="text-xl font-bold text-red-400">{activityCategories.inactive.length}</p>
                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider mt-0.5">Неактивні</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <h3 className="font-bold px-1 pt-2 flex items-center gap-2 text-[15px]">
                                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-blue-400" />
                                </div>
                                Персональний рейтинг
                            </h3>
                            {sortedMembers.map(member => (
                                <div key={member.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold flex-shrink-0">
                                        {member.name?.[0]?.toUpperCase() || "?"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-text-primary font-bold truncate">{member.name}</div>
                                        <div className="text-xs text-text-secondary flex items-center gap-2">
                                            {member.voice && <span>{member.voice}</span>}
                                            {member.stats.servicesWithRecord > 0 && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-border"></span>
                                                    <span>Був(-ла) на {member.stats.presentCount} з {member.stats.servicesWithRecord}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 pl-2">
                                        <div className={`text-lg font-bold ${member.stats.attendanceRate >= 70 ? 'text-green-400' : member.stats.attendanceRate >= 40 ? 'text-orange-400' : 'text-danger'}`}>
                                            {member.stats.servicesWithRecord > 0 ? `${member.stats.attendanceRate}%` : '—'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
