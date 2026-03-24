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
    # Permissions
    (r"label: 'Додавати пісні'", "label: t('permissions.add_songs')"),
    (r"label: 'Відмічати відсутніх'", "label: t('permissions.edit_attendance')"),
    (r"label: 'Записувати диригента/піаніста'", "label: t('permissions.edit_credits')"),
    (r"label: 'Бачити статистику'", "label: t('permissions.view_stats')"),
    (r"label: 'Створювати/видаляти служіння'", "label: t('permissions.manage_services')"),
    (r"label: 'Надсилати сповіщення'", "label: t('permissions.notify_members')"),

    # Alerts / Messages
    (r'setManagerError\(e\.message \|\| "Помилка збереження"\)', 'setManagerError(e.message || t("manager.error_save"))'),
    (r'setManagerError\("Помилка збереження"\)', 'setManagerError(t("manager.error_save"))'),
    (r'setManagerError\("Помилка приєднання"\)', 'setManagerError(t("manager.error_join"))'),
    (r'setManagerError\("Ви вже є учасником цього хору"\)', 'setManagerError(t("manager.error_already_member"))'),
    (r'setManagerError\("Невірний код"\)', 'setManagerError(t("manager.error_invalid_code"))'),
    (r'setManagerError\(error\.message \|\| "Сталася помилка при видаленні акаунту"\)', 'setManagerError(error.message || t("manager.error_delete_account"))'),
    (r'Dialog\.alert\(\{ title: "Помилка", message: "Не вдалося покинути хор" \}\)', 'Dialog.alert({ title: t("common.error"), message: t("manager.error_leave_choir") })'),
    (r'Dialog\.alert\(\{ title: "Помилка", message: "Не вдалося об\'єднати учасників" \}\)', 'Dialog.alert({ title: t("common.error"), message: t("manager.error_merge_members") })'),
    (r'Dialog\.alert\(\{ title: "Помилка", message: "Не вдалося прив\'язати користувача" \}\)', 'Dialog.alert({ title: t("common.error"), message: t("manager.error_link_user") })'),
    (r'Dialog\.alert\(\{ title: "Помилка", message: "Цей профіль вже прив\'язаний до іншого акаунту\. Зверніться до регента для переприв\'язки\." \}\)', 'Dialog.alert({ title: t("common.error"), message: t("manager.error_already_linked_to_other") })'),
    (r'Dialog\.alert\(\{ title: "Помилка", message: "Ваш акаунт вже прив\'язаний до іншого учасника\." \}\)', 'Dialog.alert({ title: t("common.error"), message: t("manager.error_account_already_linked") })'),
    (r'Dialog\.alert\(\{ title: "Помилка", message: "Помилка прив\'язки: " \+ msg \}\)', 'Dialog.alert({ title: t("common.error"), message: t("manager.error_link_prefix") + " " + msg })'),

    # UI Content
    (r'"Помилка створення хору: "', 't("manager.error_create_choir_prefix") + " "'),
    (r'"Невідома помилка"', 't("manager.error_unknown")'),
    (r'msg = e\.message \|\| \"Помилка приєднання\";', 'msg = e.message || t("manager.error_join");'),
    
    (r'label: "Регент", className', 'label: t("global.roles.regent"), className'),
    (r'label: "Хорист", className', 'label: t("global.roles.member"), className'),
    
    (r'Для повторного входу знадобиться увійти через Google\.', '{t("account.logout_warning")}'),
    (r'>Скасувати<', '>{t("common.cancel")}<'),
    (r'>Вийти<', '>{t("account.logout")}<'),
    
    (r"\{uploadingIcon \? 'Завантаження\.\.\.' : 'Натисніть, щоб змінити фото'\}", "{uploadingIcon ? t('common.loading') : t('account.change_photo')}"),
    (r"title: 'Видалити фото\?'", "title: t('account.delete_photo_title')"),
    (r"message: 'Ви впевнені, що хочете видалити фото хору\?'", "message: t('account.delete_photo_confirm')"),
    (r"okButtonTitle: 'Видалити'", "okButtonTitle: t('common.delete')"),
    (r"cancelButtonTitle: 'Скасувати'", "cancelButtonTitle: t('common.cancel')"),
    (r'>Видалити фото<', '>{t("account.delete_photo")}<'),
    
    (r'placeholder="Назва хору"', 'placeholder={t("account.choir_name")}'),
    (r'>Зберегти зміни<', '>{t("common.save_changes")}<'),
    (r"m\.role === 'head' \? 'Регент' : m\.role === 'regent' \? 'Регент' : 'Хорист'", "m.role === 'head' ? t('global.roles.regent') : m.role === 'regent' ? t('global.roles.regent') : t('global.roles.member')"),
    (r'title="Покинути хор"', 'title={t("account.leave_choir")}'),
    
    (r'>Створити<', '>{t("manager.create")}<'),
    (r'>Приєднатись<', '>{t("manager.join")}<'),
    (r'>← Назад<', '>{t("common.back_arrow")}<'),
    (r'"Створити"', 't("manager.create")'),
    (r'placeholder="Шевченко \(необов\'язково\)"', 'placeholder={t("manager.last_name_optional")}'),
    (r'placeholder="Тарас \(необов\'язково\)"', 'placeholder={t("manager.first_name_optional")}'),
]

new_keys = {
    "permissions.add_songs": "Додавати пісні",
    "permissions.edit_attendance": "Відмічати відсутніх",
    "permissions.edit_credits": "Записувати диригента/піаніста",
    "permissions.view_stats": "Бачити статистику",
    "permissions.manage_services": "Створювати/видаляти служіння",
    "permissions.notify_members": "Надсилати сповіщення",
    "manager.error_save": "Помилка збереження",
    "manager.error_join": "Помилка приєднання",
    "manager.error_already_member": "Ви вже є учасником цього хору",
    "manager.error_invalid_code": "Невірний код",
    "manager.error_delete_account": "Сталася помилка при видаленні акаунту",
    "manager.error_leave_choir": "Не вдалося покинути хор",
    "manager.error_merge_members": "Не вдалося об'єднати учасників",
    "manager.error_link_user": "Не вдалося прив'язати користувача",
    "manager.error_already_linked_to_other": "Цей профіль вже прив'язаний до іншого акаунту. Зверніться до регента для переприв'язки.",
    "manager.error_account_already_linked": "Ваш акаунт вже прив'язаний до іншого учасника.",
    "manager.error_link_prefix": "Помилка прив'язки:",
    "manager.error_create_choir_prefix": "Помилка створення хору:",
    "manager.error_unknown": "Невідома помилка",
    "account.logout_warning": "Для повторного входу знадобиться увійти через Google.",
    "account.change_photo": "Натисніть, щоб змінити фото",
    "account.delete_photo_title": "Видалити фото?",
    "account.delete_photo_confirm": "Ви впевнені, що хочете видалити фото хору?",
    "account.delete_photo": "Видалити фото",
    "common.save_changes": "Зберегти зміни",
    "account.leave_choir": "Покинути хор",
    "manager.create": "Створити",
    "manager.join": "Приєднатись",
    "common.back_arrow": "← Назад",
    "manager.last_name_optional": "Прізвище (необов'язково)",
    "manager.first_name_optional": "Ім'я (необов'язково)"
}

uk_dict.update(new_keys)

for old, new in replacements:
    content = re.sub(old, new, content)

with open(page_path, "w") as f:
    f.write(content)

with open(uk_json_path, "w") as f:
    json.dump(uk_dict, f, ensure_ascii=False, indent=2)

print("Migration script executed successfully.")
