"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, ShieldAlert, FileText, Music2, Scale, Copyright, Lock, ArrowLeft } from "lucide-react";
import { Browser } from "@capacitor/browser";
import PrivacyTextUk from "./legal/PrivacyTextUk";
import PrivacyTextEn from "./legal/PrivacyTextEn";
import TermsTextUk from "./legal/TermsTextUk";
import TermsTextEn from "./legal/TermsTextEn";
import GlassPageHeader from "./GlassPageHeader";
import { useTranslation } from "@/contexts/TranslationContext";

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialView?: 'main' | 'privacy' | 'terms';
}

type SubView = 'main' | 'privacy' | 'terms';

export default function LegalModal({ isOpen, onClose, initialView = 'main' }: LegalModalProps) {
    const { t } = useTranslation();
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
                    data-native-inner="true"
                >
                    {/* Header */}
                    <GlassPageHeader
                        title={
                            subView === 'main' ? t('legal.title_sources') :
                            subView === 'privacy' ? t('legal.privacy_policy') :
                            t('legal.terms_of_use')
                        }
                        onBack={handleClose}
                        isActive={isOpen}
                    />

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
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <Music2 className="w-5 h-5 text-indigo-400" />
                    <h2>{t('legal.sec_catalog')}</h2>
                </div>
                <div className="p-4 bg-surface rounded-2xl border border-border space-y-3">
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {t('legal.sec_catalog_desc1')}
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {t('legal.sec_catalog_desc2')}
                    </p>
                    <button
                        onClick={() => openExternal('https://mscmusic.org')}
                        className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider mt-2"
                    >
                        {t('legal.btn_source')}
                        <ExternalLink className="w-3 h-3" />
                    </button>
                </div>
            </section>

            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <Copyright className="w-5 h-5 text-purple-400" />
                    <h2>{t('legal.sec_copyright')}</h2>
                </div>
                <div className="p-4 bg-surface rounded-2xl border border-border space-y-3">
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {t('legal.sec_copyright_desc1')}
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {t('legal.sec_copyright_desc2')}
                    </p>
                </div>
            </section>

            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <FileText className="w-5 h-5 text-amber-400" />
                    <h2>{t('legal.sec_user_content')}</h2>
                </div>
                <div className="p-5 md:p-6 bg-surface rounded-2xl md:rounded-3xl border border-border flex flex-col flex-1 gap-3">
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {t('legal.sec_user_content_desc1')}
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {t('legal.sec_user_content_desc2')}
                    </p>
                </div>
            </section>

            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <Lock className="w-5 h-5 text-cyan-400" />
                    <h2>{t('legal.sec_protection')}</h2>
                </div>
                <div className="p-5 md:p-6 bg-surface rounded-2xl md:rounded-3xl border border-border flex flex-col flex-1 gap-3">
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {t('legal.sec_protection_desc1')}
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {t('legal.sec_protection_desc2')}
                    </p>
                </div>
            </section>

            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <ShieldAlert className="w-5 h-5 text-emerald-400" />
                    <h2>{t('legal.sec_responsibility')}</h2>
                </div>
                <div className="p-5 md:p-6 bg-surface rounded-2xl md:rounded-3xl border border-border flex flex-col flex-1 gap-3">
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {t('legal.sec_responsibility_desc1')}
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {t('legal.sec_responsibility_desc2')}
                    </p>
                </div>
            </section>

            <section className="space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                    <Scale className="w-5 h-5 text-rose-400" />
                    <h2>{t('legal.sec_legal')}</h2>
                </div>
                <div className="p-5 md:p-6 bg-surface rounded-2xl md:rounded-3xl border border-border flex flex-col flex-1 gap-3">
                    <p className="text-sm text-text-secondary leading-relaxed mb-4">
                        {t('legal.sec_legal_desc1')}
                    </p>

                    <div className="flex flex-col gap-0 border border-border rounded-xl overflow-hidden divide-y divide-border">
                        <button
                            onClick={onOpenPrivacy}
                            className="w-full text-left py-3 px-4 hover:bg-surface-highlight transition-colors flex items-center justify-between group"
                        >
                            <span className="text-sm font-semibold text-text-primary group-hover:text-rose-400 transition-colors">{t('legal.privacy_policy')}</span>
                            <ArrowLeft className="w-4 h-4 text-text-secondary rotate-180" />
                        </button>
                        <button
                            onClick={onOpenTerms}
                            className="w-full text-left py-3 px-4 hover:bg-surface-highlight transition-colors flex items-center justify-between group"
                        >
                            <span className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">{t('legal.terms_of_use')}</span>
                            <ArrowLeft className="w-4 h-4 text-text-secondary rotate-180" />
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

function PrivacyContent() {
    const { language } = useTranslation();
    return language === 'uk' ? <PrivacyTextUk /> : <PrivacyTextEn />;
}

function TermsContent() {
    const { language } = useTranslation();
    return language === 'uk' ? <TermsTextUk /> : <TermsTextEn />;
}
