"use client";

import { X } from "lucide-react";
import { Browser } from "@capacitor/browser";

interface TermsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
    if (!isOpen) return null;

    const openExternal = async (url: string) => {
        await Browser.open({ url });
    };

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <div
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <div className="relative bg-surface border border-border w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between bg-surface sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-text-primary tracking-tight">Умови використання</h2>
                        <p className="text-sm text-text-secondary mt-1">Останнє оновлення: 3 лютого 2026</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-surface-highlight hover:bg-border rounded-full transition-colors text-text-secondary hover:text-text-primary"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 text-text-secondary">
                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold text-text-primary">1. Загальні положення</h2>
                        <p>
                            Ці Умови використання (далі — &quot;Умови&quot;) регулюють доступ до мобільного додатку та веб-сайту &quot;MyChoir&quot; (далі — &quot;Додаток&quot;).
                            Завантажуючи, встановлюючи або використовуючи Додаток, ви (далі — &quot;Користувач&quot;) погоджуєтесь із цими Умовами.
                        </p>
                        <p>
                            Якщо ви не погоджуєтесь із цими Умовами, будь ласка, не використовуйте Додаток.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold text-text-primary">2. Ліцензія на використання</h2>
                        <p>
                            Ми надаємо вам обмежену, невиключну, особисту ліцензію на використання Додатку виключно
                            для особистих та некомерційних цілей, пов&apos;язаних з організацією хорового служіння.
                        </p>
                        <p>Заборонено:</p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>Копіювати, модифікувати або поширювати вихідний код Додатку.</li>
                            <li>Використовувати Додаток для будь-якої незаконної діяльності.</li>
                            <li>Намагатися отримати несанкціонований доступ до серверів або баз даних.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold text-text-primary">3. Обліковий запис</h2>
                        <p>
                            Для використання більшості функцій Додатку вам необхідно створити обліковий запис.
                            Ви несете відповідальність за збереження конфіденційності ваших обікових даних
                            та за всі дії, що відбуваються під вашим обліковим записом.
                        </p>
                        <p className="mt-2">
                            Ми залишаємо за собою право заблокувати або видалити ваш акаунт у разі порушення цих Умов.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold text-text-primary">4. Користувацький контент</h2>
                        <p>
                            Додаток дозволяє завантажувати тексти, ноти, аудіофайли та інші матеріали (далі — &quot;Контент&quot;).
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                Ви зберігаєте всі права на Контент, який ви завантажуєте.
                            </li>
                            <li>
                                Ви гарантуєте, що маєте право на використання та поширення цього Контенту.
                            </li>
                            <li>
                                Ми не несемо відповідальності за зміст матеріалів, завантажених користувачами,
                                але залишаємо за собою право видаляти Контент, що порушує законодавство або ці Умови.
                            </li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold text-text-primary">5. Відмова від гарантій</h2>
                        <p>
                            Додаток надається на умовах &quot;як є&quot; (as is). Ми не гарантуємо, що робота Додатку буде
                            безперебійною або безпомилковою. Ми не несемо відповідальності за втрату даних,
                            хоча вживаємо всіх заходів для їх захисту.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold text-text-primary">6. Обмеження відповідальності</h2>
                        <p>
                            У максимальному ступені, дозволеному законом, розробники Додатку не несуть відповідальності
                            за будь-які прямі, непрямі, випадкові або побічні збитки, що виникли внаслідок
                            використання або неможливості використання Додатку.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold text-text-primary">7. Зміни до Умов</h2>
                        <p>
                            Ми можемо оновлювати ці Умови в будь-який час. Продовження використання Додатку
                            після внесення змін означає вашу згоду з новими Умовами.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold text-text-primary">8. Контакти</h2>
                        <p>
                            Для зв&apos;язку з нами щодо цих Умов або роботи Додатку:
                        </p>
                        <ul className="list-none space-y-1 mt-2">
                            <li><strong>Email:</strong> artom.devv@gmail.com</li>
                            <li><strong>Telegram:</strong> <button onClick={() => openExternal('https://t.me/artom_dev')} className="text-primary hover:underline">@artom_dev</button></li>
                        </ul>
                    </section>

                    <div className="p-6 border-t border-border bg-surface mt-6">
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-colors"
                        >
                            Зрозуміло
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
