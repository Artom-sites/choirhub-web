import React from 'react';

export default function TermsText() {
    return (
        <>
            <p className="text-xs text-text-secondary">Останнє оновлення: 13 лютого 2026</p>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">1. Загальні положення</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ці Умови використання (далі — &quot;Умови&quot;) регулюють доступ до додатку &quot;MyChoir&quot;
                    (далі — &quot;Додаток&quot;), доступного як веб-додаток (PWA) та мобільний додаток.
                    Використовуючи Додаток, ви погоджуєтесь із цими Умовами.
                    Якщо ви не погоджуєтесь — припиніть використання Додатку.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">2. Опис сервісу</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    MyChoir — це платформа для організації хорового служіння, яка дозволяє:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Керувати репертуаром (пісні, ноти, аудіо)</li>
                    <li>Планувати служіння та розклад</li>
                    <li>Вести облік присутності хористів</li>
                    <li>Обмінюватися інформацією через push-сповіщення</li>
                    <li>Використовувати каталог МХО (МСЦ ЄХБ)</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">3. Реєстрація та обліковий запис</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Для використання Додатку потрібна авторизація через Google Sign-In.
                    Ви несете відповідальність за конфіденційність облікових даних
                    та всі дії під вашим обліковим записом.
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми залишаємо за собою право заблокувати або видалити акаунт у разі порушення Умов.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">4. Ліцензія на використання</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми надаємо обмежену, невиключну, відкличну ліцензію для особистих та некомерційних цілей,
                    пов&apos;язаних з організацією хорового служіння.
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">Заборонено:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Копіювати, модифікувати або поширювати вихідний код Додатку.</li>
                    <li>Використовувати Додаток для незаконної діяльності.</li>
                    <li>Намагатися отримати несанкціонований доступ до даних інших користувачів.</li>
                    <li>Використовувати автоматизовані засоби для масового збору даних.</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">5. Користувацький контент</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li>Ви зберігаєте всі права на завантажений Контент (PDF, аудіо, тощо).</li>
                    <li>Ви гарантуєте, що маєте необхідні права на завантажений Контент.</li>
                    <li>Ви надаєте нам обмежену ліцензію на зберігання та відображення Контенту в рамках Додатку.</li>
                    <li>Ми залишаємо за собою право видаляти Контент, що порушує законодавство або авторські права.</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">6. Конфіденційність</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Збір та обробка персональних даних регулюється нашою Політикою конфіденційності,
                    яка є невід&apos;ємною частиною цих Умов.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">7. Відмова від гарантій</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Додаток надається &quot;як є&quot; (as is). Ми не гарантуємо безперебійну
                    або безпомилкову роботу та не несемо відповідальності за втрату даних,
                    перебої в роботі або несумісність з окремими пристроями.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">8. Обмеження відповідальності</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    В максимально дозволеною законом мірі, розробники не несуть відповідальності
                    за будь-які прямі, непрямі, побічні або штрафні збитки від використання
                    або неможливості використання Додатку.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">9. Зміни до умов</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми можемо оновлювати ці Умови. Дата останнього оновлення вказана на початку документу.
                    Продовжуючи використовувати Додаток після змін, ви приймаєте оновлені Умови.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">10. Контакти</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    З питань щодо цих Умов зв&apos;яжіться з нами:
                </p>
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
