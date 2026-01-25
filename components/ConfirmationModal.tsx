"use client";

import { AlertTriangle, Trash2 } from "lucide-react";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Підтвердити",
    cancelLabel = "Скасувати",
    isDestructive = false
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-[#18181b] w-full max-w-sm rounded-3xl border border-white/10 p-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Icon */}
                {isDestructive && (
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                )}

                <h3 className="text-xl font-bold text-white text-center mb-2">{title}</h3>
                <p className="text-text-secondary text-center mb-8">{message}</p>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${isDestructive
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-white hover:bg-gray-200 text-black"
                            }`}
                    >
                        {isDestructive && <Trash2 className="w-4 h-4" />}
                        {confirmLabel}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl hover:bg-white/10 transition-colors font-medium"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
