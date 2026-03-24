const fs = require('fs');

const ukPath = './locales/uk.json';
const enPath = './locales/en.json';
const ruPath = './locales/ru.json';
const dePath = './locales/de.json';

const uk = JSON.parse(fs.readFileSync(ukPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
const de = JSON.parse(fs.readFileSync(dePath, 'utf8'));

const newKeys = {
    'global.actions.add': { uk: 'Додати', en: 'Add', ru: 'Добавить', de: 'Hinzufügen' },
    'global.actions.join': { uk: 'Додатись', en: 'Join', ru: 'Присоединиться', de: 'Beitreten' },
    'global.state.loading': { uk: 'Завантаження...', en: 'Loading...', ru: 'Загрузка...', de: 'Wird geladen...' },
    'services.list.archive': { uk: 'Архів', en: 'Archive', ru: 'Архив', de: 'Archiv' },
    'services.list.active': { uk: 'Актуальні', en: 'Active', ru: 'Актуальные', de: 'Aktuelle' },

    'trash.title': { uk: 'Корзина', en: 'Trash', ru: 'Корзина', de: 'Papierkorb' },
    'trash.tabs.all': { uk: 'Всі', en: 'All', ru: 'Все', de: 'Alle' },
    'trash.tabs.services': { uk: 'Служіння', en: 'Services', ru: 'Служения', de: 'Gottesdienste' },
    'trash.tabs.songs': { uk: 'Пісні', en: 'Songs', ru: 'Песни', de: 'Lieder' },
    'trash.empty_title': { uk: 'Корзина порожня', en: 'Trash is empty', ru: 'Корзина пуста', de: 'Papierkorb ist leer' },
    'trash.empty_info': { uk: 'Видалені елементи зберігаються тут {{days}} днів', en: 'Deleted items are kept here for {{days}} days', ru: 'Удаленные элементы хранятся здесь {{days}} дней', de: 'Gelöschte Elemente werden hier für {{days}} Tage aufbewahrt' },
    'trash.auto_delete_info': { uk: 'Елементи автоматично видаляються через {{days}} днів', en: 'Items are automatically deleted after {{days}} days', ru: 'Элементы автоматически удаляются через {{days}} дней', de: 'Elemente werden automatisch nach {{days}} Tagen gelöscht' },
    'trash.deleted_today': { uk: 'Буде видалено сьогодні', en: 'Will be deleted today', ru: 'Будет удалено сегодня', de: 'Wird heute gelöscht' },
    'trash.days_left': { uk: 'Залишилось {{days}} дн.', en: '{{days}} days left', ru: 'Осталось {{days}} дн.', de: '{{days}} Tage verbleiben' },
    'trash.item.service': { uk: 'Служіння', en: 'Service', ru: 'Служение', de: 'Gottesdienst' },
    'trash.item.song': { uk: 'Пісня', en: 'Song', ru: 'Песня', de: 'Lied' },
    'trash.actions.restore': { uk: 'Відновити', en: 'Restore', ru: 'Восстановить', de: 'Wiederherstellen' },
    'trash.actions.delete_forever': { uk: 'Видалити назавжди', en: 'Delete permanently', ru: 'Удалить навсегда', de: 'Dauerhaft löschen' },
    'trash.confirm.title': { uk: 'Видалити назавжди?', en: 'Delete permanently?', ru: 'Удалить навсегда?', de: 'Dauerhaft löschen?' },
    'trash.confirm.message': { uk: 'Цей елемент буде видалено без можливості відновлення.', en: 'This item will be deleted without the possibility of recovery.', ru: 'Этот элемент будет удален без возможности восстановления.', de: 'Dieses Element wird unwiderruflich gelöscht.' },

    'help.title': { uk: 'Довідка та FAQ', en: 'Help & FAQ', ru: 'Справка и FAQ', de: 'Hilfe & FAQ' },
    'help.tabs.general': { uk: 'Загальне', en: 'General', ru: 'Общее', de: 'Allgemein' },
    'help.tabs.roles': { uk: 'Ролі', en: 'Roles', ru: 'Роли', de: 'Rollen' },
    'help.tabs.songs': { uk: 'Пісні', en: 'Songs', ru: 'Песни', de: 'Lieder' },
    'help.tabs.services': { uk: 'Служіння', en: 'Services', ru: 'Служения', de: 'Gottesdienste' },
    'help.tabs.admin': { uk: 'Регентам', en: 'Admin', ru: 'Регентам', de: 'Dirigenten' },
    'help.tabs.notifications': { uk: 'Сповіщення', en: 'Notifications', ru: 'Уведомления', de: 'Benachrichtigungen' },
    'help.tabs.faq': { uk: 'FAQ', en: 'FAQ', ru: 'FAQ', de: 'FAQ' },

    'legal.privacy.last_update': { uk: 'Останнє оновлення: 22 березня 2026', en: 'Last updated: March 22, 2026', ru: 'Последнее обновление: 22 марта 2026', de: 'Letzte Aktualisierung: 22. März 2026' },
    'legal.terms.last_update': { uk: 'Останнє оновлення: 10 березня 2026', en: 'Last updated: March 10, 2026', ru: 'Последнее обновление: 10 марта 2026', de: 'Letzte Aktualisierung: 10. März 2026' },
    'legal.footer.copyright': { uk: '© 2026 MyChoir. Всі права захищені.', en: '© 2026 MyChoir. All rights reserved.', ru: '© 2026 MyChoir. Все права защищены.', de: '© 2026 MyChoir. Alle Rechte vorbehalten.' }
};

for (const [key, translations] of Object.entries(newKeys)) {
    uk[key] = translations.uk;
    en[key] = translations.en;
    ru[key] = translations.ru;
    de[key] = translations.de;
}

fs.writeFileSync(ukPath, JSON.stringify(uk, null, 2));
fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(ruPath, JSON.stringify(ru, null, 2));
fs.writeFileSync(dePath, JSON.stringify(de, null, 2));

console.log('Successfully injected keys for Phase 3.');
