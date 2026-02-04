"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, HelpCircle, User, Shield, Music2, Book, FileText, Bell, Palette, Archive, Calendar, Users, MessageSquare, Download, Filter, Trash2, Settings } from "lucide-react";
import { useState } from "react";

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type HelpTab = 'general' | 'roles' | 'admin' | 'songs' | 'services' | 'notifications' | 'faq';

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
    const [activeTab, setActiveTab] = useState<HelpTab>('general');

    if (!isOpen) return null;

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
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#18181b] w-full max-w-2xl h-[85vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
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
                                <span>Інструкція користувача</span>
                                <span>•</span>
                                <a href="/privacy" target="_blank" className="hover:text-indigo-400 transition-colors underline">Конфіденційність</a>
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
                    <div className="w-48 bg-black/20 border-r border-white/5 p-4 space-y-1 overflow-y-auto hidden md:block shrink-0">
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

                    {/* Mobile Tabs (Horizontal) */}
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

                        {/* GENERAL TAB */}
                        {activeTab === 'general' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <section>
                                    <h3 className="text-2xl font-bold text-white mb-4">Вітаємо в MyChoir! 👋</h3>
                                    <p className="text-text-secondary leading-relaxed">
                                        Це застосунок для організації хорового життя. Переглядайте репертуар, плани служінь,
                                        вчіть партії, отримуйте сповіщення та керуйте своїм хором.
                                    </p>
                                </section>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <Music2 className="w-6 h-6 text-purple-400 mb-3" />
                                        <h4 className="font-bold text-white mb-1">Репертуар</h4>
                                        <p className="text-xs text-text-secondary">База пісень хору з нотами, партіями та аудіо.</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <Calendar className="w-6 h-6 text-blue-400 mb-3" />
                                        <h4 className="font-bold text-white mb-1">Служіння</h4>
                                        <p className="text-xs text-text-secondary">Розклад служінь з піснями та відміткою присутності.</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <Users className="w-6 h-6 text-green-400 mb-3" />
                                        <h4 className="font-bold text-white mb-1">Учасники</h4>
                                        <p className="text-xs text-text-secondary">Список хористів, партії та статистика відвідувань.</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <Archive className="w-6 h-6 text-amber-400 mb-3" />
                                        <h4 className="font-bold text-white mb-1">Архів МХО</h4>
                                        <p className="text-xs text-text-secondary">Тисячі пісень з каталогу МСЦ ЄХБ.</p>
                                    </div>
                                </div>

                                <section className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-4 rounded-2xl border border-indigo-500/20">
                                    <h4 className="font-bold text-white mb-2 flex items-center gap-2">
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
                                <h3 className="text-2xl font-bold text-white mb-6">Рівні Доступу</h3>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Shield className="w-5 h-5 text-indigo-400" />
                                            <h4 className="font-bold text-white">Регент (Admin)</h4>
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

                                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                        <div className="flex items-center gap-3 mb-2">
                                            <User className="w-5 h-5 text-emerald-400" />
                                            <h4 className="font-bold text-white">Помічник регента</h4>
                                        </div>
                                        <p className="text-sm text-text-secondary mb-2">
                                            Хорист з розширеними правами через Адмін-код:
                                        </p>
                                        <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                            <li>Може додавати пісні до репертуару</li>
                                            <li>Може бачити статистику відвідувань</li>
                                            <li>Може редагувати служіння</li>
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
                                            <li>Завантаження PDF та аудіо</li>
                                            <li>Синхронізація (офлайн режим)</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SONGS TAB */}
                        {activeTab === 'songs' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <h3 className="text-2xl font-bold text-white mb-6">Робота з піснями</h3>

                                <div className="space-y-4">
                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-blue-400" />
                                            Партії та партитура
                                        </h4>
                                        <p className="text-sm text-text-secondary">
                                            Кожна пісня може мати кілька партій: Партитура, Сопрано, Альт, Тенор, Бас.
                                            Перемикайтесь між ними за допомогою табів у верхній частині екрану пісні.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                                            <Filter className="w-5 h-5 text-purple-400" />
                                            Категорії та фільтри
                                        </h4>
                                        <p className="text-sm text-text-secondary mb-2">
                                            Пісні автоматично групуються за категоріями: Різдво, Пасха, Свято Жнив тощо.
                                            Використовуйте фільтри в репертуарі для швидкого пошуку.
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="text-[10px] px-2 py-1 bg-white/10 text-text-secondary rounded-lg">Всі</span>
                                            <span className="text-[10px] px-2 py-1 bg-white/10 text-text-secondary rounded-lg">Різдво</span>
                                            <span className="text-[10px] px-2 py-1 bg-white/10 text-text-secondary rounded-lg">Пасха</span>
                                            <span className="text-[10px] px-2 py-1 bg-white/10 text-text-secondary rounded-lg">Свято Жнив</span>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                                            <Archive className="w-5 h-5 text-amber-400" />
                                            Архів МХО
                                        </h4>
                                        <p className="text-sm text-text-secondary">
                                            Глобальний каталог з тисячами пісень від МСЦ ЄХБ. Шукайте пісні,
                                            переглядайте ноти та додавайте до репертуару свого хору одним натиском.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                                            <Download className="w-5 h-5 text-green-400" />
                                            Офлайн режим
                                        </h4>
                                        <p className="text-sm text-text-secondary">
                                            Пісні, які ви відкривали, автоматично кешуються для офлайн доступу.
                                            Також можете завантажити PDF на пристрій кнопкою в правому верхньому куті.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
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
                                <h3 className="text-2xl font-bold text-white mb-6">Служіння та розклад</h3>

                                <div className="space-y-4">
                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">📅 Створення служіння</h4>
                                        <p className="text-sm text-text-secondary">
                                            Регент може створити нове служіння з датою, часом та списком пісень.
                                            Натисніть кнопку "+" на вкладці "Служіння".
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">🎵 Пісні служіння</h4>
                                        <p className="text-sm text-text-secondary">
                                            Кожне служіння має свій список пісень. Хористи бачать ноти для свого
                                            служіння прямо на картці. Порядок пісень можна змінювати перетягуванням.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">✅ Відмітка присутності</h4>
                                        <p className="text-sm text-text-secondary">
                                            Регент може відмічати присутніх на служінні.
                                            Статистика відвідувань зберігається та доступна в профілях учасників.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">📁 Архів служінь</h4>
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
                                <h3 className="text-2xl font-bold text-white mb-6">Інструменти Регента</h3>

                                <div className="space-y-6">
                                    <section>
                                        <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">1</span>
                                            Коди запрошення 🔑
                                        </h4>
                                        <p className="text-sm text-text-secondary mb-3">
                                            Створюйте коди для приєднання нових учасників. Види кодів:
                                        </p>
                                        <ul className="text-sm text-text-secondary space-y-1 list-disc pl-5">
                                            <li><b>Звичайний код</b> — для хористів з базовими правами</li>
                                            <li><b>Адмін-код</b> — для помічників з розширеними правами</li>
                                        </ul>
                                    </section>

                                    <section>
                                        <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">2</span>
                                            Керування учасниками 👥
                                        </h4>
                                        <ul className="text-sm text-text-secondary space-y-1 list-disc pl-5">
                                            <li>Змінюйте партію та роль учасника</li>
                                            <li>Призначайте голів партій</li>
                                            <li>Об'єднуйте дублікати профілів</li>
                                            <li>Видаляйте учасників</li>
                                        </ul>
                                    </section>

                                    <section>
                                        <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">3</span>
                                            Сповіщення 📢
                                        </h4>
                                        <p className="text-sm text-text-secondary">
                                            Надсилайте push-сповіщення всім учасникам хору або окремим партіям.
                                            Ідеально для термінових оголошень та нагадувань.
                                        </p>
                                    </section>

                                    <section>
                                        <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">4</span>
                                            Статистика 📊
                                        </h4>
                                        <p className="text-sm text-text-secondary">
                                            Переглядайте статистику відвідувань кожного учасника,
                                            аналізуйте активність партій та плануйте репетиції.
                                        </p>
                                    </section>

                                    <section>
                                        <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">5</span>
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
                                <h3 className="text-2xl font-bold text-white mb-6">Сповіщення</h3>

                                <div className="space-y-4">
                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">🔔 Push-сповіщення</h4>
                                        <p className="text-sm text-text-secondary">
                                            Отримуйте сповіщення про нові служіння, зміни в розкладі та
                                            повідомлення від регента прямо на телефон.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">⚙️ Налаштування</h4>
                                        <p className="text-sm text-text-secondary mb-2">
                                            Керуйте сповіщеннями в розділі "Акаунт" → "Сповіщення":
                                        </p>
                                        <ul className="text-sm text-text-secondary space-y-1 list-disc pl-5">
                                            <li>Увімкнути/вимкнути всі сповіщення</li>
                                            <li>Дозволити сповіщення в браузері</li>
                                        </ul>
                                    </div>

                                    <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/20">
                                        <h4 className="font-bold text-white mb-2">⚠️ Важливо</h4>
                                        <p className="text-sm text-text-secondary">
                                            Для отримання push-сповіщень потрібно дозволити їх в браузері.
                                            Якщо ви випадково заблокували — перейдіть в налаштування браузера.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* FAQ TAB */}
                        {activeTab === 'faq' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <h3 className="text-2xl font-bold text-white mb-6">Часті питання</h3>

                                <div className="space-y-4">
                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">Як приєднатися до хору?</h4>
                                        <p className="text-sm text-text-secondary">
                                            Отримайте код запрошення від регента вашого хору.
                                            Введіть його на екрані входу після реєстрації.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">Як створити свій хор?</h4>
                                        <p className="text-sm text-text-secondary">
                                            На екрані входу виберіть "Створити новий хор".
                                            Введіть назву — і ви автоматично станете регентом.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">Як додати пісню до репертуару?</h4>
                                        <p className="text-sm text-text-secondary">
                                            Натисніть "+" в розділі "Пісні" → оберіть з Архіву МХО або
                                            створіть власну пісню з завантаженням PDF.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">Як видалити свій акаунт?</h4>
                                        <p className="text-sm text-text-secondary">
                                            Перейдіть в "Акаунт" → прокрутіть вниз → "Видалити акаунт".
                                            Всі ваші дані будуть безповоротно стерті.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <h4 className="font-bold text-white mb-2">Як зв'язатися з підтримкою?</h4>
                                        <p className="text-sm text-text-secondary">
                                            📧 Email: artom.devv@gmail.com<br />
                                            💬 Telegram: <a href="https://t.me/artom_dev" className="text-indigo-400 hover:underline">@artom_dev</a><br />
                                            🌐 Сайт: <a href="https://artom.dev" className="text-indigo-400 hover:underline">artom.dev</a>
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
