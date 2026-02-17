"use client";

import { ReactNode } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: ReactNode;
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
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-surface w-full max-w-sm rounded-3xl border border-border p-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Icon */}
                {isDestructive && (
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                )}

                <h3 className="text-xl font-bold text-text-primary text-center mb-2">{title}</h3>
                <div className="text-text-secondary text-center mb-8">{message}</div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${isDestructive
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-primary hover:opacity-90 text-background"
                            }`}
                    >
                        {isDestructive && <Trash2 className="w-4 h-4" />}
                        {confirmLabel}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-surface-highlight border border-border text-text-primary rounded-2xl hover:bg-surface-highlight/80 transition-colors font-medium"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
