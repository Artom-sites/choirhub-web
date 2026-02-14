import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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

    if (!isOpen) return null;

    const handleSend = async () => {
        if (!title.trim() || !body.trim() || !user || !userData?.choirId) return;

        setLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/send-notification", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: title.trim(),
                    body: body.trim(),
                    choirId: userData.choirId
                })
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
                setTitle("");
                setBody("");
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

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            Заголовок
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

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-surface-highlight text-text-primary font-medium rounded-xl hover:bg-surface transition-colors"
                        >
                            Скасувати
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={loading || !title.trim() || !body.trim()}
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
