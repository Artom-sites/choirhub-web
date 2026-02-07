/**
 * Extracts and cleans the instrument name from a part name.
 * 
 * @param partName - The full name of the part (e.g., "Song Title - Violin 1")
 * @param songTitle - The title of the song to remove from the part name
 * @returns The cleaned instrument name (e.g., "Violin 1")
 */
export const extractInstrument = (partName: string, songTitle: string): string => {
    if (!partName || !songTitle) return "Загальна";

    // 1. First cleanup: extension, underscores to spaces
    let name = partName.replace(/\.pdf$/i, '').replace(/_/g, ' ').trim();

    // 2. Remove leading ordering numbers (e.g. "00 ", "01 - ", "1.")
    name = name.replace(/^\d+[\s.\-_]*/, '');

    // --- NEW LOGIC: Whitelist & Generic Mapping ---

    const lowerName = name.toLowerCase();

    // Map of known instruments/terms to their clean Display Name
    const knownInstruments: Record<string, string> = {
        // Generic / Score
        'партитура': 'Партитура',
        'partitur': 'Партитура',
        'full score': 'Партитура',
        'score': 'Партитура',
        'general': 'Партитура',
        'загальна': 'Партитура',
        'total': 'Партитура',
        'клавір': 'Клавір',
        'clavier': 'Клавір',
        'piano': 'Фортепіано',
        'фортепіано': 'Фортепіано',
        'фортепиано': 'Фортепіано',

        // Choir
        'хор': 'Хор',
        'choir': 'Хор',
        'chorus': 'Хор',
        'soprano': 'Сопрано',
        'сопрано': 'Сопрано',
        'alto': 'Альт',
        'альт': 'Альт',
        'tenor': 'Тенор',
        'тенор': 'Тенор',
        'bass': 'Бас',
        'бас': 'Бас',
        'baritone': 'Баритон',
        'баритон': 'Баритон',

        // Strings
        'violin': 'Скрипка',
        'скрипка': 'Скрипка',
        'viola': 'Альт', // Context might matter, usually Alto/Viola share name in UA
        'cello': 'Віолончель',
        'violoncello': 'Віолончель',
        'віолончель': 'Віолончель',
        'виолончель': 'Віолончель',
        'double bass': 'Контрабас',
        'contrabass': 'Контрабас',
        'контрабас': 'Контрабас',

        // Winds
        'flute': 'Флейта',
        'флейта': 'Флейта',
        'oboe': 'Гобой',
        'гобой': 'Гобой',
        'clarinet': 'Кларнет',
        'кларнет': 'Кларнет',
        'bassoon': 'Фагот',
        'фагот': 'Фагот',

        // Brass
        'horn': 'Валторна',
        'валторна': 'Валторна',
        'trumpet': 'Труба',
        'труба': 'Труба',
        'trombone': 'Тромбон',
        'тромбон': 'Тромбон',
        'tuba': 'Туба',
        'туба': 'Туба',

        // Other
        'guitar': 'Гітара',
        'гітара': 'Гітара',
        'гитара': 'Гітара',
        'organ': 'Орган',
        'орган': 'Орган',
        'drums': 'Ударні',
        'percussion': 'Ударні',
        'ударні': 'Ударні',
        'ударные': 'Ударні',
        'triangle': 'Трикутник',
        'треугольник': 'Трикутник',
    };

    // Check for exact keys first (for "General", "Загальна")
    if (["general", "загальна", "full score", "score"].includes(lowerName)) {
        return "Партитура";
    }

    // Check if the name CONTAINS any of the known instruments
    // We sort keys by length descending to match "Bassoon" before "Bass"
    const sortedKeys = Object.keys(knownInstruments).sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
        if (lowerName.includes(key)) {
            // Found a known instrument!
            // Try to capture the instrument AND any following number (1, 2, I, II)
            // Regex: key + optional space/dash + optional number/roman

            // Escape key for regex just in case
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Look for: Key + (optional: space/dash/dot + number OR roman numeral)
            // We look for numbers 1-99 or Roman I-VIII, at the end of word or string
            const regex = new RegExp(`${escapedKey}[\\s\\-._]*([0-9]+|[IVX]+)?(?:$|[^a-zа-я])`, 'i');
            const match = name.match(regex);

            if (match) {
                const number = match[1] ? ` ${match[1].toUpperCase()}` : '';
                // Special case: "Violin I" -> "Скрипка 1" or keep Roman? 
                // Let's keep what was in source but usually standardizing to Arabic is better?
                // For now, keep as is but space separated.

                return knownInstruments[key] + number;
            }

            // If regex failed (e.g. key="alt", name="altos"), we do NOT return here.
            // We continue searching or fall through to standard cleanup.
        }
    }

    // 3. Normalization Helper
    const normalizeString = (str: string) => {
        return str.toLowerCase()
            .replace(/a/g, 'а')
            .replace(/c/g, 'с')
            .replace(/e/g, 'е')
            .replace(/o/g, 'о')
            .replace(/p/g, 'р')
            .replace(/x/g, 'х')
            .replace(/y/g, 'у')
            .replace(/h/g, 'н')
            .replace(/k/g, 'к')
            .replace(/[^\w\sа-яґєіїё]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Helper to strip musical keys like " — C-dur", " - B minor"
    // Doing this early helps with title matching
    name = name.replace(/[\s\-_–—]+([A-H][hs]?)[\s\-_]*(dur|moll|major|minor)[\s\-_]*$/i, '');

    // Also strip just key if it looks like " in F", " в F"
    name = name.replace(/[\s]+(in|в|in the)[\s]+[A-H][hs]?[\s]*$/i, '');

    const normName = normalizeString(name);
    const normTitle = normalizeString(songTitle);

    // 4. Exact or fuzzy match for "Whole Score"
    if (normName === normTitle) return "Партитура";
    if (normTitle.includes(normName) && normName.length > 4) return "Партитура";

    // 5. Intelligent Separation Check
    const separators = [' - ', ' – ', ' — ', '-']; // priority order
    let parts: string[] = [];

    for (const sep of separators) {
        if (name.includes(sep)) {
            parts = name.split(sep).map(p => p.trim()).filter(p => p.length > 0);
            if (parts.length > 1) break;
        }
    }

    if (parts.length > 1) {
        let bestMatchIndex = -1;

        for (let i = 0; i < parts.length; i++) {
            const pNorm = normalizeString(parts[i]);
            // Check if this part IS the title or START of title
            if (normTitle.includes(pNorm) || pNorm.includes(normTitle)) {
                bestMatchIndex = i;
                break;
            }
            // Word overlap check
            const pWords = pNorm.split(' ');
            const tWords = normTitle.split(' ');
            if (pWords.length > 0 && tWords.length > 0 && pWords[0] === tWords[0] && pWords[0].length > 3) {
                bestMatchIndex = i;
                break;
            }
        }

        if (bestMatchIndex !== -1) {
            const instrumentParts = parts.filter((_, idx) => idx !== bestMatchIndex);
            if (instrumentParts.length > 0) {
                const candidate = instrumentParts.join(' ').trim();
                if (candidate.length > 1) return finalizeCleanup(candidate);
            }
            return "Партитура";
        }
    }

    // 6. Word Removal strategies

    // A. Remove Title from START
    if (normName.startsWith(normTitle)) {
        // Try to cut by length of title (heuristic) - risky if chars differ
        // Better: regex replace based on title words
        const possible = name.substring(songTitle.length).trim();
        // But normalized might match while raw doesn't.
        // Let's rely on word removal loop
    }

    // B. Heuristic: Remove Title string (case insensitive) directly
    const titleRegex = new RegExp(songTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (titleRegex.test(name)) {
        const candidate = name.replace(titleRegex, '').trim();
        if (candidate.length > 1) return finalizeCleanup(candidate);
    }

    // C. Word-by-word removal from START
    const nameWords = normName.split(/\s+/);
    const titleWords = normTitle.split(/\s+/);

    let matchCount = 0;
    for (let i = 0; i < Math.min(nameWords.length, titleWords.length); i++) {
        if (nameWords[i] === titleWords[i]) matchCount++;
        else break;
    }
    if (matchCount > 0) {
        const originalWords = name.split(/[\s\-–—]+/);
        if (originalWords.length > matchCount) {
            const tail = originalWords.slice(matchCount).join(' ');
            if (tail.length > 1) return finalizeCleanup(tail);
        }
    }

    // D. Word-by-word removal from END
    // "Triangle Song Title"
    // Reverse check
    let matchEndCount = 0;
    const nameRev = [...nameWords].reverse();
    const titleRev = [...titleWords].reverse();
    for (let i = 0; i < Math.min(nameRev.length, titleRev.length); i++) {
        if (nameRev[i] === titleRev[i]) matchEndCount++;
        else break;
    }
    if (matchEndCount > 0) {
        const originalWords = name.split(/\s+/); // simpler split
        if (originalWords.length > matchEndCount) {
            const head = originalWords.slice(0, originalWords.length - matchEndCount).join(' ');
            if (head.length > 0) return finalizeCleanup(head);
        }
    }

    // 7. Final attempt: parens
    const parenMatch = name.match(/\(([^)]+)\)$/);
    if (parenMatch) {
        const inside = parenMatch[1].trim();
        const insideNorm = normalizeString(inside);
        if (normTitle.includes(insideNorm) || insideNorm.includes(normTitle)) {
            return finalizeCleanup(name.replace(/\(.*\)$/, ''));
        }
        return finalizeCleanup(inside);
    }

    // If result is basically the title, return General.
    if (normalizeString(name) === normTitle) return "Партитура";

    return finalizeCleanup(name);
};

const finalizeCleanup = (str: string): string => {
    let s = str
        .replace(/^[\s\-–—,._]+/, '')
        .replace(/[\s\-–—,._]+$/, '')
        .replace(/\)+$/, '')
        .replace(/^\(+/, '')
        .replace(/^\((.*)\)$/, '$1')
        // STRIP UNBALANCED PAREN if matches specific end pattern
        // e.g. "Trumpet (Христос" -> "Trumpet"
        .replace(/\s*\([^)]*$/, '')
        .trim();

    if (!s) return "Партитура";

    // Filter out common keys/tonalities if that's the only thing left
    // e.g. "C-dur", "d-moll", "F dur"
    if (/^[A-H][hs]?[\s\-]*(dur|moll|major|minor)$/i.test(s)) {
        return "Загальна";
    }

    // Custom mappings for generic names
    const lower = s.toLowerCase();

    // Check for "Party 1" / "Part 1" / "Partia 1" (handles mixed Latin/Cyrillic chars: a, p, o, e, etc.)
    // p - 0440 (cyr) 0070 (lat)
    // a - 0430 (cyr) 0061 (lat)

    // Strict robust check: starts with "p" or "п" and IS EXACTLY digit 1 or 2 (surrounded by word boundaries ideally, or just length check)
    if (s.length < 15 && /\d/.test(s)) {
        const numMatch = s.match(/(\d+)/);
        if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            // ONLY map if number is exactly 1 or 2. 12, 13 etc will be skipped and returned as is.
            if (num === 1 && (lower.startsWith('p') || lower.startsWith('п'))) return 'Партитура';
            if (num === 2 && (lower.startsWith('p') || lower.startsWith('п'))) return 'Хор';
        }
    }

    return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Helper to extract filename from a URL (e.g. Firebase Storage URL)
 */
export const getFileNameFromUrl = (url: string): string => {
    if (!url) return "";
    try {
        const decoded = decodeURIComponent(url);
        // Remove query parameters
        const cleanUrl = decoded.split('?')[0];
        // Get last part after slash
        const parts = cleanUrl.split('/');
        return parts[parts.length - 1];
    } catch (e) {
        console.error("Error decoding URL:", e);
        return "";
    }
};

/**
 * Checks if a name is a generic part name like "Part 1", "Partia 2", "Партія 3"
 */
export const isGenericPartName = (name: string): boolean => {
    if (!name) return false;
    const lower = name.toLowerCase().trim();
    // Matches: "part 1", "partia 1", "партія 1", "p 1", "p1", "part-1"
    return /^(part|partia|партія|p)[\s.\-_]*\d+$/i.test(lower);
};
