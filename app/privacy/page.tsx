export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#09090b] text-text-secondary p-6 md:p-12 font-sans">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="border-b border-white/10 pb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">Політика конфіденційності</h1>
                    <p className="text-sm">Останнє оновлення: 30 січня 2026</p>
                </header>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">1. Вступ</h2>
                    <p>
                        Ця політика конфіденційності пояснює, як додаток "MyChoir" збирає, використовує та захищає вашу інформацію.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">2. Які дані ми збираємо</h2>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Облікові дані:</strong> Ім'я, Email, фото профілю (через Google Sign-In).</li>
                        <li><strong>Дані хору:</strong> Інформація про вашу належність до хорів, роль (регент/хорист) та партії.</li>
                        <li><strong>Активність:</strong> Відвідування репетицій та служінь.</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">3. Як ми використовуємо дані</h2>
                    <p>Ми використовуємо ваші дані виключно для забезпечення функціонування додатку:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Для авторизації та ідентифікації користувача.</li>
                        <li>Для відображення актуального розкладу та репертуару хору.</li>
                        <li>Для комунікації між регентом та хористами (сповіщення).</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">4. Видалення даних</h2>
                    <p>
                        Ви маєте право повністю видалити свій акаунт та всі пов'язані дані в будь-який момент.
                        Для цього скористайтесь кнопкою <strong>"Видалити акаунт"</strong> в меню налаштувань профілю в додатку.
                        Після підтвердження всі дані будуть безповоротно стерті з наших серверів.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">5. Контакти</h2>
                    <p>
                        Якщо у вас є питання щодо цієї політики, зв'яжіться з нами за адресою: support@mychoir.app
                    </p>
                </section>
            </div>
        </div>
    );
}
