
// Copied from lib/utils.ts (Latest Bidirectional Logic)
const extractInstrument = (partName: string, songTitle: string): string => {
    if (!partName || !songTitle) return "Загальна";

    // 1. First cleanup: extension, underscores to spaces
    let name = partName.replace(/\.pdf$/i, '').replace(/_/g, ' ').trim();

    // 2. Remove leading ordering numbers
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

    // 4. Exact match
    if (normName === normTitle) return "Загальна";
    if (normTitle.includes(normName) && normName.length > 4) return "Загальна";

    // 5. Intelligent Separation Check
    const separators = [' - ', ' – ', ' — ', '-'];
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
            if (normTitle.includes(pNorm) || pNorm.includes(normTitle) || normTitle.startsWith(pNorm.substring(0, 10)) || pNorm.startsWith(normTitle.substring(0, 10))) {
                bestMatchIndex = i;
                break;
            }
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
            return "Загальна";
        }
    }

    // 6. Fallback: Word Removal
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

    // 7. Final attempt: parens
    const parenMatch = name.match(/\(([^)]+)\)$/);
    if (parenMatch) return finalizeCleanup(parenMatch[1]);

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
        .trim();
    if (!s) return "Загальна";
    return s.charAt(0).toUpperCase() + s.slice(1);
};

// Test Cases
const songTitle = "Христос - надежда тех сердец";

// Case 1: "00 Христос надежда" -> Should be "Загальна"
console.log(`\nTest 1: "00 Христос надежда"`);
console.log(`Result: "${extractInstrument("00 Христос надежда", songTitle)}"`);

// Case 2: "Христос надежда" -> Should be "Загальна" (because it's just title words)
console.log(`\nTest 2: "Христос надежда"`);
console.log(`Result: "${extractInstrument("Христос надежда", songTitle)}"`);
// Case 9: Inverted Naming "02 Instrument - Song"
const songTitle2 = "Христос - надежда тех сердец";

console.log(`\nTest 9a: "02 Кларнет B 1,2 - Христос надія"`);
// Current logic likely returns "Христос надія"
console.log(`Result: "${extractInstrument("02 Кларнет B 1,2 - Христос надія", songTitle2)}"`);

console.log(`\nTest 9b: "05 Тромбони 1,2 - Христос надія"`);
console.log(`Result: "${extractInstrument("05 Тромбони 1,2 - Христос надія", songTitle2)}"`);

// Case 10: Parenthesis Splitting Bug
// Likely filename: "Trumpet B I (Христос - надежда).pdf"
console.log(`\nTest 10: "Trumpet B I (Христос - надежда)"`);
console.log(`Result: "${extractInstrument("Trumpet B I (Христос - надежда)", songTitle)}"`);

console.log(`\nTest 11: "Viola (Христос)"`);
console.log(`Result: "${extractInstrument("Viola (Христос)", songTitle)}"`);
// Case 3: "Something resulting in надежда)"
// Attempting to guess original string that produces this.
// Maybe: "Христос надежда (надежда)"?
console.log(`\nTest 3: "Христос надежда (надежда)"`);
console.log(`Result: "${extractInstrument("Христос надежда (надежда)", songTitle)}"`);

// Case 4: Unbalanced paren
console.log(`\nTest 4: "Христос надежда (надежда"`);
console.log(`Result: "${extractInstrument("Христос надежда (надежда", songTitle)}"`);

// Case 6: Mismatched Title (Simulating "songTitle" being empty or different)
console.log(`\nTest 6: "надежда)" with DIFFERENT title`);
console.log(`Result: "${extractInstrument("надежда)", "Other Song")}"`);

// Case 7: Mixed Cyrillic/Latin (Latin 'a' in 'надежда')
// Cyrillic: н а д е ж д а (code points: 1085 1072 1076 1077 1078 1076 1072)
// Latin 'a': 97
const latinA = "нaдеждa)".replace(/а/g, 'a'); // replaced cyrillic а with latin a
console.log(`\nTest 7: Mixed Latin/Cyrillic "надежда)" with Cyrillic Title`);
console.log(`Result: "${extractInstrument(latinA, songTitle)}"`);

// Case 8: Unbalanced paren at end
console.log(`\nTest 8: "Violin)"`);
console.log(`Result: "${extractInstrument("Violin)", songTitle)}"`);
