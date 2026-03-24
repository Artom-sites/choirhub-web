const fs = require('fs');
const uk = JSON.parse(fs.readFileSync('./locales/uk.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('./locales/en.json', 'utf8'));
const ru = JSON.parse(fs.readFileSync('./locales/ru.json', 'utf8'));
const de = JSON.parse(fs.readFileSync('./locales/de.json', 'utf8'));

const newKeys = {
    'global.actions.delete': { uk: 'Видалити', en: 'Delete', ru: 'Удалить', de: 'Löschen' },
    'services.item.songsCount': { uk: '{{count}} пісень', en: '{{count}} songs', ru: '{{count}} песен', de: '{{count}} Lieder' }
};

for (const [key, translations] of Object.entries(newKeys)) {
    uk[key] = translations.uk;
    en[key] = translations.en;
    ru[key] = translations.ru;
    de[key] = translations.de;
}

fs.writeFileSync('./locales/uk.json', JSON.stringify(uk, null, 2));
fs.writeFileSync('./locales/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('./locales/ru.json', JSON.stringify(ru, null, 2));
fs.writeFileSync('./locales/de.json', JSON.stringify(de, null, 2));
console.log('Done');
