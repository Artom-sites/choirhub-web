"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

interface ToastProps {
    message: string | null;
    onClose: () => void;
    type?: "success" | "error" | "info";
    duration?: number;
}

export default function Toast({ message, onClose, type = "success", duration = 3000 }: ToastProps) {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [message, duration, onClose]);

    return (
        <AnimatePresence>
            {message && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    className="fixed bottom-24 left-4 right-4 z-[70] flex justify-center pointer-events-none"
                >
                    <div
                        className={`
                            px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium max-w-[90%] flex items-center gap-3 pointer-events-auto
                            ${type === 'error' ? 'bg-red-500 text-white' : 'bg-white text-black'}
                        `}
                    >
                        {type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {type === 'error' && <AlertCircle className="w-5 h-5 text-white" />}

                        <span>{message}</span>

                        <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
