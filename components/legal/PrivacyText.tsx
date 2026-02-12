import React from 'react';

export default function PrivacyText() {
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
