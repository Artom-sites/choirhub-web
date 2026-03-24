import React from 'react';
import { Music2, Calendar, Users, Archive, Palette, Shield, User, FileText, Filter, Download, Trash2 } from "lucide-react";

export default function HelpContentRu({ activeTab, openExternal, isNative }: { activeTab: string, openExternal: (url: string) => void, isNative: boolean }) {
    return (
        <>
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <section>
                        <h3 className="text-2xl font-bold text-text-primary mb-4">Добро пожаловать в MyChoir! 👋</h3>
                        <p className="text-text-secondary leading-relaxed">
                            Это приложение для организации хоровой жизни. Просматривайте репертуар, планы служений,
                            учите партии, получайте уведомления и управляйте своим хором.
                        </p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Music2 className="w-6 h-6 text-purple-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">Репертуар</h4>
                            <p className="text-xs text-text-secondary">База песен хора с нотами и партиями.</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Calendar className="w-6 h-6 text-blue-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">Служения</h4>
                            <p className="text-xs text-text-secondary">Расписание служений с песнями и отметкой присутствия.</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Users className="w-6 h-6 text-green-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">Участники</h4>
                            <p className="text-xs text-text-secondary">Список хористов, партии и статистика посещений.</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-border">
                            <Archive className="w-6 h-6 text-amber-400 mb-3" />
                            <h4 className="font-bold text-text-primary mb-1">Архив МХО</h4>
                            <p className="text-xs text-text-secondary">Тысячи песен из каталога МСЦ ЕХБ (для хоров МСЦ).</p>
                        </div>
                    </div>

                    <section className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-5 rounded-3xl border border-indigo-500/20">
                        <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                            <Palette className="w-5 h-5 text-indigo-400" />
                            Темы оформления
                        </h4>
                        <p className="text-sm text-text-secondary">
                            Переключайтесь между темной и светлой темой в шапке приложения.
                            Также доступен системный режим, который следует настройкам вашего устройства.
                        </p>
                    </section>
                </div>
            )}

            {/* ROLES TAB */}
            {activeTab === 'roles' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Уровни Доступа</h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        <div className="p-5 md:p-6 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 h-full">
                            <div className="flex items-center gap-3 mb-3">
                                <Shield className="w-5 h-5 text-indigo-400" />
                                <h4 className="font-bold text-text-primary">Регент (Admin)</h4>
                            </div>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Полный контроль над хором 👑</li>
                                <li>Добавление, редактирование и удаление песен</li>
                                <li>Создание и редактирование планов служений</li>
                                <li>Управление участниками и их ролями</li>
                                <li>Создание кодов приглашения</li>
                                <li>Отправка push-уведомлений</li>
                                <li>Просмотр статистики посещений</li>
                                <li>Настройки хора (название, иконка)</li>
                            </ul>
                        </div>

                        <div className="p-5 md:p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 h-full">
                            <div className="flex items-center gap-3 mb-3">
                                <User className="w-5 h-5 text-emerald-400" />
                                <h4 className="font-bold text-text-primary">Помощник регента</h4>
                            </div>
                            <p className="text-sm text-text-secondary mb-3">
                                Хорист с расширенными правами через Админ-код:
                            </p>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Может добавлять песни в репертуар</li>
                                <li>Может видеть статистику посещений</li>
                                <li>Может редактировать служения</li>
                            </ul>
                        </div>

                        <div className="p-5 md:p-6 rounded-3xl bg-surface border border-border h-full">
                            <div className="flex items-center gap-3 mb-3">
                                <User className="w-5 h-5 text-gray-400" />
                                <h4 className="font-bold text-text-primary">Хорист (Member)</h4>
                            </div>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Просмотр репертуара и партий 👀</li>
                                <li>Просмотр расписания служений</li>
                                <li>Голосование за присутствие («Буду» / «Не буду»)</li>
                                <li>Скачивание PDF файлов</li>
                                <li>Синхронизация (офлайн режим)</li>
                            </ul>
                        </div>

                        <div className="p-5 md:p-6 rounded-3xl bg-surface border border-border h-full lg:col-span-2">
                            <h4 className="font-bold text-text-primary mb-2">🎭 Кастомные Роли и Партии</h4>
                            <p className="text-sm text-text-secondary">
                                Регент может создавать собственные роли (например, "Аккомпаниатор") и кастомные вокальные партии (например, "Баритон" или "Ученик"). Эти кастомные партии автоматически учитываются в статистике баланса голосов.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SONGS TAB */}
            {activeTab === 'songs' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Работа с песнями</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-400" />
                                Партии и партитура
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Каждая песня может иметь несколько партий: Партитура, Сопрано, Альт, Тенор, Бас.
                                Переключайтесь между ними с помощью вкладок в верхней части экрана песни.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Filter className="w-5 h-5 text-purple-400" />
                                Категории и фильтры
                            </h4>
                            <p className="text-sm text-text-secondary mb-3">
                                Песни автоматически группируются по категориям: Рождество, Пасха, Жатва и т.д.
                                Используйте фильтры в репертуаре для быстрого поиска.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Все</span>
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Рождество</span>
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Пасха</span>
                                <span className="text-[10px] px-2.5 py-1.5 bg-surface-highlight text-text-secondary rounded-lg font-medium">Жатва</span>
                            </div>
                        </div>

                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                Аннотации и заметки
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Откройте ноты на весь экран и нажмите карандаш, чтобы рисовать,
                                подчеркивать или писать заметки. Ваши пометки личные и сохраняются на устройстве.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Archive className="w-5 h-5 text-amber-400" />
                                Архив МХО
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Глобальный каталог с тысячами песен от МСЦ ЕХБ. Ищите песни,
                                просматривайте ноты и добавляйте в репертуар своего хора одним нажатием.
                            </p>
                            <p className="text-xs text-text-secondary/60 mt-3 italic">
                                Доступен только для хоров типа «Хор МСЦ ЕХБ».
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Download className="w-5 h-5 text-green-400" />
                                Офлайн режим
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Песни, которые вы открывали, автоматически кэшируются для офлайн доступа.
                                Также можете скачать PDF на устройство кнопкой в правом верхнем углу.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                                <Trash2 className="w-5 h-5 text-red-400" />
                                Корзина
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Удаленные песни попадают в корзину и могут быть восстановлены.
                                Доступ к корзине — через иконку 🗑️ в карточке репертуара.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SERVICES TAB */}
            {activeTab === 'services' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Служения и расписание</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2">📅 Создание служения</h4>
                            <p className="text-sm text-text-secondary">
                                Регент может создать новое служение с датой, временем и списком песен.
                                Нажмите кнопку "+" на вкладке "Служения".
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">🎵 Песни служения</h4>
                            <p className="text-sm text-text-secondary">
                                У каждого служения есть свой список песен. Хористы видят ноты для своего
                                служения прямо в карточке. Порядок песен можно изменять перетаскиванием.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">✅ Отметка присутствия (Опрос)</h4>
                            <p className="text-sm text-text-secondary">
                                Регент может отмечать присутствующих самостоятельно, либо отправить push-уведомление с кнопками «Буду» / «Не буду».
                                Ответы хористов автоматически сохраняются в статистике посещений.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">📊 Статистика Хора</h4>
                            <p className="text-sm text-text-secondary">
                                В профиле хора доступна развернутая статистика: график посещений, баланс всех голосов (включая кастомные) и топ самых часто исполняемых песен.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">📁 Архив служений</h4>
                            <p className="text-sm text-text-secondary">
                                Прошедшие служения автоматически архивируются. Их можно просмотреть
                                для анализа репертуара и статистики.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ADMIN TAB */}
            {activeTab === 'admin' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Инструменты Регента</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">1</span>
                                Коды приглашения 🔑
                            </h4>
                            <p className="text-sm text-text-secondary mb-3">
                                Создавайте коды для присоединения новых участников. Виды кодов:
                            </p>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li><b>Обычный код</b> — для хористов с базовыми правами</li>
                                <li><b>Админ-код</b> — для помощников с расширенными правами</li>
                            </ul>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">2</span>
                                Управление участниками 👥
                            </h4>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Изменяйте партию и роль участника</li>
                                <li>Назначайте глав партий</li>
                                <li>Объединяйте дубликаты профилей</li>
                                <li>Удаляйте участников</li>
                            </ul>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">3</span>
                                Уведомления 📢
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Отправляйте push-уведомления всем участникам хора или отдельным партиям.
                                Идеально для срочных объявлений и напоминаний.
                            </p>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">4</span>
                                Статистика 📊
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Просматривайте статистику посещений каждого участника,
                                анализируйте активность партий и планируйте репетиции.
                            </p>
                        </section>

                        <section className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-xs">5</span>
                                Настройки хора ⚙️
                            </h4>
                            <p className="text-sm text-text-secondary">
                                Изменяйте название и иконку хора через меню настроек
                                (нажмите на логотип хора в шапке).
                            </p>
                        </section>
                    </div>
                </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Уведомления</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2">🔔 Push-уведомления</h4>
                            <p className="text-sm text-text-secondary">
                                Получайте уведомления о новых служениях, изменениях в расписании и
                                сообщения от регента прямо на телефон.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">⚙️ Настройки</h4>
                            <p className="text-sm text-text-secondary mb-3">
                                Управляйте уведомлениями в разделе "Аккаунт" → "Уведомления":
                            </p>
                            <ul className="text-sm text-text-secondary space-y-2 list-disc pl-5">
                                <li>Включить/отключить все уведомления</li>
                                {!isNative && (
                                    <li>Разрешить уведомления в браузере</li>
                                )}
                            </ul>
                        </div>

                        <div className="bg-amber-500/10 p-5 md:p-6 rounded-3xl border border-amber-500/20 h-full md:col-span-2">
                            <h4 className="font-bold text-text-primary mb-2">⚠️ Важно</h4>
                            {isNative ? (
                                <p className="text-sm text-text-secondary">
                                    Убедитесь, что вы разрешили получение push-уведомлений в настройках вашего устройства (Настройки → Уведомления → MyChoir).
                                </p>
                            ) : (
                                <p className="text-sm text-text-secondary">
                                    Для получения push-уведомлений нужно разрешить их в браузере.
                                    Если вы случайно заблокировали их — перейдите в настройки браузера.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* FAQ TAB */}
            {activeTab === 'faq' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-2xl font-bold text-text-primary mb-6 md:mb-8">Частые вопросы</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-surface p-5 md:p-6 rounded-3xl border border-border h-full">
                            <h4 className="font-bold text-text-primary mb-2">Как присоединиться к хору?</h4>
                            <p className="text-sm text-text-secondary">
                                Получите код приглашения от регента вашего хора.
                                Введите его на экране входа после регистрации.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">Как создать свой хор?</h4>
                            <p className="text-sm text-text-secondary">
                                На экране входа выберите "Создать новый хор".
                                Введите название и выберите тип хора: «Хор МСЦ ЕХБ» (с доступом к Архиву МХО)
                                или «Обычный хор» (только собственный репертуар).
                                Вы автоматически станете регентом.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">Как добавить песню в репертуар?</h4>
                            <p className="text-sm text-text-secondary">
                                Нажмите "+" в разделе "Песни". Для хоров МСЦ также
                                доступен поиск в Архиве МХО. Или создайте собственную песню с загрузкой PDF.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">Как удалить свой аккаунт?</h4>
                            <p className="text-sm text-text-secondary">
                                Перейдите в "Аккаунт" → прокрутите вниз → "Удалить аккаунт".
                                Все ваши данные будут безвозвратно стерты.
                            </p>
                        </div>

                        <div className="bg-surface p-5 rounded-3xl border border-border">
                            <h4 className="font-bold text-text-primary mb-2">Как связаться с поддержкой?</h4>
                            <div className="space-y-1.5 text-sm text-text-secondary mt-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 text-center">📧</span>
                                    <button onClick={() => openExternal('mailto:artom.devv@gmail.com')} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">artom.devv@gmail.com</button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-6 text-center">💬</span>
                                    <button onClick={() => openExternal('https://t.me/artom_dev')} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">@artom_dev</button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-6 text-center">🌐</span>
                                    <button onClick={() => openExternal('https://artom.dev')} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">artom.dev</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
