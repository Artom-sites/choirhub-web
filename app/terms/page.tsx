"use client";

import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
    const handleBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '/';
        }
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
                        <span>Назад</span>
                    </button>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">Умови використання</h1>
                    <p className="text-sm">Останнє оновлення: 3 лютого 2026</p>
                </header>

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
                        <li><strong>Telegram:</strong> <a href="https://t.me/artom_dev" className="text-primary hover:underline">@artom_dev</a></li>
                    </ul>
                </section>

                <footer className="border-t border-border pt-6 mt-8">
                    <p className="text-sm text-center">
                        © 2026 MyChoir. Всі права захищені.
                    </p>
                </footer>
            </div>
        </div>
    );
}
