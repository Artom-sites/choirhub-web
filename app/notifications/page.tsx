"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Bell, BellOff, ChevronLeft, Loader2, Send, Settings, Trash2, X
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import { useFcmToken } from "@/hooks/useFcmToken";
import {
    getChoirNotifications, markNotificationAsRead, deleteNotification,
    setServiceAttendance, getServices, functions
} from "@/lib/db";
import { ChoirNotification, Service } from "@/types";
import Toast from "@/components/Toast";
import { httpsCallable } from "firebase/functions";

type Tab = "inbox" | "compose";

export default function NotificationsPage() {
    const router = useRouter();
    const { user, userData } = useAuth();
    const {
        permissionStatus, loading: fcmLoading, requestPermission,
        unsubscribe, isSupported, isGranted, isPreferenceEnabled
    } = useFcmToken();

    // Tab
    const [activeTab, setActiveTab] = useState<Tab>("inbox");
    const [showSettings, setShowSettings] = useState(false);

    // Permissions
    const canEdit = userData?.role === "head" || userData?.role === "regent";
    const canCompose = canEdit || (userData?.permissions?.includes("notify_members") ?? false);

    // ─── INBOX STATE ───
    const [notifications, setNotifications] = useState<ChoirNotification[]>([]);
    const [loadingInbox, setLoadingInbox] = useState(true);
    const [services, setServices] = useState<Service[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [votingServiceId, setVotingServiceId] = useState<string | null>(null);

    // ─── COMPOSE STATE ───
    const [body, setBody] = useState("");
    const [selectedServiceId, setSelectedServiceId] = useState("");
    const [enableVoting, setEnableVoting] = useState(false);
    const [sendLoading, setSendLoading] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // ─── LOAD INBOX ───
    const loadNotifications = useCallback(async () => {
        if (!userData?.choirId) return;
        setLoadingInbox(true);
        try {
            const data = await getChoirNotifications(userData.choirId);
            setNotifications(data);
            // Mark unread as read
            if (userData.id) {
                data.filter((n: ChoirNotification) => !n.readBy?.includes(userData.id!))
                    .forEach((n: ChoirNotification) => {
                        markNotificationAsRead(userData.choirId, n.id, userData.id!);
                    });
            }
        } catch (e) {
            console.error("[Notifications] Load error:", e);
        } finally {
            setLoadingInbox(false);
        }
    }, [userData?.choirId, userData?.id]);

    // Load on mount
    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    // Load services for voting context + compose dropdown
    useEffect(() => {
        if (!userData?.choirId) return;
        getServices(userData.choirId).then(all => {
            setServices(all.filter(s => !s.isFinalized));
        }).catch(console.error);
    }, [userData?.choirId]);

    // ─── INBOX ACTIONS ───
    const handleDelete = async (notificationId: string) => {
        if (!userData?.choirId) return;
        setDeletingId(notificationId);
        try {
            await deleteNotification(userData.choirId, notificationId);
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            setConfirmDeleteId(null);
        } catch (e) {
            console.error("Delete error:", e);
        } finally {
            setDeletingId(null);
        }
    };

    const handleVote = async (serviceId: string, status: "present" | "absent") => {
        if (!userData?.choirId || !userData?.id) return;
        setVotingServiceId(serviceId);
        try {
            await setServiceAttendance(userData.choirId, serviceId, userData.id, status);
            // Refresh services so buttons reflect new state
            const updated = await getServices(userData.choirId);
            setServices(updated.filter(s => !s.isFinalized));
        } catch (e) {
            console.error("Vote error:", e);
        } finally {
            setVotingServiceId(null);
        }
    };

    // ─── COMPOSE ───
    const handleSend = async () => {
        if (!body.trim() || !user || !userData?.choirId) return;
        setSendLoading(true);
        try {
            const selectedService = services.find(s => s.id === selectedServiceId);
            const payload: any = {
                body: body.trim(),
                choirId: userData.choirId
            };
            if (selectedServiceId && selectedService && enableVoting) {
                payload.serviceId = selectedServiceId;
                payload.serviceName = selectedService.title;
                payload.enableVoting = true;
            }
            const sendNotificationFn = httpsCallable(functions, "sendNotification");
            const result = await sendNotificationFn(payload);
            const data = result.data as any;
            if (!data.success) throw new Error(data.error || "Failed to send");

            setToast({ message: "Сповіщення надіслано", type: "success" });
            setBody("");
            setSelectedServiceId("");
            setEnableVoting(false);
            // Switch to inbox and reload
            setTimeout(() => {
                setActiveTab("inbox");
                loadNotifications();
            }, 1500);
        } catch (error: any) {
            console.error(error);
            setToast({ message: error.message || "Помилка відправки", type: "error" });
        } finally {
            setSendLoading(false);
        }
    };

    // ─── ANDROID BACK ───
    useEffect(() => {
        window.history.pushState({ page: "notifications" }, "");
        const onPop = () => router.back();
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, [router]);

    return (
        <div className="min-h-screen bg-background text-text-primary flex flex-col">
            {/* ─── HEADER ─── */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border pt-[env(safe-area-inset-top)]">
                <div className="flex items-center justify-between px-4 h-14">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-highlight transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold">Сповіщення</h1>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showSettings ? "bg-primary text-background" : "hover:bg-surface-highlight text-text-secondary"
                            }`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                {/* ─── TABS (hidden when settings open) ─── */}
                {!showSettings && (
                    <div className="flex px-4 pb-2 gap-1">
                        {([
                            { id: "inbox" as Tab, label: "Вхідні", icon: <Bell className="w-4 h-4" /> },
                            ...(canCompose ? [{ id: "compose" as Tab, label: "Написати", icon: <Send className="w-4 h-4" /> }] : []),
                        ]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === tab.id
                                    ? "bg-primary text-background"
                                    : "bg-surface-highlight text-text-secondary hover:text-text-primary"
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── CONTENT ─── */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {/* SETTINGS PANEL */}
                {showSettings && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="p-4 bg-surface rounded-2xl card-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-text-primary">Пуш-сповіщення</p>
                                    <p className="text-xs text-text-secondary mt-1">Отримувати сповіщення на цей пристрій</p>
                                </div>
                                {isPreferenceEnabled ? (
                                    <button
                                        onClick={() => unsubscribe("NotificationsPage")}
                                        disabled={fcmLoading}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${!isGranted && !fcmLoading ? "bg-amber-400" : "bg-green-500"}`}
                                    >
                                        <span className="translate-x-6 inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => requestPermission("NotificationsPage")}
                                        disabled={fcmLoading || permissionStatus === "denied"}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${permissionStatus === "denied" ? "bg-red-400 cursor-not-allowed" : "bg-gray-600"}`}
                                    >
                                        <span className="translate-x-1 inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm" />
                                    </button>
                                )}
                            </div>

                            {!isSupported && !Capacitor.isNativePlatform() && (
                                <p className="text-xs text-red-400 mt-3">
                                    Ваш браузер не підтримує пуш-сповіщення
                                </p>
                            )}

                            {permissionStatus === "denied" && (
                                <div className="mt-3 p-3 bg-amber-500/10 rounded-xl space-y-1">
                                    <p className="text-xs text-amber-400 font-medium">
                                        Сповіщення заблоковані в налаштуваннях пристрою
                                    </p>
                                    <p className="text-[11px] text-text-secondary">
                                        {/iPad|iPhone|iPod/.test(navigator.userAgent) && (window as any).Capacitor
                                            ? "Налаштування → MyChoir → Сповіщення → Увімкнути"
                                            : /iPad|iPhone|iPod/.test(navigator.userAgent)
                                                ? "Налаштування → Safari → Сповіщення → MyChoir → Дозволити"
                                                : "Відкрийте налаштування браузера для цього сайту і дозвольте сповіщення."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* INBOX TAB */}
                {!showSettings && activeTab === "inbox" && (
                    <div className="animate-in fade-in duration-200">
                        {loadingInbox ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
                                <BellOff className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm">Немає сповіщень</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notifications.map(n => (
                                    <div key={n.id} className="p-4 bg-surface rounded-2xl card-shadow relative">
                                        {/* Delete confirmation overlay */}
                                        {confirmDeleteId === n.id && (
                                            <div className="absolute inset-0 bg-surface/95 backdrop-blur-sm rounded-2xl flex items-center justify-center gap-3 z-10 p-4">
                                                <span className="text-sm text-text-primary font-medium">Видалити?</span>
                                                <button
                                                    onClick={() => handleDelete(n.id)}
                                                    disabled={deletingId === n.id}
                                                    className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors active:scale-95 min-w-[60px] flex items-center justify-center"
                                                >
                                                    {deletingId === n.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Так"}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="px-4 py-2 bg-surface-highlight border border-border text-text-primary text-sm font-medium rounded-xl"
                                                >
                                                    Ні
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex items-center mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                                {userData?.choirName || "Хор"}
                                            </span>
                                        </div>

                                        <div className="flex items-start justify-between mb-1">
                                            <h4 className="font-bold text-text-primary flex-1">{n.title}</h4>
                                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                <span className="text-[10px] text-text-secondary">
                                                    {new Date(n.createdAt).toLocaleDateString()}
                                                </span>
                                                {canCompose && (
                                                    <button
                                                        onClick={() => setConfirmDeleteId(n.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors active:scale-90 -mr-1"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <p className="text-sm text-text-secondary leading-relaxed bg-surface-highlight/50 p-2.5 rounded-lg">
                                            {n.body}
                                        </p>

                                        {/* Voting Buttons */}
                                        {n.enableVoting && n.serviceId && (() => {
                                            const service = services.find(s => s.id === n.serviceId);
                                            if (!service) return <p className="text-xs text-text-secondary/60 italic mt-3">Служіння видалено або не знайдено</p>;
                                            if (service.isFinalized) return <p className="text-xs text-text-secondary/60 italic mt-3">Служіння закрито (статистика збережена)</p>;

                                            const isPresent = userData?.id ? service.confirmedMembers?.includes(userData.id) : false;
                                            const isAbsent = userData?.id ? service.absentMembers?.includes(userData.id) : false;

                                            const [sy, sm, sd] = service.date.split('-').map(Number);
                                            const serviceDate = new Date(sy, sm - 1, sd).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

                                            return (
                                                <div className="mt-3 space-y-2">
                                                    <p className="text-[11px] text-text-secondary font-medium">
                                                        🗓 {service.title} — {serviceDate}{service.time ? `, ${service.time}` : ''}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => { if (!isPresent) handleVote(n.serviceId!, "present"); }}
                                                            disabled={votingServiceId === n.serviceId || isPresent}
                                                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${isPresent
                                                                ? "bg-primary text-background cursor-default"
                                                                : "bg-surface-highlight border border-accent/20 text-accent hover:bg-accent/10 active:scale-95"
                                                                }`}
                                                        >
                                                            {votingServiceId === n.serviceId && !isPresent && !isAbsent
                                                                ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Буду"}
                                                        </button>
                                                        <button
                                                            onClick={() => { if (!isAbsent) handleVote(n.serviceId!, "absent"); }}
                                                            disabled={votingServiceId === n.serviceId || isAbsent}
                                                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${isAbsent
                                                                ? "bg-red-500 text-white cursor-default"
                                                                : "bg-surface-highlight border border-red-500/20 text-red-500 hover:bg-red-500/10 active:scale-95"
                                                                }`}
                                                        >
                                                            {votingServiceId === n.serviceId && !isPresent && !isAbsent
                                                                ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Не буду"}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-[10px] text-text-secondary/50">Від: {n.senderName}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* COMPOSE TAB */}
                {!showSettings && activeTab === "compose" && canCompose && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <div>
                            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                Текст повідомлення
                            </label>
                            <textarea
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                placeholder="Введіть текст..."
                                rows={4}
                                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/30 resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                Прив'язати до служіння (Опитування)
                            </label>
                            {loadingServices ? (
                                <div className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-secondary flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Завантаження...
                                </div>
                            ) : (
                                <select
                                    value={selectedServiceId}
                                    onChange={e => {
                                        setSelectedServiceId(e.target.value);
                                        if (!e.target.value) setEnableVoting(false);
                                    }}
                                    className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-accent/30 appearance-none"
                                >
                                    <option value="">Без прив'язки</option>
                                    {services.map(s => {
                                        const [y, m, d] = s.date.split("-").map(Number);
                                        return (
                                            <option key={s.id} value={s.id}>
                                                {new Date(y, m - 1, d).toLocaleDateString()} - {s.title}
                                            </option>
                                        );
                                    })}
                                </select>
                            )}
                        </div>

                        {selectedServiceId && (
                            <div className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border/50">
                                <input
                                    type="checkbox"
                                    id="enableVotingToggle"
                                    checked={enableVoting}
                                    onChange={e => setEnableVoting(e.target.checked)}
                                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary focus:ring-offset-surface bg-background"
                                />
                                <label htmlFor="enableVotingToggle" className="text-sm font-medium text-text-primary cursor-pointer select-none">
                                    Додати кнопки голосування <br />
                                    <span className="text-xs text-text-secondary font-normal">("Буду" / "Не буду")</span>
                                </label>
                            </div>
                        )}

                        <button
                            onClick={handleSend}
                            disabled={sendLoading || !body.trim()}
                            className="w-full py-3.5 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
                        >
                            {sendLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            Надіслати
                        </button>
                    </div>
                )}
            </div>

            {/* SafeArea bottom */}
            <div className="safe-area-bottom" />

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
