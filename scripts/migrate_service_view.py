import json
import re
import os

filepath = "components/ServiceView.tsx"
uk_json_path = "locales/uk.json"

with open(filepath, "r") as f:
    content = f.read()

with open(uk_json_path, "r") as f:
    uk_dict = json.load(f)

replacements = [
    (r'"Невідома пісня"', 't("service.unknown_song")'),
    (r'performer: "Хор"', 'performer: t("program.type.choir")'),
    (r"name: 'Головна'", "name: t('song.main_part')"),
    (r"\|\| 'Пісня'", "|| t('songs.list.song')"),
    (r'\|\| "Пісня"', '|| t("songs.list.song")'),
    
    # Types
    (r"includes\('заг\. спів'\) \|\| lower\.includes\('загальний спів'\)", "includes(t('program.type.congregation').toLowerCase()) || lower.includes('заг. спів') || lower.includes('загальний спів')"),
    (r"includes\('вірш'\)", "includes(t('program.type.verse').toLowerCase()) || lower.includes('вірш')"),
    (r"includes\('хор'\)", "includes(t('program.type.choir').toLowerCase()) || lower.includes('хор')"),
    (r"includes\('молитва'\)", "includes(t('program.type.prayer').toLowerCase()) || lower.includes('молитва')"),
    (r"includes\('проповідь'\)", "includes(t('program.type.sermon').toLowerCase()) || lower.includes('проповідь')"),
    (r"includes\('соло'\)", "includes(t('program.type.solo').toLowerCase()) || lower.includes('соло')"),
    (r"includes\('ансамбль'\)", "includes(t('program.type.ensemble').toLowerCase()) || lower.includes('ансамбль')"),
    (r"includes\('пісня хору'\)", "includes(t('service.choir_song_keyword').toLowerCase()) || lower.includes('пісня хору')"),
    (r"replace\(/пісня хору\\\\s\*-?\\\\s\*/i", "replace(new RegExp(t('service.choir_song_keyword') + '\\\\s*-?\\\\s*', 'i')"),
    (r"=== 'Інше'", "=== t('program.type.other')"),
    (r"=== 'Хор'", "=== t('program.type.choir')"),
    
    (r"!== 'інше'", "!== t('program.type.other').toLowerCase() && displayTitle.toLowerCase() !== 'інше'"),
    (r"!== 'хор'", "!== t('program.type.choir').toLowerCase() && displayTitle.toLowerCase() !== 'хор'"),
    
    (r"\? ' о ' \+", "? ` ${t('common.at_time')} ` +"),
    (r'"HTML2Canvas повернув порожнє полотно \(ширина або висота 0\)\."', 't("service.print_error_empty_canvas")'),
    (r"'Програма: ' \+", "t('service.print_program_prefix') + ' ' +"),
    
    (r'>Нотатки<', '>{t("service.program.notes")}<'),
    (r'>Розспіванка<', '>{t("service.warmup.label")}<'),
    (r'"Без розспіванки"', 't("service.warmup.no")'),
    (r'>Без розспіванки<', '>{t("service.warmup.no")}<'),
    (r'>➕ Новий регент\.\.\.<', '>{t("service.warmup.add_regent")}<'),
    (r'placeholder="Хто проводить\?"', 'placeholder={t("service.warmup.who")}'),
    
    (r'>Список порожній<', '>{t("service.empty_list")}<'),
    (r'>Натисніть, щоб додати пісні на репетицію<', '>{t("service.empty_rehearsal_hint")}<'),
    (r'>Пісень ще не додано<', '>{t("service.empty_songs_hint")}<'),
    
    # Dialogs strings (exact replacements to avoid breaking JS interpolation)
    (r'"\}\\" буде прибрано з цієї програми\."', '"}" + " " + t("service.remove_song_suffix")'),
    (r'\{programItems\.find\(p => p\.id === programItemToDelete\)\?\.title\}&quot; буде видалено з програми\.', '{programItems.find(p => p.id === programItemToDelete)?.title}&quot; {t("service.remove_item_suffix")}'),
]

new_keys = {
    "service.unknown_song": "Невідома пісня",
    "service.choir_song_keyword": "пісня хору",
    "common.at_time": "о",
    "service.print_error_empty_canvas": "HTML2Canvas повернув порожнє полотно (ширина або висота 0).",
    "service.print_program_prefix": "Програма:",
    "service.empty_list": "Список порожній",
    "service.empty_rehearsal_hint": "Натисніть, щоб додати пісні на репетицію",
    "service.empty_songs_hint": "Пісень ще не додано",
    "service.remove_song_suffix": "буде прибрано з цієї програми.",
    "service.remove_item_suffix": "буде видалено з програми."
}

uk_dict.update(new_keys)

# Handle string extraction with strict regex, some might be missed, we check later
for old, new in replacements:
    content = re.sub(old, new, content)

# A few special cases
content = content.replace("replace(/пісня хору\\s*-?\\s*/i, '').trim();", "replace(new RegExp(t('service.choir_song_keyword') + '\\\\s*-?\\\\s*', 'i'), '').replace(/пісня хору\\s*-?\\s*/i, '').trim();")

with open(filepath, "w") as f:
    f.write(content)

with open(uk_json_path, "w") as f:
    json.dump(uk_dict, f, ensure_ascii=False, indent=2)

print("ServiceView migration script executed successfully.")
