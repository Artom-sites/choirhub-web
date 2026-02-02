"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyPage() {
    const router = useRouter();

    const handleBack = () => {
        // Try to go back in history, if no history - go to main page
        if (window.history.length > 1) {
            router.back();
        } else {
            router.push('/');
        }
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-text-secondary p-6 md:p-12 font-sans">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="border-b border-white/10 pb-6">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Назад</span>
                    </button>
                    <h1 className="text-3xl font-bold text-white mb-2">Політика конфіденційності</h1>
                    <p className="text-sm">Останнє оновлення: 3 лютого 2026</p>
                </header>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">1. Вступ</h2>
                    <p>
                        Ця політика конфіденційності пояснює, як додаток &quot;MyChoir&quot; (далі — &quot;Додаток&quot;, &quot;ми&quot;, &quot;нас&quot;)
                        збирає, використовує, зберігає та захищає вашу персональну інформацію.
                        Використовуючи наш Додаток, ви погоджуєтесь з умовами цієї політики.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">2. Які дані ми збираємо</h2>
                    <p>Ми збираємо наступні категорії персональних даних:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong>Облікові дані:</strong> Ім&apos;я, Email, фото профілю (отримані через Google Sign-In).
                        </li>
                        <li>
                            <strong>Дані хору:</strong> Інформація про вашу належність до хорів, роль (регент/хорист),
                            вокальна партія (сопрано, альт, тенор, бас).
                        </li>
                        <li>
                            <strong>Активність:</strong> Відвідування репетицій та служінь, статистика присутності.
                        </li>
                        <li>
                            <strong>Контент:</strong> Пісні, ноти (PDF), аудіофайли, що завантажуються до репертуару хору.
                        </li>
                        <li>
                            <strong>Push-токени:</strong> Технічні ідентифікатори для надсилання сповіщень на ваш пристрій.
                        </li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">3. Як ми використовуємо дані</h2>
                    <p>Ми використовуємо ваші дані виключно для забезпечення функціонування Додатку:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Для авторизації та ідентифікації користувача.</li>
                        <li>Для відображення актуального розкладу та репертуару хору.</li>
                        <li>Для комунікації між регентом та хористами (push-сповіщення).</li>
                        <li>Для ведення статистики відвідувань та активності хору.</li>
                        <li>Для покращення якості сервісу та виправлення помилок.</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">4. Зберігання та захист даних</h2>
                    <p>
                        Ваші дані зберігаються на захищених серверах Google Firebase (Firestore Database)
                        та Cloudflare R2 (для файлів PDF та аудіо). Ми використовуємо:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Шифрування даних при передачі (TLS/SSL).</li>
                        <li>Шифрування даних у стані спокою (AES-256).</li>
                        <li>Суворі правила доступу (Firebase Security Rules).</li>
                        <li>Автентифікацію через захищений OAuth 2.0 протокол Google.</li>
                    </ul>
                    <p className="mt-2">
                        Дані зберігаються на серверах, розташованих у Європейському Союзі та США,
                        що відповідає вимогам GDPR.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">5. Передача даних третім сторонам</h2>
                    <p>Ми <strong>не продаємо</strong> та <strong>не передаємо</strong> ваші персональні дані третім сторонам для маркетингових цілей.</p>
                    <p className="mt-2">Ваші дані можуть бути доступні наступним сервіс-провайдерам:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Google Firebase:</strong> Хостинг бази даних та автентифікація.</li>
                        <li><strong>Cloudflare:</strong> Зберігання файлів та CDN.</li>
                        <li><strong>Vercel:</strong> Хостинг веб-додатку.</li>
                    </ul>
                    <p className="mt-2">
                        Ці провайдери мають власні політики конфіденційності та зобов&apos;язані захищати ваші дані.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">6. Cookies та аналітика</h2>
                    <p>
                        Додаток використовує мінімальну кількість cookies для підтримки сесії авторизації.
                        Ми <strong>не використовуємо</strong> рекламні cookies або трекери.
                    </p>
                    <p className="mt-2">
                        Для покращення якості сервісу ми можемо збирати анонімну статистику
                        використання (без ідентифікації особи).
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">7. Ваші права (GDPR)</h2>
                    <p>Відповідно до Загального регламенту захисту даних (GDPR), ви маєте право:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Доступ:</strong> Запитати копію всіх ваших персональних даних.</li>
                        <li><strong>Виправлення:</strong> Оновити або виправити неточну інформацію.</li>
                        <li><strong>Видалення:</strong> Повністю видалити свій акаунт та всі пов&apos;язані дані.</li>
                        <li><strong>Переносність:</strong> Експортувати ваші дані у машиночитаному форматі.</li>
                        <li><strong>Обмеження:</strong> Обмежити обробку ваших даних за певних обставин.</li>
                        <li><strong>Заперечення:</strong> Відмовитись від певних видів обробки даних.</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">8. Видалення даних</h2>
                    <p>
                        Ви маєте право повністю видалити свій акаунт та всі пов&apos;язані дані в будь-який момент.
                        Для цього скористайтесь кнопкою <strong>&quot;Видалити акаунт&quot;</strong> в меню
                        налаштувань профілю в Додатку.
                    </p>
                    <p className="mt-2">
                        Після підтвердження всі дані будуть безповоротно стерті з наших серверів
                        протягом 30 днів. Це включає:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Ваш профіль та облікові дані.</li>
                        <li>Історію відвідувань та активності.</li>
                        <li>Файли, які ви завантажили (якщо вони не використовуються іншими користувачами).</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">9. Дані неповнолітніх</h2>
                    <p>
                        Наш Додаток не призначений для дітей віком до 13 років.
                        Ми свідомо не збираємо персональні дані від осіб цього віку.
                        Якщо ви вважаєте, що ми випадково зібрали такі дані,
                        будь ласка, зв&apos;яжіться з нами для їх видалення.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">10. Зміни до політики</h2>
                    <p>
                        Ми можемо оновлювати цю політику конфіденційності час від часу.
                        Про суттєві зміни ми повідомимо через Додаток або електронною поштою.
                        Дата останнього оновлення завжди вказана вгорі документа.
                    </p>
                    <p className="mt-2">
                        Продовжуючи використовувати Додаток після змін, ви погоджуєтесь з оновленою політикою.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">11. Контакти</h2>
                    <p>
                        Якщо у вас є питання щодо цієї політики конфіденційності або ви бажаєте
                        скористатись своїми правами, зв&apos;яжіться з нами:
                    </p>
                    <ul className="list-none space-y-1 mt-2">
                        <li><strong>Email:</strong> artom.devv@gmail.com</li>
                        <li><strong>Telegram:</strong> <a href="https://t.me/artom_dev" className="text-blue-400 hover:underline">@artom_dev</a></li>
                        <li><strong>Сайт:</strong> <a href="https://artom.dev" className="text-blue-400 hover:underline">artom.dev</a></li>
                    </ul>
                    <p className="mt-4 text-sm">
                        Ми зобов&apos;язуємось відповісти на ваш запит протягом 30 днів.
                    </p>
                </section>

                <footer className="border-t border-white/10 pt-6 mt-8">
                    <p className="text-sm text-center">
                        © 2026 MyChoir. Всі права захищені.
                    </p>
                </footer>
            </div>
        </div>
    );
}
