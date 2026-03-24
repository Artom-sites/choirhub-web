const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../locales');
const newKeys = {
  // GlobalArchive headers
  "archive.header": { uk: "АРХІВ МХО", en: "MHO ARCHIVE", ru: "АРХИВ МХО", de: "MHO ARCHIV" },
  "archive.add_song_title": { uk: "Додати пісню?", en: "Add Song?", ru: "Добавить песню?", de: "Lied hinzufügen?" },
  "archive.add_song_message": { uk: "Ви дійсно хочете додати \"{{title}}\" до репертуару вашого хору?", en: "Do you really want to add \"{{title}}\" to your choir's repertoire?", ru: "Вы действительно хотите добавить \"{{title}}\" в репертуар вашего хора?", de: "Möchten Sie \"{{title}}\" wirklich zum Repertoire Ihres Chores hinzufügen?" },

  // Themes
  "global.themes.Різдво": { uk: "Різдво", en: "Christmas", ru: "Рождество", de: "Weihnachten" },
  "global.themes.Пасха": { uk: "Пасха", en: "Easter", ru: "Пасха", de: "Ostern" },
  "global.themes.Свято_Жнив": { uk: "Свято Жнив", en: "Harvest", ru: "Праздник Жатвы", de: "Erntedankfest" },
  "global.themes.Новий_рік": { uk: "Новий рік", en: "New Year", ru: "Новый год", de: "Neujahr" },
  "global.themes.Молитовні": { uk: "Молитовні", en: "Prayer", ru: "Молитвенные", de: "Gebet" },
  "global.themes.Вечеря": { uk: "Вечеря", en: "Communion", ru: "Вечеря", de: "Abendmahl" },
  "global.themes.Весілля": { uk: "Весілля", en: "Wedding", ru: "Свадебные", de: "Hochzeit" },
  "global.themes.Хрещення": { uk: "Хрещення", en: "Baptism", ru: "Крещение", de: "Taufe" },
  "global.themes.Вїзд": { uk: "В'їзд", en: "Triumphal Entry", ru: "Въезд", de: "Einzug" },
  "global.themes.Трійця": { uk: "Трійця", en: "Trinity", ru: "Троица", de: "Kirchenjahr" },
  "global.themes.Вознесіння": { uk: "Вознесіння", en: "Ascension", ru: "Вознесение", de: "Himmelfahrt" },
  "global.themes.Інші": { uk: "Інші", en: "Other", ru: "Другие", de: "Andere" },

  // Subcategories
  "global.subcategories.mixed": { uk: "Змішаний", en: "Mixed", ru: "Смешанный", de: "Gemischt" },
  "global.subcategories.youth": { uk: "Молодіжний", en: "Youth", ru: "Молодежный", de: "Jugend" },
  "global.subcategories.male": { uk: "Чоловічий", en: "Male", ru: "Мужской", de: "Männer" },
  "global.subcategories.female": { uk: "Жіночий", en: "Female", ru: "Женский", de: "Frauen" },
  "global.subcategories.children": { uk: "Дитячий", en: "Children", ru: "Детский", de: "Kinder" },
  
  "global.subcategories.symphonic": { uk: "Симфонічний", en: "Symphonic", ru: "Симфонический", de: "Sinfonisch" },
  "global.subcategories.chamber": { uk: "Камерний", en: "Chamber", ru: "Камерный", de: "Kammer" },
  "global.subcategories.wind": { uk: "Духовий", en: "Wind", ru: "Духовой", de: "Blas" },
  "global.subcategories.folk": { uk: "Народний", en: "Folk", ru: "Народный", de: "Volks" },
  
  "global.subcategories.brass": { uk: "Духовий", en: "Brass", ru: "Духовой", de: "Blechbläser" },
  "global.subcategories.guitar": { uk: "Гітарний", en: "Guitar", ru: "Гитарный", de: "Gitarre" }
};

['uk', 'en', 'ru', 'de'].forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  for (const [key, translations] of Object.entries(newKeys)) {
    data[key] = translations[lang];
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`Updated ${lang}.json`);
});
