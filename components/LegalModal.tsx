"use client";

import { useState, useRef, useEffect } from "react";
import { X, ExternalLink, ShieldAlert, FileText, Music2, Scale, Lock, Copyright, ArrowLeft } from "lucide-react";
import { Browser } from "@capacitor/browser";

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenPrivacy?: () => void;
    onOpenTerms?: () => void;
}

type SubView = 'main' | 'privacy' | 'terms';

export default function LegalModal({ isOpen, onClose }: LegalModalProps) {
    const [subView, setSubView] = useState<SubView>('main');
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
    return (
        <>
            <p className="text-xs text-text-secondary">Останнє оновлення: 3 лютого 2026</p>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">1. Вступ</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ця політика конфіденційності пояснює, як додаток &quot;MyChoir&quot; (далі — &quot;Додаток&quot;, &quot;ми&quot;, &quot;нас&quot;)
                    збирає, використовує, зберігає та захищає вашу персональну інформацію.
                    Використовуючи наш Додаток, ви погоджуєтесь з умовами цієї політики.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">2. Які дані ми збираємо</h3>
                <p className="text-sm text-text-secondary leading-relaxed">Ми збираємо наступні категорії персональних даних:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li><strong>Облікові дані:</strong> Ім&apos;я, Email, фото профілю (через Google Sign-In).</li>
                    <li><strong>Дані хору:</strong> Належність до хорів, роль, вокальна партія.</li>
                    <li><strong>Активність:</strong> Відвідування репетицій та служінь, статистика присутності.</li>
                    <li><strong>Контент:</strong> Пісні, ноти (PDF), аудіофайли.</li>
                    <li><strong>Push-токени:</strong> Технічні ідентифікатори для сповіщень.</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">3. Як ми використовуємо дані</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li>Для авторизації та ідентифікації користувача.</li>
                    <li>Для відображення розкладу та репертуару хору.</li>
                    <li>Для комунікації між регентом та хористами.</li>
                    <li>Для ведення статистики відвідувань.</li>
                    <li>Для покращення якості сервісу.</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">4. Зберігання та захист даних</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Дані зберігаються на серверах Google Firebase та Cloudflare R2 з використанням шифрування TLS/SSL та AES-256.
                    Сервери розташовані в ЄС та США відповідно до вимог GDPR.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">5. Передача даних третім сторонам</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми <strong>не продаємо</strong> та <strong>не передаємо</strong> ваші дані для маркетингу.
                    Дані доступні лише сервіс-провайдерам: Google Firebase, Cloudflare, Vercel.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">6. Cookies та аналітика</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми використовуємо мінімальні cookies для сесії авторизації.
                    Ми <strong>не використовуємо</strong> рекламні cookies або трекери.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">7. Ваші права (GDPR)</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li><strong>Доступ:</strong> Запитати копію ваших даних.</li>
                    <li><strong>Виправлення:</strong> Оновити неточну інформацію.</li>
                    <li><strong>Видалення:</strong> Повністю видалити акаунт та дані.</li>
                    <li><strong>Переносність:</strong> Експортувати дані.</li>
                    <li><strong>Обмеження / Заперечення:</strong> Обмежити обробку даних.</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">8. Видалення даних</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Скористайтесь кнопкою &quot;Видалити акаунт&quot; в налаштуваннях профілю.
                    Всі дані будуть стерті протягом 30 днів.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">9. Контакти</h3>
                <ul className="list-none space-y-1 text-sm text-text-secondary">
                    <li><strong>Email:</strong> artom.devv@gmail.com</li>
                    <li><strong>Telegram:</strong> <a href="https://t.me/artom_dev" className="text-primary hover:underline">@artom_dev</a></li>
                    <li><strong>Сайт:</strong> <a href="https://artom.dev" className="text-primary hover:underline">artom.dev</a></li>
                </ul>
            </section>

            <footer className="border-t border-border pt-4 mt-4">
                <p className="text-xs text-text-secondary text-center">© 2026 MyChoir. Всі права захищені.</p>
            </footer>
        </>
    );
}

function TermsContent() {
    return (
        <>
            <p className="text-xs text-text-secondary">Останнє оновлення: 3 лютого 2026</p>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">1. Загальні положення</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ці Умови використання регулюють доступ до додатку &quot;MyChoir&quot;.
                    Використовуючи Додаток, ви погоджуєтесь із цими Умовами.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">2. Ліцензія на використання</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми надаємо обмежену, невиключну ліцензію для особистих та некомерційних цілей,
                    пов&apos;язаних з організацією хорового служіння.
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">Заборонено:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li>Копіювати, модифікувати або поширювати вихідний код.</li>
                    <li>Використовувати для незаконної діяльності.</li>
                    <li>Намагатися отримати несанкціонований доступ.</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">3. Обліковий запис</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ви несете відповідальність за конфіденційність облікових даних
                    та всі дії під вашим обліковим записом. Ми залишаємо за собою право
                    заблокувати акаунт у разі порушення Умов.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">4. Користувацький контент</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li>Ви зберігаєте всі права на завантажений Контент.</li>
                    <li>Ви гарантуєте, що маєте право на його використання.</li>
                    <li>Ми залишаємо за собою право видаляти Контент, що порушує законодавство.</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">5. Відмова від гарантій</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Додаток надається &quot;як є&quot;. Ми не гарантуємо безперебійну роботу
                    та не несемо відповідальності за втрату даних.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">6. Обмеження відповідальності</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Розробники не несуть відповідальності за будь-які прямі, непрямі або побічні збитки
                    від використання Додатку.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">7. Контакти</h3>
                <ul className="list-none space-y-1 text-sm text-text-secondary">
                    <li><strong>Email:</strong> artom.devv@gmail.com</li>
                    <li><strong>Telegram:</strong> <a href="https://t.me/artom_dev" className="text-primary hover:underline">@artom_dev</a></li>
                </ul>
            </section>

            <footer className="border-t border-border pt-4 mt-4">
                <p className="text-xs text-text-secondary text-center">© 2026 MyChoir. Всі права захищені.</p>
            </footer>
        </>
    );
}
