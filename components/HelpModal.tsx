"use client";

import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, User, Shield, Music2, Book, FileText, Bell, Palette, Archive, Calendar, Users, MessageSquare, Download, Filter, Trash2, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type HelpTab = 'general' | 'roles' | 'admin' | 'songs' | 'services' | 'notifications' | 'faq';

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
    const [activeTab, setActiveTab] = useState<HelpTab>('general');

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
        { id: 'general', label: 'Загальне', icon: Book },
        { id: 'roles', label: 'Ролі', icon: User },
        { id: 'songs', label: 'Пісні', icon: Music2 },
        { id: 'services', label: 'Служіння', icon: Calendar },
        { id: 'admin', label: 'Регентам', icon: Shield },
        { id: 'notifications', label: 'Сповіщення', icon: Bell },
        { id: 'faq', label: 'FAQ', icon: MessageSquare },
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
                >
                    {/* Header */}
                    <div className="shrink-0 pt-[max(env(safe-area-inset-top),16px)] bg-surface/80 backdrop-blur-xl border-b border-border">
                        <div className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-surface-highlight rounded-xl transition-colors text-text-secondary hover:text-text-primary"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg">
                                    <HelpCircle className="w-4.5 h-4.5 text-primary" />
                                </div>
                                <h1 className="font-bold text-lg tracking-tight">Довідка та FAQ</h1>
                            </div>
                        </div>

                        {/* Menu Dropdown - Mobile Friendly Tabs */}
                        <div className="w-full overflow-x-auto flex items-center gap-1.5 px-4 py-3 border-t border-border bg-surface shrink-0 hide-scrollbar">
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
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto w-full">
                        <div className="p-4 md:p-6 max-w-2xl mx-auto w-full pb-[max(env(safe-area-inset-bottom),24px)]">
                            {/* GENERAL TAB */}
                            {activeTab === 'general' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <section>
                                        <h3 className="text-2xl font-bold text-text-primary mb-4">Вітаємо в MyChoir! 👋</h3>
                                        <p className="text-text-secondary leading-relaxed">
                                            Це застосунок для організації хорового життя. Переглядайте репертуар, плани служінь,
                                            вчіть партії, отримуйте сповіщення та керуйте своїм хором.
                                        </p>
                                    </section>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-surface p-4 rounded-2xl border border-border">
                                            <Music2 className="w-6 h-6 text-purple-400 mb-3" />
                                            <h4 className="font-bold text-text-primary mb-1">Репертуар</h4>
                                            <p className="text-xs text-text-secondary">База пісень хору з нотами та партіями.</p>
                                        </div>
                                        <div className="bg-surface p-4 rounded-2xl border border-border">
                                            <Calendar className="w-6 h-6 text-blue-400 mb-3" />
                                            <h4 className="font-bold text-text-primary mb-1">Служіння</h4>
                                            <p className="text-xs text-text-secondary">Розклад служінь з піснями та відміткою присутності.</p>
                                        </div>
                                        <div className="bg-surface p-4 rounded-2xl border border-border">
                                            <Users className="w-6 h-6 text-green-400 mb-3" />
                                            <h4 className="font-bold text-text-primary mb-1">Учасники</h4>
                                            <p className="text-xs text-text-secondary">Список хористів, партії та статистика відвідувань.</p>
                                        </div>
                                        <div className="bg-surface p-4 rounded-2xl border border-border">
                                            <Archive className="w-6 h-6 text-amber-400 mb-3" />
                                            <h4 className="font-bold text-text-primary mb-1">Архів МХО</h4>
                                            <p className="text-xs text-text-secondary">Тисячі пісень з каталогу МСЦ ЄХБ (для хорів МСЦ).</p>
                                        </div>
                                    </div>

                                    <section className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-5 rounded-3xl border border-indigo-500/20">
                                        <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                            <Palette className="w-5 h-5 text-indigo-400" />
                                            Теми оформлення
                                        </h4>
                                        <p className="text-sm text-text-secondary">
                                            Перемикайте між темною та світлою темою у хедері застосунку.
                                            Також доступний системний режим, який слідує налаштуванням вашого пристрою.
                                        </p>
                                    </section>
                                </div>
                            )}

                            {/* ROLES TAB */}
                            {activeTab === 'roles' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-bold text-text-primary mb-6">Рівні Доступу</h3>

                                    <div className="space-y-4">
                                        <div className="p-5 rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Shield className="w-5 h-5 text-indigo-400" />
                                                <h4 className="font-bold text-text-primary">Регент (Admin)</h4>
                                            </div>
                                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                                <li>Повний контроль над хором 👑</li>
                                                <li>Додавання, редагування та видалення пісень</li>
                                                <li>Створення та редагування планів служінь</li>
                                                <li>Керування учасниками та їх ролями</li>
                                                <li>Створення кодів запрошення</li>
                                                <li>Надсилання push-сповіщень</li>
                                                <li>Перегляд статистики відвідувань</li>
                                                <li>Налаштування хору (назва, іконка)</li>
                                            </ul>
                                        </div>

                                        <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20">
                                            <div className="flex items-center gap-3 mb-3">
                                                <User className="w-5 h-5 text-emerald-400" />
                                                <h4 className="font-bold text-text-primary">Помічник регента</h4>
                                            </div>
                                            <p className="text-sm text-text-secondary mb-3">
                                                Хорист з розширеними правами через Адмін-код:
                                            </p>
                                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                                <li>Може додавати пісні до репертуару</li>
                                                <li>Може бачити статистику відвідувань</li>
                                                <li>Може редагувати служіння</li>
                                            </ul>
                                        </div>

                                        <div className="p-5 rounded-3xl bg-surface border border-border">
                                            <div className="flex items-center gap-3 mb-3">
                                                <User className="w-5 h-5 text-gray-400" />
                                                <h4 className="font-bold text-text-primary">Хорист (Member)</h4>
                                            </div>
                                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                                <li>Перегляд репертуару та партій 👀</li>
                                                <li>Перегляд розкладу служінь</li>
                                                <li>Голосування за присутність («Буду» / «Не буду»)</li>
                                                <li>Завантаження PDF файлів</li>
                                                <li>Синхронізація (офлайн режим)</li>
                                            </ul>
                                        </div>

                                        <div className="p-5 rounded-3xl bg-surface border border-border mt-4">
                                            <h4 className="font-bold text-text-primary mb-2">🎭 Кастомні Ролі та Партії</h4>
                                            <p className="text-sm text-text-secondary">
                                                Регент може створювати власні ролі (наприклад, &quot;Акомпаніатор&quot;) та кастомні вокальні партії (наприклад, &quot;Баритон&quot; або &quot;Учень&quot;). Ці кастомні партії автоматично враховуються у статистиці балансу голосів.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SONGS TAB */}
                            {activeTab === 'songs' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-bold text-text-primary mb-6">Робота з піснями</h3>

                                    <div className="space-y-4">
                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-blue-400" />
                                                Партії та партитура
                                            </h4>
                                            <p className="text-sm text-text-secondary">
                                                Кожна пісня може мати кілька партій: Партитура, Сопрано, Альт, Тенор, Бас.
                                                Перемикайтесь між ними за допомогою табів у верхній частині екрану пісні.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                                <Filter className="w-5 h-5 text-purple-400" />
                                                Категорії та фільтри
                                            </h4>
                                            <p className="text-sm text-text-secondary mb-3">
                                                Пісні автоматично групуються за категоріями: Різдво, Пасха, Свято Жнив тощо.
                                                Використовуйте фільтри в репертуарі для швидкого пошуку.
                                            </p>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Всі</span>
                                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Різдво</span>
                                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Пасха</span>
                                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Свято Жнив</span>
                                            </div>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                Анотації та нотатки
                                            </h4>
                                            <p className="text-sm text-text-secondary">
                                                Відкрийте ноти на весь екран та натисніть олівець, щоб малювати,
                                                підкреслювати або писати нотатки. Ваші помітки особисті і зберігаються на пристрої.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                                <Archive className="w-5 h-5 text-amber-400" />
                                                Архів МХО
                                            </h4>
                                            <p className="text-sm text-text-secondary">
                                                Глобальний каталог з тисячами пісень від МСЦ ЄХБ. Шукайте пісні,
                                                переглядайте ноти та додавайте до репертуару свого хору одним натиском.
                                            </p>
                                            <p className="text-xs text-text-secondary/60 mt-3 italic">
                                                Доступний тільки для хорів типу «Хор МСЦ ЄХБ».
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                                <Download className="w-5 h-5 text-green-400" />
                                                Офлайн режим
                                            </h4>
                                            <p className="text-sm text-text-secondary">
                                                Пісні, які ви відкривали, автоматично кешуються для офлайн доступу.
                                                Також можете завантажити PDF на пристрій кнопкою в правому верхньому куті.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                                <Trash2 className="w-5 h-5 text-red-400" />
                                                Кошик
                                            </h4>
                                            <p className="text-sm text-text-secondary">
                                                Видалені пісні потрапляють у кошик і можуть бути відновлені.
                                                Доступ до кошика — через іконку 🗑️ в картці репертуару.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SERVICES TAB */}
                            {activeTab === 'services' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-bold text-text-primary mb-6">Служіння та розклад</h3>

                                    <div className="space-y-4">
                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">📅 Створення служіння</h4>
                                            <p className="text-sm text-text-secondary">
                                                Регент може створити нове служіння з датою, часом та списком пісень.
                                                Натисніть кнопку &quot;+&quot; на вкладці &quot;Служіння&quot;.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">🎵 Пісні служіння</h4>
                                            <p className="text-sm text-text-secondary">
                                                Кожне служіння має свій список пісень. Хористи бачать ноти для свого
                                                служіння прямо на картці. Порядок пісень можна змінювати перетягуванням.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">✅ Відмітка присутності (Опитування)</h4>
                                            <p className="text-sm text-text-secondary">
                                                Регент може відмічати присутніх самостійно, або надіслати push-сповіщення з кнопками «Буду» / «Не буду».
                                                Відповіді хористів автоматично зберігаються в статистиці відвідувань.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">📊 Статистика Хору</h4>
                                            <p className="text-sm text-text-secondary">
                                                В профілі хору доступна розгорнута статистика: графік відвідувань, баланс всіх голосів (включно з кастомними) та топ найбільш часто виконуваних пісень.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">📁 Архів служінь</h4>
                                            <p className="text-sm text-text-secondary">
                                                Минулі служіння автоматично архівуються. Їх можна переглянути
                                                для аналізу репертуару та статистики.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ADMIN TAB */}
                            {activeTab === 'admin' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-bold text-text-primary mb-6">Інструменти Регента</h3>

                                    <div className="space-y-6">
                                        <section>
                                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">1</span>
                                                Коди запрошення 🔑
                                            </h4>
                                            <p className="text-sm text-text-secondary mb-3">
                                                Створюйте коди для приєднання нових учасників. Види кодів:
                                            </p>
                                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                                <li><b>Звичайний код</b> — для хористів з базовими правами</li>
                                                <li><b>Адмін-код</b> — для помічників з розширеними правами</li>
                                            </ul>
                                        </section>

                                        <section>
                                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">2</span>
                                                Керування учасниками 👥
                                            </h4>
                                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                                <li>Змінюйте партію та роль учасника</li>
                                                <li>Призначайте голів партій</li>
                                                <li>Об&apos;єднуйте дублікати профілів</li>
                                                <li>Видаляйте учасників</li>
                                            </ul>
                                        </section>

                                        <section>
                                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">3</span>
                                                Сповіщення 📢
                                            </h4>
                                            <p className="text-sm text-text-secondary">
                                                Надсилайте push-сповіщення всім учасникам хору або окремим партіям.
                                                Ідеально для термінових оголошень та нагадувань.
                                            </p>
                                        </section>

                                        <section>
                                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">4</span>
                                                Статистика 📊
                                            </h4>
                                            <p className="text-sm text-text-secondary">
                                                Переглядайте статистику відвідувань кожного учасника,
                                                аналізуйте активність партій та плануйте репетиції.
                                            </p>
                                        </section>

                                        <section>
                                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">5</span>
                                                Налаштування хору ⚙️
                                            </h4>
                                            <p className="text-sm text-text-secondary">
                                                Змінюйте назву та іконку хору через меню налаштувань
                                                (натисніть на логотип хору в хедері).
                                            </p>
                                        </section>
                                    </div>
                                </div>
                            )}

                            {/* NOTIFICATIONS TAB */}
                            {activeTab === 'notifications' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-bold text-text-primary mb-6">Сповіщення</h3>

                                    <div className="space-y-4">
                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">🔔 Push-сповіщення</h4>
                                            <p className="text-sm text-text-secondary">
                                                Отримуйте сповіщення про нові служіння, зміни в розкладі та
                                                повідомлення від регента прямо на телефон.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">⚙️ Налаштування</h4>
                                            <p className="text-sm text-text-secondary mb-3">
                                                Керуйте сповіщеннями в розділі &quot;Акаунт&quot; → &quot;Сповіщення&quot;:
                                            </p>
                                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                                <li>Увімкнути/вимкнути всі сповіщення</li>
                                                {!Capacitor.isNativePlatform() && (
                                                    <li>Дозволити сповіщення в браузері</li>
                                                )}
                                            </ul>
                                        </div>

                                        <div className="bg-amber-500/10 p-5 rounded-3xl border border-amber-500/20">
                                            <h4 className="font-bold text-text-primary mb-2">⚠️ Важливо</h4>
                                            {Capacitor.isNativePlatform() ? (
                                                <p className="text-sm text-text-secondary">
                                                    Переконайтеся, що ви дозволили отримання push-сповіщень в налаштуваннях вашого пристрою (Налаштування → Сповіщення → MyChoir).
                                                </p>
                                            ) : (
                                                <p className="text-sm text-text-secondary">
                                                    Для отримання push-сповіщень потрібно дозволити їх в браузері.
                                                    Якщо ви випадково заблокували — перейдіть в налаштування браузера.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* FAQ TAB */}
                            {activeTab === 'faq' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-2xl font-bold text-text-primary mb-6">Часті питання</h3>

                                    <div className="space-y-4">
                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">Як приєднатися до хору?</h4>
                                            <p className="text-sm text-text-secondary">
                                                Отримайте код запрошення від регента вашого хору.
                                                Введіть його на екрані входу після реєстрації.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">Як створити свій хор?</h4>
                                            <p className="text-sm text-text-secondary">
                                                На екрані входу виберіть &quot;Створити новий хор&quot;.
                                                Введіть назву та оберіть тип хору: «Хор МСЦ ЄХБ» (з доступом до Архіву МХО)
                                                або «Звичайний хор» (тільки власний репертуар).
                                                Ви автоматично станете регентом.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">Як додати пісню до репертуару?</h4>
                                            <p className="text-sm text-text-secondary">
                                                Натисніть &quot;+&quot; в розділі &quot;Пісні&quot;. Для хорів МСЦ також
                                                доступний пошук у Архіві МХО. Або створіть власну пісню з завантаженням PDF.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">Як видалити свій акаунт?</h4>
                                            <p className="text-sm text-text-secondary">
                                                Перейдіть в &quot;Акаунт&quot; → прокрутіть вниз → &quot;Видалити акаунт&quot;.
                                                Всі ваші дані будуть безповоротно стерті.
                                            </p>
                                        </div>

                                        <div className="bg-surface p-5 rounded-3xl border border-border">
                                            <h4 className="font-bold text-text-primary mb-2">Як зв&apos;язатися з підтримкою?</h4>
                                            <div className="space-y-1.5 text-sm text-text-secondary mt-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 text-center">📧</span>
                                                    <button onClick={() => openExternal('mailto:artom.devv@gmail.com')} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">artom.devv@gmail.com</button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 text-center">💬</span>
                                                    <button onClick={() => openExternal('https://t.me/artom_dev')} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">@artom_dev</button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 text-center">🌐</span>
                                                    <button onClick={() => openExternal('https://artom.dev')} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">artom.dev</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
