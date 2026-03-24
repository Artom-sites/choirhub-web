"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import GlassPageHeader from '@/components/GlassPageHeader';
import { Service, ServiceSong, SimpleSong, Choir, ChoirMember, ProgramItem, ProgramItemType } from "@/types";
import { addSongToService, removeSongFromService, getChoir, updateService, setServiceAttendance, addKnownConductor, addKnownPianist } from "@/lib/db";
import { getFirstNameInitial } from "@/lib/utils";
import { updateAttendanceCache } from "@/lib/attendanceCache";
import { useAuth } from "@/contexts/AuthContext";
import { useRepertoire } from "@/contexts/RepertoireContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { ChevronLeft, Eye, X, Plus, Users, UserX, Check, Calendar, Music, UserCheck, AlertCircle, Trash2, User as UserIcon, CloudDownload, CheckCircle, Loader, ChevronDown, Mic2, BookOpen, Hand, Mic, Users2, MoreHorizontal, GripVertical, ListOrdered, Printer, Pencil, Save, Clock } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from '@capacitor/status-bar';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Dialog } from '@capacitor/dialog';
import { useRouter } from "next/navigation";
import SwipeableCard, { SwipeableCardRef } from "./SwipeableCard";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet';

import { resolvePdfUrlToBase64 } from "../lib/cache";
import OfflinePdfModal from "./OfflinePdfModal";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import AddProgramItemModal from "./AddProgramItemModal";
import { PencilKitAnnotator } from "@/plugins/PencilKitAnnotator";

interface ServiceViewProps {
    service: Service;
    allServices?: Service[];
    onBack: () => void;
    canEdit: boolean;
    canEditCredits?: boolean; // Edit conductor/pianist
    canEditAttendance?: boolean; // Edit attendance
    choir?: Choir | null;
    isNativeApp?: boolean; // Passed from parent if already computed
}

