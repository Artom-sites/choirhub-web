"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, X, Settings, Trash2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import { getChoirNotifications, markNotificationAsRead, deleteNotification, setServiceAttendance } from "@/lib/db";
import { ChoirNotification, Service } from "@/types";

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    canDelete?: boolean;
    services?: Service[];
    // FCM Props passed from parent (Single Source of Truth)
    permissionStatus: NotificationPermission | "unsupported" | "default";
    requestPermission: (caller?: string) => Promise<string | null>;
    unsubscribe: (caller?: string) => Promise<void>;
    isSupported: boolean;
    isGranted: boolean;
    isPreferenceEnabled: boolean;
    fcmLoading: boolean;
}

export default function NotificationsModal({
    isOpen,
    onClose,
    canDelete = false,
    services = [],
    permissionStatus,
    requestPermission,
    unsubscribe,
    isSupported,
    isGranted,
    isPreferenceEnabled,
    fcmLoading
}: NotificationsModalProps) {
    const { userData } = useAuth();
    const [notifications, setNotifications] = useState<ChoirNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [votingServiceId, setVotingServiceId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && userData?.choirId) {
            loadNotifications();
        }
        if (!isOpen) {
            setConfirmDeleteId(null);
        }
    }, [isOpen, userData?.choirId]);

    const loadNotifications = async () => {
        if (!userData?.choirId) return;
        setLoading(true);
        try {
            const data = await getChoirNotifications(userData.choirId);
            setNotifications(data);

            // Mark unread as read
            if (userData.id) {
                const unread = data.filter((n: ChoirNotification) => !n.readBy?.includes(userData.id!));
                unread.forEach((n: ChoirNotification) => {
                    markNotificationAsRead(userData.choirId, n.id, userData.id!);
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (notificationId: string) => {
        if (!userData?.choirId) return;
        setDeletingId(notificationId);
        try {
            await deleteNotification(userData.choirId, notificationId);
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            setConfirmDeleteId(null);
        } catch (error) {
            console.error("Failed to delete notification:", error);
            alert("Не вдалося видалити повідомлення");
        } finally {
            setDeletingId(null);
        }
    };

    const handleVote = async (serviceId: string, status: 'present' | 'absent') => {
        if (!userData?.choirId || !userData?.id) return;
        setVotingServiceId(serviceId);
        try {
            await setServiceAttendance(userData.choirId, serviceId, userData.id, status);
        } catch (error) {
            console.error("Voting failed:", error);
            alert("Помилка при збереженні відповіді");
        } finally {
            setVotingServiceId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-surface w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <Bell className="w-5 h-5" />
                        Сповіщення
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-xl transition-colors ${showSettings ? 'bg-accent text-white' : 'hover:bg-surface-highlight text-text-secondary'}`}
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-surface-highlight rounded-xl text-text-secondary">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {showSettings ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-surface-highlight rounded-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-text-primary">Пуш-сповіщення</p>
                                    <p className="text-xs text-text-secondary mt-1">Отримувати сповіщення на цей пристрій</p>
                                </div>
                                {isPreferenceEnabled ? (
                                    <button
                                        onClick={() => unsubscribe("NotificationsModalButton")}
                                        disabled={fcmLoading}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${!isGranted && !fcmLoading ? "bg-amber-400" : "bg-green-500"
                                            }`}
                                    >
                                        <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => requestPermission("NotificationsModalSettings")}
                                        disabled={fcmLoading || permissionStatus === "denied"}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${permissionStatus === "denied" ? "bg-red-400 cursor-not-allowed" : "bg-gray-200"
                                            }`}
                                    >
                                        <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
                                    </button>
                                )}
                            </div>

                            {!isSupported && !Capacitor.isNativePlatform() && (
                                <p className="text-xs text-red-400 mt-2">
                                    Ваш браузер не підтримує пуш-сповіщення
                                </p>
                            )}

                            {permissionStatus === "denied" && (
                                <p className="text-xs text-amber-400 mt-2">
                                    Сповіщення заблоковані в налаштуваннях браузера
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto min-h-[200px]">
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-text-secondary">
                                <BellOff className="w-10 h-10 mb-3 opacity-20" />
                                <p>Немає сповіщень</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notifications.map(n => (
                                    <div key={n.id} className="p-4 bg-surface-highlight rounded-2xl relative">
                                        {/* Delete confirmation overlay */}
                                        {confirmDeleteId === n.id && (
                                            <div className="absolute inset-0 bg-surface-highlight/95 backdrop-blur-sm rounded-2xl flex items-center justify-center gap-3 z-10 p-4">
                                                <span className="text-sm text-text-primary font-medium">Видалити?</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(n.id);
                                                    }}
                                                    disabled={deletingId === n.id}
                                                    className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors active:scale-95 min-w-[60px] flex items-center justify-center"
                                                >
                                                    {deletingId === n.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Так"}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmDeleteId(null);
                                                    }}
                                                    className="px-4 py-2 bg-surface border border-border text-text-primary text-sm font-medium rounded-xl hover:bg-surface/80 transition-colors active:scale-95"
                                                >
                                                    Ні
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex items-start justify-between mb-1">
                                            <h4 className="font-bold text-text-primary flex-1">{n.title}</h4>
                                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                <span className="text-[10px] text-text-secondary">
                                                    {new Date(n.createdAt).toLocaleDateString()}
                                                </span>
                                                {canDelete && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            setConfirmDeleteId(n.id);
                                                        }}
                                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors active:scale-90 -mr-1"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-text-secondary leading-relaxed bg-surface/50 p-2 rounded-lg">
                                            {n.body}
                                        </p>

                                        {/* Voting Buttons */}
                                        {n.enableVoting && n.serviceId && (
                                            <div className="mt-3">
                                                {(() => {
                                                    const service = services.find(s => s.id === n.serviceId);
                                                    if (!service) {
                                                        return <p className="text-xs text-text-secondary/60 italic">Служіння видалено або не знайдено</p>;
                                                    }
                                                    if (service.isFinalized) {
                                                        return <p className="text-xs text-text-secondary/60 italic">Служіння закрито (статистика збережена)</p>;
                                                    }

                                                    const isPresent = userData?.id ? service.confirmedMembers?.includes(userData.id) : false;
                                                    const isAbsent = userData?.id ? service.absentMembers?.includes(userData.id) : false;

                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!isPresent) handleVote(n.serviceId!, 'present');
                                                                }}
                                                                disabled={votingServiceId === n.serviceId || isPresent}
                                                                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${isPresent
                                                                    ? 'bg-primary text-background cursor-default'
                                                                    : 'bg-surface border border-accent/20 text-accent hover:bg-accent/10 active:scale-95'
                                                                    }`}
                                                            >
                                                                {votingServiceId === n.serviceId && !isPresent && !isAbsent ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Буду"}
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!isAbsent) handleVote(n.serviceId!, 'absent');
                                                                }}
                                                                disabled={votingServiceId === n.serviceId || isAbsent}
                                                                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${isAbsent
                                                                    ? 'bg-red-500 text-white cursor-default'
                                                                    : 'bg-surface border border-red-500/20 text-red-500 hover:bg-red-500/10 active:scale-95'
                                                                    }`}
                                                            >
                                                                {votingServiceId === n.serviceId && !isPresent && !isAbsent ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Не буду"}
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-[10px] text-text-secondary/50">
                                                Від: {n.senderName}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
