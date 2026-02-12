import React from 'react';

export default function PrivacyText() {
    return (
        <>
            <p className="text-xs text-text-secondary">Останнє оновлення: 13 лютого 2026</p>

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

                <h4 className="text-sm font-semibold text-text-primary mt-2">2.1. Облікові дані (через Google Sign-In)</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Ім&apos;я та прізвище</li>
                    <li>Адреса електронної пошти (email)</li>
                    <li>Фото профілю (URL з Google)</li>
                    <li>Унікальний ідентифікатор Firebase Auth (UID)</li>
                </ul>

                <h4 className="text-sm font-semibold text-text-primary mt-2">2.2. Дані хору</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Належність до хорів (членство в одному або кількох хорах)</li>
                    <li>Роль у хорі (хорист, регент, адміністратор)</li>
                    <li>Вокальна партія (Сопрано, Альт, Тенор, Бас)</li>
                    <li>Коди запрошення до хору</li>
                </ul>

                <h4 className="text-sm font-semibold text-text-primary mt-2">2.3. Контент</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Пісні: назва, композитор, категорія, тональність</li>
                    <li>Ноти: PDF-файли партій (партитура, сопрано, альт, тенор, бас)</li>
                    <li>Аудіофайли партій</li>
                    <li>Плани служінь: дата, час, список пісень, порядок</li>
                    <li>Анотації та нотатки до нот (зберігаються на пристрої)</li>
                </ul>

                <h4 className="text-sm font-semibold text-text-primary mt-2">2.4. Активність</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Відвідування репетицій та служінь</li>
                    <li>Статистика присутності</li>
                </ul>

                <h4 className="text-sm font-semibold text-text-primary mt-2">2.5. Технічні дані</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Push-токени (FCM) для доставки сповіщень</li>
                    <li>Налаштування теми оформлення (темна/світла)</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">3. Як ми використовуємо дані</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li>Для авторизації та ідентифікації користувача (Firebase Authentication).</li>
                    <li>Для відображення розкладу та репертуару хору.</li>
                    <li>Для комунікації між регентом та хористами (push-сповіщення через Firebase Cloud Messaging).</li>
                    <li>Для ведення статистики відвідувань.</li>
                    <li>Для забезпечення автономної роботи (кешування даних для офлайн доступу).</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">4. Де зберігаються дані</h3>

                <h4 className="text-sm font-semibold text-text-primary mt-2">4.1. Серверне зберігання</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li><strong>Google Firebase (Firestore):</strong> облікові дані, профілі, хори, пісні (метадані), служіння, відвідуваність, push-токени. Шифрування TLS/SSL + AES-256.</li>
                    <li><strong>Cloudflare R2:</strong> PDF-файли нот та аудіофайли з каталогу МХО. Шифрування при передачі (TLS) та у стані спокою.</li>
                    <li><strong>Vercel:</strong> хостинг веб-додатку. Дані користувачів не зберігаються на серверах Vercel.</li>
                </ul>

                <h4 className="text-sm font-semibold text-text-primary mt-2">4.2. Локальне зберігання на пристрої</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li><strong>localStorage:</strong> тема оформлення, кешовані метадані пісень та служінь (для офлайн доступу, до 7 днів), анотації до нот.</li>
                    <li><strong>IndexedDB:</strong> кешовані PDF-файли нот (для офлайн доступу, автоматично видаляються через 7 днів).</li>
                </ul>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Локальні дані зберігаються виключно на вашому пристрої і не передаються на сервер.
                    Ви можете очистити їх через налаштування браузера або застосунку.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">5. Передача даних третім сторонам</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми <strong>не продаємо</strong> та <strong>не передаємо</strong> ваші дані для маркетингу чи рекламних цілей.
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">Дані обробляються наступними сервіс-провайдерами:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li><strong>Google Firebase:</strong> авторизація (Auth), база даних (Firestore), push-сповіщення (FCM).</li>
                    <li><strong>Cloudflare:</strong> зберігання файлів (R2), CDN.</li>
                    <li><strong>Vercel:</strong> хостинг веб-додатку.</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">6. Cookies та аналітика</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми використовуємо мінімальні cookies для сесії авторизації Firebase.
                    Ми <strong>не використовуємо</strong> рекламні cookies, трекери, Google Analytics або інші інструменти відстеження.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">7. Ваші права (GDPR)</h3>
                <p className="text-sm text-text-secondary leading-relaxed">Відповідно до GDPR, ви маєте такі права:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li><strong>Доступ:</strong> Запитати копію ваших даних.</li>
                    <li><strong>Виправлення:</strong> Оновити неточну інформацію (ім&apos;я — через налаштування профілю).</li>
                    <li><strong>Видалення:</strong> Повністю видалити акаунт та всі пов&apos;язані дані.</li>
                    <li><strong>Переносність:</strong> Експортувати дані у зручному форматі.</li>
                    <li><strong>Обмеження / Заперечення:</strong> Обмежити обробку ваших даних.</li>
                </ul>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Для реалізації цих прав зв&apos;яжіться з нами за контактами нижче.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">8. Видалення даних</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Скористайтесь кнопкою &quot;Видалити акаунт&quot; в налаштуваннях профілю.
                    Всі серверні дані будуть стерті протягом 30 днів.
                    Локальний кеш на пристрої видаляється автоматично або через налаштування браузера.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">9. Діти</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Додаток не призначений для дітей до 13 років. Ми свідомо не збираємо
                    персональні дані неповнолітніх без згоди батьків або законних представників.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">10. Зміни до політики</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми можемо оновлювати цю політику конфіденційності. Дата останнього оновлення
                    вказана на початку документу. Продовжуючи використовувати Додаток після змін,
                    ви приймаєте оновлену політику.
                </p>
            </section>

            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">11. Контакти</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    З питань щодо конфіденційності ваших даних зв&apos;яжіться з нами:
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
