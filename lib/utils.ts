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

    const normName = normalizeString(name);
    const normTitle = normalizeString(songTitle);

    // 4. Exact or fuzzy match for "Whole Score"
    if (normName === normTitle) return "Загальна";
    if (normTitle.includes(normName) && normName.length > 4) return "Загальна";

    // 5. Intelligent Separation Check
    // We check if the name contains the title, or if the title is on one side of a separator.

    // We try to split by standard separators
    const separators = [' - ', ' – ', ' — ', '-']; // priority order
    let parts: string[] = [];

    // Try to split by the first valid separator found
    for (const sep of separators) {
        if (name.includes(sep)) {
            parts = name.split(sep).map(p => p.trim()).filter(p => p.length > 0);
            if (parts.length > 1) break;
        }
    }

    if (parts.length > 1) {
        // Find which part matches the title best
        let bestMatchIndex = -1;

        for (let i = 0; i < parts.length; i++) {
            const pNorm = normalizeString(parts[i]);
            // Check if this part IS the title or START of title
            if (normTitle.includes(pNorm) || pNorm.includes(normTitle) || normTitle.startsWith(pNorm.substring(0, 10)) || pNorm.startsWith(normTitle.substring(0, 10))) {
                bestMatchIndex = i;
                break;
            }

            // Check word overlap - strict check to avoid false positives with common words
            const pWords = pNorm.split(' ');
            const tWords = normTitle.split(' ');
            // If the first word matches the title's first word, it's a strong indicator
            if (pWords.length > 0 && tWords.length > 0 && pWords[0] === tWords[0] && pWords[0].length > 3) {
                bestMatchIndex = i;
                break;
            }
        }

        if (bestMatchIndex !== -1) {
            // The title is at parts[bestMatchIndex].
            // The instrument is the OTHER part(s).
            const instrumentParts = parts.filter((_, idx) => idx !== bestMatchIndex);
            if (instrumentParts.length > 0) {
                const candidate = instrumentParts.join(' ').trim();
                if (candidate.length > 1) return finalizeCleanup(candidate);
            }
            return "Загальна";
        }
    }

    // 6. Fallback: Word Removal (Standard Left-to-Right removal)
    // If no explicit separator matched, assumes "Title Instrument"
    const nameWords = normName.split(/\s+/);
    const titleWords = normTitle.split(/\s+/);

    let matchCount = 0;
    for (let i = 0; i < Math.min(nameWords.length, titleWords.length); i++) {
        if (nameWords[i] === titleWords[i]) matchCount++;
        else break;
    }

    if (matchCount > 0) {
        // Starts with title -> remove it
        // We need to cut the original string based on words roughly
        const originalWords = name.split(/[\s\-–—]+/);
        if (originalWords.length > matchCount) {
            const tail = originalWords.slice(matchCount).join(' ');
            if (tail.length > 1) return finalizeCleanup(tail);
        }
    }

    // 7. Final attempt: parens
    // Check if the content INSIDE parens is the title?
    const parenMatch = name.match(/\(([^)]+)\)$/);
    if (parenMatch) {
        const inside = parenMatch[1].trim();
        const insideNorm = normalizeString(inside);
        // If inside matches title, return valid OUTER part
        if (normTitle.includes(insideNorm) || insideNorm.includes(normTitle)) {
            // Return everything BEFORE the parenthesis
            // "Viola (Христос)" -> "Viola"
            return finalizeCleanup(name.replace(/\(.*\)$/, ''));
        }
        return finalizeCleanup(inside);
    }

    // If we're here, we failed to extract.
    // If result is basically the title, return General.
    if (normalizeString(name) === normTitle) return "Загальна";

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

    if (!s) return "Загальна";

    // Filter out common keys/tonalities if that's the only thing left
    // e.g. "C-dur", "d-moll", "F dur"
    if (/^[A-H][hs]?[\s\-]*(dur|moll|major|minor)$/i.test(s)) {
        return "Загальна";
    }

    // Custom mappings for generic names
    const lower = s.toLowerCase();
    if (lower === 'партія 1' || lower === 'part 1') return 'Партитура';
    if (lower === 'партія 2' || lower === 'part 2') return 'Хор';

    return s.charAt(0).toUpperCase() + s.slice(1);
};
