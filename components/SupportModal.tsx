"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mail, MessageCircle, Globe, HeartHandshake } from "lucide-react";
import { Browser } from "@capacitor/browser";
import GlassPageHeader from "./GlassPageHeader";
import { useTranslation } from "@/contexts/TranslationContext";

interface SupportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SupportModal({ isOpen, onClose }: SupportModalProps) {
    const { t } = useTranslation();
    const openExternal = async (url: string) => {
        try {
            if (url.startsWith('mailto:') || url.startsWith('tel:')) {
                window.location.href = url;
                return;
            }
            await Browser.open({ url });
        } catch {
            window.open(url, '_blank');
        }
    };

    const contacts = [
        {
            icon: Mail,
            label: 'Email',
            value: 'artom.devv@gmail.com',
            href: 'mailto:artom.devv@gmail.com?subject=MyChoir%20Підтримка',
            color: 'text-indigo-400',
            bg: 'bg-indigo-500/10 border-indigo-500/20',
        },
        {
            icon: MessageCircle,
            label: 'Telegram',
            value: '@artom_dev',
            href: 'https://t.me/artom_dev',
            color: 'text-sky-400',
            bg: 'bg-sky-500/10 border-sky-500/20',
        },
        {
            icon: Globe,
            label: t('support.website'),
            value: 'artom.dev',
            href: 'https://artom.dev',
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border-emerald-500/20',
        },
    ];

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
                    <GlassPageHeader
                        title={t('account.support')}
                        onBack={onClose}
                        isActive={isOpen}
                    />

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-5 md:p-8 max-w-lg mx-auto space-y-6 pb-[max(env(safe-area-inset-bottom),32px)]">

                            {/* Hero */}
                            <div className="flex flex-col items-center text-center py-6">
                                <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                                    <HeartHandshake className="w-8 h-8 text-primary" />
                                </div>
                                <h2 className="text-2xl font-bold text-text-primary mb-2">{t('support.any_questions')}</h2>
                                <p className="text-text-secondary text-sm leading-relaxed max-w-xs">
                                    {t('support.contact_us')}
                                </p>
                            </div>

                            {/* Contacts */}
                            <div className="space-y-3">
                                {contacts.map(({ icon: Icon, label, value, href, color, bg }) => (
                                    <button
                                        key={href}
                                        onClick={() => openExternal(href)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98] ${bg}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-background/40`}>
                                            <Icon className={`w-5 h-5 ${color}`} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs text-text-secondary font-medium">{label}</p>
                                            <p className={`text-sm font-semibold ${color}`}>{value}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Note */}
                            <p className="text-center text-xs text-text-secondary/60 pt-2">
                                {t('support.made_in_ukraine')}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
