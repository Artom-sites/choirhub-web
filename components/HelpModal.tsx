"use client";

import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, User, Shield, Music2, Book, FileText, Bell, Palette, Archive, Calendar, Users, MessageSquare, Download, Filter, Trash2, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import GlassPageHeader from "./GlassPageHeader";
import { useTranslation } from "@/contexts/TranslationContext";
import HelpContentUk from "./help/HelpContentUk";
import HelpContentEn from "./help/HelpContentEn";
import HelpContentRu from "./help/HelpContentRu";
import HelpContentDe from "./help/HelpContentDe";

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type HelpTab = 'general' | 'roles' | 'admin' | 'songs' | 'services' | 'notifications' | 'faq';

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
    const [activeTab, setActiveTab] = useState<HelpTab>('general');
    const { t, language } = useTranslation();

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

    const tabs: { id: HelpTab; label: string; icon: any }[] = [
        { id: 'general', label: t('help.tabs.general'), icon: Book },
        { id: 'roles', label: t('help.tabs.roles'), icon: User },
        { id: 'songs', label: t('help.tabs.songs'), icon: Music2 },
        { id: 'services', label: t('help.tabs.services'), icon: Calendar },
        { id: 'admin', label: t('help.tabs.admin'), icon: Shield },
        { id: 'notifications', label: t('help.tabs.notifications'), icon: Bell },
        { id: 'faq', label: t('help.tabs.faq'), icon: MessageSquare },
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
                    {/* Header */}
                    <GlassPageHeader
                        title={t('help.title')}
                        onBack={onClose}
                        isActive={isOpen}
                    >

                        {/* Menu Dropdown - Mobile Friendly Tabs */}
                        <div className="md:hidden w-full overflow-x-auto flex items-center gap-1.5 px-4 py-3 border-t border-border bg-surface shrink-0 hide-scrollbar">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 border ${activeTab === tab.id
                                        ? 'bg-primary/10 text-primary border-primary/20 scale-100'
                                        : 'bg-surface-highlight text-text-secondary border-border active:scale-95'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </GlassPageHeader>

                    {/* Content Area with Desktop Sidebar */}
                    <div className="flex-1 overflow-hidden flex flex-row w-full">
                        {/* Desktop Sidebar */}
                        <div className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r border-border bg-surface/30 p-4 gap-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),24px)]">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border ${activeTab === tab.id
                                        ? 'bg-primary/5 text-primary border-primary/20 shadow-sm'
                                        : 'bg-transparent text-text-secondary border-transparent hover:bg-surface-highlight hover:text-text-primary'
                                        }`}
                                >
                                    <tab.icon className="w-5 h-5" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Scrolling Content Pane */}
                        <div className="flex-1 overflow-y-auto w-full bg-background relative">
                            <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto w-full pb-[max(env(safe-area-inset-bottom),32px)]">
                            {language === 'en' ? <HelpContentEn activeTab={activeTab} openExternal={openExternal} isNative={Capacitor.isNativePlatform()} /> :
                             language === 'ru' ? <HelpContentRu activeTab={activeTab} openExternal={openExternal} isNative={Capacitor.isNativePlatform()} /> :
                             language === 'de' ? <HelpContentDe activeTab={activeTab} openExternal={openExternal} isNative={Capacitor.isNativePlatform()} /> :
                             <HelpContentUk activeTab={activeTab} openExternal={openExternal} isNative={Capacitor.isNativePlatform()} />}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
