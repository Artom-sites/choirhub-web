"use client";

import { X, ExternalLink, ShieldAlert, FileText, Music2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function LegalModal({ isOpen, onClose }: LegalModalProps) {
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
                    className="relative bg-[#18181b] border border-white/10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#18181b] sticky top-0 z-10">
                        <h2 className="text-xl font-bold text-white tracking-tight">Sources & Content</h2>
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-8">
                        {/* Section 1: Song Catalog */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-white font-bold text-lg">
                                <Music2 className="w-5 h-5 text-indigo-400" />
                                <h3>Song catalog</h3>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Каталог пісень у застосунку сформовано на основі відкритих матеріалів,
                                    опублікованих Музично-хоровим відділом МСЦ ЄХБ,
                                    та призначених для вільного використання в церковному служінні.
                                </p>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Застосунок не є власником музичних творів
                                    і не обмежує доступ до першоджерел.
                                </p>
                                <a
                                    href="https://mscmusic.org"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider mt-2"
                                >
                                    Перейти до джерела
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </section>

                        {/* Section 2: User Content */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-white font-bold text-lg">
                                <FileText className="w-5 h-5 text-amber-400" />
                                <h3>User content</h3>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Користувачі можуть додавати власні матеріали
                                    (ноти, тексти, PDF-файли) для приватного використання
                                    в межах свого хору або церковної спільноти.
                                </p>
                            </div>
                        </section>

                        {/* Section 3: Responsibility */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-white font-bold text-lg">
                                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                                <h3>Responsibility</h3>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Користувачі несуть відповідальність за контент,
                                    який вони додають або використовують у застосунку,
                                    та підтверджують, що мають право на його використання
                                    в межах церковного служіння.
                                </p>
                            </div>
                        </section>
                    </div>

                    <div className="p-6 border-t border-white/5 bg-[#18181b]">
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            Зрозуміло
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
