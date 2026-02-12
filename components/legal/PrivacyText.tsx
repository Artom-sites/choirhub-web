import React from 'react';

export default function PrivacyText() {
    return (
        <>
            <p className="text-xs text-text-secondary">Останнє оновлення: 13 лютого 2026</p>

            {/* 1. Introduction */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">1. Вступ</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ця Політика конфіденційності описує, як додаток &quot;MyChoir&quot; (далі — &quot;Додаток&quot;)
                    збирає, використовує, зберігає та захищає персональні дані користувачів.
                    Використовуючи Додаток, ви підтверджуєте, що ознайомились та погоджуєтесь
                    з умовами цієї Політики.
                </p>
            </section>

            {/* A. Data Controller */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">2. Оператор даних</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Оператором (контролером) персональних даних є:
                </p>
                <ul className="list-none space-y-1 text-sm text-text-secondary">
                    <li><strong>Оператор:</strong> Фізична особа — Дуля Артьом</li>
                    <li><strong>Юрисдикція:</strong> Україна</li>
                    <li><strong>Email для питань конфіденційності:</strong> artom.devv@gmail.com</li>
                    <li><strong>Telegram:</strong> <a href="https://t.me/artom_dev" className="text-primary hover:underline">@artom_dev</a></li>
                </ul>
            </section>

            {/* 2. Data collected */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">3. Які дані ми збираємо</h3>

                <h4 className="text-sm font-semibold text-text-primary mt-2">3.1. Облікові дані</h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                    При авторизації через Google Sign-In ми отримуємо:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Ім&apos;я та прізвище</li>
                    <li>Адреса електронної пошти</li>
                    <li>URL фото профілю</li>
                    <li>Унікальний ідентифікатор користувача (Firebase UID)</li>
                </ul>

                <h4 className="text-sm font-semibold text-text-primary mt-2">3.2. Дані хору</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Членство у хорах</li>
                    <li>Роль (хорист, регент, адміністратор)</li>
                    <li>Вокальна партія (Сопрано, Альт, Тенор, Бас)</li>
                </ul>

                <h4 className="text-sm font-semibold text-text-primary mt-2">3.3. Контент</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Пісні: назва, композитор, категорія, тональність</li>
                    <li>Файли нот (PDF) та аудіозаписи партій</li>
                    <li>Плани служінь: дата, час, список пісень</li>
                    <li>Анотації до нот (зберігаються локально на пристрої)</li>
                </ul>

                <h4 className="text-sm font-semibold text-text-primary mt-2">3.4. Дані активності</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Відвідування служінь та репетицій</li>
                    <li>Статистика присутності</li>
                </ul>

                <h4 className="text-sm font-semibold text-text-primary mt-2">3.5. Технічні дані</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Токен push-сповіщень (Firebase Cloud Messaging)</li>
                    <li>Налаштування теми оформлення</li>
                </ul>
            </section>

            {/* B. Legal Basis */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">4. Правові підстави для обробки (GDPR, ст. 6)</h3>
                <p className="text-sm text-text-secondary leading-relaxed">Ми обробляємо ваші дані на таких підставах:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li>
                        <strong>Виконання договору (ст. 6(1)(b)):</strong> обробка необхідна для надання основного
                        функціоналу Додатку — авторизації, управління хором, відображення репертуару та служінь.
                    </li>
                    <li>
                        <strong>Законний інтерес (ст. 6(1)(f)):</strong> ведення статистики відвідувань,
                        забезпечення безпеки облікових записів, покращення якості сервісу.
                    </li>
                    <li>
                        <strong>Згода (ст. 6(1)(a)):</strong> надсилання push-сповіщень. Ви можете відкликати
                        згоду в будь-який момент через налаштування пристрою.
                    </li>
                </ul>
            </section>

            {/* 3. Use */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">5. Як ми використовуємо дані</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li>Авторизація та ідентифікація користувача.</li>
                    <li>Відображення репертуару хору та розкладу служінь.</li>
                    <li>Надсилання функціональних push-сповіщень (нове служіння, зміни в розкладі, повідомлення від регента).</li>
                    <li>Ведення обліку відвідувань за рішенням регента хору.</li>
                    <li>Забезпечення автономного доступу (кешування даних на пристрої).</li>
                </ul>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми <strong>не використовуємо</strong> push-сповіщення для маркетингу чи реклами.
                </p>
            </section>

            {/* C. Data Location */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">6. Розташування та захист даних</h3>

                <h4 className="text-sm font-semibold text-text-primary mt-2">6.1. Серверне зберігання</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>
                        <strong>Google Firebase (Firestore, Auth, FCM):</strong> облікові дані, профілі, метадані
                        пісень, служіння, відвідуваність, push-токени.
                    </li>
                    <li>
                        <strong>Cloudflare R2:</strong> PDF-файли нот та аудіозаписи.
                    </li>
                    <li>
                        <strong>Vercel:</strong> хостинг веб-додатку (дані користувачів не зберігаються).
                    </li>
                </ul>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Дані можуть оброблятися в Європейському Союзі, США та інших юрисдикціях,
                    де розташовані сервери наших провайдерів. Усі передачі даних захищені
                    шифруванням TLS/SSL.
                </p>

                <h4 className="text-sm font-semibold text-text-primary mt-2">6.2. Локальне зберігання на пристрої</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>
                        <strong>localStorage:</strong> тема оформлення, кешовані метадані пісень та служінь
                        (для офлайн доступу, термін зберігання — до 7 днів), анотації до нот.
                    </li>
                    <li>
                        <strong>IndexedDB:</strong> кешовані PDF-файли нот (автоматичне видалення через 7 днів).
                    </li>
                </ul>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Локальні дані зберігаються виключно на вашому пристрої, не передаються на сервер
                    і можуть бути очищені через налаштування браузера або додатку.
                </p>
            </section>

            {/* 5. Third parties */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">7. Передача даних третім сторонам</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми <strong>не продаємо</strong>, <strong>не передаємо</strong> та <strong>не надаємо</strong> ваші
                    дані третім сторонам для маркетингу чи рекламних цілей.
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Дані можуть оброблятися наступними сервіс-провайдерами виключно для забезпечення
                    роботи Додатку:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li><strong>Google LLC:</strong> Firebase Authentication, Firestore, Cloud Messaging.</li>
                    <li><strong>Cloudflare, Inc.:</strong> зберігання файлів (R2), CDN.</li>
                    <li><strong>Vercel Inc.:</strong> хостинг веб-додатку.</li>
                </ul>
            </section>

            {/* 6. Cookies */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">8. Cookies та аналітика</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Додаток використовує мінімальні cookies, необхідні для підтримки сесії авторизації Firebase.
                    Ми <strong>не використовуємо</strong> рекламні cookies, трекери, Google Analytics
                    або будь-які інші інструменти відстеження поведінки користувачів.
                </p>
            </section>

            {/* H. Data Retention */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">9. Строки зберігання даних</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li>
                        <strong>Облікові дані та профіль:</strong> зберігаються протягом усього терміну
                        існування облікового запису.
                    </li>
                    <li>
                        <strong>Контент хору (пісні, служіння):</strong> зберігається, доки хор активний
                        у системі.
                    </li>
                    <li>
                        <strong>Статистика відвідувань:</strong> зберігається протягом терміну існування хору.
                    </li>
                    <li>
                        <strong>Push-токени:</strong> оновлюються автоматично; видаляються при видаленні
                        акаунту.
                    </li>
                    <li>
                        <strong>Локальний кеш:</strong> автоматично видаляється через 7 днів або
                        вручну через налаштування.
                    </li>
                </ul>
            </section>

            {/* 7. GDPR Rights */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">10. Ваші права (GDPR)</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Відповідно до Загального регламенту захисту даних (GDPR), ви маєте такі права:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li><strong>Право доступу:</strong> отримати підтвердження обробки та копію ваших даних.</li>
                    <li><strong>Право на виправлення:</strong> оновити неточну або неповну інформацію.</li>
                    <li><strong>Право на видалення:</strong> вимагати видалення ваших даних.</li>
                    <li><strong>Право на переносність:</strong> отримати дані у структурованому, машинозчитуваному форматі.</li>
                    <li><strong>Право на обмеження обробки:</strong> обмежити обробку за певних обставин.</li>
                    <li><strong>Право на заперечення:</strong> заперечити проти обробки на підставі законного інтересу.</li>
                    <li><strong>Право відкликати згоду:</strong> відкликати раніше надану згоду (наприклад, на push-сповіщення).</li>
                </ul>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Для реалізації цих прав зверніться до нас за контактами, вказаними у розділі 2.
                </p>
            </section>

            {/* F. Account Deletion */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">11. Видалення акаунту та даних</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ви можете видалити свій обліковий запис у будь-який час через Додаток:
                    Акаунт → &quot;Видалити акаунт&quot;.
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li>Усі персональні дані на серверах будуть безповоротно стерті протягом 30 днів.</li>
                    <li>Контент хору (пісні, служіння), створений спільно, може залишатися доступним
                        для інших учасників хору.</li>
                    <li>Локальні дані на пристрої можна очистити через налаштування браузера.</li>
                </ul>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми не зберігаємо резервні копії персональних даних після завершення процедури видалення.
                </p>
            </section>

            {/* D. Age Restriction */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">12. Вікові обмеження</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Додаток не призначений для осіб молодших за 13 років (або 16 років у юрисдикціях ЄС,
                    де це вимагається). Ми свідомо не збираємо персональні дані неповнолітніх
                    без згоди батьків або законних представників. Якщо ви вважаєте, що неповнолітня
                    особа надала нам свої дані — зв&apos;яжіться з нами для їх видалення.
                </p>
            </section>

            {/* 10. Changes */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">13. Зміни до Політики</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми залишаємо за собою право оновлювати цю Політику конфіденційності.
                    Дата останнього оновлення вказана на початку документу.
                    У разі суттєвих змін ми повідомимо вас через Додаток.
                    Продовження використання Додатку після публікації змін означає вашу згоду
                    з оновленою Політикою.
                </p>
            </section>

            {/* 11. Contact */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">14. Контакти</h3>
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
