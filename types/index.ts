export type UserRole = 'head' | 'regent' | 'member';

export type Permission =
    | 'add_songs'
    | 'edit_attendance'
    | 'edit_credits'
    | 'view_stats'
    | 'manage_services'
    | 'notify_members';

export interface AdminCode {
    code: string;
    permissions: Permission[];
    label?: string; // e.g., "Секретар"
}


export interface UserMembership {
    choirId: string;
    choirName: string;
    role: UserRole;
}

export interface UserData {
    id?: string; // Firebase Auth ID
    name: string;
    email?: string;
    choirId: string;
    choirName: string;
    role: UserRole;
    permissions?: Permission[]; // Custom admin permissions
    memberships?: UserMembership[]; // New field
    createdAt?: any;
}

export interface ChoirMember {
    id: string; // userId or unique string
    name: string;
    role: UserRole;
    voice?: 'Soprano' | 'Alto' | 'Tenor' | 'Bass';
    photoURL?: string;
    permissions?: Permission[]; // Custom admin permissions
    hasAccount?: boolean; // True if this member is linked to a real App Account
    linkedUserIds?: string[]; // Additional linked app user UIDs
}

export interface Choir {
    id: string;
    name: string;
    memberCode: string;
    regentCode: string;
    createdAt: string;
    regents: string[]; // Legacy: just names
    members?: ChoirMember[]; // New: full member objects
    icon?: string; // Base64 or URL
    knownConductors?: string[]; // Saved conductor names for autocomplete
    knownPianists?: string[];   // Saved pianist names for autocomplete
    adminCodes?: AdminCode[];   // Custom admin invite codes
    knownCategories?: string[]; // Custom song categories
}

export interface ServiceSong {
    songId: string;
    songTitle?: string;
    note?: string;
    performedBy?: string;  // Conductor for THIS performance
    pianist?: string;      // Pianist for THIS performance
}

export interface Service {
    id: string;
    date: string;
    time?: string; // HH:MM format, e.g. "10:00"
    title: string;
    songs: ServiceSong[];
    absentMembers?: string[]; // Array of member IDs
    confirmedMembers?: string[]; // Array of member IDs
    deletedAt?: string; // ISO timestamp for soft-delete (trash bin)
}

export interface SimpleSong {
    id: string;
    title: string;
    category: string;
    conductor?: string;
    pianist?: string;
    hasPdf?: boolean;
    addedBy?: string;
    addedAt?: string;
    pdfData?: string; // Base64 PDF content (Legacy)
    pdfUrl?: string; // Firebase Storage URL
    parts?: SongPart[]; // List of parts if available
    composer?: string;
    poet?: string;
    theme?: string;
    deletedAt?: string; // For soft delete
}

export type Category = string;

// ============ GLOBAL ARCHIVE ============

export type SongCategory = 'choir' | 'ensemble' | 'orchestra';

export type ChoirSubcategory = 'mixed' | 'female' | 'male' | 'youth' | 'children';

export type SyncPriority = 'critical' | 'high' | 'low';

export type SongSource = 'global' | 'local';

export interface SongPart {
    name: string;           // "Партитура", "Скрипка", "Сопрано"
    pdfUrl: string;         // Supabase Storage URL
    fileSize?: number;      // Bytes, for cache management
}

export interface GlobalSong {
    id?: string;
    title: string;
    composer?: string;
    poet?: string;          // Author of lyrics (text)
    category: SongCategory | string;

    subcategory?: ChoirSubcategory | string;  // For choir: mixed/female/etc, for orchestra: custom
    theme?: string;         // E.g. "Різдво", "Пасха", "Весілля"
    keywords: string[];     // Lowercase for search: ["отче", "наш", "кедров"]
    partsCount?: number;    // From index
    pdfUrl?: string;        // From index
    parts: SongPart[];      // At least one part (main PDF)
    sourceUrl?: string;     // Original URL from mscmusic.org
    sourceId?: string;      // External ID (e.g., MSC idx)
    createdAt?: string;
    updatedAt?: string;
}

export type SongSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface PendingSong extends GlobalSong {
    status: SongSubmissionStatus;
    submittedBy: string;        // User ID
    submittedByName?: string;   // User Name
    submittedChoirId?: string;  // Choir ID (optional context)
    submittedAt: string;
    reviewedBy?: string;        // Admin ID
    reviewedAt?: string;
    rejectionReason?: string;
}

// Local song in choir's private repertoire
export interface LocalSong extends GlobalSong {
    addedBy: string;        // User ID who added it
    choirId: string;        // Which choir owns this
    deletedAt?: string;     // Soft delete timestamp
    deletedBy?: string;     // User who deleted it
}

// Song reference in a Service (program)
export interface ServiceSongRef {
    songId: string;
    source: SongSource;     // 'global' or 'local'
    partIndex: number;      // Which part is selected (0 = first/main)
    songTitle?: string;     // Denormalized for display
    note?: string;          // Performance notes
    performedBy?: string;   // Conductor for THIS performance
    pianist?: string;       // Pianist for THIS performance
}

// User's saved songs (personal folder)
export interface UserSavedSong {
    songId: string;
    source: SongSource;
    partIndex: number;
    savedAt: string;
}

// Cache entry for offline storage
export interface CachedPdf {
    songId: string;
    partIndex: number;
    source: SongSource;
    priority: SyncPriority;
    pdfBlob?: Blob;         // Actual PDF data
    cachedAt: string;
    expiresAt?: string;     // For low-priority cache cleanup
}

// Metadata for search index (lightweight)
export interface SongMeta {
    id: string;
    title: string;
    composer?: string;
    category: SongCategory;
    subcategory?: string;
    keywords: string[];
    partCount: number;
    source: SongSource;
}

export interface ChoirNotification {
    id: string;
    title: string;
    body: string;
    choirId: string;
    senderId: string;
    senderName: string;
    createdAt: string;
    readBy: string[]; // Array of user IDs who have read this
}
