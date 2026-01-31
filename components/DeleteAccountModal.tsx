"use client";

import { useState } from "react";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export default function DeleteAccountModal({ isOpen, onClose, onConfirm }: DeleteAccountModalProps) {
    const [loading, setLoading] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleDelete = async () => {
        if (confirmText !== "ВИДАЛИТИ") {
            setError("Введіть слово ВИДАЛИТИ для підтвердження");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await onConfirm();
            // Modal will be closed by parent or navigation will happen
        } catch (e) {
            console.error(e);
            setError("Помилка видалення. Спробуйте ще раз.");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#18181b] border border-red-500/20 w-full max-w-sm p-6 rounded-3xl shadow-2xl relative overflow-hidden"
            >
                {/* Background red glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px] rounded-full pointer-events-none" />

                <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>

                    <h3 className="text-xl font-bold text-white">Видалити акаунт?</h3>
                    <p className="text-sm text-text-secondary">
                        Ця дія <span className="text-red-400 font-bold">незворотна</span>. Всі ваші дані, налаштування та історія будуть втрачені назавжди.
                    </p>

                    <div className="w-full pt-4 space-y-2">
                        <label className="text-xs text-text-secondary uppercase tracking-widest font-bold">
                            Для підтвердження введіть "ВИДАЛИТИ"
                        </label>
                        <input
                            value={confirmText}
                            onChange={(e) => { setConfirmText(e.target.value.toUpperCase()); setError(""); }}
                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-center text-white placeholder:text-white/20 focus:border-red-500/50 focus:outline-none transition-colors"
                            placeholder="ВИДАЛИТИ"
                        />
                        {error && <p className="text-red-400 text-xs font-bold animate-pulse">{error}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3 w-full pt-2">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors"
                        >
                            Скасувати
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={loading || confirmText !== "ВИДАЛИТИ"}
                            className="py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>
                                    <Trash2 className="w-5 h-5" />
                                    Видалити
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
