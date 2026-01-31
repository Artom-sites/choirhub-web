/**
 * Extracts and cleans the instrument name from a part name.
 * 
 * @param partName - The full name of the part (e.g., "Song Title - Violin 1")
 * @param songTitle - The title of the song to remove from the part name
 * @returns The cleaned instrument name (e.g., "Violin 1")
 */
export const extractInstrument = (partName: string, songTitle: string): string => {
    if (partName.includes(songTitle)) {
        const afterTitle = partName.replace(songTitle, '').replace(/^[\s\-–—]+/, '').trim();
        if (afterTitle) return afterTitle;
    }
    const match = partName.match(/[\-–—]\s*(.+)$/);
    if (match) return match[1].trim();
    return partName;
};
