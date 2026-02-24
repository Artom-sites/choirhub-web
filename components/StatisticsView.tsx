"use client";

import { useMemo, useState, useEffect } from "react";
import { Choir } from "@/types";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowLeft, Users, Mic2, Calendar, TrendingUp, Music, X, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import DetailedStatisticsModal from "./DetailedStatisticsModal";

// ─── Types matching the summary document from Cloud Function ───

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
    updatedAt: any;
}

// ─── Component ───

interface StatisticsViewProps {
    choir: Choir;
    onBack: () => void;
}

export default function StatisticsView({ choir, onBack }: StatisticsViewProps) {
    const [stats, setStats] = useState<StatsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!choir.id) return;
        const summaryRef = doc(db, `choirs/${choir.id}/stats/summary`);
        const unsub = onSnapshot(
            summaryRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setStats(snapshot.data() as StatsSummary);
                    setError(null);
                } else {
                    setStats(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error("[StatisticsView] onSnapshot error:", err);
                setError("Помилка завантаження статистики");
                setLoading(false);
            }
        );
        return () => unsub();
    }, [choir.id]);

    // Voice distribution
    const voiceData = useMemo(() => {
        const counts: Record<string, number> = { Soprano: 0, Alto: 0, Tenor: 0, Bass: 0, Unassigned: 0 };
        (choir.members || []).forEach(m => {
            if (m.voice && counts[m.voice] !== undefined) {
                counts[m.voice]++;
            } else {
                counts.Unassigned++;
            }
        });
        const raw = [
            { name: 'Сопрано', key: 'Soprano', value: counts.Soprano, color: '#f472b6' },
            { name: 'Альт', key: 'Alto', value: counts.Alto, color: '#c084fc' },
            { name: 'Тенор', key: 'Tenor', value: counts.Tenor, color: '#60a5fa' },
            { name: 'Бас', key: 'Bass', value: counts.Bass, color: '#4ade80' },
        ].filter(d => d.value > 0);

        // Largest-remainder method so percentages sum to exactly 100
        const total = raw.reduce((s, d) => s + d.value, 0);
        if (total === 0) return raw.map(d => ({ ...d, pct: 0 }));
        const exact = raw.map(d => (d.value / total) * 100);
        const floored = exact.map(v => Math.floor(v));
        let remainder = 100 - floored.reduce((s, v) => s + v, 0);
        const remainders = exact.map((v, i) => ({ i, r: v - floored[i] }));
        remainders.sort((a, b) => b.r - a.r);
        for (let j = 0; j < remainder; j++) floored[remainders[j].i]++;
        return raw.map((d, i) => ({ ...d, pct: floored[i] }));
    }, [choir.members]);

    const totalMembers = (choir.members || []).length;
    const voicedMembers = voiceData.reduce((sum, d) => sum + d.value, 0);

    const attendanceData = useMemo(() => {
        if (!stats?.attendanceTrend) return [];
        // Only show the last 5 services on the main screen to avoid scrolling and clipping
        return stats.attendanceTrend.slice(-5).map(entry => ({
            ...entry,
            date: new Date(entry.date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }),
        }));
    }, [stats?.attendanceTrend]);

    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [showAllSongs, setShowAllSongs] = useState(false);
    const [showDetailedStats, setShowDetailedStats] = useState(false);
    const onPieEnter = (_: any, index: number) => setActiveIndex(index);
    const onPieLeave = () => setActiveIndex(null);

    return (
        <div className="min-h-screen bg-background text-text-primary">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-border px-4 py-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-surface-highlight rounded-xl transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-text-secondary" />
                </button>
                <h1 className="font-bold text-lg text-text-primary">Статистика хору</h1>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-12 mt-12">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                    <p className="text-text-secondary font-medium">Завантаження статистики...</p>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center p-12 mt-12">
                    <AlertCircle className="w-8 h-8 text-red-400 mb-4" />
                    <p className="text-text-secondary font-medium">{error}</p>
                </div>
            ) : !stats ? (
                <div className="flex flex-col items-center justify-center p-12 mt-12">
                    <Calendar className="w-8 h-8 text-text-secondary mb-4" />
                    <p className="text-text-secondary font-medium">Статистика ще не створена</p>
                    <p className="text-text-secondary text-sm mt-1">Додайте служіння, щоб побачити дані</p>
                </div>
            ) : (
                <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">

                    {/* Summary Cards Row */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-surface border border-border rounded-2xl p-4 text-center">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
                                <Users className="w-4.5 h-4.5 text-blue-400" />
                            </div>
                            <p className="text-2xl font-bold">{totalMembers}</p>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider mt-0.5">Учасників</p>
                        </div>
                        <div className="bg-surface border border-border rounded-2xl p-4 text-center">
                            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto mb-2">
                                <TrendingUp className="w-4.5 h-4.5 text-green-400" />
                            </div>
                            <p className="text-2xl font-bold">{stats.averageAttendance}%</p>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider mt-0.5">Явка</p>
                        </div>
                        <div className="bg-surface border border-border rounded-2xl p-4 text-center">
                            <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto mb-2">
                                <Calendar className="w-4.5 h-4.5 text-orange-400" />
                            </div>
                            <p className="text-2xl font-bold">{stats.totalServices}</p>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider mt-0.5">Служінь</p>
                        </div>
                    </div>

                    {/* Voice Balance — Donut + Inline Legend */}
                    <div className="bg-surface border border-border rounded-3xl p-5">
                        <h3 className="font-bold mb-4 flex items-center gap-2 text-[15px]">
                            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <Mic2 className="w-4 h-4 text-purple-400" />
                            </div>
                            Баланс голосів
                        </h3>

                        <div className="flex items-center gap-4">
                            {/* Donut Chart */}
                            <div className="w-36 h-36 relative flex-shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={voiceData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={42}
                                            outerRadius={62}
                                            paddingAngle={3}
                                            dataKey="value"
                                            onClick={onPieEnter}
                                            onMouseEnter={onPieEnter}
                                            onMouseLeave={onPieLeave}
                                            strokeWidth={0}
                                        >
                                            {voiceData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.color}
                                                    stroke="none"
                                                    className="outline-none focus:outline-none cursor-pointer"
                                                    opacity={activeIndex !== null && activeIndex !== index ? 0.35 : 1}
                                                    style={{ outline: 'none', transition: 'opacity 0.2s' }}
                                                />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    {activeIndex !== null && voiceData[activeIndex] ? (
                                        <span className="text-2xl font-bold text-text-primary">{voiceData[activeIndex].value}</span>
                                    ) : (
                                        <span className="text-2xl font-bold text-text-primary">{voicedMembers}</span>
                                    )}
                                </div>
                            </div>

                            {/* Inline Legend */}
                            <div className="flex-1 space-y-2.5">
                                {voiceData.map((entry, i) => (
                                    <div
                                        key={entry.key}
                                        className="flex items-center gap-2.5 cursor-pointer group"
                                        onClick={() => setActiveIndex(activeIndex === i ? null : i)}
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: entry.color }}
                                        />
                                        <span className="text-sm text-text-primary group-hover:text-text-primary/80 flex-1">{entry.name}</span>
                                        <span className="text-sm font-bold text-text-primary tabular-nums">{entry.value}</span>
                                        <span className="text-xs text-text-secondary tabular-nums w-10 text-right">
                                            {entry.pct}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Attendance Trend */}
                    {attendanceData.length > 0 && (
                        <div className="bg-surface border border-border rounded-3xl p-5">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-[15px]">
                                <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-orange-400" />
                                </div>
                                Динаміка відвідуваності
                            </h3>
                            {/* Dedicated Layout Row for Chart and YAxis matching Detailed Stats */}
                            <div className="flex h-56 w-full mt-2">
                                {/* Completely Decoupled HTML Y-Axis Column with gap */}
                                <div className="w-[36px] h-full flex flex-col justify-between text-right pr-2 pb-[24px] pt-[2px] shrink-0">
                                    {[100, 75, 50, 25, 0].map(v => (
                                        <span key={v} className="text-[11px] text-text-secondary leading-none">{v}%</span>
                                    ))}
                                </div>

                                {/* Chart Container */}
                                <div className="flex-1 overflow-visible">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={attendanceData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
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
                                                tick={({ x, y, payload }) => (
                                                    <text
                                                        x={x}
                                                        y={y}
                                                        dy={10}
                                                        fill="var(--text-secondary)"
                                                        fontSize={11}
                                                        textAnchor="middle"
                                                    >
                                                        {payload.value}
                                                    </text>
                                                )}
                                                tickLine={false}
                                                axisLine={false}
                                                interval={0}
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
                            <button
                                onClick={() => setShowDetailedStats(true)}
                                className="w-full mt-3 py-2.5 bg-surface-highlight/60 hover:bg-surface-highlight rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5"
                            >
                                Детальніше
                            </button>
                        </div>
                    )}

                    {/* Most Performed Songs */}
                    {stats.topSongs.length > 0 && (
                        <div className="bg-surface border border-border rounded-3xl p-5">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-[15px]">
                                <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center">
                                    <Music className="w-4 h-4 text-pink-400" />
                                </div>
                                Найпопулярніші пісні
                            </h3>
                            <div className="space-y-1">
                                {stats.topSongs.slice(0, 5).map((song, idx) => {
                                    const barWidth = (song.count / stats.topSongs[0].count) * 100;
                                    return (
                                        <div key={song.songId} className="flex items-center gap-2.5 py-2 group">
                                            <span className={`text-xs w-5 text-right font-bold tabular-nums ${idx < 3 ? 'text-pink-400' : 'text-text-secondary/50'}`}>
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                                <span className="text-[13px] text-text-primary truncate">{song.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <div className="w-16 h-1.5 bg-surface-highlight rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{
                                                            width: `${barWidth}%`,
                                                            background: 'linear-gradient(90deg, #ec4899, #a855f7)'
                                                        }}
                                                    />
                                                </div>
                                                <span className={`text-[11px] font-bold tabular-nums w-6 text-right ${idx < 3 ? 'text-pink-400' : 'text-text-secondary'}`}>{song.count}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {stats.allSongs.length > 5 && (
                                <button
                                    onClick={() => setShowAllSongs(true)}
                                    className="w-full mt-3 py-2.5 bg-surface-highlight/60 hover:bg-surface-highlight rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5"
                                >
                                    Усі пісні ({stats.allSongs.length})
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )
            }

            {/* Show All Songs Modal */}
            {
                showAllSongs && stats && (
                    <div className="fixed inset-0 z-[70] bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="sticky top-0 z-10 bg-surface/80 backdrop-blur-xl border-b border-border px-4 py-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] flex items-center gap-3">
                            <button onClick={() => setShowAllSongs(false)} className="p-2 hover:bg-surface-highlight rounded-xl">
                                <X className="w-5 h-5" />
                            </button>
                            <h2 className="font-bold text-lg">Статистика по пісням ({stats.allSongs.length})</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 pb-safe">
                            <div className="space-y-2 max-w-lg mx-auto">
                                {stats.allSongs.map((song, idx) => (
                                    <div key={song.songId} className="flex items-center gap-3 bg-surface border border-border p-3 rounded-xl">
                                        <span className={`text-xs w-6 text-center font-bold tabular-nums ${idx < 3 ? 'text-pink-400' : 'text-text-secondary'}`}>{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-text-primary truncate">{song.title}</span>
                                                <span className="text-sm text-pink-400 font-bold ml-2 tabular-nums">{song.count}×</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1.5">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${(song.count / stats.allSongs[0].count) * 100}%`,
                                                        background: 'linear-gradient(90deg, #ec4899, #a855f7)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showDetailedStats && stats && (
                    <DetailedStatisticsModal
                        isOpen={showDetailedStats}
                        onClose={() => setShowDetailedStats(false)}
                        choir={choir}
                        attendanceTrend={stats.attendanceTrend}
                        memberStats={stats.memberStats || {}}
                    />
                )
            }
        </div >
    );
}
