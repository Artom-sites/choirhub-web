"use client";

import { useState, useRef, useEffect } from "react";
import { X, ExternalLink, ShieldAlert, FileText, Music2, Scale, Lock, Copyright, ArrowLeft } from "lucide-react";
import { Browser } from "@capacitor/browser";
import PrivacyText from "./legal/PrivacyText";
import TermsText from "./legal/TermsText";

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialView?: 'main' | 'privacy' | 'terms';
    onOpenPrivacy?: () => void;
    onOpenTerms?: () => void;
}

type SubView = 'main' | 'privacy' | 'terms';

export default function LegalModal({ isOpen, onClose, initialView = 'main' }: LegalModalProps) {
    const [subView, setSubView] = useState<SubView>(initialView);

    // Reset view when modal opens/closes or initialView changes
    useEffect(() => {
        if (isOpen) {
            setSubView(initialView);
        }
    }, [isOpen, initialView]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to top when subView changes
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [subView]);

    const openExternal = async (url: string) => {
        await Browser.open({ url });
    };

    const handleClose = () => {
        setSubView('main');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
                onClick={handleClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <div className="relative bg-surface border border-border w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between bg-surface sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        {subView !== 'main' && (
                            <button
                                onClick={() => setSubView('main')}
                                className="p-1.5 hover:bg-surface-highlight rounded-full transition-colors text-text-secondary hover:text-text-primary"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h2 className="text-xl font-bold text-text-primary tracking-tight">
                            {subView === 'main' && 'Джерела та контент'}
                            {subView === 'privacy' && 'Політика конфіденційності'}
                            {subView === 'terms' && 'Умови використання'}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 bg-surface-highlight hover:bg-border rounded-full transition-colors text-text-secondary hover:text-text-primary"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div ref={scrollContainerRef} className="p-6 overflow-y-auto space-y-6">
                    {subView === 'main' && <MainContent openExternal={openExternal} onOpenPrivacy={() => setSubView('privacy')} onOpenTerms={() => setSubView('terms')} />}
                    {subView === 'privacy' && <PrivacyContent />}
                    {subView === 'terms' && <TermsContent />}
                </div>

                <div className="p-6 border-t border-border bg-surface">
                    <button
                        onClick={subView === 'main' ? handleClose : () => setSubView('main')}
                        className="w-full py-3 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-colors"
                    >
                        {subView === 'main' ? 'Зрозуміло' : 'Назад'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MainContent({ openExternal, onOpenPrivacy, onOpenTerms }: { openExternal: (url: string) => Promise<void>; onOpenPrivacy: () => void; onOpenTerms: () => void }) {
    return (
        <>
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
                    <button
                        onClick={() => openExternal('https://mscmusic.org')}
                        className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider mt-2"
                    >
                        Перейти до джерела
                        <ExternalLink className="w-3 h-3" />
                    </button>
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
                    <button
                        onClick={onOpenPrivacy}
                        className="inline-flex items-center gap-2 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-wider"
                    >
                        Політика конфіденційності
                        <ArrowLeft className="w-3 h-3 rotate-180" />
                    </button>
                    <div className="h-2" />
                    <button
                        onClick={onOpenTerms}
                        className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-colors uppercase tracking-wider"
                    >
                        Умови використання
                        <ArrowLeft className="w-3 h-3 rotate-180" />
                    </button>
                </div>
            </section>
        </>
    );
}

function PrivacyContent() {
    return <PrivacyText />;
}

function TermsContent() {
    return <TermsText />;
}
