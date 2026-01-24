"use client";

import { useState, useEffect } from "react";
import { Service } from "@/types";
import { getServices, addService, deleteService, setServiceAttendance } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Plus, ChevronRight, X, Trash2, Loader2, Check } from "lucide-react";

interface ServiceListProps {
    onSelectService: (service: Service) => void;
    canEdit: boolean;
}

export default function ServiceList({ onSelectService, canEdit }: ServiceListProps) {
    const { userData, user } = useAuth();

    const effectiveCanEdit = canEdit;

    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [votingLoading, setVotingLoading] = useState<string | null>(null);

    // Create form
    const [newTitle, setNewTitle] = useState("Співанка");
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        refreshServices();
    }, [userData?.choirId]);

    const refreshServices = async () => {
        if (!userData?.choirId) return;
        setLoading(true);
        const fetched = await getServices(userData.choirId);
        setServices(fetched);
        setLoading(false);
    };

    const handleVote = async (e: React.MouseEvent, serviceId: string, status: 'present' | 'absent') => {
        e.stopPropagation();
        if (!userData?.choirId || !user?.uid) return;

        // Optimistic update
        setServices(prev => prev.map(s => {
            if (s.id === serviceId) {
                const newConfirmed = status === 'present'
                    ? [...(s.confirmedMembers || []), user.uid].filter((v, i, a) => a.indexOf(v) === i)
                    : (s.confirmedMembers || []).filter(id => id !== user.uid);

                const newAbsent = status === 'absent'
                    ? [...(s.absentMembers || []), user.uid].filter((v, i, a) => a.indexOf(v) === i)
                    : (s.absentMembers || []).filter(id => id !== user.uid);

                return { ...s, confirmedMembers: newConfirmed, absentMembers: newAbsent };
            }
            return s;
        }));

        setVotingLoading(serviceId);
        try {
            await setServiceAttendance(userData.choirId, serviceId, user.uid, status);
        } catch (error) {
            console.error("Voting failed", error);
            refreshServices(); // Revert on error
        } finally {
            setVotingLoading(null);
        }
    };

    const isUpcoming = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Robust parsed date (handle timezone issues)
        const [y, m, d] = dateStr.split('-').map(Number);
        const serviceDate = new Date(y, m - 1, d);
        return serviceDate >= today;
    };

    // ... create handlers same as before ... 
    const handleCreate = async () => {
        if (!userData?.choirId) return;

        await addService(userData.choirId, {
            title: newTitle,
            date: newDate,
            songs: []
        });

        setShowCreateModal(false);
        setNewTitle("Співанка");
        setNewDate(new Date().toISOString().split('T')[0]);
        refreshServices();
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!userData?.choirId) return;

        if (confirm("Видалити це служіння?")) {
            await deleteService(userData.choirId, id);
            refreshServices();
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('uk-UA', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        }).format(date);
    };

    const isToday = (dateStr: string) => {
        const today = new Date().toISOString().split('T')[0];
        return dateStr === today;
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-white/20" /></div>;
    }

    // Status helper
    const getMyStatus = (service: Service) => {
        if (!user?.uid) return 'unknown';
        if (service.confirmedMembers?.includes(user.uid)) return 'present';
        if (service.absentMembers?.includes(user.uid)) return 'absent';
        return 'unknown';
    };

    return (
        <div className="max-w-md mx-auto px-4 py-4 space-y-6 pb-24">

            {/* Upcoming Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest pl-2">Найближчі служіння</h2>
                {effectiveCanEdit && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="text-black bg-white hover:bg-gray-200 p-2 rounded-xl transition-colors shadow-lg shadow-white/10"
                        title="Додати служіння"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                )}
            </div>

            {services.length === 0 ? (
                <div className="text-center py-20 bg-surface/30 rounded-3xl border border-white/5 mx-2">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white/50">
                        <Calendar className="w-8 h-8" />
                    </div>
                    <p className="text-text-secondary font-medium">Немає запланованих служінь</p>
                    {effectiveCanEdit && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-6 px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors font-medium text-sm border border-white/5"
                        >
                            Створити перше
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {services.map(service => {
                        const status = getMyStatus(service);
                        const isFuture = isUpcoming(service.date);

                        return (
                            <div
                                key={service.id}
                                onClick={() => onSelectService(service)}
                                className={`relative group p-5 rounded-2xl border transition-all cursor-pointer ${isToday(service.date) ? 'bg-white/10 border-white/20' : 'bg-surface border-white/5 hover:border-white/10'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isToday(service.date) ? 'text-white' : 'text-text-secondary'}`}>
                                            {isToday(service.date) ? 'Сьогодні' : formatDate(service.date)}
                                        </p>
                                        <h3 className="text-xl font-bold text-white mb-2">{service.title}</h3>

                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${isToday(service.date) ? 'bg-white text-black border-white' : 'bg-white/5 text-text-secondary border-white/5'}`}>
                                                {service.songs.length} пісень
                                            </div>
                                        </div>

                                        {/* Voting Area */}
                                        {isFuture && (
                                            <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                                                {(status === 'unknown' || status === 'present') && (
                                                    <button
                                                        onClick={(e) => handleVote(e, service.id, 'present')}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${status === 'present' ? 'bg-green-500 text-white ring-2 ring-green-500/50' : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'}`}
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        {status === 'present' ? 'Я буду' : 'Буду'}
                                                    </button>
                                                )}

                                                {(status === 'unknown' || status === 'absent') && (
                                                    <button
                                                        onClick={(e) => handleVote(e, service.id, 'absent')}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${status === 'absent' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50' : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'}`}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        {status === 'absent' ? 'Не буду' : 'Не буду'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white transition-colors" />
                                </div>

                                {effectiveCanEdit && (
                                    <button
                                        onClick={(e) => handleDelete(e, service.id)}
                                        className="absolute top-4 right-4 p-2 text-text-secondary hover:text-red-500 hover:bg-white/5 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#18181b] w-full max-w-sm rounded-3xl border border-white/10 p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Нове служіння</h3>
                            <button onClick={() => setShowCreateModal(false)}>
                                <X className="w-6 h-6 text-text-secondary hover:text-white" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Назва</label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Дата</label>
                                <input
                                    type="date"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30 [color-scheme:dark]"
                                />
                            </div>

                            <button
                                onClick={handleCreate}
                                className="w-full py-4 bg-white text-black font-bold rounded-xl mt-4 hover:bg-gray-200 transition-colors"
                            >
                                Створити
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
