import React from 'react';

export default function TermsText() {
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
