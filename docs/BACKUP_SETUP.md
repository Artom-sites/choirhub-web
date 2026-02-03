# Automated Backup Setup

## Що це?
Автоматичні бекапи Firestore даних, які:
- Запускаються **щонеділі о 3:00 UTC** (5:00 за Києвом)
- Зберігаються в R2 bucket як JSON
- Автоматично видаляються через 14 днів

## Налаштування GitHub Secrets

Перейдіть в **Settings → Secrets and variables → Actions** вашого репозиторію та додайте:

### 1. `FIREBASE_SERVICE_ACCOUNT`
Як отримати:
1. Відкрийте [Firebase Console](https://console.firebase.google.com/project/choirhub-8bfa2/settings/serviceaccounts/adminsdk)
2. Натисніть **"Generate new private key"**
3. Скопіюйте весь вміст JSON файлу як значення секрету

### 2. R2 credentials (вже маєте в .env.local):
- `R2_ACCOUNT_ID` → `67ec94e2b5fa84c98362b7f9c6063fdc`
- `R2_ACCESS_KEY_ID` → `640ccd2b8dfc60a6bc158e2e9b680643`
- `R2_SECRET_ACCESS_KEY` → (з .env.local)
- `R2_BUCKET_NAME` → `msc-catalog`

## Ручний запуск
1. GitHub → Actions → "Weekly Firestore Backup"
2. Натисніть **"Run workflow"**

## Перевірка бекапів
Бекапи зберігаються в R2:
- Шлях: `backups/backup-YYYY-MM-DD.json`
- Можна переглянути через Cloudflare Dashboard

## Локальний запуск (для тестування)
```bash
# Експортуйте змінні середовища:
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
export R2_ACCOUNT_ID=...
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_BUCKET_NAME=msc-catalog

# Запустіть:
node scripts/backup.mjs
```
