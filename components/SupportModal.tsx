"use client";

import { X, Heart, Copy, Check, ExternalLink, CreditCard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface SupportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SupportModal({ isOpen, onClose }: SupportModalProps) {
    const [copied, setCopied] = useState(false);
    const JAR_LINK = "https://send.monobank.ua/jar/99DzJJMxxq";
    const CARD_NUMBER = "4874 1000 2452 9433";

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(CARD_NUMBER.replace(/\s/g, ''));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative bg-[#18181b] border border-white/10 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Header with Heart Icon */}
                    <div className="p-6 pb-0 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-pink-900/40">
                            <Heart className="w-8 h-8 text-white fill-white animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Підтримка MyChoir</h2>
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6 text-center">
                        <div className="space-y-2">
                            <p className="text-white font-medium">
                                Додаток створюється волонтерами.
                            </p>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                Якщо хочете підтримати — це допоможе з оплатою серверів та подальшим розвитком функцій.
                            </p>
                        </div>

                        {/* Target Progress (Optional visual) */}
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-left">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-xs text-text-secondary font-bold uppercase tracking-wider">Ціль збору</span>
                                <span className="text-sm font-bold text-white">50 000 ₴</span>
                            </div>
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 w-[5%] min-w-[5px]" />
                            </div>
                            <p className="text-[10px] text-text-secondary mt-2 text-center">
                                На сервери, базу даних та R2 Storage
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <a
                                href={JAR_LINK}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-pink-900/30 transition-all active:scale-95"
                            >
                                <ExternalLink className="w-5 h-5" />
                                Поповнити Банку
                            </a>

                            <div className="relative">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <CreditCard className="w-5 h-5 text-text-secondary" />
                                </div>
                                <div className="w-full py-3 pl-10 pr-12 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm tracking-wide">
                                    {CARD_NUMBER}
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-text-secondary hover:text-white transition-colors"
                                >
                                    {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="text-xs text-text-secondary/50">
                                Натисніть на значок копіювання, щоб скопіювати номер
                            </p>
                        </div>
                    </div>

                    <div className="p-4 border-t border-white/5 bg-[#18181b]">
                        <button
                            onClick={onClose}
                            className="w-full py-3 text-text-secondary font-bold rounded-xl hover:bg-white/5 transition-colors text-sm"
                        >
                            Закрити
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
