"use client";

import { useState, useEffect } from "react";
import { Service } from "@/types";
import { getServices, addService, deleteService, setServiceAttendance } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Plus, ChevronRight, X, Trash2, Loader2, Check } from "lucide-react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ConfirmationModal from "./ConfirmationModal";
import TrashBin from "./TrashBin";
import SwipeableCard from "./SwipeableCard";

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
    const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
    const [showArchive, setShowArchive] = useState(false);
    const [showTrashBin, setShowTrashBin] = useState(false);

    // Create form
    const [newTitle, setNewTitle] = useState("Співанка");
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newTime, setNewTime] = useState("10:00");

    useEffect(() => {
        if (!userData?.choirId) return;

        setLoading(true);
        const q = query(
            collection(db, `choirs/${userData.choirId}/services`)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`Fetched ${snapshot.docs.length} services (Source: ${snapshot.metadata.fromCache ? 'Cache' : 'Server'})`);

            const fetchedServices = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Service))
                .filter(s => !s.deletedAt);

            // Smart Sort: Upcoming (Ascending), then Past (Descending)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const upcoming = fetchedServices.filter(s => new Date(s.date) >= today)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const past = fetchedServices.filter(s => new Date(s.date) < today)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setServices([...upcoming, ...past]);
            setLoading(false);
        }, (error) => {
            console.error("Error subscribing to services:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userData?.choirId]);

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
            // Revert handled by listener or next update
            // If we really want to revert, we might need a way to force refresh or just let next snapshot fix it.
            // For now, listener will eventually correct it if write failed on backend but succeeded locally? 
            // Actually if write fails, local cache might be reverted by SDK.
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

    const handleCreate = async () => {
        if (!userData?.choirId) return;

        await addService(userData.choirId, {
            title: newTitle,
            date: newDate,
            time: newTime || undefined,
            songs: []
        });

        setShowCreateModal(false);
        setNewTitle("Співанка");
        setNewDate(new Date().toISOString().split('T')[0]);
        setNewTime("10:00");
    };

    const initiateDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setServiceToDelete(id);
    };

    const confirmDelete = async () => {
        if (!userData?.choirId || !serviceToDelete) return;
        await deleteService(userData.choirId, serviceToDelete);
        setServiceToDelete(null);
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
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-6 pb-32">

            {/* Header with Archive Toggle */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest pl-2">
                    {showArchive ? 'Архів служінь' : 'Найближчі служіння'}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowArchive(!showArchive)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${showArchive ? 'bg-primary text-background' : 'bg-surface text-text-secondary card-shadow'}`}
                    >
                        {showArchive ? 'Актуальні' : 'Архів'}
                    </button>
                    {effectiveCanEdit && !showArchive && (
                        <button
                            onClick={() => setShowTrashBin(true)}
                            className="p-2 rounded-xl text-text-secondary hover:text-red-400 hover:bg-surface-highlight transition-colors"
                            title="Корзина"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                    {effectiveCanEdit && !showArchive && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-zinc-900 text-white hover:bg-zinc-800 p-2 rounded-xl transition-colors shadow-md"
                            title="Додати служіння"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Logic */}
            {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Smart Sort filters are done in DB, but let's strictly separate here for view
                // Actually the `services` prop from getServices (Smart Sort) returns upcoming then past.
                // We need to re-filter to separate them for the view toggle.

                const upcomingServices = services.filter(s => new Date(s.date) >= today);
                const pastServices = services.filter(s => new Date(s.date) < today);

                const displayServices = showArchive ? pastServices : upcomingServices;

                if (displayServices.length === 0) {
                    return (
                        <div className="text-center py-20 bg-surface rounded-2xl mx-2 card-shadow">
                            <div className="w-16 h-16 bg-surface-highlight rounded-2xl flex items-center justify-center mx-auto mb-4 text-text-secondary">
                                <Calendar className="w-8 h-8" />
                            </div>
                            <p className="text-text-secondary font-medium">
                                {showArchive ? 'Архіви порожні' : 'Немає запланованих служінь'}
                            </p>
                            {!showArchive && effectiveCanEdit && (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="mt-6 px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium text-sm"
                                >
                                    Створити перше
                                </button>
                            )}
                        </div>
                    );
                }

                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayServices.map(service => {
                            const status = getMyStatus(service);
                            const isFuture = isUpcoming(service.date);

                            return (
                                <SwipeableCard
                                    key={service.id}
                                    onDelete={() => setServiceToDelete(service.id)}
                                    disabled={!effectiveCanEdit}
                                    className="rounded-2xl h-full"
                                >
                                    <div
                                        onClick={() => onSelectService(service)}
                                        className={`relative group p-5 rounded-2xl transition-all cursor-pointer h-full flex flex-col justify-between card-shadow ${isToday(service.date) ? 'bg-accent/10 border border-accent/20' : 'bg-surface'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isToday(service.date) ? 'text-accent' : 'text-text-secondary'}`}>
                                                    {isToday(service.date) ? 'Сьогодні' : formatDate(service.date)}
                                                </p>
                                                <h3 className="text-xl font-bold text-text-primary mb-2">{service.title}</h3>

                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${isToday(service.date) ? 'bg-transparent border-white/30 text-white' : 'bg-transparent border-border text-text-secondary'}`}>
                                                        {service.songs.length} пісень
                                                    </div>
                                                </div>

                                                {isFuture && (
                                                    <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                                                        {(status === 'unknown' || status === 'present') && (
                                                            <button
                                                                onClick={(e) => handleVote(e, service.id, 'present')}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${status === 'present' ? 'bg-success text-white ring-2 ring-success/50' : 'bg-background text-text-secondary hover:bg-surface-highlight'}`}
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                {status === 'present' ? 'Я буду' : 'Буду'}
                                                            </button>
                                                        )}

                                                        {(status === 'unknown' || status === 'absent') && (
                                                            <button
                                                                onClick={(e) => handleVote(e, service.id, 'absent')}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${status === 'absent' ? 'bg-danger/20 text-danger ring-1 ring-danger/50' : 'bg-background text-text-secondary hover:bg-surface-highlight'}`}
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                {status === 'absent' ? 'Не буду' : 'Не буду'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <ChevronRight className="w-5 h-5 text-text-secondary group-hover:text-text-primary transition-colors" />
                                        </div>
                                    </div>
                                </SwipeableCard>
                            )
                        })}
                    </div>
                );
            })()}

            <ConfirmationModal
                isOpen={!!serviceToDelete}
                onClose={() => setServiceToDelete(null)}
                onConfirm={confirmDelete}
                title="Видалити служіння?"
                message="Служіння буде переміщено до корзини. Ви зможете відновити його протягом 7 днів."
                confirmLabel="Видалити"
                isDestructive
            />

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface w-full max-w-sm rounded-3xl border border-border p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-text-primary">Нове служіння</h3>
                            <button onClick={() => setShowCreateModal(false)}>
                                <X className="w-6 h-6 text-text-secondary hover:text-text-primary" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Назва</label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary focus:outline-none focus:border-text-secondary/50 focus:bg-surface transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Дата</label>
                                    <input
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        className="w-full h-12 px-4 bg-surface-highlight border border-border rounded-xl text-text-primary focus:outline-none focus:border-text-secondary/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Час</label>
                                    <input
                                        type="time"
                                        value={newTime}
                                        onChange={(e) => setNewTime(e.target.value)}
                                        className="w-full h-12 px-4 bg-surface-highlight border border-border rounded-xl text-text-primary focus:outline-none focus:border-text-secondary/50"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleCreate}
                                className="w-full py-4 bg-primary text-background font-bold rounded-xl mt-4 hover:opacity-90 transition-colors"
                            >
                                Створити
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Trash Bin */}
            {showTrashBin && userData?.choirId && (
                <TrashBin
                    choirId={userData.choirId}
                    onClose={() => setShowTrashBin(false)}
                    onRestore={() => { }} // Listener handles restore updates
                />
            )}
        </div>
    );
}
