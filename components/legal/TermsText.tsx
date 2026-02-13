import React from 'react';

export default function TermsText() {
    return (
        <>
            <p className="text-xs text-text-secondary">Останнє оновлення: 13 лютого 2026</p>

            {/* 1. General */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">1. Загальні положення</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ці Умови використання (далі — &quot;Умови&quot;) регулюють доступ та використання
                    додатку &quot;MyChoir&quot; (далі — &quot;Додаток&quot;), доступного як веб-додаток (PWA)
                    та мобільний додаток для платформ iOS та Android.
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Використовуючи Додаток, ви підтверджуєте, що ознайомились та погоджуєтесь із цими Умовами.
                    Якщо ви не погоджуєтесь з будь-яким положенням — припиніть використання Додатку.
                </p>
            </section>

            {/* 2. Operator */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">2. Оператор</h3>
                <ul className="list-none space-y-1 text-sm text-text-secondary">
                    <li><strong>Оператор:</strong> Фізична особа — Дуля Артьом</li>
                    <li><strong>Юрисдикція:</strong> Україна</li>
                    <li><strong>Email:</strong> artom.devv@gmail.com</li>
                </ul>
            </section>

            {/* 3. Service Description */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">3. Опис сервісу</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    MyChoir — це некомерційна платформа для організації хорового служіння, яка надає:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Управління репертуаром (пісні, ноти, аудіо)</li>
                    <li>Планування служінь та розкладу</li>
                    <li>Облік присутності хористів</li>
                    <li>Обмін інформацією через push-сповіщення</li>
                    <li>Доступ до каталогу МХО (МСЦ ЄХБ). Архів МХО використовується як відкритий інформаційний ресурс і не є власністю Додатку.</li>
                    <li>Автономний доступ до даних (офлайн режим)</li>
                </ul>
            </section>

            {/* 4. Registration */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">4. Реєстрація та обліковий запис</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Для використання Додатку необхідна авторизація через обліковий запис Google (Google Sign-In).
                    Ви несете відповідальність за безпеку свого облікового запису та всі дії,
                    здійснені під вашими обліковими даними.
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми залишаємо за собою право призупинити або видалити обліковий запис
                    у разі порушення цих Умов.
                </p>
            </section>

            {/* D. Age */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">5. Вікові обмеження</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Додаток не призначений для осіб молодших за 13 років (або 16 років
                    у юрисдикціях ЄС, де це вимагається). Використовуючи Додаток, ви підтверджуєте,
                    що досягли відповідного мінімального віку.
                </p>
            </section>

            {/* 5. License */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">6. Ліцензія на використання</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми надаємо вам обмежену, невиключну, відкличну, безоплатну ліцензію на використання
                    Додатку для особистих та некомерційних цілей, пов&apos;язаних з організацією хорового служіння.
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">Заборонено:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Відтворювати, модифікувати або поширювати вихідний код Додатку.</li>
                    <li>Використовувати Додаток для незаконної діяльності.</li>
                    <li>Намагатися отримати несанкціонований доступ до даних інших користувачів або систем.</li>
                    <li>Використовувати автоматизовані засоби для збору даних з Додатку.</li>
                    <li>Видаляти або змінювати повідомлення про авторські права.</li>
                </ul>
            </section>

            {/* 6. User Content */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">7. Користувацький контент</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary">
                    <li>Ви зберігаєте всі права інтелектуальної власності на завантажений вами контент.</li>
                    <li>Ви гарантуєте, що маєте необхідні права для завантаження та поширення контенту.</li>
                    <li>
                        Ви надаєте нам обмежену ліцензію на зберігання, обробку та відображення
                        вашого контенту виключно в рамках функціоналу Додатку.
                    </li>
                    <li>
                        Ми залишаємо за собою право видаляти контент, який порушує чинне
                        законодавство або авторські права третіх осіб.
                    </li>
                </ul>
            </section>

            {/* Privacy Reference */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">8. Конфіденційність</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Збір, обробка та захист персональних даних регулюються нашою Політикою конфіденційності,
                    яка є невід&apos;ємною частиною цих Умов. Ознайомтесь з нею перед використанням Додатку.
                </p>
            </section>

            {/* G. Push */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">9. Push-сповіщення</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Додаток може надсилати push-сповіщення за вашою згодою.
                    Сповіщення мають виключно функціональний характер (нові служіння, зміни в розкладі,
                    повідомлення від регента) і <strong>не використовуються</strong> для маркетингу чи реклами.
                    Ви можете вимкнути сповіщення в будь-який момент через налаштування пристрою.
                </p>
            </section>

            {/* F. Account Deletion */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">10. Видалення акаунту</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ви маєте право видалити свій обліковий запис у будь-який момент через Додаток:
                    Акаунт → &quot;Видалити акаунт&quot;. Після підтвердження:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    <li>Усі персональні дані будуть безповоротно видалені протягом 30 днів.</li>
                    <li>Спільний контент хору може залишатися доступним для інших учасників.</li>
                    <li>Ми не зберігаємо активні резервні копії персональних даних після завершення процедури видалення. Технічні резервні копії провайдерів можуть зберігатися протягом обмеженого часу відповідно до їх політик.</li>
                </ul>
            </section>

            {/* E. Disclaimer */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">11. Відмова від гарантій</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Додаток надається на умовах &quot;як є&quot; (as is) та &quot;як доступно&quot; (as available).
                    В межах, дозволених чинним законодавством, ми не надаємо жодних гарантій,
                    явних або неявних, щодо безперебійної, безпомилкової або безпечної роботи Додатку.
                </p>
            </section>

            {/* E. Liability */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">12. Обмеження відповідальності</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    В максимально дозволеній чинним законодавством мірі, розробники Додатку не несуть
                    відповідальності за будь-які прямі, непрямі, побічні, штрафні або випадкові збитки,
                    що виникли внаслідок використання або неможливості використання Додатку,
                    включаючи, але не обмежуючись, втрату даних або переривання сервісу.
                </p>
            </section>

            {/* Changes */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">13. Зміни до Умов</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ми залишаємо за собою право оновлювати ці Умови. Дата останнього оновлення
                    вказана на початку документу. У разі суттєвих змін ми повідомимо вас через Додаток.
                    Продовження використання Додатку після публікації змін означає вашу згоду
                    з оновленими Умовами.
                </p>
            </section>

            {/* Governing Law */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">14. Застосовне право</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Ці Умови регулюються та тлумачаться відповідно до законодавства України,
                    без урахування колізійних норм. У разі спору сторони докладатимуть зусиль
                    для його вирішення шляхом переговорів.
                </p>
            </section>

            {/* Contact */}
            <section className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary">15. Контакти</h3>
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
