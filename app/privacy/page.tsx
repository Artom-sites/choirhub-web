"use client";

import BackButton from '@/components/legal/BackButton';
import PrivacyTextUk from '@/components/legal/PrivacyTextUk';
import PrivacyTextEn from '@/components/legal/PrivacyTextEn';
import { useTranslation } from '@/contexts/TranslationContext';

export default function PrivacyPage() {
    const { t, language } = useTranslation();
    return (
        <div className="min-h-screen bg-background text-text-secondary px-6 pb-6 md:px-12 md:pb-12 font-sans pt-[env(safe-area-inset-top)]">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="border-b border-border pb-6 pt-6">
                    <BackButton />
                    <h1 className="text-3xl font-bold text-text-primary mb-2">{t('legal.privacy_policy')}</h1>
                </header>

                <div className="prose prose-invert max-w-none">
                    {language === 'uk' ? <PrivacyTextUk /> : <PrivacyTextEn />}
                </div>
            </div>
        </div>
    );
}
