export type UserRole = 'head' | 'regent' | 'member';

export type Permission =
    | 'add_songs'
    | 'edit_attendance'
    | 'edit_credits'
    | 'view_stats'
    | 'manage_services';

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
    permissions?: Permission[]; // Custom admin permissions
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
    hasPdf?: boolean;
    addedBy?: string;
    addedAt?: string;
    pdfData?: string; // Base64 PDF content (Legacy)
    pdfUrl?: string; // Firebase Storage URL
}

export type Category = string;
