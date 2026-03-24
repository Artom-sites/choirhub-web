const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../locales');
const newKeys = {
  "services.list.today": { uk: "Сьогодні", en: "Today", ru: "Сегодня", de: "Heute" },
  "services.actions.create_button": { uk: "Створити", en: "Create", ru: "Создать", de: "Erstellen" },
  "services.actions.will_be_present_active": { uk: "Я буду", en: "I'll be there", ru: "Я буду", de: "Ich nehme teil" },
  "services.actions.will_be_present": { uk: "Буду", en: "Attend", ru: "Буду", de: "Teilnehmen" },
  "services.actions.will_not_be_present": { uk: "Не буду", en: "Can't attend", ru: "Не буду", de: "Kann nicht attendieren" },
  "global.categories.new": { uk: "Новинки 🔥", en: "New 🔥", ru: "Новинки 🔥", de: "Neu 🔥" },
  "global.categories.all": { uk: "Всі", en: "All", ru: "Все", de: "Alle" },
  "global.categories.choir": { uk: "Хор", en: "Choir", ru: "Хор", de: "Chor" },
  "global.categories.orchestra": { uk: "Оркестр", en: "Orchestra", ru: "Оркестр", de: "Orchester" },
  "global.categories.ensemble": { uk: "Ансамбль", en: "Ensemble", ru: "Ансамбль", de: "Ensemble" },
  "global.lang_ukr": { uk: "Українська", en: "Ukrainian", ru: "Украинский", de: "Ukrainisch" },
  "global.lang_rus": { uk: "Російська", en: "Russian", ru: "Русский", de: "Russisch" },
  "global.lang_eng": { uk: "Англійська", en: "English", ru: "Английский", de: "Englisch" },
  "global.lang_ger": { uk: "Німецька", en: "German", ru: "Немецкий", de: "Deutsch" },
  "global.lang_rom": { uk: "Румунська", en: "Romanian", ru: "Румынский", de: "Rumänisch" },
  "global.choose_pdf": { uk: "Оберіть PDF файл", en: "Choose PDF file", ru: "Выберите PDF файл", de: "PDF-Datei auswählen" },
  "submit_song.title": { uk: "Запропонувати пісню", en: "Suggest a Song", ru: "Предложить песню", de: "Lied vorschlagen" },
  "submit_song.song_title": { uk: "Назва твору *", en: "Song Title *", ru: "Название произведения *", de: "Liedtitel *" },
  "submit_song.composer": { uk: "Композитор", en: "Composer", ru: "Композитор", de: "Komponist" },
  "submit_song.poet": { uk: "Автор тексту", en: "Lyrics Author", ru: "Автор текста", de: "Textautor" },
  "submit_song.category": { uk: "Категорія", en: "Category", ru: "Категория", de: "Kategorie" },
  "submit_song.theme": { uk: "Тема", en: "Theme", ru: "Тема", de: "Thema" },
  "submit_song.pdf_file": { uk: "PDF Файл *", en: "PDF File *", ru: "PDF Файл *", de: "PDF-Datei *" },
  "submit_song.info": { uk: "Пісня з'явиться в каталозі \"Новинки\" після перевірки модератором.", en: "The song will appear in the 'New' catalog after moderator approval.", ru: "Песня появится в каталоге \"Новинки\" после проверки модератором.", de: "Das Lied erscheint nach der Freigabe durch den Moderator im Katalog „Neu“." },
  "submit_song.submit": { uk: "Надіслати", en: "Submit", ru: "Отправить", de: "Senden" },
  "submit_song.theme_not_specified": { uk: "Не вказано", en: "Not specified", ru: "Не указано", de: "Nicht angegeben" },
  "archive.load_more": { uk: "Завантажити старіші", en: "Load older", ru: "Загрузить старые", de: "Ältere laden" },
  "archive.loading": { uk: "Завантаження...", en: "Loading...", ru: "Загрузка...", de: "Wird geladen..." }
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
