"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, HelpCircle, User, Shield, Music2, Book, ChevronRight, FileText } from "lucide-react";
import { useState } from "react";

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type HelpTab = 'general' | 'roles' | 'admin' | 'songs';

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
    const [activeTab, setActiveTab] = useState<HelpTab>('general');

    if (!isOpen) return null;

    const tabs: { id: HelpTab; label: string; icon: any }[] = [
        { id: 'general', label: 'Загальне', icon: Book },
        { id: 'roles', label: 'Ролі', icon: User },
        { id: 'admin', label: 'Регентам', icon: Shield },
        { id: 'songs', label: 'Пісні', icon: Music2 },
    ];

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#18181b] w-full max-w-2xl h-[80vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#18181b]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                            <HelpCircle className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Довідка</h2>
                            <div className="flex gap-2 text-xs text-text-secondary items-center">
                                <span>Інструкція</span>
                                <span>•</span>
                                <a href="/privacy" target="_blank" className="hover:text-indigo-400 transition-colors underline">Політика конфіденційності</a>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content Layout */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
                    {/* Sidebar Tabs (Desktop) */}
                    <div className="w-48 bg-black/20 border-r border-white/5 p-4 space-y-2 overflow-y-auto hidden md:block shrink-0">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-white/10 text-white shadow-sm'
                                    : 'text-text-secondary hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Mobile Tabs (Horizontal) - In Flow */}
                    <div className="md:hidden w-full overflow-x-auto flex items-center gap-2 p-2 border-b border-white/5 bg-black/20 shrink-0">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
                                    ? 'bg-white/10 text-white'
                                    : 'text-text-secondary'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#18181b]">

                        {activeTab === 'general' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <section>
                                    <h3 className="text-2xl font-bold text-white mb-4">Вітаємо в MyChoir! 👋</h3>
                                    <p className="text-text-secondary leading-relaxed">
                                        Це застосунок для організації хорового життя. Тут ви можете переглядати репертуар, плани служінь, вчити партії та отримувати сповіщення.
                                    </p>
                                </section>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <Music2 className="w-6 h-6 text-purple-400 mb-3" />
                                        <h4 className="font-bold text-white mb-1">Репертуар</h4>
                                        <p className="text-xs text-text-secondary">База пісень вашого хору з нотами та партіями.</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <FileText className="w-6 h-6 text-blue-400 mb-3" />
                                        <h4 className="font-bold text-white mb-1">Планування</h4>
                                        <p className="text-xs text-text-secondary">Розклад служінь та списки пісень на кожне служіння.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'roles' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <h3 className="text-2xl font-bold text-white mb-6">Рівні Доступу</h3>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Shield className="w-5 h-5 text-indigo-400" />
                                            <h4 className="font-bold text-white">Регент (Admin)</h4>
                                        </div>
                                        <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                            <li>Повний контроль над хором 👑</li>
                                            <li>Додавання та редагування пісень</li>
                                            <li>Створення планів служінь</li>
                                            <li>Керування учасниками та створення кодів доступу</li>
                                        </ul>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <div className="flex items-center gap-3 mb-2">
                                            <User className="w-5 h-5 text-gray-400" />
                                            <h4 className="font-bold text-white">Хорист (Member)</h4>
                                        </div>
                                        <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                            <li>Перегляд репертуару та партій 👀</li>
                                            <li>Перегляд розкладу служінь</li>
                                            <li>Синхронізація (офлайн режим)</li>
                                        </ul>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Shield className="w-5 h-5 text-orange-400" />
                                            <h4 className="font-bold text-white">Спеціальні права</h4>
                                        </div>
                                        <p className="text-sm text-text-secondary mb-2">
                                            Регент може надати окремі права хористу через <b>Адмін-коди</b>:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="text-[10px] px-2 py-1 bg-orange-500/20 text-orange-300 rounded-lg">Бачити статистику</span>
                                            <span className="text-[10px] px-2 py-1 bg-orange-500/20 text-orange-300 rounded-lg">Додавати пісні</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'admin' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <h3 className="text-2xl font-bold text-white mb-6">Інструменти Регента</h3>

                                <div className="space-y-8">
                                    <section>
                                        <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">1</span>
                                            Адмін-коди 🔑
                                        </h4>
                                        <p className="text-sm text-text-secondary mb-3">
                                            Створюйте спеціальні коди запрошення для помічників. Ви можете вибрати конкретні дозволи.
                                        </p>
                                        <div className="bg-black/30 p-4 rounded-xl text-sm border-l-2 border-indigo-500">
                                            <p className="font-medium text-white mb-1">Приклад:</p>
                                            <p className="text-text-secondary">Створіть код "Секретар" з правом <b>"Бачити статистику"</b> та <b>"Відмічати відсутніх"</b>, але без права редагування пісень.</p>
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">2</span>
                                            Глобальний Репертуар 🌍
                                        </h4>
                                        <p className="text-sm text-text-secondary">
                                            Кнопка "+" у розділі пісень відкриває <b>Глобальний Репертуар</b>. Це база з тисячами пісень.
                                            Ви можете додати пісню собі, і вона автоматично з'явиться у всіх учасників.
                                        </p>
                                    </section>
                                </div>
                            </div>
                        )}

                        {activeTab === 'songs' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <h3 className="text-2xl font-bold text-white mb-6">Робота з піснями</h3>

                                <div className="space-y-4">
                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                        <h4 className="font-bold text-white mb-2">Перемикач партій</h4>
                                        <p className="text-sm text-text-secondary">
                                            У верхній частині екрану пісні є перемикач (таби): <b>Партитура</b>, <b>Сопрано</b>, <b>Альт</b> тощо.
                                            Вибирайте свою партію, щоб бачити тільки її.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                        <h4 className="font-bold text-white mb-2">Офлайн режим</h4>
                                        <p className="text-sm text-text-secondary">
                                            Пісні, які ви відкривали, автоматично кешуються. Також ви можете натиснути кнопку завантаження, щоб зберегти PDF на пристрій.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </motion.div>
        </div>
    );
}
