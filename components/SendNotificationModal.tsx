import { useState, useEffect } from "react";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getServices } from "@/lib/db";
import { Service } from "@/types";
import Toast from "./Toast";

interface SendNotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SendNotificationModal({ isOpen, onClose }: SendNotificationModalProps) {
    const { user, userData } = useAuth();
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [services, setServices] = useState<Service[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState<string>("");
    const [enableVoting, setEnableVoting] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);

    useEffect(() => {
        if (isOpen && userData?.choirId) {
            setLoadingServices(true);
            getServices(userData.choirId).then((allServices) => {
                const activeServices = allServices.filter(s => !s.isFinalized);
                activeServices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                setServices(activeServices);
                setLoadingServices(false);
            }).catch(e => {
                console.error("Failed to load services for notification:", e);
                setLoadingServices(false);
            });
        } else {
            setTitle("");
            setBody("");
            setSelectedServiceId("");
            setEnableVoting(false);
        }
    }, [isOpen, userData?.choirId]);

    if (!isOpen) return null;

    const handleSend = async () => {
        if (!body.trim() || !user || !userData?.choirId) return;

        setLoading(true);
        try {
            const token = await user.getIdToken();
            const selectedService = services.find(s => s.id === selectedServiceId);
            const payload: any = {
                title: title.trim(),
                body: body.trim(),
                choirId: userData.choirId
            };

            if (selectedServiceId && selectedService && enableVoting) {
                payload.serviceId = selectedServiceId;
                payload.serviceName = selectedService.title;
                payload.enableVoting = true;
            }

            const response = await fetch("/api/send-notification", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const text = await response.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch { data = { error: text || "Невідома помилка сервера" }; }

            if (!response.ok) {
                throw new Error(data.error || "Failed to send");
            }

            setToast({ message: "Сповіщення надіслано", type: "success" });

            setTimeout(() => {
                onClose();
                setToast(null);
            }, 2000);

        } catch (error: any) {
            console.error(error);
            setToast({ message: error.message || "Помилка відправки", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    Сповіщення хору
                </h3>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar pb-6 pr-2">
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Заголовок <span className="text-[10px] lowercase text-text-secondary/70 font-normal">(необов'язково)</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Наприклад: Зміна часу репетиції"
                            className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/30"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Текст повідомлення
                        </label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Введіть текст..."
                            rows={4}
                            className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/30 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Прив'язати до служіння (Опитування)
                        </label>
                        {loadingServices ? (
                            <div className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-secondary flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Завантаження...
                            </div>
                        ) : (
                            <select
                                value={selectedServiceId}
                                onChange={(e) => {
                                    setSelectedServiceId(e.target.value);
                                    if (!e.target.value) setEnableVoting(false);
                                }}
                                className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl text-text-primary focus:outline-none focus:border-accent/30 appearance-none"
                            >
                                <option value="">Без прив'язки</option>
                                {services.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {new Date(s.date).toLocaleDateString()} - {s.title}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {selectedServiceId && (
                        <div className="flex items-center gap-3 p-3 bg-surface-highlight rounded-xl border border-border/50">
                            <input
                                type="checkbox"
                                id="enableVotingToggle"
                                checked={enableVoting}
                                onChange={(e) => setEnableVoting(e.target.checked)}
                                className="w-5 h-5 rounded border-border text-primary focus:ring-primary focus:ring-offset-surface bg-background"
                            />
                            <label htmlFor="enableVotingToggle" className="text-sm font-medium text-text-primary cursor-pointer select-none">
                                Додати кнопки голосування <br />
                                <span className="text-xs text-text-secondary font-normal">("Буду" / "Не буду")</span>
                            </label>
                        </div>
                    )}

                    <div className="flex gap-3 mt-6 border-t border-border/10 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-surface-highlight text-text-primary font-medium rounded-xl hover:bg-surface transition-colors"
                        >
                            Скасувати
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={loading || !body.trim()}
                            className="flex-1 py-3 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Надіслати"}
                        </button>
                    </div>
                </div>
            </div>

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
