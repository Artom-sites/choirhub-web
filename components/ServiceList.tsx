"use client";

import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { getServices, addService, deleteService, setServiceAttendance, getChoir } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { Calendar, Plus, ChevronRight, X, Trash2, Loader2, Check, Clock, Mic2, CheckCircle2, Circle, Music } from "lucide-react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { getFirestoreLazy } from "@/lib/firebase";
import { Service } from "@/types";
import ConfirmationModal from "./ConfirmationModal";
import TrashBin from "./TrashBin";
import SwipeableCard, { SwipeableCardRef } from "./SwipeableCard";
import { useRef } from "react";
import RecurringScheduleModal from "./RecurringScheduleModal";
import { Settings } from "lucide-react";

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
    const { t, language } = useTranslation();
    const effectiveCanEdit = canEdit;

    // Local-to-prop state mapping
    const [localShowCreateModal, setLocalShowCreateModal] = useState(false);
    const showCreateModal = propsShowCreateModal ?? localShowCreateModal;
    const setShowCreateModal = propsSetShowCreateModal ?? setLocalShowCreateModal;
    const [votingLoading, setVotingLoading] = useState<string | null>(null);
    const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
    const cardRefs = useRef<Record<string, SwipeableCardRef | null>>({});

    // Persist archive tab state so returning from a service doesn't reset it
    const [showArchive, setShowArchive] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('showArchive') === 'true';
        }
        return false;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('showArchive', showArchive.toString());
        }
    }, [showArchive]);

    const [showTrashBin, setShowTrashBin] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    // Create form
    const [newTitle, setNewTitle] = useState(t('services.create.default_title') || "Співанка");
    const [newType, setNewType] = useState<'service' | 'rehearsal'>('rehearsal');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newTime, setNewTime] = useState("");
    const [newWarmupConductor, setNewWarmupConductor] = useState("");
    const [showCustomWarmup, setShowCustomWarmup] = useState(false);

    // Set current time when the modal opens
    useEffect(() => {
        if (showCreateModal) {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            setNewTime(`${hours}:${minutes}`);
        }
    }, [showCreateModal]);
    const [regents, setRegents] = useState<string[]>([]);

    useEffect(() => {
        if (!userData?.choirId) return;
        getChoir(userData.choirId).then(c => {
            if (c) {
                const list = Array.from(new Set([
                    ...(c.regents || []),
                    ...(c.knownConductors || []),
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
            if (services.length > 0) {
                const updated = services.map(s => {
                    if (s.id !== serviceId) return s;
                    let c = [...(s.confirmedMembers || [])].filter(id => id !== user.uid);
                    let a = [...(s.absentMembers || [])].filter(id => id !== user.uid);
                    if (status === 'present') c.push(user.uid);
                    else if (status === 'absent') a.push(user.uid);
                    return { ...s, confirmedMembers: c, absentMembers: a };
                });
                import('@/lib/widgetSync').then(m => m.syncWidgetNearestService(updated, { id: userData?.choirId } as any)).catch(console.error);
            }
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
                type: newType,
                date: newDate,
                songs: [],
                attendanceReminderSent: false,
                attendanceReminderRetryCount: 0
            };
            if (newTime) serviceData.time = newTime;
            if (newWarmupConductor) serviceData.warmupConductor = newWarmupConductor;

            const tempId = 'temp_' + Date.now();
            if (services) {
                import('@/lib/widgetSync').then(m => m.syncWidgetNearestService([...services, { ...serviceData, id: tempId } as any], { id: userData?.choirId } as any)).catch(console.error);
            }

            await addService(userData.choirId, serviceData);

            setShowCreateModal(false);
            setNewTitle(t('services.create.default_title') || "Співанка");
            setNewType('rehearsal');
            setNewDate(new Date().toISOString().split('T')[0]);
            setNewTime("");
            setNewWarmupConductor("");
            setShowCustomWarmup(false);
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
        if (services) {
            const updated = services.filter(s => s.id !== serviceToDelete);
            import('@/lib/widgetSync').then(m => m.syncWidgetNearestService(updated, { id: userData?.choirId } as any)).catch(console.error);
        }
        await deleteService(userData.choirId, serviceToDelete);
        setServiceToDelete(null);
    };

    const cancelDelete = () => {
        if (serviceToDelete && cardRefs.current[serviceToDelete]) {
            cardRefs.current[serviceToDelete]?.reset();
        }
        setServiceToDelete(null);
    }

    const formatDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const localeMap: Record<string, string> = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU', de: 'de-DE' };
        const activeLocale = localeMap[language] || 'uk-UA';
        return new Intl.DateTimeFormat(activeLocale, {
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
        <div className="max-w-5xl mx-auto px-4 pb-4 space-y-6">

            {/* Header with Archive Toggle - Spacious & Clean */}
            <div className="sticky top-[calc(4rem_+_env(safe-area-inset-top))] bg-background/95 backdrop-blur-md pt-3 pb-3 -mx-4 px-4 mb-4 z-40 flex items-center justify-between border-b border-border">
                <h2 className="text-lg font-bold text-text-primary">
                    {showArchive ? t('services.list.archive') : t('services.list.upcoming')}
                </h2>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowArchive(!showArchive)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showArchive ? 'bg-primary text-background shadow-md' : 'text-text-secondary bg-surface hover:bg-surface-highlight hover:text-text-primary'}`}
                    >
                        {showArchive ? t('services.list.active') : t('services.list.archive')}
                    </button>

                    {effectiveCanEdit && !showArchive && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowScheduleModal(true)}
                                className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-surface-highlight transition-colors"
                                title="Розклад"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setShowTrashBin(true)}
                                className="p-2 rounded-lg text-text-secondary hover:text-red-400 hover:bg-surface-highlight transition-colors"
                                title="Корзина"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
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

                const upcomingServices = services.filter(s => {
                    const [y, m, d] = s.date.split('-').map(Number);
                    return new Date(y, m - 1, d) >= today;
                });
                const pastServices = services.filter(s => {
                    const [y, m, d] = s.date.split('-').map(Number);
                    return new Date(y, m - 1, d) < today;
                });

                const displayServices = showArchive ? pastServices : upcomingServices;

                if (displayServices.length === 0) {
                    return (
                        <div className="text-center py-20 bg-surface rounded-2xl mx-2 card-shadow">
                            <div className="w-16 h-16 bg-surface-highlight rounded-2xl flex items-center justify-center mx-auto mb-4 text-text-secondary">
                                <Calendar className="w-8 h-8" />
                            </div>
                            <p className="text-text-secondary font-medium">
                                {showArchive ? t('services.list.empty') : t('services.list.empty')}
                            </p>
                            {!showArchive && effectiveCanEdit && (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="mt-6 px-6 py-3 bg-primary text-background hover:opacity-90 transition-colors font-bold text-sm rounded-xl"
                                >
                                    {t('services.list.create_first')}
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
                                        ref={el => { cardRefs.current[service.id] = el; }}
                                        onDelete={() => setServiceToDelete(service.id)}
                                        disabled={!effectiveCanEdit}
                                        className="rounded-2xl h-full"
                                        contentClassName=""
                                        backgroundClassName="rounded-2xl"
                                        disableFullSwipe={!Capacitor.isNativePlatform()}
                                    >
                                        <div
                                            onClick={() => onSelectService(service)}
                                            className={`relative group rounded-2xl transition-all cursor-pointer h-full flex flex-col card-shadow ${isToday(service.date) ? 'bg-surface ring-1 ring-primary/30' : 'bg-surface'}`}
                                        >

                                            <div className="p-5 flex-1 flex flex-col">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-[11px] font-bold uppercase tracking-widest mb-1.5 ${isToday(service.date) ? 'text-primary' : 'text-text-secondary'}`}>
                                                            {isToday(service.date) ? t('services.list.today') : formatDate(service.date)}
                                                        </p>
                                                        <h3 className="text-lg font-bold text-text-primary leading-tight">{service.title}</h3>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-text-secondary/50 group-hover:text-text-primary transition-colors flex-shrink-0 mt-1" />
                                                </div>

                                                <div className="flex items-center gap-3 mt-3">
                                                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                                                        <Music className="w-3.5 h-3.5" />
                                                        <span>{t('services.item.songsCount', { count: (service.songs || []).length })}</span>
                                                    </div>
                                                    {service.time && (
                                                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            <span>{service.time}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Finalization badge - only in archive view */}
                                                {showArchive && effectiveCanEdit && (() => {
                                                    const hasAttendanceData = service.isFinalized ||
                                                        (service.absentMembers && service.absentMembers.length > 0);
                                                    return hasAttendanceData ? (
                                                        <div className="flex items-center gap-1.5 mt-2 text-xs text-green-400">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            <span>{t('services.attendance_saved')}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            <span>{t('services.open_to_save')}</span>
                                                        </div>
                                                    );
                                                })()}

                                                {isFuture && (
                                                    <div className="flex gap-2 mt-4 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
                                                        {(status === 'unknown' || status === 'present') && (
                                                            <button
                                                                onClick={(e) => handleVote(e, service.id, 'present')}
                                                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${status === 'present' ? 'bg-success text-white ring-2 ring-success/50' : 'bg-background text-text-secondary hover:bg-surface-highlight'}`}
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                {status === 'present' ? t('services.actions.will_be_present_active') : t('services.actions.will_be_present')}
                                                            </button>
                                                        )}

                                                        {(status === 'unknown' || status === 'absent') && (
                                                            <button
                                                                onClick={(e) => handleVote(e, service.id, 'absent')}
                                                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${status === 'absent' ? 'bg-danger/20 text-danger ring-1 ring-danger/50' : 'bg-background text-text-secondary hover:bg-surface-highlight'}`}
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                {t('services.actions.will_not_be_present')}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
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
                                {t('archive.loading')}
                            </>
                        ) : (
                            <>
                                <Clock className="w-4 h-4" />
                                {t('archive.load_more')}
                            </>
                        )}
                    </button>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!serviceToDelete}
                onClose={cancelDelete}
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
                            <h3 className="text-xl font-bold text-text-primary">{t('services.new')}</h3>
                            <button onClick={() => setShowCreateModal(false)}>
                                <X className="w-6 h-6 text-text-secondary hover:text-text-primary" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Type Toggle */}
                            <div className="flex bg-surface-highlight border border-border rounded-xl p-1 gap-1 w-full">
                                <button
                                    onClick={() => {
                                        setNewType('service');
                                        if (newTitle === t('services.create.default_title') || newTitle === t('services.create.tab_rehearsal')) setNewTitle(t('services.create.tab_service'));
                                    }}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newType === 'service'
                                        ? 'bg-primary text-background shadow-sm'
                                        : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                >
                                    {t('services.create.tab_service')}
                                </button>
                                <button
                                    onClick={() => {
                                        setNewType('rehearsal');
                                        if (newTitle === t('services.create.tab_service')) setNewTitle(t('services.create.default_title'));
                                    }}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newType === 'rehearsal'
                                        ? 'bg-primary text-background shadow-sm'
                                        : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                >
                                    {t('services.create.tab_rehearsal')}
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('services.title_label')}</label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('services.date_label')}</label>
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
                                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('services.time_label')}</label>
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
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('services.warmup_leader')}</label>
                                <div className="relative w-full">
                                    {!showCustomWarmup ? (
                                        <>
                                            <select
                                                value={newWarmupConductor}
                                                onChange={(e) => {
                                                    if (e.target.value === '__ADD_NEW__') {
                                                        setShowCustomWarmup(true);
                                                        setNewWarmupConductor('');
                                                    } else {
                                                        setNewWarmupConductor(e.target.value);
                                                    }
                                                }}
                                                className="w-full h-12 pl-4 pr-10 bg-surface-highlight border border-border rounded-xl text-text-primary text-base appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                            >
                                                <option value="">{t('services.not_specified')}</option>
                                                {regents.map((name, i) => (
                                                    <option key={i} value={name}>{name}</option>
                                                ))}
                                                {newWarmupConductor && !regents.includes(newWarmupConductor) && (
                                                    <option value={newWarmupConductor}>{newWarmupConductor}</option>
                                                )}
                                                <option value="__ADD_NEW__">➕ Новий регент...</option>
                                            </select>
                                            <Mic2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newWarmupConductor}
                                                onChange={(e) => setNewWarmupConductor(e.target.value)}
                                                placeholder="Новий регент"
                                                className="flex-1 h-12 pl-4 pr-4 bg-surface-highlight border border-primary/50 rounded-xl text-text-primary text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => setShowCustomWarmup(false)}
                                                className="p-3 text-text-secondary hover:text-text-primary bg-surface-highlight rounded-xl border border-border"
                                                title="Скасувати"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
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
                                ) : t('services.actions.create_button')}
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

            {/* Recurring Schedule */}
            {showScheduleModal && userData?.choirId && (
                <RecurringScheduleModal
                    isOpen={showScheduleModal}
                    onClose={() => setShowScheduleModal(false)}
                    choirId={userData.choirId}
                />
            )}
        </div>
    );
}
