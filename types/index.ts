export type UserRole = 'head' | 'regent' | 'member';


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
    memberships?: UserMembership[]; // New field
    createdAt?: any;
}

export interface ChoirMember {
    id: string; // userId or unique string
    name: string;
    role: UserRole;
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
}

export interface ServiceSong {
    songId: string;
    songTitle?: string;
    note?: string;
}

export interface Service {
    id: string;
    date: string;
    title: string;
    songs: ServiceSong[];
    absentMembers?: string[]; // Array of member IDs
}

export interface SimpleSong {
    id: string;
    title: string;
    category: string;
    conductor?: string;
    hasPdf?: boolean;
    addedBy?: string;
    addedAt?: string;
    pdfData?: string; // Base64 PDF content
}

export type Category =
    | "Новий рік"
    | "Різдво"
    | "В'їзд"
    | "Вечеря"
    | "Пасха"
    | "Вознесіння"
    | "Трійця"
    | "Свято Жнив"
    | "Інші";
