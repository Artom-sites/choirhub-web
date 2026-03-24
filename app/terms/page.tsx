"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import TermsTextUk from "@/components/legal/TermsTextUk";
import TermsTextEn from "@/components/legal/TermsTextEn";
import { useTranslation } from "@/contexts/TranslationContext";

export default function TermsPage() {
    const router = useRouter();
    const { t, language } = useTranslation();

    const handleBack = () => {
        router.back();
    };

    return (
        <div className="min-h-screen bg-background text-text-secondary px-6 pb-6 md:px-12 md:pb-12 font-sans pt-[env(safe-area-inset-top)]">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="border-b border-border pb-6 pt-6">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>{t('common.back')}</span>
                    </button>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">{t('legal.terms_of_use')}</h1>
                </header>

                <div className="prose prose-invert max-w-none">
                    {language === 'uk' ? <TermsTextUk /> : <TermsTextEn />}
                </div>
            </div>
        </div>
    );
}
