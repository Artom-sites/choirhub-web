"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, ShieldAlert, FileText, Music2, Scale, Copyright, Lock, ArrowLeft } from "lucide-react";
import { Browser } from "@capacitor/browser";
import PrivacyText from "./legal/PrivacyText";
import TermsText from "./legal/TermsText";

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialView?: 'main' | 'privacy' | 'terms';
}

type SubView = 'main' | 'privacy' | 'terms';

export default function LegalModal({ isOpen, onClose, initialView = 'main' }: LegalModalProps) {
    const [subView, setSubView] = useState<SubView>(initialView);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSubView(initialView);
        }
    }, [isOpen, initialView]);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [subView]);

    const openExternal = async (url: string) => {
        try {
            if (url.startsWith('mailto:') || url.startsWith('tel:')) {
                window.location.href = url;
                return;
            }
            await Browser.open({ url });
        } catch (error) {
            console.error("Browser.open failed:", error);
            window.open(url, '_blank');
        }
    };

    const handleClose = () => {
        if (subView !== 'main') {
            setSubView('main');
        } else {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed inset-0 z-[100] bg-background text-text-primary flex flex-col"
                >
                    {/* Header */}
                    <div className="shrink-0 pt-[max(env(safe-area-inset-top),16px)] bg-surface/80 backdrop-blur-xl border-b border-border">
                        <div className="px-4 py-3 pb-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleClose}
                                    className="p-2 hover:bg-surface-highlight rounded-xl transition-colors text-text-secondary hover:text-text-primary"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <h1 className="font-bold text-lg tracking-tight">
                                    {subView === 'main' && 'Джерела та контент'}
                                    {subView === 'privacy' && 'Політика конфіденційності'}
                                    {subView === 'terms' && 'Умови використання'}
                                </h1>
                            </div>
                        </div>
                    </div>

                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full">
                        <div className={`mx-auto w-full p-4 md:p-6 lg:p-8 pb-[max(env(safe-area-inset-bottom),24px)] ${subView === 'main' ? 'max-w-7xl' : 'max-w-3xl'}`}>
                            {subView === 'main' && <MainContent openExternal={openExternal} onOpenPrivacy={() => setSubView('privacy')} onOpenTerms={() => setSubView('terms')} />}
                            {subView === 'privacy' && <PrivacyContent />}
                            {subView === 'terms' && <TermsContent />}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function MainContent({ openExternal, onOpenPrivacy, onOpenTerms }: { openExternal: (url: string) => Promise<void>; onOpenPrivacy: () => void; onOpenTerms: () => void }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <Music2 className="w-5 h-5 text-indigo-400" />
                    <h2>Каталог пісень</h2>
                </div>
                <div className="p-4 bg-surface rounded-2xl border border-border space-y-3">
                    <p className="text-sm text-text-secondary leading-relaxed">
                        Каталог пісень у застосунку сформовано на основі відкритих матеріалів,
                        опублікованих Музично-хоровим відділом МСЦ ЄХБ (Міжнародний союз церков
                        євангельських християн-баптистів).
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed">
                        Ці матеріали призначені для вільного використання в церковному служінні
                        та доступні на офіційному сайті організації.
                    </p>
                    <button
                        onClick={() => openExternal('https://mscmusic.org')}
                        className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider mt-2"
                    >
                        Перейти до джерела
                        <ExternalLink className="w-3 h-3" />
                    </button>
                </div>
            </section>

            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <Copyright className="w-5 h-5 text-purple-400" />
                    <h2>Авторські права</h2>
                </div>
                <div className="p-4 bg-surface rounded-2xl border border-border space-y-3">
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

            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <FileText className="w-5 h-5 text-amber-400" />
                    <h2>Користувацький контент</h2>
                </div>
                <div className="p-5 md:p-6 bg-surface rounded-2xl md:rounded-3xl border border-border flex flex-col flex-1 gap-3">
                    <p className="text-sm text-text-secondary leading-relaxed">
                        Користувачі можуть додавати власні матеріали (ноти, тексти, PDF-файли)
                        для використання в межах свого хору або церковної спільноти.
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed">
                        Завантажений контент зберігається на захищених серверах і доступний
                        лише учасникам відповідного хору.
                    </p>
                </div>
            </section>

            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <Lock className="w-5 h-5 text-cyan-400" />
                    <h2>Захист даних</h2>
                </div>
                <div className="p-5 md:p-6 bg-surface rounded-2xl md:rounded-3xl border border-border flex flex-col flex-1 gap-3">
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

            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <ShieldAlert className="w-5 h-5 text-emerald-400" />
                    <h2>Відповідальність</h2>
                </div>
                <div className="p-5 md:p-6 bg-surface rounded-2xl md:rounded-3xl border border-border flex flex-col flex-1 gap-3">
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

            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <Scale className="w-5 h-5 text-rose-400" />
                    <h2>Правова інформація</h2>
                </div>
                <div className="p-5 md:p-6 bg-surface rounded-2xl md:rounded-3xl border border-border flex flex-col flex-1 gap-3">
                    <p className="text-sm text-text-secondary leading-relaxed mb-4">
                        Детальну інформацію про обробку персональних даних
                        можна знайти в нашій Політиці конфіденційності.
                    </p>

                    <div className="flex flex-col gap-0 border border-border rounded-xl overflow-hidden divide-y divide-border">
                        <button
                            onClick={onOpenPrivacy}
                            className="w-full text-left py-3 px-4 hover:bg-surface-highlight transition-colors flex items-center justify-between group"
                        >
                            <span className="text-sm font-semibold text-text-primary group-hover:text-rose-400 transition-colors">Політика конфіденційності</span>
                            <ArrowLeft className="w-4 h-4 text-text-secondary rotate-180" />
                        </button>
                        <button
                            onClick={onOpenTerms}
                            className="w-full text-left py-3 px-4 hover:bg-surface-highlight transition-colors flex items-center justify-between group"
                        >
                            <span className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">Умови використання</span>
                            <ArrowLeft className="w-4 h-4 text-text-secondary rotate-180" />
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

function PrivacyContent() {
    return <PrivacyText />;
}

function TermsContent() {
    return <TermsText />;
}
