import json
import re
import os

page_path = "app/app/page.tsx"
uk_json_path = "locales/uk.json"

with open(page_path, "r") as f:
    content = f.read()

with open(uk_json_path, "r") as f:
    uk_dict = json.load(f)

replacements = [
    (r'placeholder="Код \(6 символів\)"', 'placeholder={t("manager.code_placeholder")}'),
    (r'"Ми знайшли дуже схоже ім\'я в списку хору\."', 't("account.claim_found_similar")'),
    (r'"Зв\'яжіть свій акаунт із цим профілем, щоб зберегти вашу історію відвідувань та партію\."', 't("account.claim_link_desc")'),
    (r'"Якщо ваше ім\'я позначене «вже має акаунт», зверніться до регента для переприв\'язки\."', 't("account.claim_already_linked_warning")'),
    (r'"Так, це я"', 't("account.claim_yes")'),
    (r'"Ні, я новий учасник"', 't("account.claim_no_new")'),
    (r'"Якщо хочете, додайте ваше ім\'я — це допоможе регенту впізнати вас у хорі\. Поля необов\'язкові та можна пропустити\."', 't("account.claim_name_hint")'),
    (r'"Продовжити"', 't("common.continue")'),
    (r'ac.label \|\| \'Адмін\'', "ac.label || t('account.admin_role')"),
    (r'>Очистити<', '>{t("common.clear")}<'),
    (r"'Безліміт'", "t('account.unlimited')"),
    (r"'1 ГБ'", "t('account.cache_1gb')"),
    (r"'500 МБ'", "t('account.cache_500mb')"),
    (r"'50 МБ'", "t('account.cache_50mb')"),
    (r'>50 МБ<', '>{t("account.cache_50mb")}<'),
    (r"'Ніколи'", "t('account.never')"),
    (r"'7 днів'", "t('common.days_7')"),
    (r"'30 днів'", "t('common.days_30')"),
    (r"'90 днів'", "t('common.days_90')"),
    (r'>1 день<', '>{t("common.day_one")}<'),
    (r"title: 'Написати лист'", "title: t('account.contact_title')"),
    (r"message: 'Відкрити поштовий додаток для зв\\'язку з підтримкою\?'", "message: t('account.contact_msg')"),
    (r"okButtonTitle: 'Відкрити'", "okButtonTitle: t('common.open')"),
    (r'>Видалити акаунт<', '>{t("account.delete_account")}<'),
    (r'title="Сповіщення"', 'title={t("notif.title")}'),
    (r'\bпісень\b', "{t('songs.list.songs_count_plural')}"),
]

new_keys = {
    "manager.code_placeholder": "Код (6 символів)",
    "account.claim_found_similar": "Ми знайшли дуже схоже ім'я в списку хору.",
    "account.claim_link_desc": "Зв'яжіть свій акаунт із цим профілем, щоб зберегти вашу історію відвідувань та партію.",
    "account.claim_already_linked_warning": "Якщо ваше ім'я позначене «вже має акаунт», зверніться до регента для переприв'язки.",
    "account.claim_yes": "Так, це я",
    "account.claim_no_new": "Ні, я новий учасник",
    "account.claim_name_hint": "Якщо хочете, додайте ваше ім'я — це допоможе регенту впізнати вас у хорі. Поля необов'язкові та можна пропустити.",
    "common.continue": "Продовжити",
    "account.admin_role": "Адмін",
    "common.clear": "Очистити",
    "account.cache_1gb": "1 ГБ",
    "account.cache_500mb": "500 МБ",
    "account.cache_50mb": "50 МБ",
    "common.days_7": "7 днів",
    "common.days_30": "30 днів",
    "common.days_90": "90 днів",
    "account.contact_title": "Написати лист",
    "account.contact_msg": "Відкрити поштовий додаток для зв'язку з підтримкою?",
    "common.open": "Відкрити",
    "account.delete_account": "Видалити акаунт"
}

uk_dict.update(new_keys)

for old, new in replacements:
    content = re.sub(old, new, content)

# additional custom replacements that are tricky via strict regexes
content = content.replace("title=\"Пошук\"", "title={t('search.placeholder')}")

with open(page_path, "w") as f:
    f.write(content)

with open(uk_json_path, "w") as f:
    json.dump(uk_dict, f, ensure_ascii=False, indent=2)

print("Second migration script executed successfully.")
