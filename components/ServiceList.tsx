"use client";

import { useState, useEffect } from "react";
import { getServices, addService, deleteService, setServiceAttendance, getChoir } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Plus, ChevronRight, X, Trash2, Loader2, Check, Clock, Mic2 } from "lucide-react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Service } from "@/types";
import ConfirmationModal from "./ConfirmationModal";
import TrashBin from "./TrashBin";
import SwipeableCard from "./SwipeableCard";
import { motion, AnimatePresence } from "framer-motion";

interface ServiceListProps {
    onSelectService: (service: Service) => void;
    canEdit: boolean;
    services: Service[];
    showCreateModal?: boolean;
    setShowCreateModal?: (show: boolean) => void;
    onLoadHistory?: () => void;
    loadingHistory?: boolean;
    allHistoryLoaded?: boolean;
}

export default function ServiceList({
    onSelectService,
    canEdit,
    services,
    showCreateModal: propsShowCreateModal,
    setShowCreateModal: propsSetShowCreateModal,
    onLoadHistory,
    loadingHistory = false,
    allHistoryLoaded = false
}: ServiceListProps) {
    const { userData, user } = useAuth();
    const effectiveCanEdit = canEdit;

    // Local-to-prop state mapping
    const [localShowCreateModal, setLocalShowCreateModal] = useState(false);
    const showCreateModal = propsShowCreateModal ?? localShowCreateModal;
    const setShowCreateModal = propsSetShowCreateModal ?? setLocalShowCreateModal;
    const [votingLoading, setVotingLoading] = useState<string | null>(null);
    const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
    const [showArchive, setShowArchive] = useState(false);
    const [showTrashBin, setShowTrashBin] = useState(false);

    // Create form
    const [newTitle, setNewTitle] = useState("Співанка");
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newTime, setNewTime] = useState("10:00");
    const [newWarmupConductor, setNewWarmupConductor] = useState("");
    const [regents, setRegents] = useState<string[]>([]);

    useEffect(() => {
        if (!userData?.choirId) return;
        getChoir(userData.choirId).then(c => {
            if (c) {
                const list = Array.from(new Set([
                    ...(c.regents || []),
                    ...(c.members?.filter(m => m.role === 'regent' || m.role === 'head').map(m => m.name) || [])
                ])).filter(Boolean);
                setRegents(list);
            }
        });
    }, [userData?.choirId]);

    const handleVote = async (e: React.MouseEvent, serviceId: string, status: 'present' | 'absent') => {
        e.stopPropagation();
        if (!userData?.choirId || !user?.uid) return;

        setVotingLoading(serviceId);
        try {
            await setServiceAttendance(userData.choirId, serviceId, user.uid, status);
        } catch (error) {
            console.error("Voting failed", error);
        } finally {
            setVotingLoading(null);
        }
    };

    const isUpcoming = (dateStr: string, timeStr?: string) => {
        const now = new Date();
        const [y, m, d] = dateStr.split('-').map(Number);
        const serviceDate = new Date(y, m - 1, d);

        if (timeStr) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            serviceDate.setHours(hours, minutes, 0, 0);
            return serviceDate > now;
        } else {
            // If no time, it's upcoming until the end of the day
            serviceDate.setHours(23, 59, 59, 999);
            return serviceDate >= now;
        }
    };

    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!userData?.choirId || creating) return;

        setCreating(true);
        try {
            const serviceData: any = {
                title: newTitle,
                date: newDate,
                songs: []
            };
            if (newTime) serviceData.time = newTime;
            if (newWarmupConductor) serviceData.warmupConductor = newWarmupConductor;

            await addService(userData.choirId, serviceData);

            setShowCreateModal(false);
            setNewTitle("Співанка");
            setNewDate(new Date().toISOString().split('T')[0]);
            setNewTime("10:00");
            setNewWarmupConductor("");
        } catch (error) {
            console.error("Failed to create service:", error);
        } finally {
            setCreating(false);
        }
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

    // Status helper
    const getMyStatus = (service: Service) => {
        if (!user?.uid) return 'unknown';
        if (service.confirmedMembers?.includes(user.uid)) return 'present';
        if (service.absentMembers?.includes(user.uid)) return 'absent';
        return 'unknown';
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-6">

            {/* Header with Archive Toggle - Spacious & Clean */}
            <div className="flex items-center justify-between px-2 mb-4 relative z-10">
                <h2 className="text-lg font-bold text-text-primary">
                    {showArchive ? 'Архів служінь' : 'Найближчі служіння'}
                </h2>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowArchive(!showArchive)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showArchive ? 'bg-primary text-background shadow-md' : 'text-text-secondary bg-surface hover:bg-surface-highlight hover:text-text-primary'}`}
                    >
                        {showArchive ? 'Актуальні' : 'Архів'}
                    </button>

                    {effectiveCanEdit && !showArchive && (
                        <button
                            onClick={() => setShowTrashBin(true)}
                            className="p-2 rounded-lg text-text-secondary hover:text-red-400 hover:bg-surface-highlight transition-colors"
                            title="Корзина"
                        >
                            <Trash2 className="w-5 h-5" />
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
                                    className="mt-6 px-6 py-3 bg-primary text-background hover:opacity-90 transition-colors font-bold text-sm rounded-xl"
                                >
                                    Створити перше
                                </button>
                            )}
                        </div>
                    );
                }

                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayServices.map((service) => {
                            const status = getMyStatus(service);
                            const isFuture = isUpcoming(service.date, service.time);

                            return (
                                <div
                                    key={service.id}
                                    className="h-full"
                                >
                                    <SwipeableCard
                                        onDelete={() => setServiceToDelete(service.id)}
                                        disabled={!effectiveCanEdit}
                                        className="rounded-2xl h-full"
                                        contentClassName="" // Remove default bg-surface that creates square corners
                                        backgroundClassName="rounded-2xl"
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
                                                        <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${isToday(service.date) ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-surface-highlight border-border text-text-primary'}`}>
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
                                </div>
                            )
                        })}
                    </div>
                );
            })()}

            {/* Load More History Button */}
            {showArchive && onLoadHistory && !allHistoryLoaded && (
                <div className="flex justify-center mt-6 mb-8">
                    <button
                        onClick={onLoadHistory}
                        disabled={loadingHistory}
                        className="px-6 py-3 bg-surface border border-border rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-highlight transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loadingHistory ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Завантаження...
                            </>
                        ) : (
                            <>
                                <Clock className="w-4 h-4" />
                                Завантажити старіші
                            </>
                        )}
                    </button>
                </div>
            )}

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
                                    className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Дата</label>
                                    <div className="relative w-full">
                                        {/* Visual Fake Input */}
                                        <div className="w-full h-12 flex items-center pl-4 pr-10 bg-surface-highlight border border-border rounded-xl text-text-primary text-base">
                                            {newDate ? newDate.split('-').reverse().join('.') : ''}
                                        </div>
                                        {/* Invisible Real Input */}
                                        <input
                                            type="date"
                                            value={newDate}
                                            onChange={(e) => setNewDate(e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer appearance-none"
                                        />
                                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Час</label>
                                    <div className="relative w-full">
                                        {/* Visual Fake Input */}
                                        <div className="w-full h-12 flex items-center pl-4 pr-10 bg-surface-highlight border border-border rounded-xl text-text-primary text-base">
                                            {newTime}
                                        </div>
                                        {/* Invisible Real Input */}
                                        <input
                                            type="time"
                                            value={newTime}
                                            onChange={(e) => setNewTime(e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer appearance-none"
                                        />
                                        <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Хто проводить розспіванку</label>
                                <div className="relative w-full">
                                    <select
                                        value={newWarmupConductor}
                                        onChange={(e) => setNewWarmupConductor(e.target.value)}
                                        className="w-full h-12 pl-4 pr-10 bg-surface-highlight border border-border rounded-xl text-text-primary text-base appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    >
                                        <option value="">Не вказано</option>
                                        {regents.map((name, i) => (
                                            <option key={i} value={name}>{name}</option>
                                        ))}
                                    </select>
                                    <Mic2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
                                </div>
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                className="w-full py-4 bg-primary text-background font-bold rounded-xl mt-4 hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {creating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Створення...
                                    </>
                                ) : 'Створити'}
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
