"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, X, Settings } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import { getChoirNotifications, markNotificationAsRead } from "@/lib/db";
import { ChoirNotification } from "@/types";
import { useFcmToken } from "@/hooks/useFcmToken";

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
    const { userData } = useAuth();
    const [notifications, setNotifications] = useState<ChoirNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

    // FCM Settings
    const {
        permissionStatus,
        loading: fcmLoading,
        requestPermission,
        isSupported,
        isGranted,
    } = useFcmToken();

    useEffect(() => {
        if (isOpen && userData?.choirId) {
            loadNotifications();
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
                                {isGranted ? (
                                    <span className="px-3 py-1 bg-green-500/20 text-green-500 rounded-full text-xs font-bold">Увімкнено</span>
                                ) : (
                                    <button
                                        onClick={requestPermission}
                                        disabled={fcmLoading || permissionStatus === "denied"}
                                        className="px-3 py-1 bg-primary text-background rounded-full text-xs font-bold"
                                    >
                                        Увімкнути
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
                                    <div key={n.id} className="p-4 bg-surface-highlight rounded-2xl">
                                        <div className="flex items-start justify-between mb-1">
                                            <h4 className="font-bold text-text-primary">{n.title}</h4>
                                            <span className="text-[10px] text-text-secondary">
                                                {new Date(n.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-text-secondary leading-relaxed bg-surface/50 p-2 rounded-lg">
                                            {n.body}
                                        </p>
                                        <div className="mt-2 flex items-center justify-between">
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
