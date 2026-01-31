/**
 * Official theme list for the choir app.
 * Used for filtering, editing, and displaying song themes.
 * 
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for themes.
 * Any updates to themes should be made here only.
 */

export const OFFICIAL_THEMES: string[] = [
    "Різдво",
    "Пасха",
    "Свято Жнив",
    "Новий рік",
    "Молитовні",
    "Вечеря",
    "Весілля",
    "Хрещення",
    "В'їзд",
    "Трійця",
    "Вознесіння",
    "Інші",
];

export type Theme = string;

// For backwards compatibility with existing code using "Category"
export const CATEGORIES = OFFICIAL_THEMES;
export type Category = string;
