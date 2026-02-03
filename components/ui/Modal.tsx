"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    icon?: "success" | "error" | "warning" | "info";
}

export function Modal({ isOpen, onClose, children, title, icon }: ModalProps) {
    const iconMap = {
        success: <CheckCircle className="w-12 h-12 text-green-500" />,
        error: <AlertCircle className="w-12 h-12 text-red-500" />,
        warning: <AlertTriangle className="w-12 h-12 text-amber-500" />,
        info: <Info className="w-12 h-12 text-blue-500" />,
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                    >
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md pointer-events-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                                {title && (
                                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                                        {title}
                                    </h3>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors ml-auto"
                                >
                                    <X className="w-5 h-5 text-zinc-500" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                {icon && (
                                    <div className="flex justify-center mb-4">
                                        {iconMap[icon]}
                                    </div>
                                )}
                                {children}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "success" | "warning" | "default";
    loading?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Підтвердити",
    cancelText = "Скасувати",
    variant = "default",
    loading = false
}: ConfirmModalProps) {
    const variantStyles = {
        danger: "bg-red-500 hover:bg-red-600 text-white",
        success: "bg-green-500 hover:bg-green-600 text-white",
        warning: "bg-amber-500 hover:bg-amber-600 text-white",
        default: "bg-primary hover:bg-primary-dark text-white",
    };

    const iconMap = {
        danger: <AlertCircle className="w-12 h-12 text-red-500" />,
        success: <CheckCircle className="w-12 h-12 text-green-500" />,
        warning: <AlertTriangle className="w-12 h-12 text-amber-500" />,
        default: <Info className="w-12 h-12 text-primary" />,
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                    >
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md pointer-events-auto overflow-hidden">
                            {/* Content */}
                            <div className="p-6 text-center">
                                <div className="flex justify-center mb-4">
                                    {iconMap[variant]}
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                                    {title}
                                </h3>
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    {message}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800">
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 rounded-xl font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    disabled={loading}
                                    className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 ${variantStyles[variant]}`}
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Обробка...
                                        </span>
                                    ) : confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    buttonText?: string;
    variant?: "success" | "error" | "warning" | "info";
}

export function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    buttonText = "OK",
    variant = "info"
}: AlertModalProps) {
    const iconMap = {
        success: <CheckCircle className="w-16 h-16 text-green-500" />,
        error: <AlertCircle className="w-16 h-16 text-red-500" />,
        warning: <AlertTriangle className="w-16 h-16 text-amber-500" />,
        info: <Info className="w-16 h-16 text-primary" />,
    };

    const buttonStyles = {
        success: "bg-green-500 hover:bg-green-600",
        error: "bg-red-500 hover:bg-red-600",
        warning: "bg-amber-500 hover:bg-amber-600",
        info: "bg-primary hover:bg-primary-dark",
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                    >
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm pointer-events-auto overflow-hidden">
                            <div className="p-8 text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", delay: 0.1 }}
                                    className="flex justify-center mb-4"
                                >
                                    {iconMap[variant]}
                                </motion.div>
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                                    {title}
                                </h3>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                                    {message}
                                </p>
                                <button
                                    onClick={onClose}
                                    className={`w-full px-4 py-3 rounded-xl font-medium text-white transition-colors ${buttonStyles[variant]}`}
                                >
                                    {buttonText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    title: string;
    message?: string;
    placeholder?: string;
    submitText?: string;
    cancelText?: string;
    loading?: boolean;
    required?: boolean;
}

export function InputModal({
    isOpen,
    onClose,
    onSubmit,
    title,
    message,
    placeholder = "",
    submitText = "Підтвердити",
    cancelText = "Скасувати",
    loading = false,
    required = false
}: InputModalProps) {
    const [value, setValue] = React.useState("");

    const handleSubmit = () => {
        if (required && !value.trim()) return;
        onSubmit(value);
        setValue("");
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                    >
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md pointer-events-auto overflow-hidden">
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                                    {title}
                                </h3>
                                {message && (
                                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                        {message}
                                    </p>
                                )}
                                <textarea
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    placeholder={placeholder}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                />
                            </div>

                            <div className="flex gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800">
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 rounded-xl font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || (required && !value.trim())}
                                    className="flex-1 px-4 py-3 rounded-xl font-medium bg-primary hover:bg-primary-dark text-white transition-colors disabled:opacity-50"
                                >
                                    {loading ? "Обробка..." : submitText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Need React for InputModal state
import React from "react";
