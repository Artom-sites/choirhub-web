import { extractInstrument } from '../lib/utils';
// Note: Jest might need moduleNameMapper if using @/ alias without ts-jest or babel-plugin-module-resolver manually configured, 
// strictly speaking next/jest handles it, but let's test relative path first to be safe, or stick to alias if confident.
// I'll use relative path to avoid potential alias issues if next/jest setup has quirks.
// Actually, next/jest reads tsconfig.json so aliases work. I'll correct to use alias if I can, but .. relative is safer for quick check.

describe('utils', () => {
    describe('extractInstrument', () => {
        it('removes song title from part name with hyphen', () => {
            expect(extractInstrument('Amazing Grace - Violin 1', 'Amazing Grace')).toBe('Violin 1');
        });

        it('removes song title from part name with en-dash', () => {
            expect(extractInstrument('Amazing Grace – Cello', 'Amazing Grace')).toBe('Cello');
        });

        it('removes song title from part name with em-dash', () => {
            expect(extractInstrument('Amazing Grace — Bass', 'Amazing Grace')).toBe('Bass');
        });

        it('returns instrument name if extracted via regex fallbacks', () => {
            // "Song Title - Instrument" pattern
            expect(extractInstrument('Random Song - Flute', 'Different Title')).toBe('Flute');
        });

        it('returns original string if no pattern matches', () => {
            expect(extractInstrument('JustName', 'Other')).toBe('JustName');
        });
    });
});
