"use client";

import { X, ExternalLink, ShieldAlert, FileText, Music2, Scale, Lock, Copyright } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function LegalModal({ isOpen, onClose }: LegalModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
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
                        className="relative bg-surface border border-border w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border flex items-center justify-between bg-surface sticky top-0 z-10">
                            <h2 className="text-xl font-bold text-text-primary tracking-tight">Джерела та контент</h2>
                            <button
                                onClick={onClose}
                                className="p-2 bg-surface-highlight hover:bg-border rounded-full transition-colors text-text-secondary hover:text-text-primary"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Section 1: Song Catalog */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                                    <Music2 className="w-5 h-5 text-indigo-400" />
                                    <h3>Каталог пісень</h3>
                                </div>
                                <div className="p-4 bg-surface-highlight rounded-2xl border border-border space-y-3">
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Каталог пісень у застосунку сформовано на основі відкритих матеріалів,
                                        опублікованих Музично-хоровим відділом МСЦ ЄХБ (Міжнародний союз церков
                                        євангельських християн-баптистів).
                                    </p>
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Ці матеріали призначені для вільного використання в церковному служінні
                                        та доступні на офіційному сайті організації.
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

                            {/* Section 2: Copyright */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                                    <Copyright className="w-5 h-5 text-purple-400" />
                                    <h3>Авторські права</h3>
                                </div>
                                <div className="p-4 bg-surface-highlight rounded-2xl border border-border space-y-3">
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Застосунок не є власником музичних творів і не претендує на авторські права.
                                        Всі права на оригінальні твори належать їх авторам та правовласникам.
                                    </p>
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Ми лише надаємо зручний інтерфейс для доступу до матеріалів,
                                        які вже є у відкритому доступі.
                                    </p>
                                </div>
                            </section>

                            {/* Section 3: User Content */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                                    <FileText className="w-5 h-5 text-amber-400" />
                                    <h3>Користувацький контент</h3>
                                </div>
                                <div className="p-4 bg-surface-highlight rounded-2xl border border-border space-y-3">
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Користувачі можуть додавати власні матеріали (ноти, тексти, PDF-файли, аудіо)
                                        для використання в межах свого хору або церковної спільноти.
                                    </p>
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Завантажений контент зберігається на захищених серверах і доступний
                                        лише учасникам відповідного хору.
                                    </p>
                                </div>
                            </section>

                            {/* Section 4: Data Protection */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                                    <Lock className="w-5 h-5 text-cyan-400" />
                                    <h3>Захист даних</h3>
                                </div>
                                <div className="p-4 bg-surface-highlight rounded-2xl border border-border space-y-3">
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Ваші дані зашифровані та зберігаються на серверах Google Firebase
                                        та Cloudflare з дотриманням стандартів GDPR.
                                    </p>
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Ми не передаємо ваші персональні дані третім сторонам
                                        для маркетингових або комерційних цілей.
                                    </p>
                                </div>
                            </section>

                            {/* Section 5: Responsibility */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                                    <ShieldAlert className="w-5 h-5 text-emerald-400" />
                                    <h3>Відповідальність</h3>
                                </div>
                                <div className="p-4 bg-surface-highlight rounded-2xl border border-border space-y-3">
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Користувачі несуть відповідальність за контент, який вони додають
                                        або використовують у застосунку.
                                    </p>
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Завантажуючи матеріали, ви підтверджуєте, що маєте право
                                        на їх використання в межах церковного служіння та некомерційних цілей.
                                    </p>
                                </div>
                            </section>

                            {/* Section 6: Legal */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                                    <Scale className="w-5 h-5 text-rose-400" />
                                    <h3>Правова інформація</h3>
                                </div>
                                <div className="p-4 bg-surface-highlight rounded-2xl border border-border space-y-3">
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        Детальну інформацію про обробку персональних даних
                                        можна знайти в нашій Політиці конфіденційності.
                                    </p>
                                    <a
                                        href="/privacy"
                                        className="inline-flex items-center gap-2 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-wider"
                                    >
                                        Політика конфіденційності
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                    <div className="h-2" />
                                    <a
                                        href="/terms"
                                        className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-colors uppercase tracking-wider"
                                    >
                                        Умови використання
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </section>
                        </div>

                        <div className="p-6 border-t border-border bg-surface">
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-colors"
                            >
                                Зрозуміло
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