// programTypeConfig is built inside the component so it can use t()
const buildProgramTypeConfig = (t: (key: any) => string): Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> => ({
    choir: { label: t('program.type.choir'), icon: <Music className="w-4 h-4" />, color: "text-blue-400", bg: "bg-blue-500/10" },
    congregation: { label: t('program.type.congregation'), icon: <Users2 className="w-4 h-4" />, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    verse: { label: t('program.type.verse'), icon: <BookOpen className="w-4 h-4" />, color: "text-purple-400", bg: "bg-purple-500/10" },
    prayer: { label: t('program.type.prayer'), icon: <Hand className="w-4 h-4" />, color: "text-amber-500", bg: "bg-amber-500/10" },
    sermon: { label: t('program.type.sermon'), icon: <BookOpen className="w-4 h-4" />, color: "text-orange-400", bg: "bg-orange-500/10" },
    solo: { label: t('program.type.solo'), icon: <Mic className="w-4 h-4" />, color: "text-pink-400", bg: "bg-pink-500/10" },
    ensemble: { label: t('program.type.ensemble'), icon: <Users2 className="w-4 h-4" />, color: "text-green-400", bg: "bg-green-500/10" },
    reading: { label: t('service.type.reading'), icon: <BookOpen className="w-4 h-4" />, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    announcement: { label: t('service.type.announcement'), icon: <AlertCircle className="w-4 h-4" />, color: "text-gray-400", bg: "bg-gray-500/10" },
    other: { label: t('program.type.other'), icon: <MoreHorizontal className="w-4 h-4" />, color: "text-zinc-400", bg: "bg-zinc-500/10" },
});

export default function ServiceView({ service, allServices = [], onBack, canEdit, canEditCredits = false, canEditAttendance = false, choir, isNativeApp }: ServiceViewProps) {
    const router = useRouter();
    const { userData, user } = useAuth();
    const { t } = useTranslation();
    const programTypeConfig = buildProgramTypeConfig(t);

    // Local state for optimistic updates
    const [currentService, setCurrentService] = useState<Service>(service);
    // const [availableSongs, setAvailableSongs] = useState<SimpleSong[]>([]); // Replaced by Context
    const { songs: rawAvailableSongs } = useRepertoire();
    const availableSongs = rawAvailableSongs || [];
    const [showAddSong, setShowAddSong] = useState(false);
    const [showAttendance, setShowAttendance] = useState(false);
    const [search, setSearch] = useState("");
    const [votingLoading, setVotingLoading] = useState(false);

    // Native-only: Tab state and program items
    const [isNative, setIsNative] = useState(() => isNativeApp ?? false);
    useEffect(() => {
        if (isNativeApp !== undefined) {
            setIsNative(isNativeApp);
            return;
        }
        // Fallback robust check for standalone usage
        const checkIsNative = typeof window !== 'undefined' && (
            ((window as any).Capacitor?.getPlatform && (window as any).Capacitor.getPlatform() !== 'web') ||
            document.documentElement.classList.contains('is-native') ||
            Capacitor.isNativePlatform()
        );
        setIsNative(!!checkIsNative);
    }, [isNativeApp]);
    const [activeTab, setActiveTab] = useState<'program' | 'choir'>('program');
    const [showAddProgramItem, setShowAddProgramItem] = useState(false);
    const [editingProgramItem, setEditingProgramItem] = useState<ProgramItem | null>(null);
    const [programItems, setProgramItems] = useState<ProgramItem[]>(service.program || []);
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
    const [swipedProgramItemId, setSwipedProgramItemId] = useState<string | null>(null);
    const [programItemToDelete, setProgramItemToDelete] = useState<string | null>(null);

    // Edit Service Modal (title, date, time)
    const [showEditServiceModal, setShowEditServiceModal] = useState(false);
    const [editTitle, setEditTitle] = useState(service.title);
    const [editDate, setEditDate] = useState(service.date);
    const [editTime, setEditTime] = useState(service.time || '');
    const [editingDescription, setEditingDescription] = useState(false);
    const [editDescription, setEditDescription] = useState(service.description || '');

    const openEditServiceModal = () => {
        setEditTitle(currentService.title);
        setEditDate(currentService.date);
        setEditTime(currentService.time || '');
        setShowEditServiceModal(true);
    };

    const saveServiceDetails = async () => {
        const trimmedTitle = editTitle.trim();
        if (!trimmedTitle) return;
        setCurrentService(prev => ({ ...prev, title: trimmedTitle, date: editDate, time: editTime || undefined }));
        setShowEditServiceModal(false);
        if (userData?.choirId) {
            const updates: any = { title: trimmedTitle, date: editDate };
            if (editTime) updates.time = editTime; else updates.time = '';
            await updateService(userData.choirId, currentService.id, updates);
        }
    };

    const saveDescription = async () => {
        const val = editDescription.trim();
        setCurrentService(prev => ({ ...prev, description: val || undefined }));
        setEditingDescription(false);
        if (userData?.choirId) await updateService(userData.choirId, currentService.id, { description: val } as any);
    };

    const cardRefs = useRef<Record<string, SwipeableCardRef | null>>({});

    const cancelDeleteProgramItem = () => {
        if (programItemToDelete && cardRefs.current[programItemToDelete]) {
            cardRefs.current[programItemToDelete]?.reset();
        }
        setProgramItemToDelete(null);
    }

    const cancelDeleteSong = () => {
        if (songToDeleteIndex !== null) {
            const tempSongIdStr = `temp-song-${songToDeleteIndex}`;
            if (cardRefs.current[tempSongIdStr]) {
                cardRefs.current[tempSongIdStr]?.reset();
            }
        }
        setSongToDeleteIndex(null);
    }

    const isServiceType = service.type !== 'rehearsal'; // default to true if undefined for backward compat with 'service'

    // Pdf preview modal (previously strictly offline, now universal for native inline view)
    const [previewModalSong, setPreviewModalSong] = useState<{ id: string, title: string, pdfUrl?: string, parts?: any[] } | null>(null);

    // Filter choir members for attendance — exclude voiceless auto-stubs
    const filterRosterMembers = (members: ChoirMember[]): ChoirMember[] => {
        return members.filter((m: any) => {
            if (m.isDuplicate) return false;
            if (m.voice) return true;
            if (m.role === 'head' || m.role === 'regent') return true;
            if (typeof m.id === 'string' && m.id.startsWith('manual_')) return true;
            // Voiceless entry with hasAccount = auto-created app stub → hide from attendance
            if (m.hasAccount && !m.voice) return false;
            return true;
        });
    };

    // Choir members for attendance
    const [choirMembers, setChoirMembers] = useState<ChoirMember[]>(filterRosterMembers(choir?.members || []));
    const [absentMembers, setAbsentMembers] = useState<string[]>(service.absentMembers || []);
    const [confirmedMembers, setConfirmedMembers] = useState<string[]>(service.confirmedMembers || []);
    const [membersLoading, setMembersLoading] = useState(!(choir?.members && choir.members.length > 0));

    // Sync local state with prop updates (real-time data)
    useEffect(() => {
        setCurrentService(service);
        setAbsentMembers(service.absentMembers || []);
        setConfirmedMembers(service.confirmedMembers || []);

        // Auto-migrate legacy songs to program items if program is empty but songs exist
        // Migrate songs to program items ONLY if it's a full service type
        if (isServiceType && isNative && (currentService.songs || []).length > 0 && !service.program) {
            const migratedProgram: ProgramItem[] = (service.songs || []).map((s, index) => {
                const songTitle = availableSongs.find(as => as.id === s.songId)?.title || s.songTitle || t("service.unknown_song");
                return {
                    id: crypto.randomUUID(),
                    type: 'choir',
                    title: songTitle,
                    performer: t("program.type.choir"), // Default
                    songId: s.songId,
                    songTitle: songTitle,
                    conductor: s.performedBy || undefined,
                    pianist: s.pianist || undefined,
                    order: index
                };
            });
            setProgramItems(migratedProgram);
            // Optionally save the migration to DB right away to persist it
            if (userData?.choirId) {
                updateService(userData.choirId, service.id, { program: migratedProgram }).catch(console.error);
            }
        } else if (service.program) {
            setProgramItems(service.program);
        }
    }, [service, isNative, availableSongs, userData?.choirId, isServiceType]);

    // Widget data updates are now handled globally via lib/db.ts mutations and lib/widgetSync.ts

    // Sync choir data updates
    useEffect(() => {
        if (choir) {
            setChoirMembers(filterRosterMembers(choir.members || []));
            if (choir.knownConductors) setKnownConductors(Array.from(new Set(choir.knownConductors)));
            if (choir.knownPianists) setKnownPianists(Array.from(new Set(choir.knownPianists)));
            setMembersLoading(false);
        }
    }, [choir]);

    useEffect(() => {
        async function fetchData() {
            if (!userData?.choirId) return;

            // Songs are now handled by RepertoireContext (no fetch here)

            // Only fetch choir if not provided via props
            if (!choir) {
                setMembersLoading(true);
                try {
                    const fetchedChoir = await getChoir(userData.choirId);
                    if (fetchedChoir?.members) {
                        setChoirMembers(filterRosterMembers(fetchedChoir.members));
                    }
                    if (fetchedChoir?.knownConductors) setKnownConductors(Array.from(new Set(fetchedChoir.knownConductors)));
                    if (fetchedChoir?.knownPianists) setKnownPianists(Array.from(new Set(fetchedChoir.knownPianists)));
                } catch (e) {
                    console.error("Error fetching choir details:", e);
                } finally {
                    setMembersLoading(false);
                }
            }
        }
        fetchData();
    }, [userData?.choirId, choir]);

    // Song credits state
    const [knownConductors, setKnownConductors] = useState<string[]>(Array.from(new Set(choir?.knownConductors || [])));
    const [knownPianists, setKnownPianists] = useState<string[]>(Array.from(new Set(choir?.knownPianists || [])));
    const [editingSongIndex, setEditingSongIndex] = useState<number | null>(null);
    const [tempConductor, setTempConductor] = useState("");
    const [tempPianist, setTempPianist] = useState("");

    // Credits modal dropdown state
    const [isConductorDropdownOpen, setIsConductorDropdownOpen] = useState(false);
    const [isPianistDropdownOpen, setIsPianistDropdownOpen] = useState(false);
    const [showCustomConductor, setShowCustomConductor] = useState(false);
    const [showCustomPianist, setShowCustomPianist] = useState(false);
    const conductorDropdownRef = useRef<HTMLDivElement>(null);
    const pianistDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (conductorDropdownRef.current && !conductorDropdownRef.current.contains(e.target as Node)) {
                setIsConductorDropdownOpen(false);
            }
            if (pianistDropdownRef.current && !pianistDropdownRef.current.contains(e.target as Node)) {
                setIsPianistDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Warmup Conductor
    const [showCustomWarmup, setShowCustomWarmup] = useState(false);
    const [warmupConductor, setWarmupConductor] = useState(service.warmupConductor || "");

    useEffect(() => {
        setWarmupConductor(service.warmupConductor || "");
    }, [service.warmupConductor]);

    const handleUpdateWarmup = async (name: string) => {
        setWarmupConductor(name);
        setShowCustomWarmup(false);
        if (userData?.choirId) {
            await updateService(userData.choirId, currentService.id, { warmupConductor: name });
        }
    };

    const regentsList = Array.from(new Set([
        ...(choir?.regents || []),
        ...(choir?.knownConductors || []),
        ...(choirMembers.filter(m => m.role === 'regent' || m.role === 'head').map(m => m.name))
    ])).filter(Boolean);

    // Offline Caching
    const { cacheServiceSongs, progress: cacheProgress, checkCacheStatus } = useOfflineCache();
    const [localCacheStatus, setLocalCacheStatus] = useState<Record<string, boolean>>({});

    // Auto-cache effect: Cache PDFs when viewing service (any service, not just upcoming)

    // Attendance Modal Status Bar Control
    useEffect(() => {
        if (showAttendance) {
            // Modal is dark -> set Status Bar to Dark (Light Text)
            if (Capacitor.isNativePlatform()) {
                StatusBar.setStyle({ style: Style.Dark });
                StatusBar.setBackgroundColor({ color: '#09090b' }); // Match modal bg
            }
        } else {
            // Revert to default theme behavior
            const theme = document.documentElement.getAttribute('data-theme');
            if (Capacitor.isNativePlatform()) {
                if (theme === 'dark') {
                    StatusBar.setStyle({ style: Style.Dark });
                    StatusBar.setBackgroundColor({ color: '#09090b' });
                } else {
                    StatusBar.setStyle({ style: Style.Light });
                    StatusBar.setBackgroundColor({ color: '#FFFFFF' });
                }
            }
        }
    }, [showAttendance]);
    useEffect(() => {
        if (!currentService || availableSongs.length === 0) return;
        // Only cache on native platforms
        if (!Capacitor.isNativePlatform()) return;

        // Check cache status for UI
        const songIds = (currentService.songs || []).map(s => s.songId);
        checkCacheStatus(songIds).then(status => {
            setLocalCacheStatus(status);
        });

        // Cache all songs in this service for offline access
        const songsToCache = (currentService.songs || []).map(s => {
            const fullSong = availableSongs.find(as => as.id === s.songId);
            if (fullSong && (fullSong.pdfUrl || (fullSong.parts && fullSong.parts.length > 0))) {
                return {
                    id: fullSong.id,
                    title: fullSong.title,
                    pdfUrl: fullSong.pdfUrl,
                    parts: fullSong.parts
                };
            }
            return null;
        }).filter(Boolean) as any[];

        if (songsToCache.length > 0) {
            cacheServiceSongs(currentService.id, songsToCache).then((success) => {
                checkCacheStatus(songIds).then(status => {
                    setLocalCacheStatus(status);
                });
            });
        }

        // Prefetch the song page route to cache JS chunks
        const songs = currentService.songs || [];
        if (songs.length > 0) {
            const firstSongId = songs[0]?.songId;
            if (firstSongId) {
                const prefetchUrl = `/song?id=${firstSongId}`;
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = prefetchUrl;
                link.as = 'document';
                document.head.appendChild(link);
            }
        }
    }, [currentService, availableSongs, cacheServiceSongs, checkCacheStatus]);

    const isUpcoming = (dateStr: string, timeStr?: string) => {
        const now = new Date();
        // Parse dateStr (e.g., YYYY-MM-DD) manually to avoid timezone issues.
        // new Date("YYYY-MM-DD") is UTC, but we want local time for comparisons.
        const parts = dateStr.split('-');
        if (parts.length < 3) return false;

        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
        const day = parseInt(parts[2]);

        const serviceDate = new Date(year, month, day);

        if (timeStr) {
            // Parse time and set it on the service date
            const [hours, minutes] = timeStr.split(':').map(Number);
            serviceDate.setHours(hours, minutes, 0, 0);
            return serviceDate > now;
        } else {
            // If no time, check if date is today or future (using end of day)
            serviceDate.setHours(23, 59, 59, 999);
            return serviceDate >= now;
        }
    };

    const handleVote = async (status: 'present' | 'absent') => {
        if (!userData?.choirId || !user?.uid) return;

        // Strict Check: Prevent voting if service is in the past
        if (!isUpcoming(currentService.date, currentService.time)) {
            alert(t('service.voting.closed'));
            return;
        }

        // Optimistic update
        const uid = user.uid;
        const previousConfirmed = [...confirmedMembers];
        const previousAbsent = [...absentMembers];
        const previousService = { ...currentService };

        let newConfirmed = [...confirmedMembers];
        let newAbsent = [...absentMembers];

        if (status === 'present') {
            newConfirmed = [...newConfirmed, uid].filter((v, i, a) => a.indexOf(v) === i);
            newAbsent = newAbsent.filter(id => id !== uid);
        } else {
            newAbsent = [...newAbsent, uid].filter((v, i, a) => a.indexOf(v) === i);
            newConfirmed = newConfirmed.filter(id => id !== uid);
        }

        // Apply optimistic state immediately
        setConfirmedMembers(newConfirmed);
        setAbsentMembers(newAbsent);
        setCurrentService({ ...currentService, confirmedMembers: newConfirmed, absentMembers: newAbsent });
        setVotingLoading(true);

        try {
            if (allServices && allServices.length > 0) {
                const up = allServices.map(s => {
                    if (s.id !== currentService.id) return s;
                    let c = [...(s.confirmedMembers || [])].filter(id => id !== user.uid);
                    let a = [...(s.absentMembers || [])].filter(id => id !== user.uid);
                    if (status === 'present') c.push(user.uid);
                    else if (status === 'absent') a.push(user.uid);
                    return { ...s, confirmedMembers: c, absentMembers: a };
                });
                import('@/lib/widgetSync').then(m => m.syncWidgetNearestService(up, choir)).catch(console.error);
            }
            await setServiceAttendance(userData.choirId, currentService.id, user.uid, status);
            // Since ServiceView might not have the full services list easily available from props if we removed it, wait, we probably need allServices for widget sync!
            // Ah, the user said we must implement payload-driven widget sync directly from React state using the UPDATED in-memory services array. 
            // In ServiceView, we don't have the full array unless we keep the allServices prop. Let's keep the allServices prop! 
        } catch (e) {
            console.error(e);
            // Revert on error
            setConfirmedMembers(previousConfirmed);
            setAbsentMembers(previousAbsent);
            setCurrentService(previousService);
            alert(t('service.voting.save_failed'));
        }
        finally { setVotingLoading(false); }
    };

    const getMyStatus = () => {
        if (!user?.uid) return 'unknown';
        if ((currentService as any).absentMembers?.includes(user?.uid)) return 'absent';
        if ((currentService as any).confirmedMembers?.includes(user?.uid)) return 'present';
        return 'unknown';
    };



    const [selectedSongsToService, setSelectedSongsToService] = useState<string[]>([]);
    const [addingSongsLoading, setAddingSongsLoading] = useState(false);

    const toggleSongSelection = (songId: string) => {
        setSelectedSongsToService(prev =>
            prev.includes(songId)
                ? prev.filter(id => id !== songId)
                : [...prev, songId]
        );
    };

    const handleBatchAddSongs = async () => {
        if (!userData?.choirId || selectedSongsToService.length === 0) return;
        setAddingSongsLoading(true);

        // Find full song objects
        const songsToAdd = (availableSongs || []).filter(s => selectedSongsToService.includes(s.id));
        const newServiceSongs: ServiceSong[] = songsToAdd.map(s => {
            const songData: ServiceSong = {
                songId: s.id,
                songTitle: s.title,
            };
            if (s.conductor) songData.performedBy = s.conductor;
            if (s.pianist) songData.pianist = s.pianist;
            return songData;
        });

        const newProgramItems: ProgramItem[] = isServiceType ? songsToAdd.map((s, idx) => ({
            id: crypto.randomUUID(),
            type: 'choir',
            title: s.title,
            performer: t("program.type.choir"),
            songId: s.id,
            songTitle: s.title,
            conductor: s.conductor || undefined,
            pianist: s.pianist || undefined,
            order: programItems.length + idx
        })) : [];

        const updatedSongs = [...currentService.songs, ...newServiceSongs];
        let updatedProgram = programItems;
        if (isServiceType) {
            updatedProgram = [...programItems, ...newProgramItems];
        }

        setCurrentService({ ...currentService, songs: updatedSongs, program: isServiceType ? updatedProgram : undefined });
        if (isServiceType) setProgramItems(updatedProgram);

        setShowAddSong(false);
        setSearch("");
        setSelectedSongsToService([]);
        setAddingSongsLoading(false);

        try {
            const updates: any = { songs: updatedSongs };
            if (isServiceType) updates.program = updatedProgram;
            await updateService(userData.choirId, currentService.id, updates);
        } catch (e) {
            console.error("Failed to batch add songs", e);
        }
    };



    const [songToDeleteIndex, setSongToDeleteIndex] = useState<number | null>(null);

    const handleRemoveSong = (index: number) => {
        setSongToDeleteIndex(index);
    };

    const confirmRemoveSong = async () => {
        if (!userData?.choirId || songToDeleteIndex === null) return;

        const updatedSongs = [...currentService.songs];
        const removedSong = updatedSongs.splice(songToDeleteIndex, 1)[0];

        let updatedProgram = programItems;
        if (isServiceType && removedSong?.songId) {
            updatedProgram = programItems.filter(p => !(p.type === 'choir' && p.songId === removedSong.songId));
            setProgramItems(updatedProgram);
        }

        setCurrentService({ ...currentService, songs: updatedSongs, program: isServiceType ? updatedProgram : undefined });
        setSongToDeleteIndex(null);

        const updates: any = { songs: updatedSongs };
        if (isServiceType) updates.program = updatedProgram;

        await updateService(userData.choirId, currentService.id, updates);
    };

    const handleViewPdf = async (songId: string, itemTitle?: string) => {
        // Find the full song details to get the PDF URL
        const song = availableSongs.find(s => s.id === songId);

        if (isNative && Capacitor.getPlatform() === 'ios') {
            // iOS offline: try to resolve to Base64 using cache
            if (!navigator.onLine && song) {
                // Determine Parts
                const partsData = (song.parts && song.parts.length > 0)
                    ? song.parts.map((p: any) => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                    : [{ name: t('song.main_part'), pdfUrl: song.pdfUrl || '' }];

                if (partsData.length > 0 && partsData[0].pdfUrl) {
                    try {
                        // Resolve all URLs to base64 so Swift can handle them without network
                        const resolvedParts = await Promise.all(
                            partsData.map(async (p: any) => {
                                const resolvedUrl = await resolvePdfUrlToBase64(p.pdfUrl, songId, p.name);
                                return { ...p, pdfUrl: resolvedUrl };
                            })
                        );

                        // Check if we ACTUALLY got offline data (starting with data:)
                        if (resolvedParts[0].pdfUrl.startsWith('data:')) {
                            await PencilKitAnnotator.openNativePdfViewer({
                                parts: resolvedParts,
                                initialPartIndex: 0,
                                songId,
                                userUid: userData?.id || 'anonymous',
                                title: song.title || itemTitle || t('songs.list.song'),
                            });
                            return;
                        }
                    } catch (e) {
                        console.error('[NativePdfOffline] Failed resolving base64 cache', e);
                    }
                }

                // If resolving base64 failed, the file is not cached for offline.
                await Dialog.alert({
                    title: t('service.cache.error_title'),
                    message: t('service.cache.error_message')
                });
                return;
            }
            // iOS online: Open native PDF viewer directly — zero preloader
            if (song) {
                const partsData = (song.parts && song.parts.length > 0)
                    ? song.parts.map((p: any) => ({ name: p.name || 'Part', pdfUrl: p.pdfUrl }))
                    : [{ name: t('song.main_part'), pdfUrl: song.pdfUrl || '' }];

                if (partsData[0]?.pdfUrl) {
                    PencilKitAnnotator.openNativePdfViewer({
                        parts: partsData,
                        initialPartIndex: 0,
                        songId,
                        userUid: userData?.id || 'anonymous',
                        title: song.title || itemTitle || t('songs.list.song'),
                    }).catch(e => console.error('[NativePdf] Error:', e));
                    return;
                }
            }
            // Fallback: if no PDF data, navigate to song page
            router.push(`/song?id=${songId}`);
            return;
        }

        if (isNative) {
            // Non-iOS native: use preview modal
            if (song) {
                setPreviewModalSong(song);
            } else {
                setPreviewModalSong({ id: songId, title: itemTitle || t("songs.list.song") });
            }
            return;
        }

        // Web Online - navigate to song page as usual
        if (!navigator.onLine && song) {
            setPreviewModalSong(song);
            return;
        }

        router.push(`/song?id=${songId}`);
    };

    const openEditCredits = (index: number) => {
        const song = currentService.songs?.[index];
        setTempConductor(song?.performedBy || "");
        setTempPianist(song?.pianist || "");
        setEditingSongIndex(index);
        setShowCustomConductor(false);
        setShowCustomPianist(false);
        setIsConductorDropdownOpen(false);
        setIsPianistDropdownOpen(false);
    };

    const handleSaveCredits = async () => {
        if (editingSongIndex === null || !userData?.choirId) return;

        const updatedSongs = [...(currentService.songs || [])];
        const currentSong = updatedSongs[editingSongIndex];
        if (!currentSong) {
            setEditingSongIndex(null);
            return;
        }
        const updatedSong: ServiceSong = { ...currentSong };

        if (tempConductor) {
            updatedSong.performedBy = tempConductor;
        } else {
            delete updatedSong.performedBy;
        }

        if (tempPianist) {
            updatedSong.pianist = tempPianist;
        } else {
            delete updatedSong.pianist;
        }

        updatedSongs[editingSongIndex] = updatedSong;

        let updatedProgram = programItems;
        if (isServiceType && currentService.program) {
            updatedProgram = programItems.map(p => {
                if (p.type === 'choir' && p.songId === updatedSong.songId) {
                    return {
                        ...p,
                        conductor: updatedSong.performedBy,
                        pianist: updatedSong.pianist
                    };
                }
                return p;
            });
            setProgramItems(updatedProgram);
        }

        setCurrentService({ ...currentService, songs: updatedSongs, program: isServiceType ? updatedProgram : undefined });
        setEditingSongIndex(null);

        // Save to Firestore
        const updates: any = { songs: updatedSongs };
        if (isServiceType) updates.program = updatedProgram;
        await updateService(userData.choirId, currentService.id, updates);

        // Add new names to known lists (if not empty and not already in list)
        if (tempConductor && !knownConductors.includes(tempConductor)) {
            await addKnownConductor(userData.choirId, tempConductor);
            setKnownConductors(prev => [...prev, tempConductor]);
        }
        if (tempPianist && !knownPianists.includes(tempPianist)) {
            await addKnownPianist(userData.choirId, tempPianist);
            setKnownPianists(prev => [...prev, tempPianist]);
        }

        // Also update the song in repertoire with the new conductor/pianist (only if song doesn't already have one)
        if ((tempPianist || tempConductor) && currentSong.songId) {
            try {
                // Find the song in availableSongs to check if it already has these fields
                const originalSong = availableSongs.find(s => s.id === currentSong.songId);
                const songUpdates: any = {};
                
                if (tempPianist && originalSong && !originalSong.pianist) {
                    songUpdates.pianist = tempPianist;
                }
                if (tempConductor && originalSong && !originalSong.conductor) {
                    songUpdates.conductor = tempConductor;
                }
                
                if (Object.keys(songUpdates).length > 0) {
                    const { updateSong } = await import("@/lib/db");
                    await updateSong(userData.choirId, currentSong.songId, songUpdates);
                }
            } catch (e) {
                console.error("Failed to update song details in repertoire:", e);
            }
        }
    };

    const setMemberAttendance = (memberId: string, status: 'present' | 'absent' | 'unknown') => {
        if (status === 'present') {
            setConfirmedMembers(prev => [...prev.filter(id => id !== memberId), memberId]);
            setAbsentMembers(prev => prev.filter(id => id !== memberId));
        } else if (status === 'absent') {
            setAbsentMembers(prev => [...prev.filter(id => id !== memberId), memberId]);
            setConfirmedMembers(prev => prev.filter(id => id !== memberId));
        } else {
            // Reset to unknown/waiting
            setConfirmedMembers(prev => prev.filter(id => id !== memberId));
            setAbsentMembers(prev => prev.filter(id => id !== memberId));
        }
    };

    const markRestAsPresent = () => {
        const newConfirmed = choirMembers
            .map(m => m.id)
            .filter(id => !absentMembers.includes(id));
        setConfirmedMembers(newConfirmed);
    };

    const handleSaveAttendance = async () => {
        if (!userData?.choirId || !userData?.id) return;
        try {
            // Single atomic write: attendance + finalization in one Firestore request.
            // Eliminates race condition and false errors for attendance-permission users.
            const now = new Date().toISOString();
            await updateService(userData.choirId, currentService.id, {
                absentMembers,
                confirmedMembers,
                isFinalized: true,
                finalizedAt: now,
                finalizedBy: userData.id,
            });

            const finalUpdate = {
                ...currentService,
                absentMembers,
                confirmedMembers,
                isFinalized: true,
                finalizedAt: now,
                finalizedBy: userData.id,
            };

            setCurrentService(finalUpdate);
            updateAttendanceCache(userData.choirId, [finalUpdate]);
            setShowAttendance(false);
        } catch (error) {
            console.error('Failed to save attendance:', error);
            alert(t('service.members.save_failed'));
        }
    };

    const filteredSongs = (availableSongs || []).filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) &&
        !(currentService.songs || []).some(existing => existing.songId === s.id)
    );

    const absentCount = absentMembers.length;
    const isFuture = isUpcoming(currentService.date, currentService.time);

    // Helper: check if a member matches any UID in a list (checks id, accountUid, linkedUserIds)
    const memberMatchesUid = (m: any, uids: string[]) => {
        if (uids.includes(m.id)) return true;
        if (m.accountUid && uids.includes(m.accountUid)) return true;
        if (m.linkedUserIds?.some((uid: string) => uids.includes(uid))) return true;
        return false;
    };

    const confirmedMembersList = choirMembers.filter(m => memberMatchesUid(m, confirmedMembers));

    const displayConfirmedCount = !isFuture
        ? choirMembers.length - absentCount
        : confirmedMembersList.length;

    const displayWaitingCount = !isFuture
        ? 0
        : choirMembers.length - displayConfirmedCount - absentCount;

    const previewAttendees = membersLoading ? [] : confirmedMembersList.slice(0, 4);
    const extraAttendees = displayConfirmedCount > 4 ? displayConfirmedCount - 4 : 0;
    const myStatus = getMyStatus();

    // Sync program array back to songs array to maintain web backward compatibility
    const syncProgramToSongs = async (program: ProgramItem[]) => {
        if (!userData?.choirId) return;
        // Extract only choir/song items to keep the legacy `songs` array relevant
        const syncedSongs: ServiceSong[] = program
            .filter(p => p.songId)
            .map(p => ({
                songId: p.songId!,
                songTitle: p.songTitle || p.title,
                performedBy: p.conductor || "",
                pianist: p.pianist || ""
            }));

        const newService = { ...currentService, program, songs: syncedSongs };
        setCurrentService(newService);
        await updateService(userData.choirId, currentService.id, { program, songs: syncedSongs });

        // Dispatch event to update the parent app's memory (GlobalArchive / page.tsx)
        const event = new CustomEvent('serviceUpdated', {
            detail: newService
        });
        window.dispatchEvent(event);
    };

    // Add program item
    const handleAddProgramItem = async (item: Omit<ProgramItem, 'id' | 'order'>) => {
        if (!userData?.choirId) return;
        const newItem: ProgramItem = {
            ...item,
            id: crypto.randomUUID(),
            order: programItems.length,
        };
        const updated = [...programItems, newItem];
        setProgramItems(updated);
        setShowAddProgramItem(false);
        await syncProgramToSongs(updated);
    };

    // Edit program item
    const handleEditProgramItem = async (updatedItem: ProgramItem) => {
        if (!userData?.choirId) return;
        const updated = programItems.map(p => p.id === updatedItem.id ? updatedItem : p);
        setProgramItems(updated);
        setEditingProgramItem(null);
        setShowAddProgramItem(false);
        await syncProgramToSongs(updated);
    };

    // Remove program item
    const handleRemoveProgramItem = async (itemId: string) => {
        if (!userData?.choirId) return;
        const updated = programItems
            .filter(p => p.id !== itemId)
            .map((p, i) => ({ ...p, order: i }));
        setProgramItems(updated);
        setProgramItemToDelete(null);
        await syncProgramToSongs(updated);
    };

    // Drag & drop reorder (touch-based)
    const touchStartY = useRef(0);
    const touchStartOrder = useRef(0);
    const dragItemRef = useRef<string | null>(null);

    const handleDragStart = (itemId: string) => {
        setDraggedItemId(itemId);
        dragItemRef.current = itemId;
    };

    const handleDragEnd = async () => {
        if (!draggedItemId || !dragOverItemId || draggedItemId === dragOverItemId) {
            setDraggedItemId(null);
            setDragOverItemId(null);
            return;
        }
        if (!userData?.choirId) return;

        const items = [...programItems].sort((a, b) => a.order - b.order);
        const dragIndex = items.findIndex(p => p.id === draggedItemId);
        const dropIndex = items.findIndex(p => p.id === dragOverItemId);

        if (dragIndex === -1 || dropIndex === -1) return;

        const [removed] = items.splice(dragIndex, 1);
        items.splice(dropIndex, 0, removed);

        const reordered = items.map((p, i) => ({ ...p, order: i }));
        setProgramItems(reordered);
        setDraggedItemId(null);
        setDragOverItemId(null);

        await syncProgramToSongs(reordered);
    };

    // Touch-based reorder for mobile using the Grip icon
    const handleTouchStart = (e: React.TouchEvent, itemId: string, index: number) => {
        if (!canEdit) return;
        e.preventDefault(); // Prevent scroll from starting
        touchStartY.current = e.touches[0].clientY;
        touchStartOrder.current = index;
        setDraggedItemId(itemId);
        dragItemRef.current = itemId;
        document.body.style.overflow = 'hidden';
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!draggedItemId || !canEdit) return;
        e.preventDefault(); // Block page scroll while dragging

        const currentY = e.touches[0].clientY;
        const diffY = currentY - touchStartY.current;

        // Assume each row is roughly 70px tall (including gap)
        const rowHeight = 70;
        const moves = Math.round(diffY / rowHeight);

        const newIndex = touchStartOrder.current + moves;
        const boundedIndex = Math.max(0, Math.min(programItems.length - 1, newIndex));

        // Identify the item currently at validIndex
        const items = [...programItems].sort((a, b) => a.order - b.order);
        const targetItem = items[boundedIndex];

        if (targetItem && targetItem.id !== dragOverItemId) {
            setDragOverItemId(targetItem.id);
        }
    };

    const handleTouchEnd = async () => {
        document.body.style.overflow = '';
        if (!draggedItemId || !dragOverItemId || draggedItemId === dragOverItemId) {
            setDraggedItemId(null);
            setDragOverItemId(null);
            return;
        }
        await handleDragEnd(); // Re-use the existing drop logic
    };


    const handlePrint = async () => {
        if (Capacitor.isNativePlatform()) {
            const result = await ActionSheet.showActions({
                title: t('service.print.format_title'),
                message: t('service.print.format_message'),
                options: [
                    { title: t('service.print.1copy') },
                    { title: t('service.print.2copy') },
                    { title: t('service.print.4copy') },
                    { title: t('common.cancel'), style: ActionSheetButtonStyle.Cancel }
                ]
            });
            if (result.index === 3) return; // Cancel
            const formats = [1, 2, 4];
            await generatePdf(formats[result.index]);
        } else {
            await generatePdf(2); // default for web
        }
    };

    const generatePdf = async (copies: number) => {
        try {
            const items = programItems.map((item, idx) => {
                const explicitType = item.type || 'other';
                let config = programTypeConfig[explicitType] || programTypeConfig['other'];

                let displayTitle = item.title || '';
                
                // Auto-infer older items that were imported or missing types
                if (!item.type || item.type === 'other') {
                    const lower = displayTitle.toLowerCase();
                    if (lower.includes(t('program.type.congregation').toLowerCase()) || lower.includes('заг. спів') || lower.includes('загальний спів')) config = programTypeConfig['congregation'];
                    else if (lower.includes(t('program.type.verse').toLowerCase()) || lower.includes('вірш')) config = programTypeConfig['verse'];
                    else if (lower.includes(t('program.type.choir').toLowerCase()) || lower.includes('хор') || lower.includes(t('service.choir_song_keyword').toLowerCase()) || lower.includes('пісня хору')) config = programTypeConfig['choir'];
                    else if (lower.includes(t('program.type.prayer').toLowerCase()) || lower.includes('молитва')) config = programTypeConfig['prayer'];
                    else if (lower.includes(t('program.type.sermon').toLowerCase()) || lower.includes('проповідь')) config = programTypeConfig['sermon'];
                    else if (lower.includes(t('program.type.solo').toLowerCase()) || lower.includes('соло')) config = programTypeConfig['solo'];
                    else if (lower.includes(t('program.type.ensemble').toLowerCase()) || lower.includes('ансамбль')) config = programTypeConfig['ensemble'];
                }

                if (config.label === t('program.type.choir') && (displayTitle.toLowerCase().includes(t('service.choir_song_keyword').toLowerCase()) || displayTitle.toLowerCase().includes('пісня хору'))) {
                    displayTitle = displayTitle.replace(new RegExp(t('service.choir_song_keyword') + '\\s*-?\\s*', 'i'), '').replace(/пісня хору\s*-?\s*/i, '').trim();
                }

                // If songId is present, try to get the real song title
                let displaySongTitle = item.songTitle || '';
                if ((item as any).type === 'song' && (item as any).songId) {
                    const found = availableSongs?.find((rs: any) => rs.id === (item as any).songId);
                    if (found) displaySongTitle = found.title;
                }

                const isLegacyOther = config.label === t('program.type.other') && displayTitle && displayTitle.toLowerCase() !== t('program.type.other').toLowerCase() && displayTitle.toLowerCase() !== 'інше';
                const mainDisplayName = isLegacyOther ? displayTitle : config.label;

                let subtitleText = '';
                if (config.label === t('program.type.choir')) {
                    subtitleText = displaySongTitle || (displayTitle.toLowerCase() !== t('program.type.choir').toLowerCase() && displayTitle.toLowerCase() !== 'хор' ? displayTitle : '');
                } else if (!isLegacyOther && displayTitle && displayTitle.toLowerCase() !== config.label.toLowerCase()) {
                    subtitleText = displayTitle;
                }

                const subParts: string[] = [];
                if (subtitleText) subParts.push(subtitleText);
                if (item.performer) subParts.push(item.performer);
                if (item.note) subParts.push(`(${item.note})`);

                const extraHtml = subParts.length > 0
                    ? `<span class="extra">: <i>${subParts.join(', ')}</i></span>`
                    : '';

                return `<div class="item"><div class="number">${idx + 1}.</div><div class="content"><span class="main">${mainDisplayName}</span>${extraHtml}</div></div>`;
            }).join('');

            const dateStr = new Date(currentService.date).toLocaleDateString("uk-UA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
            const timeStr = currentService.time ? ` ${t('common.at_time')} ` + currentService.time : '';

            const singleProgramHtml = `
                <div class="program-title">${currentService.title}</div>
                <div class="program-date">${dateStr}${timeStr}</div>
                ${items}
            `;

            let printHtml = '';
            let pdfOrientation: 'portrait' | 'landscape' = 'portrait';

            if (copies === 1) {
                printHtml = `
                    <div style="position:absolute;top:0;left:0;width:800px;padding:60px;box-sizing:border-box;background:white;color:black;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                        <style>
                            .program-title { text-align: center; font-size: 34px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 800; color: #000; }
                            .program-date { text-align: center; font-size: 20px; color: #555; margin-bottom: 60px; font-weight: 500; }
                            .item { display: flex; align-items: baseline; gap: 24px; margin-bottom: 32px; }
                            .number { width: 36px; text-align: right; font-size: 22px; color: #666; line-height: 1; font-weight: 500; }
                            .content { flex: 1; font-size: 22px; line-height: 1.35; }
                            .main { font-weight: 700; color: #000; font-size: 26px; line-height: 1.2; }
                            .extra { color: #444; font-size: 20px; }
                            .extra i { font-style: italic; font-weight: normal; }
                        </style>
                        ${singleProgramHtml}
                    </div>
                `;
                pdfOrientation = 'portrait';
            } else if (copies === 2) {
                printHtml = `
                    <div style="position:absolute;top:0;left:0;width:1400px;padding:60px;box-sizing:border-box;background:white;color:black;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;">
                        <style>
                            .program-column { flex: 1; padding: 0 40px; }
                            .program-column:first-child { border-right: 1px dashed #ccc; }
                            .program-title { text-align: center; font-size: 26px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 800; color: #000; }
                            .program-date { text-align: center; font-size: 16px; color: #555; margin-bottom: 30px; font-weight: 500; }
                            .item { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
                            .number { width: 28px; text-align: right; font-size: 18px; color: #444; font-weight: 600; }
                            .content { flex: 1; font-size: 18px; line-height: 1.35; }
                            .main { font-weight: 700; color: #000; }
                            .extra { color: #333; }
                            .extra i { font-style: italic; font-weight: normal; }
                        </style>
                        <div class="program-column">${singleProgramHtml}</div>
                        <div class="program-column">${singleProgramHtml}</div>
                    </div>
                `;
                pdfOrientation = 'landscape';
            } else if (copies === 4) {
                printHtml = `
                    <div style="position:absolute;top:0;left:0;width:1200px;height:1697px;padding:40px;box-sizing:border-box;background:white;color:black;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;">
                        <style>
                            .program-cell { padding: 30px; }
                            .program-cell:nth-child(odd) { border-right: 1px dashed #ccc; }
                            .program-cell:nth-child(1), .program-cell:nth-child(2) { border-bottom: 1px dashed #ccc; }
                            .program-title { text-align: center; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 800; color: #000; }
                            .program-date { text-align: center; font-size: 14px; color: #555; margin-bottom: 20px; font-weight: 500; }
                            .item { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
                            .number { width: 20px; text-align: right; font-size: 15px; color: #444; font-weight: 600; }
                            .content { flex: 1; font-size: 15px; line-height: 1.3; }
                            .main { font-weight: 700; color: #000; }
                            .extra { color: #333; }
                            .extra i { font-style: italic; font-weight: normal; }
                        </style>
                        <div class="program-cell">${singleProgramHtml}</div>
                        <div class="program-cell">${singleProgramHtml}</div>
                        <div class="program-cell">${singleProgramHtml}</div>
                        <div class="program-cell">${singleProgramHtml}</div>
                    </div>
                `;
                pdfOrientation = 'portrait';
            }

            const container = document.createElement('div');
            // Position at top-left with overflow visible so html2canvas captures full content
            container.style.position = 'fixed';
            container.style.left = '0px';
            container.style.top = '0px';
            container.style.margin = '0';
            container.style.padding = '0';
            container.style.overflow = 'visible';
            container.style.zIndex = '-9999'; // Hide behind app content
            container.style.pointerEvents = 'none';
            container.innerHTML = printHtml;
            document.body.appendChild(container);

            try {
                // Short wait to ensure DOM has computed layout
                await new Promise(resolve => setTimeout(resolve, 50));

                const inner = container.firstElementChild as HTMLElement | null;
                const targetEl = inner || container;
                const targetWidth = targetEl.offsetWidth || parseInt(targetEl.style.width) || 800;
                const targetHeight = targetEl.offsetHeight || parseInt(targetEl.style.height) || 1200;

                const canvas = await html2canvas(targetEl, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    x: 0,
                    y: 0,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: targetWidth,
                    windowHeight: targetHeight,
                    width: targetWidth,
                    height: targetHeight,
                });

                if (!canvas.width || !canvas.height) {
                    throw new Error(t("service.print_error_empty_canvas"));
                }

                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                
                const pdf = new jsPDF({
                    orientation: pdfOrientation,
                    unit: 'px',
                    format: [Math.max(1, canvas.width / 2), Math.max(1, canvas.height / 2)]
                });

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

                if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
                    const pdfBase64 = pdf.output('datauristring').split(',')[1];
                    const fileName = 'program-' + currentService.id.slice(0, 6) + '.pdf';
                    
                    const result = await Filesystem.writeFile({
                        path: fileName,
                        data: pdfBase64,
                        directory: Directory.Cache,
                    });
                    
                    await Share.share({
                        title: t('service.print_program_prefix') + ' ' + currentService.title,
                        url: result.uri,
                        dialogTitle: t('service.print.dialog_title')
                    });
                } else {
                    pdf.save('program-' + currentService.id.slice(0, 6) + '.pdf');
                }
            } finally {
                if (document.body.contains(container)) {
                    document.body.removeChild(container);
                }
            }
        } catch (e: any) {
            // Silently ignore share cancellation (user dismissed the sheet)
            const msg = (e?.message || String(e)).toLowerCase();
            if (msg.includes('cancel') || msg.includes('abort') || msg.includes('dismiss')) {
                console.log("[Print] Share dismissed by user");
                return;
            }
            console.error("Print error:", e);
            try {
                await Dialog.alert({ title: t('service.print.error'), message: e?.message || String(e) });
            } catch (_) {
                // Ignore Dialog failure (e.g. not native), do not use window.alert
                console.error('Print dialog failed for: ' + (e?.message || String(e)));
            }
        }
    };



    return (
        <div className="pb-32 bg-background min-h-screen" data-native-inner="true">
            {/* Header */}
            <GlassPageHeader
                title={currentService.title}
                subtitle={(() => {
                    const [y, m, d] = currentService.date.split('-').map(Number);
                    const dateStr = new Date(y, m - 1, d).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });
                    return currentService.time ? `${dateStr} • ${currentService.time}` : dateStr;
                })()}
                onBack={onBack}
                rightActions={canEdit ? [
                    {
                        id: 'edit',
                        icon: 'pencil',
                        onClick: openEditServiceModal
                    }
                ] : []}
            />

            <div className="md:max-w-3xl lg:max-w-4xl mx-auto px-4 py-6 space-y-6">


                {/* ===== TAB BAR ===== */}
                <div className="flex bg-surface/40 border border-border/60 rounded-2xl p-1 gap-1">
                    <button
                        onClick={() => setActiveTab('program')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'program'
                            ? 'bg-primary text-background shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                            }`}
                    >
                        <ListOrdered className="w-4 h-4" />
                        {t('service.tab.program')}
                    </button>
                    <button
                        onClick={() => setActiveTab('choir')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'choir'
                            ? 'bg-primary text-background shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        {t('service.tab.choir')}
                    </button>
                </div>

                {/* ===== PROGRAM TAB (or default web view) ===== */}
                {(isServiceType && activeTab === 'program') && (
                    <>
                        {/* Program Items (Only for Services) */}
                        {programItems.length > 0 && (
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-xs font-bold text-text-secondary uppercase tracking-[0.15em]">{t('service.program.order')} ({programItems.length})</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handlePrint}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold hover:bg-primary/20 transition-colors"
                                        >
                                            <Printer className="w-3.5 h-3.5" />
                                            {t('service.program.print')}
                                        </button>
                                        {canEdit && (
                                            <button
                                                onClick={() => { setEditDescription(currentService.description || ''); setEditingDescription(true); }}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors relative ${currentService.description ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-surface-highlight text-text-secondary hover:bg-surface-highlight/80'}`}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                                {t('service.program.notes')}
                                                {currentService.description && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full absolute -top-0.5 -right-0.5" />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Warmup Row */}
                                <div className="flex items-center gap-2.5 bg-surface/30 border border-border/60 px-3 py-2.5 rounded-2xl transition-colors">
                                    <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                                        <Mic2 className="w-4 h-4 text-orange-400" />
                                    </div>
                                    <div className="flex-1 w-full relative">
                                        {!canEdit ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[14px] font-medium text-text-primary">{t('service.warmup.label')}</span>
                                                <span className={`text-[14px] font-medium ${warmupConductor ? 'text-text-secondary' : 'text-text-secondary/40'}`}>
                                                    {warmupConductor || t('service.warmup.no')}
                                                </span>
                                            </div>
                                        ) : !showCustomWarmup ? (
                                            <select
                                                value={warmupConductor}
                                                onChange={(e) => {
                                                    if (e.target.value === '__ADD_NEW__') {
                                                        setShowCustomWarmup(true);
                                                    } else {
                                                        handleUpdateWarmup(e.target.value);
                                                    }
                                                }}
                                                style={{ fontSize: '16px' }}
                                                className="w-full bg-transparent text-[16px] font-medium text-text-primary appearance-none focus:outline-none cursor-pointer"
                                            >
                                                <option value="">{t('service.warmup.no')}</option>
                                                {regentsList.map((name, i) => (
                                                    <option key={name + i} value={name}>{name}</option>
                                                ))}
                                                {warmupConductor && !regentsList.includes(warmupConductor) && (
                                                    <option value={warmupConductor}>{warmupConductor}</option>
                                                )}
                                                <option value="__ADD_NEW__">{t('service.warmup.add_regent')}</option>
                                            </select>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={warmupConductor}
                                                    onChange={(e) => setWarmupConductor(e.target.value)}
                                                    style={{ fontSize: '16px' }}
                                                    placeholder={t('service.warmup.who')}
                                                    className="flex-1 min-w-0 bg-surface-highlight text-[16px] font-medium text-text-primary rounded-lg px-2 py-1 outline-none border border-primary/30"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdateWarmup(warmupConductor);
                                                        if (e.key === 'Escape') setShowCustomWarmup(false);
                                                    }}
                                                />
                                                <button onClick={() => handleUpdateWarmup(warmupConductor)} className="p-1 text-primary"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => setShowCustomWarmup(false)} className="p-1 text-text-secondary hover:text-text-primary"><X className="w-4 h-4" /></button>
                                            </div>
                                        )}
                                        {canEdit && !showCustomWarmup && <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary/50 pointer-events-none" />}
                                    </div>
                                </div>

                                {/* Program Items List — Timeline Style */}
                                <div className="relative">
                                    {(() => {
                                        const sortedItems = [...programItems].sort((a, b) => a.order - b.order);
                                        return sortedItems.map((item, index) => {
                                            const explicitType = item.type || 'other';
                                            let config = programTypeConfig[explicitType] || programTypeConfig['other'];

                                            const isDragged = draggedItemId === item.id;
                                            const isDragOver = dragOverItemId === item.id;

                                            let displayTitle = item.title || '';
                                            let displaySongTitle = item.songTitle || '';

                                            // Auto-infer older items that were imported or missing types
                                            if (!item.type || item.type === 'other') {
                                                const lower = displayTitle.toLowerCase();
                                                if (lower.includes(t('program.type.congregation').toLowerCase()) || lower.includes('заг. спів') || lower.includes('загальний спів')) config = programTypeConfig['congregation'];
                                                else if (lower.includes(t('program.type.verse').toLowerCase()) || lower.includes('вірш')) config = programTypeConfig['verse'];
                                                else if (lower.includes(t('program.type.choir').toLowerCase()) || lower.includes('хор') || lower.includes(t('service.choir_song_keyword').toLowerCase()) || lower.includes('пісня хору')) config = programTypeConfig['choir'];
                                                else if (lower.includes(t('program.type.prayer').toLowerCase()) || lower.includes('молитва')) config = programTypeConfig['prayer'];
                                                else if (lower.includes(t('program.type.sermon').toLowerCase()) || lower.includes('проповідь')) config = programTypeConfig['sermon'];
                                                else if (lower.includes(t('program.type.solo').toLowerCase()) || lower.includes('соло')) config = programTypeConfig['solo'];
                                                else if (lower.includes(t('program.type.ensemble').toLowerCase()) || lower.includes('ансамбль')) config = programTypeConfig['ensemble'];
                                            }

                                            // Sometimes legacy items had "Пісня хору Мінь Бог живий" as title
                                            if (config.label === t('program.type.choir') && (displayTitle.toLowerCase().includes(t('service.choir_song_keyword').toLowerCase()) || displayTitle.toLowerCase().includes('пісня хору'))) {
                                                displayTitle = displayTitle.replace(new RegExp(t('service.choir_song_keyword') + '\\s*-?\\s*', 'i'), '').replace(/пісня хору\s*-?\s*/i, '').trim();
                                            }

                                            const isLegacyOther = config.label === t('program.type.other') && displayTitle && displayTitle.toLowerCase() !== t('program.type.other').toLowerCase() && displayTitle.toLowerCase() !== 'інше';
                                            const mainDisplayName = isLegacyOther ? displayTitle : config.label;

                                            // Choose what to show as the subtitle
                                            // For Choir, we want the song name as the subtitle (displayTitle or songTitle)
                                            let subtitleText = '';
                                            if (config.label === t('program.type.choir')) {
                                                subtitleText = displaySongTitle || (displayTitle.toLowerCase() !== t('program.type.choir').toLowerCase() && displayTitle.toLowerCase() !== 'хор' ? displayTitle : '');
                                                // For others, show displayTitle if it differs from the main label
                                            } else if (!isLegacyOther && displayTitle && displayTitle.toLowerCase() !== config.label.toLowerCase()) {
                                                subtitleText = displayTitle;
                                            }
                                            const showSub = subtitleText.length > 0;
                                            return (
                                                <div key={item.id} className="relative w-full mb-2">
                                                    {/* Insertion Line (dynamic placement based on drag direction) */}
                                                    {isDragOver && draggedItemId !== item.id && (
                                                        (() => {
                                                            const dragIdx = sortedItems.findIndex(p => p.id === draggedItemId);
                                                            const dropIdx = index;
                                                            const isMovingDown = dragIdx < dropIdx;

                                                            return (
                                                                <div className={`absolute ${isMovingDown ? '-bottom-[9px]' : '-top-[9px]'} left-8 right-0 z-20 flex items-center pointer-events-none`}>
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-primary -ml-1" />
                                                                    <div className="flex-1 h-[2px] bg-primary" />
                                                                </div>
                                                            );
                                                        })()
                                                    )}

                                                    <SwipeableCard
                                                        ref={(el) => { cardRefs.current[item.id] = el }}
                                                        onDelete={() => setProgramItemToDelete(item.id)}
                                                        disabled={!canEdit}
                                                        className="rounded-xl"
                                                        contentClassName="bg-background rounded-xl"
                                                        disableFullSwipe={true}
                                                    >
                                                        <div
                                                            draggable={canEdit}
                                                            onDragStart={() => handleDragStart(item.id)}
                                                            onDragOver={(e) => { e.preventDefault(); setDragOverItemId(item.id); }}
                                                            onDragEnd={handleDragEnd}
                                                            className={`w-full flex items-center gap-3 min-h-16 py-2 select-none [-webkit-touch-callout:none] ${isDragged ? 'opacity-40 scale-[0.98]' : ''}`}
                                                        >
                                                            {/* Left Column: Number */}
                                                            <div className="flex-shrink-0 w-7 text-right">
                                                                <span className="text-[14px] font-bold text-text-secondary/40 tabular-nums">{index + 1}</span>
                                                            </div>

                                                            {/* Icon Dot */}
                                                            <div className={`w-8 h-8 rounded-xl ${config.color} flex items-center justify-center flex-shrink-0`}>
                                                                {config.icon}
                                                            </div>

                                                            {/* Text */}
                                                            <div
                                                                className="flex-1 min-w-0"
                                                                onClick={(e) => {
                                                                    if (canEdit) {
                                                                        setEditingProgramItem(item);
                                                                        setShowAddProgramItem(true);
                                                                    } else if (item.songId) {
                                                                        handleViewPdf(item.songId, item.title);
                                                                    }
                                                                }}
                                                            >
                                                                <h3 className="text-[15px] font-bold text-text-primary leading-tight">{mainDisplayName}</h3>
                                                                {showSub && (
                                                                    <p className="text-[13px] text-text-secondary mt-0.5 truncate">{subtitleText}</p>
                                                                )}
                                                                {item.performer && (
                                                                    <p className="text-[12px] text-text-secondary/60 mt-0.5">{item.performer}</p>
                                                                )}
                                                            </div>

                                                            {/* View PDF */}
                                                            {item.songId && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleViewPdf(item.songId!, item.title);
                                                                    }}
                                                                    className="p-1.5 text-text-secondary/40 hover:text-primary transition-colors flex-shrink-0"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                            )}

                                                            {/* Drag Handle (Right Side) */}
                                                            {canEdit && (
                                                                <div
                                                                    className="cursor-grab active:cursor-grabbing p-1.5 select-none flex-shrink-0 opacity-20 hover:opacity-50 active:opacity-70 transition-opacity touch-none"
                                                                    style={{ touchAction: 'none' }}
                                                                    onTouchStart={(e) => {
                                                                        e.stopPropagation();
                                                                        handleTouchStart(e, item.id, index);
                                                                    }}
                                                                    onTouchMove={(e) => {
                                                                        e.stopPropagation();
                                                                        handleTouchMove(e);
                                                                    }}
                                                                    onTouchEnd={(e) => {
                                                                        e.stopPropagation();
                                                                        handleTouchEnd();
                                                                    }}
                                                                >
                                                                    <GripVertical className="w-4 h-4 text-text-secondary pointer-events-none" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </SwipeableCard>
                                                </div>
                                            );
                                        })
                                    })()}
                                </div>

                                {/* Add Program Item Button (Bottom) */}
                                {canEdit && (
                                    <button
                                        onClick={() => setShowAddProgramItem(true)}
                                        className="w-full py-4 border border-dashed border-border/60 rounded-[28px] text-text-secondary hover:text-text-primary hover:bg-surface-highlight/30 hover:border-border transition-all flex items-center justify-center gap-2 text-sm font-medium"
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('service.program.add_item')}
                                    </button>
                                )}

                                {/* Notes Section — at end of program */}
                                {editingDescription ? (
                                    <div className="bg-surface/30 rounded-[20px] border border-primary/30 shadow-sm p-4 space-y-3">
                                        <label className="text-xs text-text-secondary uppercase font-bold">{t('service.program.notes')}</label>
                                        <textarea
                                            autoFocus
                                            value={editDescription}
                                            onChange={e => setEditDescription(e.target.value)}
                                            placeholder={t('service.program.notes_placeholder')}
                                            rows={4}
                                            className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setEditingDescription(false); setEditDescription(currentService.description || ''); }}
                                                className="flex-1 py-2 text-sm font-bold text-text-secondary bg-surface-highlight rounded-xl hover:bg-surface-highlight/80 transition-colors"
                                            >
                                                {t('common.cancel')}
                                            </button>
                                            <button
                                                onClick={saveDescription}
                                                className="flex-1 py-2 text-sm font-bold text-background bg-primary rounded-xl hover:opacity-90 transition-colors"
                                            >
                                                {t('common.save')}
                                            </button>
                                        </div>
                                    </div>
                                ) : currentService.description ? (
                                    <div className="bg-surface/30 rounded-[20px] border border-border/60 shadow-sm px-4 py-3">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                                                <Pencil className="w-3 h-3 text-amber-400" />
                                                {t('service.program.notes')}
                                            </p>
                                            {canEdit && (
                                                <button
                                                    onClick={() => { setEditDescription(currentService.description || ''); setEditingDescription(true); }}
                                                    className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                                                >
                                                    {t('service.program.notes_edit')}
                                                </button>
                                            )}
                                        </div>
                                        <div
                                            className={`text-sm text-text-primary whitespace-pre-wrap transition-all ${!(currentService as any).__notesExpanded ? 'line-clamp-2' : ''}`}
                                        >
                                            {currentService.description}
                                        </div>
                                        {currentService.description.split('\n').length > 2 || currentService.description.length > 120 ? (
                                            <button
                                                onClick={() => setCurrentService(prev => ({ ...prev, __notesExpanded: !(prev as any).__notesExpanded } as any))}
                                                className="text-[11px] font-semibold text-primary mt-1.5 hover:text-primary/80 transition-colors"
                                            >
                                                {(currentService as any).__notesExpanded ? t('service.program.notes_collapse') : t('service.program.notes_show_more')}
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* If native and no program items yet, show a button to start creating */}
                        {isServiceType && programItems.length === 0 && (
                            <div className="space-y-4 pt-2">
                                {canEdit && (
                                    <>
                                        <div className="flex items-center justify-between gap-3 px-1">
                                            <h2 className="text-xs font-bold text-text-secondary uppercase tracking-[0.15em]">{t('service.program.header')}</h2>
                                            <button
                                                onClick={() => { setEditDescription(currentService.description || ''); setEditingDescription(true); }}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors relative ${currentService.description ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-surface-highlight text-text-secondary hover:bg-surface-highlight/80'}`}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                                {t('service.program.notes')}
                                                {currentService.description && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full absolute -top-0.5 -right-0.5" />}
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setShowAddProgramItem(true)}
                                            className="w-full py-8 border-2 border-dashed border-primary/20 rounded-[28px] hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-3"
                                        >
                                            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                                                <Plus className="w-6 h-6 text-primary" />
                                            </div>
                                            <div className="text-center">
                                                <span className="text-[15px] font-bold text-text-primary block mb-1">{t('service.program.create')}</span>
                                                <span className="text-sm text-text-secondary">{t('service.program.create_hint')}</span>
                                            </div>
                                        </button>
                                    </>
                                )}

                                {/* Notes Section — when program is empty */}
                                {editingDescription ? (
                                    <div className="bg-surface/30 rounded-[20px] border border-primary/30 shadow-sm p-4 space-y-3">
                                        <label className="text-xs text-text-secondary uppercase font-bold">{t('service.program.notes')}</label>
                                        <textarea
                                            autoFocus
                                            value={editDescription}
                                            onChange={e => setEditDescription(e.target.value)}
                                            placeholder={t('service.program.notes_placeholder')}
                                            rows={4}
                                            className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setEditingDescription(false); setEditDescription(currentService.description || ''); }}
                                                className="flex-1 py-2 text-sm font-bold text-text-secondary bg-surface-highlight rounded-xl hover:bg-surface-highlight/80 transition-colors"
                                            >
                                                {t('common.cancel')}
                                            </button>
                                            <button
                                                onClick={saveDescription}
                                                className="flex-1 py-2 text-sm font-bold text-background bg-primary rounded-xl hover:opacity-90 transition-colors"
                                            >
                                                {t('common.save')}
                                            </button>
                                        </div>
                                    </div>
                                ) : currentService.description ? (
                                    <div className="bg-surface/30 rounded-[20px] border border-border/60 shadow-sm px-4 py-3">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                                                <Pencil className="w-3 h-3 text-amber-400" />
                                                {t('service.program.notes')}
                                            </p>
                                            {canEdit && (
                                                <button
                                                    onClick={() => { setEditDescription(currentService.description || ''); setEditingDescription(true); }}
                                                    className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                                                >
                                                    {t('service.program.notes_edit')}
                                                </button>
                                            )}
                                        </div>
                                        <div
                                            className={`text-sm text-text-primary whitespace-pre-wrap transition-all ${!(currentService as any).__notesExpanded ? 'line-clamp-2' : ''}`}
                                        >
                                            {currentService.description}
                                        </div>
                                        {currentService.description.split('\n').length > 2 || currentService.description.length > 120 ? (
                                            <button
                                                onClick={() => setCurrentService(prev => ({ ...prev, __notesExpanded: !(prev as any).__notesExpanded } as any))}
                                                className="text-[11px] font-semibold text-primary mt-1.5 hover:text-primary/80 transition-colors"
                                            >
                                                {(currentService as any).__notesExpanded ? t('service.program.notes_collapse') : t('service.program.notes_show_more')}
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </>
                )}

                {/* SONGS LIST (REHEARSAL VIEW PROGRAM TAB) */}
                {(!isServiceType && activeTab === 'program') && (
                    <div className="mt-8 space-y-4">
                        <div className="flex items-center justify-between gap-3 px-1">
                            <h2 className="text-xs font-bold text-text-secondary uppercase tracking-[0.15em]">{t('service.program.songs_header')} ({(currentService.songs || []).length})</h2>
                            {canEdit && (
                                <button
                                    onClick={() => { setEditDescription(currentService.description || ''); setEditingDescription(true); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors relative ${currentService.description ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-surface-highlight text-text-secondary hover:bg-surface-highlight/80'}`}
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    {t("service.program.notes")}
                                    {currentService.description && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full absolute -top-0.5 -right-0.5" />}
                                </button>
                            )}
                        </div>

                        {/* Warmup Row (only when NOT using program items — i.e. Rehearsals) */}
                        {(!isServiceType) && (
                            <div className="flex items-center gap-3 bg-surface/30 border border-border/60 p-3.5 rounded-3xl transition-colors">
                                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                                    <Mic2 className="w-4 h-4 text-orange-400" />
                                </div>
                                <div className="flex-1 w-full relative">
                                    {!canEdit ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[15px] font-medium text-text-primary">{t("service.warmup.label")}</span>
                                            <span className={`text-[14px] font-medium ${warmupConductor ? 'text-text-secondary' : 'text-text-secondary/40'}`}>
                                                {warmupConductor || t("service.warmup.no")}
                                            </span>
                                        </div>
                                    ) : !showCustomWarmup ? (
                                        <select
                                            value={warmupConductor}
                                            onChange={(e) => {
                                                if (e.target.value === '__ADD_NEW__') {
                                                    setShowCustomWarmup(true);
                                                } else {
                                                    handleUpdateWarmup(e.target.value);
                                                }
                                            }}
                                            style={{ fontSize: '16px' }}
                                            className="w-full bg-transparent text-[16px] font-medium text-text-primary appearance-none focus:outline-none cursor-pointer"
                                        >
                                            <option value="">{t("service.warmup.no")}</option>
                                            {regentsList.map((name, i) => (
                                                <option key={name + i} value={name}>{name}</option>
                                            ))}
                                            {warmupConductor && !regentsList.includes(warmupConductor) && (
                                                <option value={warmupConductor}>{warmupConductor}</option>
                                            )}
                                            <option value="__ADD_NEW__">{t("service.warmup.add_regent")}</option>
                                        </select>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={warmupConductor}
                                                onChange={(e) => setWarmupConductor(e.target.value)}
                                                style={{ fontSize: '16px' }}
                                                placeholder={t("service.warmup.who")}
                                                className="flex-1 min-w-0 bg-surface-highlight text-[16px] font-medium text-text-primary rounded-lg px-2 py-1.5 outline-none border border-primary/30"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleUpdateWarmup(warmupConductor);
                                                    if (e.key === 'Escape') setShowCustomWarmup(false);
                                                }}
                                            />
                                            <button onClick={() => handleUpdateWarmup(warmupConductor)} className="p-1.5 text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"><Check className="w-4 h-4" /></button>
                                            <button onClick={() => setShowCustomWarmup(false)} className="p-1.5 text-text-secondary hover:text-text-primary bg-surface-highlight rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                    {canEdit && !showCustomWarmup && <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary/50 pointer-events-none" />}
                                </div>
                            </div>
                        )}

                        {(currentService.songs || []).length === 0 ? (
                            canEdit ? (
                                <button
                                    onClick={() => setShowAddSong(true)}
                                    className="w-full text-center py-10 bg-transparent border-2 border-dashed border-border/40 rounded-[28px] hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-3"
                                >
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                                        <Plus className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="text-center">
                                        <span className="text-[15px] font-bold text-text-primary block mb-1">{t("service.empty_list")}</span>
                                        <span className="text-sm text-text-secondary">{t("service.empty_rehearsal_hint")}</span>
                                    </div>
                                </button>
                            ) : (
                                <div className="text-center py-10 bg-surface border border-border rounded-3xl flex flex-col items-center justify-center gap-3">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center transition-colors glass-frost-circle text-zinc-700">
                                        <Music className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="text-text-primary font-medium">{t("service.empty_list")}</p>
                                        <p className="text-sm text-text-secondary">{t("service.empty_songs_hint")}</p>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="space-y-2">
                                {(currentService.songs || []).map((song, index) => {
                                    const originalSong = availableSongs.find(s => s.id === song.songId);
                                    const hasPdf = originalSong?.hasPdf;

                                    return (
                                        <SwipeableCard
                                            key={`${song.songId}-${index}`}
                                            ref={(el) => { cardRefs.current[`temp-song-${index}`] = el }}
                                            onDelete={() => setSongToDeleteIndex(index)}
                                            disabled={!canEdit}
                                            className="rounded-3xl"
                                            contentClassName="bg-surface rounded-3xl"
                                        >
                                            <div className="flex items-center gap-3.5 bg-surface/40 hover:bg-surface/60 border border-border/40 p-3.5 rounded-3xl transition-colors">
                                                {/* Minimal rounded number */}
                                                <div className="w-7 h-7 rounded-full bg-surface-highlight/50 flex items-center justify-center text-[10px] font-bold text-text-secondary flex-shrink-0">
                                                    {index + 1}
                                                </div>

                                                <div className="flex-1 min-w-0" onClick={() => handleViewPdf(song.songId)}>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-text-primary font-medium text-[16px] truncate">{song.songTitle}</h3>
                                                    </div>

                                                    {/* Sophisticated inline credits */}
                                                    {(song.performedBy || song.pianist) && (
                                                        <div className="flex items-center gap-3 mt-1 text-[11px] font-medium">
                                                            {song.performedBy && (
                                                                <div className="flex items-center gap-1.5 text-indigo-400">
                                                                    <UserIcon className="w-3 h-3" />
                                                                    <span>{song.performedBy}</span>
                                                                </div>
                                                            )}
                                                            {song.performedBy && song.pianist && (
                                                                <div className="w-1 h-1 rounded-full bg-border/50" />
                                                            )}
                                                            {song.pianist && (
                                                                <div className="flex items-center gap-1.5 text-amber-500/90">
                                                                    <span className="text-[10px]">🎹</span>
                                                                    <span>{song.pianist}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {(canEdit || canEditCredits) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEditCredits(index);
                                                        }}
                                                        className="flex-shrink-0 p-2 rounded-full bg-surface-highlight text-text-secondary hover:text-text-primary hover:bg-surface-highlight/80 transition-colors"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </SwipeableCard>
                                    );
                                })}
                            </div>
                        )}

                        {/* Add Song Button (Bottom) */}
                        {canEdit && (currentService.songs || []).length > 0 && (
                            <button
                                onClick={() => setShowAddSong(true)}
                                className="w-full py-4 border border-dashed border-border/60 rounded-[28px] text-text-secondary hover:text-text-primary hover:bg-surface-highlight/30 hover:border-border transition-all flex items-center justify-center gap-2 text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                {t('service.program.add_more_songs')}
                            </button>
                        )}

                        {/* Notes Section — at end of rehearsal songs */}
                        {editingDescription ? (
                            <div className="bg-surface/30 rounded-[20px] border border-primary/30 shadow-sm p-4 space-y-3">
                                <label className="text-xs text-text-secondary uppercase font-bold">{t('service.program.notes')}</label>
                                <textarea
                                    autoFocus
                                    value={editDescription}
                                    onChange={e => setEditDescription(e.target.value)}
                                    placeholder={t('service.program.notes_placeholder_rehearsal')}
                                    rows={4}
                                    className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setEditingDescription(false); setEditDescription(currentService.description || ''); }}
                                        className="flex-1 py-2 text-sm font-bold text-text-secondary bg-surface-highlight rounded-xl hover:bg-surface-highlight/80 transition-colors"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        onClick={saveDescription}
                                        className="flex-1 py-2 text-sm font-bold text-background bg-primary rounded-xl hover:opacity-90 transition-colors"
                                    >
                                        {t('common.save')}
                                    </button>
                                </div>
                            </div>
                        ) : currentService.description ? (
                            <div className="bg-surface/30 rounded-[20px] border border-border/60 shadow-sm px-4 py-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                                        <Pencil className="w-3 h-3 text-amber-400" />
                                        {t('service.program.notes')}
                                    </p>
                                    {canEdit && (
                                        <button
                                            onClick={() => { setEditDescription(currentService.description || ''); setEditingDescription(true); }}
                                            className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                                        >
                                            {t('service.program.notes_edit')}
                                        </button>
                                    )}
                                </div>
                                <div
                                    className={`text-sm text-text-primary whitespace-pre-wrap transition-all ${!(currentService as any).__notesExpanded ? 'line-clamp-2' : ''}`}
                                >
                                    {currentService.description}
                                </div>
                                {currentService.description.split('\n').length > 2 || currentService.description.length > 120 ? (
                                    <button
                                        onClick={() => setCurrentService(prev => ({ ...prev, __notesExpanded: !(prev as any).__notesExpanded } as any))}
                                        className="text-[11px] font-semibold text-primary mt-1.5 hover:text-primary/80 transition-colors"
                                    >
                                        {(currentService as any).__notesExpanded ? t('service.program.notes_collapse') : t('service.program.notes_show_more')}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                )}

                {/* ===== CHOIR TAB ===== */}
                {(activeTab === 'choir') && (
                    <>
                        {/* Voting Section */}
                        {isFuture ? (
                            <div className="bg-surface/30 border border-border/60 rounded-[28px] p-5">
                                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-[0.15em] mb-4 text-center">{t('service.voting.my_part')}</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleVote('present')}
                                        disabled={votingLoading}
                                        className={`py-3.5 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 ${myStatus === 'present'
                                            ? 'bg-green-500/10 border-green-500/30 shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]'
                                            : 'bg-surface border-border/50 hover:border-border'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${myStatus === 'present' ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : 'bg-surface-highlight text-text-secondary'}`}>
                                            <Check className="w-4 h-4" strokeWidth={3} />
                                        </div>
                                        <span className={`text-[13px] font-bold ${myStatus === 'present' ? 'text-green-400' : 'text-text-secondary'}`}>{t('service.voting.attending')}</span>
                                    </button>

                                    <button
                                        onClick={() => handleVote('absent')}
                                        disabled={votingLoading}
                                        className={`py-3.5 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 ${myStatus === 'absent'
                                            ? 'bg-red-500/10 border-red-500/30 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]'
                                            : 'bg-surface border-border/50 hover:border-border'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${myStatus === 'absent' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-surface-highlight text-text-secondary'}`}>
                                            <X className="w-4 h-4" strokeWidth={3} />
                                        </div>
                                        <span className={`text-[13px] font-bold ${myStatus === 'absent' ? 'text-red-400' : 'text-text-secondary'}`}>{t('service.voting.not_attending')}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Past Service Voting Status Check */
                            <div className="bg-surface/30 border border-border/60 rounded-[24px] p-4 flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${myStatus === 'present' ? 'bg-green-500/15 text-green-500' :
                                    myStatus === 'absent' ? 'bg-red-500/15 text-red-500' :
                                        'bg-surface-highlight text-text-secondary'
                                    }`}>
                                    {myStatus === 'present' ? <Check className="w-5 h-5" strokeWidth={2.5} /> :
                                        myStatus === 'absent' ? <X className="w-5 h-5" strokeWidth={2.5} /> :
                                            <AlertCircle className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="font-bold text-text-primary text-[15px]">
                                        {myStatus === 'present' ? t('service.voting.was_present') :
                                            myStatus === 'absent' ? t('service.voting.was_absent') :
                                                t('service.voting.no_status')}
                                    </p>
                                    <p className="text-xs text-text-secondary mt-0.5">{t('service.voting.closed_label')}</p>
                                </div>
                            </div>
                        )}

                        {/* Attendees Section - Enhanced */}
                        {(canEdit || canEditAttendance || !isFuture) && (() => {
                            const confirmedList = choirMembers.filter(m => memberMatchesUid(m, confirmedMembers));
                            const normalizeVoice = (v: string | undefined) => v?.toLowerCase().trim();
                            const voiceStats = {
                                Soprano: confirmedList.filter(m => normalizeVoice(m.voice) === 'soprano').length,
                                Alto: confirmedList.filter(m => normalizeVoice(m.voice) === 'alto').length,
                                Tenor: confirmedList.filter(m => normalizeVoice(m.voice) === 'tenor').length,
                                Bass: confirmedList.filter(m => normalizeVoice(m.voice) === 'bass').length,
                                Unknown: confirmedList.filter(m => !m.voice || !['soprano', 'alto', 'tenor', 'bass'].includes(normalizeVoice(m.voice)!)).length
                            };

                            const realUserCount = confirmedList.filter(m => m.hasAccount).length;
                            const listUserCount = confirmedList.length - realUserCount;

                            return (
                                <div onClick={() => setShowAttendance(true)} className="bg-surface/30 border border-border/60 rounded-[28px] cursor-pointer hover:border-border/80 transition-colors overflow-hidden relative group">
                                    <div className="p-5 pb-3 flex justify-between items-center relative z-10">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                                <Users className="w-4 h-4 text-indigo-400" />
                                            </div>
                                            <span className="text-text-primary font-bold text-[16px]">{t('service.members.title')}</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-text-secondary bg-surface-highlight px-3 py-1.5 rounded-full group-hover:bg-surface-highlight/80 transition-colors">{t('service.members.open')}</span>
                                    </div>

                                    <div className="px-5 pb-5 space-y-4 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse"></div>
                                            <span className="text-2xl font-bold text-text-primary leading-none">{confirmedList.length}</span>
                                            <span className="text-sm font-medium text-text-secondary">{t('service.members.total')}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                                            {voiceStats.Soprano > 0 && <div className="flex justify-between px-3 py-2 bg-pink-500/5 rounded-xl"><span className="text-text-secondary">{t('service.voice.soprano')}</span> <span className="font-bold text-pink-400">{voiceStats.Soprano}</span></div>}
                                            {voiceStats.Alto > 0 && <div className="flex justify-between px-3 py-2 bg-purple-500/5 rounded-xl"><span className="text-text-secondary">{t('service.voice.alto')}</span> <span className="font-bold text-purple-400">{voiceStats.Alto}</span></div>}
                                            {voiceStats.Tenor > 0 && <div className="flex justify-between px-3 py-2 bg-blue-500/5 rounded-xl"><span className="text-text-secondary">{t('service.voice.tenor')}</span> <span className="font-bold text-blue-400">{voiceStats.Tenor}</span></div>}
                                            {voiceStats.Bass > 0 && <div className="flex justify-between px-3 py-2 bg-green-500/5 rounded-xl"><span className="text-text-secondary">{t('service.voice.bass')}</span> <span className="font-bold text-green-400">{voiceStats.Bass}</span></div>}
                                            {voiceStats.Unknown > 0 && <div className="flex justify-between px-3 py-2 bg-surface-highlight/50 rounded-xl"><span className="text-text-secondary">{t('service.members.no_voice')}</span> <span className="font-bold text-text-primary">{voiceStats.Unknown}</span></div>}
                                        </div>

                                        {absentCount > 0 && (
                                            <div className="flex items-center gap-2 text-xs text-red-400 mt-2 bg-red-500/5 px-3 py-2 rounded-xl border border-red-500/10">
                                                <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                                                    <UserX className="w-3 h-3 text-red-400" />
                                                </div>
                                                <div>
                                                    <span className="font-bold">{absentCount}</span>
                                                    <span className="ml-1 opacity-80">{t('service.members.absent_label')}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* Modals remain mostly simple, just style updates */}
            {/* Add Song Sheet - Full Screen Multiselect */}
            {
                showAddSong && (
                    <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="p-4 pt-safe border-b border-border flex justify-between items-center bg-surface/50 backdrop-blur-xl sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setShowAddSong(false)} className="p-2 -ml-2 hover:bg-surface-highlight rounded-full transition-colors text-text-primary">
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                <div>
                                    <h3 className="text-xl font-bold text-text-primary">{t('service.add_songs.title')}</h3>
                                    <p className="text-xs text-text-secondary">{t('service.add_songs.hint')}</p>
                                </div>
                            </div>
                            <div className="w-10" /> {/* Spacer for balance */}
                        </div>

                        <div className="p-4 bg-background sticky top-[73px] z-10 border-b border-border">
                            <input
                                type="text"
                                placeholder={t('service.add_songs.search')}
                                className="w-full px-5 py-4 bg-surface rounded-2xl text-text-primary border border-border focus:outline-none focus:border-border/50 text-lg placeholder:text-text-secondary/50"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-32">
                            {filteredSongs.map(song => {
                                const isSelected = selectedSongsToService.includes(song.id);
                                const alreadyInService = (currentService.songs || []).some(s => s.songId === song.id);

                                return (
                                    <button
                                        key={song.id}
                                        onClick={() => !alreadyInService && toggleSongSelection(song.id)}
                                        disabled={alreadyInService}
                                        className={`w-full text-left p-4 rounded-2xl border flex justify-between items-center group transition-all ${alreadyInService
                                            ? 'bg-surface/50 border-border opacity-50 cursor-not-allowed'
                                            : isSelected
                                                ? 'bg-blue-500/10 border-blue-500/50'
                                                : 'bg-surface border-border hover:bg-surface-highlight'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className={`font-medium text-lg leading-tight ${alreadyInService ? 'text-text-secondary' : isSelected ? 'text-blue-400' : 'text-text-primary'}`}>{song.title}</div>
                                            {alreadyInService ? (
                                                <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    {t('service.add_songs.already_added')}
                                                </div>
                                            ) : song.conductor && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <UserIcon className="w-3 h-3 text-text-secondary" />
                                                    <span className="text-xs text-text-secondary">{song.conductor}</span>
                                                </div>
                                            )}
                                        </div>
                                        {!alreadyInService && (
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isSelected
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-surface-highlight text-text-secondary group-hover:bg-surface-highlight/80'
                                                }`}>
                                                {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Bottom Action Bar */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-xl border-t border-border pb-safe-offset">
                            <button
                                onClick={handleBatchAddSongs}
                                disabled={selectedSongsToService.length === 0}
                                className="w-full py-4 bg-primary text-background rounded-2xl font-bold text-lg hover:opacity-90 transition-colors shadow-lg disabled:opacity-50 disabled:bg-surface-highlight disabled:text-text-secondary flex items-center justify-center gap-2"
                            >
                                {t('service.add_songs.add_button')}
                                {selectedSongsToService.length > 0 && (
                                    <span className="bg-black text-white text-xs px-2 py-0.5 rounded-full min-w-[20px]">
                                        {selectedSongsToService.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div >
                )
            }

            {/* Attendance Sheet - Enhanced List View */}
            {
                showAttendance && (
                    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-border flex justify-between items-center bg-surface sticky top-0 z-10 pt-[calc(1rem+env(safe-area-inset-top))]">
                                <div>
                                    <h3 className="text-xl font-bold text-text-primary">{t('service.members.title')}</h3>
                                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                                        <span>{t('service.members.total')}: {choirMembers.length}</span>
                                        <span>•</span>
                                        <span>{t('service.members.will_be')}: {confirmedMembers.length}</span>
                                    </div>
                                </div>
                                <button onClick={() => setShowAttendance(false)} className="p-2 bg-surface-highlight rounded-full hover:bg-surface-highlight/80">
                                    <X className="w-6 h-6 text-text-primary" />
                                </button>
                            </div>

                            {/* Filters */}
                            <div className="px-4 py-3 border-b border-border bg-background/50 backdrop-blur-sm flex gap-2 overflow-x-auto scrollbar-hide">
                                {[t('service.members.filter_all'), 'Soprano', 'Alto', 'Tenor', 'Bass'].map(filter => {
                                    const isActive =
                                        (search === filter) ||
                                        (filter === t('service.members.filter_all') && search === '') ||
                                        (filter === 'Real Users' && search === 'real');

                                    return (
                                        <button
                                            key={filter}
                                            onClick={() => setSearch(filter === t('service.members.filter_all') ? '' : filter)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${isActive
                                                ? 'bg-primary text-background font-bold'
                                                : 'bg-surface-highlight text-text-secondary hover:text-text-primary'
                                                }`}
                                        >
                                            {filter}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-background/50 pb-32">
                                {(() => {
                                    // Group members by Voice Part (or "Other")
                                    const filteredMembers = choirMembers.filter(m => {
                                        if (!search) return true;
                                        if (search === 'real') return m.hasAccount;
                                        if (['Soprano', 'Alto', 'Tenor', 'Bass'].includes(search)) return m.voice === search;
                                        return true;
                                    });

                                    // Sort alphabetically only
                                    const sortedMembers = [...filteredMembers].sort((a, b) =>
                                        a.name.localeCompare(b.name)
                                    );

                                    return sortedMembers.map(member => {
                                        const isAbsent = memberMatchesUid(member, absentMembers);
                                        const isConfirmed = memberMatchesUid(member, confirmedMembers);
                                        const canMarkAttendance = canEdit || canEditAttendance;

                                        return (
                                            <div
                                                key={member.id}
                                                className={`w-full p-3 rounded-2xl border flex justify-between items-center gap-3 transition-all ${isAbsent
                                                    ? 'bg-red-500/5 border-red-500/20'
                                                    : isConfirmed
                                                        ? 'bg-green-500/5 border-green-500/20'
                                                        : 'bg-surface/50 border-border'
                                                    }`}
                                            >
                                                {/* Member Info */}
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isAbsent ? 'bg-red-500/10 text-red-400'
                                                        : isConfirmed ? 'bg-green-500/10 text-green-500'
                                                            : 'bg-surface-highlight text-text-secondary'
                                                        }`}>
                                                        {getFirstNameInitial(member.name)}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <span className={`font-medium truncate block ${isAbsent ? 'text-red-400 line-through' : 'text-text-primary'}`}>
                                                            {member.name}
                                                        </span>
                                                        <span className="text-xs text-text-secondary">
                                                            {member.voice || t('service.members.no_voice')}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Two Buttons: Present / Absent */}
                                                {canMarkAttendance ? (
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {/* Present Button */}
                                                        <button
                                                            onClick={() => setMemberAttendance(member.id, isConfirmed ? 'unknown' : 'present')}
                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isConfirmed
                                                                ? 'bg-green-500 text-white shadow-md'
                                                                : 'bg-surface-highlight text-text-secondary hover:bg-green-500/20 hover:text-green-500'
                                                                }`}
                                                        >
                                                            <Check className="w-5 h-5" strokeWidth={isConfirmed ? 3 : 2} />
                                                        </button>

                                                        {/* Absent Button */}
                                                        <button
                                                            onClick={() => setMemberAttendance(member.id, isAbsent ? 'unknown' : 'absent')}
                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isAbsent
                                                                ? 'bg-red-500 text-white shadow-md'
                                                                : 'bg-surface-highlight text-text-secondary hover:bg-red-500/20 hover:text-red-500'
                                                                }`}
                                                        >
                                                            <X className="w-5 h-5" strokeWidth={isAbsent ? 3 : 2} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    /* Read-only status */
                                                    <div className="shrink-0">
                                                        {isAbsent ? (
                                                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                                                <X className="w-5 h-5 text-red-500" />
                                                            </div>
                                                        ) : isConfirmed ? (
                                                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                                                <Check className="w-5 h-5 text-green-500" />
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-text-secondary bg-surface-highlight px-2 py-1 rounded-lg">{t('service.members.pending')}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            {(canEdit || canEditAttendance) && (
                                <div className="p-4 bg-surface border-t border-border pb-safe-offset">
                                    {isFuture ? (
                                        <>
                                            <button
                                                disabled
                                                className="w-full py-3 bg-surface-highlight text-text-secondary rounded-xl font-bold cursor-not-allowed"
                                            >
                                                {t('service.members.save')}
                                            </button>
                                            <p className="text-center text-xs text-text-secondary mt-2">
                                                {t('service.members.save_after_start')}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleSaveAttendance}
                                                className="w-full py-3 bg-primary text-background rounded-xl font-bold hover:opacity-90 transition-colors shadow-lg"
                                            >
                                                {t('service.members.save')}
                                            </button>
                                            <button
                                                onClick={markRestAsPresent}
                                                className="w-full mt-2 py-3 text-blue-400 font-medium text-sm hover:bg-blue-500/10 rounded-xl transition-colors"
                                            >
                                                {t('service.members.mark_rest_present')}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {/* Confirmation Modal for Song Deletion */}
            {
                songToDeleteIndex !== null && (
                    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-surface border border-border w-full max-w-xs p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-text-primary">{t('service.delete_song.title')}</h3>
                                    <p className="text-text-secondary text-sm mt-1">
                                        "{songToDeleteIndex !== null ? currentService.songs?.[songToDeleteIndex]?.songTitle : ""}" {t("service.remove_song_suffix")}
                                    </p>
                                </div>
                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={cancelDeleteSong}
                                        className="flex-1 py-3 border border-border rounded-xl text-text-primary hover:bg-surface-highlight transition-colors font-medium text-sm"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        onClick={confirmRemoveSong}
                                        className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors text-sm"
                                    >
                                        {t('common.delete')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Credits Editing Modal */}
            {
                editingSongIndex !== null && (
                    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-surface border border-border w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="space-y-5">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-text-primary">{t('service.credits.title')}</h3>
                                    <button onClick={() => setEditingSongIndex(null)} className="p-1 hover:bg-surface-highlight rounded-full">
                                        <X className="w-5 h-5 text-text-secondary" />
                                    </button>
                                </div>

                                {/* Conductor Dropdown */}
                                <div className="relative z-20">
                                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('service.credits.conductor')}</label>
                                    {!showCustomConductor ? (
                                        <div className="relative" ref={conductorDropdownRef}>
                                            <button
                                                type="button"
                                                onClick={() => setIsConductorDropdownOpen(!isConductorDropdownOpen)}
                                                className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl flex items-center justify-between hover:bg-surface transition-all"
                                            >
                                                <span className={`text-sm font-medium ${tempConductor ? 'text-text-primary' : 'text-text-secondary'}`}>
                                                    {tempConductor || t('service.credits.conductor_placeholder')}
                                                </span>
                                                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isConductorDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isConductorDropdownOpen && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-[60] animate-in fade-in zoom-in-95 duration-100">
                                                    <div
                                                        onClick={() => {
                                                            setTempConductor("");
                                                            setIsConductorDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-surface-highlight cursor-pointer transition-colors ${!tempConductor ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                                    >
                                                        <span className="text-sm font-medium italic">{t('service.credits.no_conductor')}</span>
                                                    </div>
                                                    {regentsList.map(name => (
                                                        <div
                                                            key={`cond-${name}`}
                                                            onClick={() => {
                                                                setTempConductor(name);
                                                                setIsConductorDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-surface-highlight cursor-pointer transition-colors ${tempConductor === name ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                                        >
                                                            <span className="text-sm font-medium">{name}</span>
                                                        </div>
                                                    ))}
                                                    <div
                                                        onClick={() => {
                                                            setShowCustomConductor(true);
                                                            setIsConductorDropdownOpen(false);
                                                            setTempConductor("");
                                                        }}
                                                        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-surface-highlight cursor-pointer transition-colors text-primary border-t border-border/50"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        <span className="text-sm font-medium">{t('service.credits.new_conductor')}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={tempConductor}
                                                onChange={(e) => setTempConductor(e.target.value)}
                                                placeholder={t('service.credits.name_placeholder')}
                                                className="flex-1 min-w-0 px-4 py-3 bg-surface-highlight text-sm font-medium text-text-primary rounded-xl outline-none border border-primary/30"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') setShowCustomConductor(false);
                                                }}
                                            />
                                            <button type="button" onClick={() => setShowCustomConductor(false)} className="px-4 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors">
                                                <Check className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Pianist Dropdown */}
                                <div className="relative z-10">
                                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('service.credits.pianist')}</label>
                                    {!showCustomPianist ? (
                                        <div className="relative" ref={pianistDropdownRef}>
                                            <button
                                                type="button"
                                                onClick={() => setIsPianistDropdownOpen(!isPianistDropdownOpen)}
                                                className="w-full px-4 py-3 bg-surface-highlight border border-border rounded-xl flex items-center justify-between hover:bg-surface transition-all"
                                            >
                                                <span className={`text-sm font-medium ${tempPianist ? 'text-text-primary' : 'text-text-secondary'}`}>
                                                    {tempPianist || t('service.credits.pianist_placeholder')}
                                                </span>
                                                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isPianistDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isPianistDropdownOpen && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-[60] animate-in fade-in zoom-in-95 duration-100">
                                                    <div
                                                        onClick={() => {
                                                            setTempPianist("");
                                                            setIsPianistDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-surface-highlight cursor-pointer transition-colors ${!tempPianist ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                                    >
                                                        <span className="text-sm font-medium italic">{t('service.credits.no_pianist')}</span>
                                                    </div>
                                                    {knownPianists.map(name => (
                                                        <div
                                                            key={`pian-${name}`}
                                                            onClick={() => {
                                                                setTempPianist(name);
                                                                setIsPianistDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-surface-highlight cursor-pointer transition-colors ${tempPianist === name ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                                        >
                                                            <span className="text-sm font-medium">{name}</span>
                                                        </div>
                                                    ))}
                                                    <div
                                                        onClick={() => {
                                                            setShowCustomPianist(true);
                                                            setIsPianistDropdownOpen(false);
                                                            setTempPianist("");
                                                        }}
                                                        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-surface-highlight cursor-pointer transition-colors text-primary border-t border-border/50"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        <span className="text-sm font-medium">{t('service.credits.new_pianist')}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={tempPianist}
                                                onChange={(e) => setTempPianist(e.target.value)}
                                                placeholder={t('service.credits.name_placeholder')}
                                                className="flex-1 min-w-0 px-4 py-3 bg-surface-highlight text-sm font-medium text-text-primary rounded-xl outline-none border border-primary/30"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') setShowCustomPianist(false);
                                                }}
                                            />
                                            <button type="button" onClick={() => setShowCustomPianist(false)} className="px-4 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors">
                                                <Check className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        // Need to safely cast indices out of React state nulls
                                        if (editingSongIndex !== null) {
                                            handleSaveCredits();
                                        }
                                        setEditingSongIndex(null);
                                    }}
                                    className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-colors"
                                >
                                    {t('common.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Service Modal (title, date, time) */}
            {showEditServiceModal && (
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-surface border border-border w-full max-w-sm p-6 rounded-3xl shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-text-primary">{t('service.edit.title')}</h3>
                            <button onClick={() => setShowEditServiceModal(false)} className="p-2 text-text-secondary hover:text-text-primary transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            {/* Title */}
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">{t('service.edit.name_label')}</label>
                                <input
                                    autoFocus
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    placeholder={t('service.edit.name_placeholder')}
                                    className="w-full h-[50px] px-4 bg-surface-highlight text-text-primary border border-border rounded-xl focus:border-primary/50 focus:bg-surface outline-none transition-all"
                                />
                            </div>

                            {/* Date */}
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">{t('service.edit.date_label')}</label>
                                <div className="relative w-full">
                                    <div className="w-full h-[50px] flex items-center pl-[44px] pr-4 bg-surface-highlight border border-border rounded-xl text-text-primary text-[15px] focus-within:border-primary/50 focus-within:bg-surface transition-all">
                                        {editDate ? editDate.split('-').reverse().join('.') : ''}
                                    </div>
                                    <input
                                        type="date"
                                        value={editDate}
                                        onChange={e => setEditDate(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer appearance-none"
                                    />
                                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary/70 pointer-events-none" />
                                </div>
                            </div>

                            {/* Time */}
                            <div>
                                <label className="text-xs text-text-secondary uppercase font-bold mb-2 flex items-center justify-between">
                                    <span>{t('service.edit.time_label')}</span>
                                    <span className="text-[10px] text-text-secondary/50 lowercase font-medium tracking-normal">{t('service.edit.time_optional')}</span>
                                </label>
                                <div className="relative w-full">
                                    <div className="w-full h-[50px] flex items-center pl-[44px] pr-4 bg-surface-highlight border border-border rounded-xl text-text-primary text-[15px] focus-within:border-primary/50 focus-within:bg-surface transition-all">
                                        {editTime || <span className="text-text-secondary/50">--:--</span>}
                                    </div>
                                    <input
                                        type="time"
                                        value={editTime}
                                        onChange={e => setEditTime(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer appearance-none"
                                    />
                                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary/70 pointer-events-none" />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowEditServiceModal(false)}
                                    className="flex-1 p-3 bg-surface-highlight text-text-secondary rounded-xl font-bold hover:bg-surface-highlight/80 transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={saveServiceDetails}
                                    disabled={!editTitle.trim()}
                                    className="flex-1 p-3 bg-primary text-background rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Save className="w-4 h-4" /> {t('common.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Program Item Modal (Native-only) */}
            {
                showAddProgramItem && (
                    <AddProgramItemModal
                        onAdd={handleAddProgramItem}
                        onClose={() => { setShowAddProgramItem(false); setEditingProgramItem(null); }}
                        editItem={editingProgramItem || undefined}
                        onEdit={handleEditProgramItem}
                    />
                )
            }

            {/* Program Item Delete Confirmation ... (skipped inner parts as they are correct) */}
            {
                programItemToDelete && (
                    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-surface border border-border w-full max-w-xs p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-text-primary">{t('service.delete_item.title')}</h3>
                                    <p className="text-text-secondary text-sm mt-1">
                                        &quot;{programItems.find(p => p.id === programItemToDelete)?.title}&quot; {t("service.remove_item_suffix")}
                                    </p>
                                </div>
                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={() => setProgramItemToDelete(null)}
                                        className="flex-1 py-3 border border-border rounded-xl text-text-primary hover:bg-surface-highlight transition-colors font-medium text-sm"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        onClick={() => programItemToDelete && handleRemoveProgramItem(programItemToDelete)}
                                        className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors text-sm"
                                    >
                                        {t('common.delete')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* PDF Modal (Reused for both Offline */}
            {/* PDF Viewer Sheet */}
            <OfflinePdfModal
                isOpen={!!previewModalSong}
                onClose={() => setPreviewModalSong(null)}
                song={previewModalSong as unknown as SimpleSong}
            />
        </div >
    );
}
