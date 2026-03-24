import json

keys_to_add = {
    "locales/uk.json": {
        "account.delete_account_keyword": "ВИДАЛИТИ",
        "account.delete_account_keyword_error": "Введіть слово ВИДАЛИТИ для підтвердження",
        "account.delete_account_title": "Видалити акаунт?",
        "account.delete_account_desc_1": "Ця дія",
        "account.delete_account_desc_2": "незворотна",
        "account.delete_account_desc_3": ". Всі ваші дані, налаштування та історія будуть втрачені назавжди.",
        "account.delete_account_label": "Для підтвердження введіть \"ВИДАЛИТИ\"",
        "account.delete_account_error": "Помилка видалення. Спробуйте ще раз.",
        "account.save_name": "Зберегти ім'я"
    },
    "locales/en.json": {
        "account.delete_account_keyword": "DELETE",
        "account.delete_account_keyword_error": "Type the word DELETE to confirm",
        "account.delete_account_title": "Delete account?",
        "account.delete_account_desc_1": "This action is",
        "account.delete_account_desc_2": "irreversible",
        "account.delete_account_desc_3": ". All your data, settings, and history will be lost forever.",
        "account.delete_account_label": "Type \"DELETE\" to confirm",
        "account.delete_account_error": "Failed to delete account. Please try again.",
        "account.save_name": "Save name"
    },
    "locales/de.json": {
        "account.delete_account_keyword": "LÖSCHEN",
        "account.delete_account_keyword_error": "Geben Sie das Wort LÖSCHEN zur Bestätigung ein",
        "account.delete_account_title": "Konto löschen?",
        "account.delete_account_desc_1": "Diese Aktion ist",
        "account.delete_account_desc_2": "unwiderruflich",
        "account.delete_account_desc_3": ". Alle Ihre Daten, Einstellungen und der Verlauf gehen dauerhaft verloren.",
        "account.delete_account_label": "Zur Bestätigung \"LÖSCHEN\" eingeben",
        "account.delete_account_error": "Fehler beim Löschen des Kontos. Bitte versuchen Sie es erneut.",
        "account.save_name": "Name speichern"
    },
    "locales/ru.json": {
        "account.delete_account_keyword": "УДАЛИТЬ",
        "account.delete_account_keyword_error": "Введите слово УДАЛИТЬ для подтверждения",
        "account.delete_account_title": "Удалить аккаунт?",
        "account.delete_account_desc_1": "Это действие",
        "account.delete_account_desc_2": "необратимо",
        "account.delete_account_desc_3": ". Все ваши данные, настройки и история будут потеряны навсегда.",
        "account.delete_account_label": "Для подтверждения введите \"УДАЛИТЬ\"",
        "account.delete_account_error": "Ошибка удаления. Попробуйте еще раз.",
        "account.save_name": "Сохранить имя"
    }
}

for path, new_keys in keys_to_add.items():
    with open(path, "r") as f:
        data = json.load(f)
    for k, v in new_keys.items():
        data[k] = v
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("Added delete keys.")
