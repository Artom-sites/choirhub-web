"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getChoir, createUser, updateChoirMembers, getServices, uploadChoirIcon } from "@/lib/db";
import { Service, Choir, UserMembership, ChoirMember, Permission, AdminCode } from "@/types";
import SongList from "@/components/SongList";
import ServiceList from "@/components/ServiceList";
import ServiceView from "@/components/ServiceView";
import StatisticsView from "@/components/StatisticsView"; // New
import EditMemberModal from "@/components/EditMemberModal"; // New
import {
  Music2, Loader2, Copy, Check,
  LogOut, ChevronLeft, Home, User, Users, Repeat,
  PlusCircle, UserPlus, X, Trash2, Camera, BarChart2, Link2, Pencil
} from "lucide-react";
import { collection as firestoreCollection, addDoc, getDocs, where, query, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading: authLoading, signOut, refreshProfile } = useAuth();

  const [choir, setChoir] = useState<Choir | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // Navigation
  const activeTabRaw = searchParams.get('tab');
  const activeTab = (activeTabRaw === 'songs' || activeTabRaw === 'members') ? activeTabRaw : 'home';

  const setActiveTab = (tab: 'home' | 'songs' | 'members') => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (tab === 'home') newParams.delete('tab');
    else newParams.set('tab', tab);
    router.replace(`/?${newParams.toString()}`, { scroll: false });
  };

  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Stats
  const [showStats, setShowStats] = useState(false);

  // Overlays
  const [showAccount, setShowAccount] = useState(false);
  const [showChoirManager, setShowChoirManager] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Member Management
  const [editingMember, setEditingMember] = useState<ChoirMember | null>(null);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Choir Manager State
  const [managerMode, setManagerMode] = useState<'list' | 'create' | 'join'>('list');
  const [newChoirName, setNewChoirName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [managerLoading, setManagerLoading] = useState(false);
  const [managerError, setManagerError] = useState("");

  const iconInputRef = useRef<HTMLInputElement>(null);

  // Admin Code Creation
  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [newAdminLabel, setNewAdminLabel] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [creatingAdminCode, setCreatingAdminCode] = useState(false);

  // Edit Name Modal
  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const AVAILABLE_PERMISSIONS: { key: Permission; label: string }[] = [
    { key: 'add_songs', label: 'Додавати пісні' },
    { key: 'edit_attendance', label: 'Відмічати відсутніх' },
    { key: 'edit_credits', label: 'Записувати диригента/піаніста' },
    { key: 'view_stats', label: 'Бачити статистику' },
    { key: 'manage_services', label: 'Створювати/видаляти служіння' },
  ];

  const fetchChoirData = async () => {
    if (!userData?.choirId) return;
    const [fetchedChoir, fetchedServices] = await Promise.all([
      getChoir(userData.choirId),
      getServices(userData.choirId)
    ]);
    setChoir(fetchedChoir);
    setServices(fetchedServices);
    return fetchedChoir;
  };

  useEffect(() => {
    if (authLoading) return;

    if (!user || !userData?.choirId) {
      router.push("/setup");
      return;
    }



    async function init() {
      if (userData?.choirId) {
        const fetchedChoir = await fetchChoirData();

        // Check for joinCode param
        const joinCodeParam = searchParams.get('joinCode');
        if (joinCodeParam) {
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.delete('joinCode');
          router.replace(`/?${newParams.toString()}`, { scroll: false });

          // Check if user is already in a choir that matches this code
          const codeUpper = joinCodeParam.toUpperCase();
          const alreadyInChoir = fetchedChoir && (
            fetchedChoir.memberCode === codeUpper ||
            fetchedChoir.regentCode === codeUpper ||
            fetchedChoir.adminCodes?.some(ac => ac.code === codeUpper)
          );

          // Only show join modal if user is NOT already in the choir with this code
          if (!alreadyInChoir) {
            setShowAccount(false);
            setShowChoirManager(true);
            setManagerMode('join');
            setJoinCode(joinCodeParam);
          }
          // If alreadyInChoir, just do nothing (they're already here)
        }

        // Check for serviceId param (Android Back Support)
        const serviceIdParam = searchParams.get('serviceId');
        if (serviceIdParam) {
          // We need services to be set, which fetchChoirData does
          // But services state update might not be immediate here if we just called setServices
          // So we rely on fetchedServices from Promise if we were returning it, but fetchChoirData returns void/choir
          // Let's refactor slightly to access services
          const services = await getServices(userData.choirId);
          // actually better to just let fetchChoirData handle state and maybe we check services from state in a separate effect? 
          // Or just re-get it here. 
          const foundService = services.find(s => s.id === serviceIdParam);
          if (foundService) setSelectedService(foundService);
        } else {
          setSelectedService(null);
        }
      }
      setPageLoading(false);
    }
    init();

  }, [authLoading, user, userData, router, searchParams]);

  // Handle Service Selection with URL sync
  const handleSelectService = (service: Service | null) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (service) {
      newParams.set('serviceId', service.id);
      router.push(`/?${newParams.toString()}`, { scroll: false });
      // State update will happen via useEffect or we can set it eagerly
      setSelectedService(service);
    } else {
      newParams.delete('serviceId');
      // If we are "going back", we might want router.back() if history length > 1, 
      // but replacing is safer to just clear the param if clicked "Back" button in UI.
      // However, if user clicks browser back, searchParams changes automatically.
      // If user clicks UI back button, we should remove param.
      router.back(); // This mimics browser back, which typically removes the last pushed state
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/setup");
  };

  const handleSwitchChoir = async (membership: UserMembership) => {
    if (!user) return;
    setPageLoading(true);

    await createUser(user.uid, {
      choirId: membership.choirId,
      choirName: membership.choirName,
      role: membership.role
    });

    await refreshProfile();
    window.location.reload();
  };

  const handleCreateChoir = async () => {
    if (!user || !newChoirName.trim()) return;
    setManagerLoading(true);
    try {
      const memberCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const regentCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const choirData = {
        name: newChoirName.trim(),
        memberCode,
        regentCode,
        createdAt: new Date().toISOString(),
        regents: [userData?.name || "Head"],
        members: [{
          id: user.uid,
          name: userData?.name || "Користувач",
          role: 'head'
        }]
      };

      const choirRef = await addDoc(firestoreCollection(db, "choirs"), choirData);

      await createUser(user.uid, {
        choirId: choirRef.id,
        choirName: choirData.name,
        role: 'head',
        memberships: arrayUnion({
          choirId: choirRef.id,
          choirName: choirData.name,
          role: 'head'
        }) as any
      });

      await refreshProfile();
      window.location.reload();

    } catch (e) {
      console.error(e);
      setManagerError("Помилка створення");
    } finally {
      setManagerLoading(false);
    }
  };

  const handleJoinChoir = async () => {
    if (!user || !joinCode || joinCode.length !== 6) return;
    setManagerLoading(true);
    try {
      const qMember = query(firestoreCollection(db, "choirs"), where("memberCode", "==", joinCode.toUpperCase()));
      const qRegent = query(firestoreCollection(db, "choirs"), where("regentCode", "==", joinCode.toUpperCase()));

      const [snapMember, snapRegent] = await Promise.all([getDocs(qMember), getDocs(qRegent)]);

      let foundChoirId = "";
      let role: 'member' | 'regent' = 'member';
      let foundChoirName = "";

      if (!snapRegent.empty) {
        foundChoirId = snapRegent.docs[0].id;
        role = 'regent';
        foundChoirName = snapRegent.docs[0].data().name;
      } else if (!snapMember.empty) {
        foundChoirId = snapMember.docs[0].id;
        role = 'member';
        foundChoirName = snapMember.docs[0].data().name;
      } else {
        setManagerError("Код не знайдено");
        setManagerLoading(false);
        return;
      }

      if (userData?.memberships?.some(m => m.choirId === foundChoirId)) {
        setManagerError("Ви вже є учасником цього хору");
        setManagerLoading(false);
        return;
      }

      const choirRef = doc(db, "choirs", foundChoirId);
      await updateDoc(choirRef, {
        members: arrayUnion({
          id: user.uid,
          name: userData?.name || "Користувач",
          role: role
        })
      });

      await createUser(user.uid, {
        choirId: foundChoirId,
        choirName: foundChoirName,
        role: role,
        memberships: arrayUnion({
          choirId: foundChoirId,
          choirName: foundChoirName,
          role: role
        }) as any
      });

      await refreshProfile();
      window.location.reload();
    } catch (e) {
      console.error(e);
      setManagerError("Помилка приєднання");
    } finally {
      setManagerLoading(false);
    }
  };

  const createAdminCode = async () => {
    if (!choir || !userData?.choirId || selectedPermissions.length === 0) return;

    setCreatingAdminCode(true);
    try {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newAdminCode: AdminCode = {
        code: newCode,
        permissions: selectedPermissions,
        label: newAdminLabel.trim() || undefined,
      };

      const updatedAdminCodes = [...(choir.adminCodes || []), newAdminCode];

      const choirRef = doc(db, "choirs", userData.choirId);
      await updateDoc(choirRef, { adminCodes: updatedAdminCodes });

      setChoir({ ...choir, adminCodes: updatedAdminCodes });
      setShowAdminCodeModal(false);
      setNewAdminLabel("");
      setSelectedPermissions([]);

      // Copy new code to clipboard
      copyCode(newCode);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingAdminCode(false);
    }
  };

  const togglePermission = (perm: Permission) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSaveName = async () => {
    if (!newName.trim() || !user) return;
    setSavingName(true);
    try {
      await createUser(user.uid, { name: newName.trim() });
      await refreshProfile();
      await fetchChoirData();
      setShowEditName(false);
      setNewName("");
    } catch (err) {
      console.error("Failed to update name:", err);
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveMember = async (member: ChoirMember) => {
    if (!choir || !userData?.choirId) return;

    const existingIndex = (choir.members || []).findIndex(m => m.id === member.id);
    const updatedMembers = [...(choir.members || [])];

    if (existingIndex >= 0) {
      updatedMembers[existingIndex] = member;
    } else {
      updatedMembers.push(member);
    }

    try {
      await updateChoirMembers(userData.choirId, updatedMembers);
      setChoir({ ...choir, members: updatedMembers });
      setShowEditMemberModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!choir || !userData?.choirId) return;
    // Don't allow removing yourself or the head
    if (memberId === user?.uid) return;

    const updatedMembers = (choir.members || []).filter(m => m.id !== memberId);

    try {
      await updateChoirMembers(userData.choirId, updatedMembers);
      setChoir({ ...choir, members: updatedMembers });
      setShowEditMemberModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Count absences for a member across all services
  const getAbsenceCount = (memberId: string): number => {
    return services.filter(s => s.absentMembers?.includes(memberId)).length;
  };

  // Check if user can edit - either by role OR specific permissions from admin codes
  const hasManagePermission = userData?.permissions?.some(p =>
    ['add_songs', 'edit_attendance', 'edit_credits', 'manage_services'].includes(p)
  ) ?? false;
  const canEdit = userData?.role === 'head' || userData?.role === 'regent' || hasManagePermission;

  // More granular permissions
  const canAddSongs = canEdit || (userData?.permissions?.includes('add_songs') ?? false);
  const canEditAttendance = canEdit || (userData?.permissions?.includes('edit_attendance') ?? false);
  const canEditCredits = canEdit || (userData?.permissions?.includes('edit_credits') ?? false);
  const canManageServices = canEdit || (userData?.permissions?.includes('manage_services') ?? false);

  // Handle choir icon upload
  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData?.choirId || !canEdit) return;

    try {
      const url = await uploadChoirIcon(userData.choirId, file);
      setChoir(prev => prev ? { ...prev, icon: url } : null);
    } catch (err) {
      console.error("Failed to update icon:", err);
    }
  };

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  // Show Statistics
  if (showStats && choir) {
    return (
      <StatisticsView
        choir={choir}
        services={services}
        onBack={() => setShowStats(false)}
      />
    );
  }

  // If viewing a specific service, render ServiceView full screen
  if (selectedService) {
    return (
      <main className="min-h-screen bg-[#09090b] selection:bg-white/30">
        <ServiceView
          service={selectedService}
          onBack={() => handleSelectService(null)}
          canEdit={canEdit}
        />
      </main>
    );
  }

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; bg: string; text: string }> = {
      head: { label: "Регент", bg: "bg-amber-500/20", text: "text-amber-400" },
      regent: { label: "Регент", bg: "bg-blue-500/20", text: "text-blue-400" },
      member: { label: "Хорист", bg: "bg-white/10", text: "text-gray-400" },
    };
    const config = roleConfig[role] || roleConfig.member;
    return (
      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getVoiceBadge = (voice?: string) => {
    if (!voice) return null;
    const config: Record<string, string> = {
      Soprano: "text-pink-400 border-pink-500/20",
      Alto: "text-purple-400 border-purple-500/20",
      Tenor: "text-blue-400 border-blue-500/20",
      Bass: "text-green-400 border-green-500/20",
    };

    const style = config[voice] || "text-gray-400 border-white/10";
    const label = voice === 'Soprano' ? 'S' : voice === 'Alto' ? 'A' : voice === 'Tenor' ? 'T' : 'B';

    return (
      <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${style}`}>
        {label}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#09090b] pb-24 selection:bg-white/30">

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 w-full max-w-xs p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center">
                <LogOut className="w-6 h-6 text-text-secondary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Вийти з акаунту?</h3>
                <p className="text-text-secondary text-sm mt-1">
                  Для повторного входу знадобиться увійти через Google.
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 border border-white/10 rounded-xl text-white hover:bg-white/5 transition-colors font-medium text-sm"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
                >
                  Вийти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Choir Manager Modal */}
      {showChoirManager && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#18181b] border border-white/10 w-full max-w-sm p-6 rounded-3xl shadow-2xl overflow-hidden relative">
            <button onClick={() => { setShowChoirManager(false); setManagerMode('list'); setManagerError(""); }} className="absolute top-4 right-4 p-2 text-text-secondary hover:text-white">
              <X className="w-5 h-5" />
            </button>

            {managerMode === 'list' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white text-center mb-6">Мої хори</h3>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  <div className="p-4 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold">{userData?.choirName}</p>
                      <p className="text-xs text-green-400 font-medium tracking-wide">ПОТОЧНИЙ</p>
                    </div>
                    <Check className="w-5 h-5 text-green-400" />
                  </div>

                  {userData?.memberships?.filter(m => m.choirId !== userData.choirId).map(m => (
                    <button
                      key={m.choirId}
                      onClick={() => handleSwitchChoir(m)}
                      className="w-full p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 flex items-center justify-between transition-all"
                    >
                      <div className="text-left">
                        <p className="text-white font-bold">{m.choirName}</p>
                        <p className="text-xs text-text-secondary uppercase">{m.role === 'head' ? 'Регент' : m.role === 'regent' ? 'Регент' : 'Хорист'}</p>
                      </div>
                      <Repeat className="w-4 h-4 text-text-secondary" />
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button onClick={() => setManagerMode('create')} className="p-3 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200">
                    Створити
                  </button>
                  <button onClick={() => setManagerMode('join')} className="p-3 bg-white/10 text-white rounded-xl text-sm font-bold hover:bg-white/20 border border-white/5">
                    Приєднатись
                  </button>
                </div>
              </div>
            )}

            {managerMode === 'create' && (
              <div className="space-y-4">
                <button onClick={() => setManagerMode('list')} className="text-xs text-text-secondary hover:text-white mb-2">← Назад</button>
                <h3 className="text-xl font-bold text-white">Новий хор</h3>
                <input
                  value={newChoirName}
                  onChange={e => setNewChoirName(e.target.value)}
                  placeholder="Назва хору"
                  className="w-full p-3 bg-black/20 text-white border border-white/10 rounded-xl"
                />
                <button
                  onClick={handleCreateChoir}
                  disabled={managerLoading}
                  className="w-full p-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 disabled:opacity-50"
                >
                  {managerLoading ? <Loader2 className="animate-spin mx-auto" /> : "Створити"}
                </button>
              </div>
            )}

            {managerMode === 'join' && (
              <div className="space-y-4">
                <button onClick={() => { setManagerMode('list'); setManagerError(""); }} className="text-xs text-text-secondary hover:text-white mb-2">← Назад</button>
                <h3 className="text-xl font-bold text-white">Приєднатись</h3>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Код (6 символів)"
                  maxLength={6}
                  className="w-full p-3 bg-black/20 text-white border border-white/10 rounded-xl text-center font-mono uppercase tracking-widest"
                />
                {managerError && <p className="text-red-400 text-xs">{managerError}</p>}
                <button
                  onClick={handleJoinChoir}
                  disabled={managerLoading}
                  className="w-full p-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 disabled:opacity-50"
                >
                  {managerLoading ? <Loader2 className="animate-spin mx-auto" /> : "Додатись"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit/Add Member Modal */}
      {/* Edit/Add Member Modal */}
      {showEditMemberModal && (
        <EditMemberModal
          isOpen={showEditMemberModal}
          onClose={() => setShowEditMemberModal(false)}
          member={editingMember}
          onSave={handleSaveMember}
          onDelete={handleRemoveMember}
        />
      )}

      {/* Account Overlay */}
      {showAccount && (
        <div className="fixed inset-0 z-50 bg-[#09090b] animate-in slide-in-from-right duration-300 flex flex-col">
          <div className="p-4 border-b border-white/5 bg-[#18181b]/50 backdrop-blur-md">
            <button
              onClick={() => setShowAccount(false)}
              className="flex items-center gap-2 text-white font-medium hover:text-white/80 transition-colors py-1"
            >
              <ChevronLeft className="w-5 h-5" />
              Назад
            </button>
          </div>

          <div className="max-w-md mx-auto w-full h-full flex flex-col p-6 overflow-y-auto">
            <h2 className="text-3xl font-bold text-white mb-8 tracking-tight">Акаунт</h2>

            <div className="space-y-6 flex-1">
              {/* Profile Card */}
              <div className="bg-white/5 border border-white/5 rounded-3xl p-6 flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center text-xl font-bold shadow-lg overflow-hidden">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{userData?.name?.[0]?.toUpperCase() || "U"}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">{userData?.name}</h3>
                    <button
                      onClick={() => { setNewName(userData?.name || ""); setShowEditName(true); }}
                      className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-text-secondary hover:text-white"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-text-secondary">{user?.email}</p>
                  <p className="text-xs text-text-secondary/50 mt-0.5">{userData?.choirName}</p>
                  <div className="mt-2">{getRoleBadge(userData?.role || 'member')}</div>
                </div>
              </div>

              {/* Change Choir Button */}
              <button
                onClick={() => { setShowAccount(false); setShowChoirManager(true); }}
                className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">Змінити хор</p>
                    <p className="text-xs text-text-secondary group-hover:text-white/80">Додати або перемкнути</p>
                  </div>
                </div>
                <PlusCircle className="w-5 h-5 text-text-secondary group-hover:text-white" />
              </button>

              {/* Codes for admin */}
              {(userData?.role === 'head' || userData?.role === 'regent') && choir && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-2">Коди доступу</h3>

                  <button
                    onClick={() => copyCode(`https://${window.location.host}/setup?code=${choir.memberCode}`)}
                    className="w-full bg-[#18181b] border border-white/5 hover:border-white/30 p-4 rounded-2xl flex items-center justify-between group transition-all"
                  >
                    <div className="text-left">
                      <p className="text-sm text-text-secondary mb-1">Хористи</p>
                      <code className="text-xl font-mono text-white font-bold tracking-wider">{choir.memberCode}</code>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      {copiedCode === `https://${window.location.host}/setup?code=${choir.memberCode}` ? <Check className="w-5 h-5 text-green-500" /> : <Link2 className="w-5 h-5 text-text-secondary group-hover:text-white" />}
                    </div>
                  </button>

                  <button
                    onClick={() => copyCode(`https://${window.location.host}/setup?code=${choir.regentCode}`)}
                    className="w-full bg-[#18181b] border border-white/5 hover:border-white/30 p-4 rounded-2xl flex items-center justify-between group transition-all"
                  >
                    <div className="text-left">
                      <p className="text-sm text-text-secondary mb-1">Регенти</p>
                      <code className="text-xl font-mono text-white font-bold tracking-wider">{choir.regentCode}</code>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      {copiedCode === `https://${window.location.host}/setup?code=${choir.regentCode}` ? <Check className="w-5 h-5 text-green-500" /> : <Link2 className="w-5 h-5 text-text-secondary group-hover:text-white" />}
                    </div>
                  </button>

                  {/* Admin Codes Section */}
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Адмін-коди</h4>
                      <button
                        onClick={() => setShowAdminCodeModal(true)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-colors"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>

                    {(choir.adminCodes?.length || 0) === 0 ? (
                      <p className="text-xs text-text-secondary/50">Ще немає адмін-кодів</p>
                    ) : (
                      <div className="space-y-2">
                        {choir.adminCodes?.map((ac, idx) => (
                          <div key={idx} className="bg-black/20 border border-white/5 p-3 rounded-xl">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-text-secondary">{ac.label || 'Адміністратор'}</p>
                                <code className="text-white font-mono font-bold">{ac.code}</code>
                              </div>
                              <button
                                onClick={() => copyCode(`https://${window.location.host}/setup?code=${ac.code}`)}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                              >
                                {copiedCode === `https://${window.location.host}/setup?code=${ac.code}` ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Link2 className="w-4 h-4 text-text-secondary" />
                                )}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {ac.permissions.map(p => (
                                <span key={p} className="text-[10px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded">
                                  {AVAILABLE_PERMISSIONS.find(ap => ap.key === p)?.label?.split(' ')[0]}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full py-4 border border-white/10 text-white hover:bg-white/10 rounded-2xl font-bold transition-all mt-6 flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Вийти з акаунту
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo - clickable to change icon (for regent/head only) */}
            <input
              type="file"
              ref={iconInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleIconUpload}
            />
            <button
              onClick={() => canEdit && iconInputRef.current?.click()}
              className={`w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/5 overflow-hidden relative group ${canEdit ? 'cursor-pointer hover:border-white/30' : ''}`}
            >
              {choir?.icon ? (
                <img src={choir.icon} alt="Choir" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl text-white font-bold">{choir?.name?.[0]?.toUpperCase() || "C"}</span>
              )}
              {canEdit && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                {activeTab === 'home' ? 'Головна' : activeTab === 'songs' ? 'Пісні' : 'Учасники'}
              </h1>
              <p className="text-xs text-text-secondary font-medium">
                {choir?.name || "ChoirHub"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAccount(true)}
            className="w-10 h-10 rounded-full border border-white/10 hover:border-white/50 transition-colors overflow-hidden"
          >
            <div className="w-full h-full bg-[#18181b] flex items-center justify-center text-text-secondary font-bold text-sm">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
              ) : (
                <span>{userData?.name?.[0]?.toUpperCase() || "U"}</span>
              )}
            </div>
          </button>
        </div>
      </header>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === 'home' && (
          <ServiceList onSelectService={handleSelectService} canEdit={canEdit} />
        )}

        {activeTab === 'songs' && <SongList
          canAddSongs={canAddSongs}
          regents={choir?.regents || []}
          knownConductors={choir?.knownConductors || []}
          knownCategories={choir?.knownCategories || []}
        />}

        {activeTab === 'members' && (
          <div className="max-w-md mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">Учасники</h2>
                {/* Stats Button */}
                <button
                  onClick={() => setShowStats(true)}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                >
                  <BarChart2 className="w-5 h-5" />
                </button>
              </div>

              {canEdit && (
                <button
                  onClick={() => { setEditingMember(null); setShowEditMemberModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Додати
                </button>
              )}
            </div>

            <div className="space-y-2">
              {(choir?.members || []).length === 0 ? (
                <div className="text-center py-12 text-text-secondary">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Немає учасників</p>
                  {canEdit && <p className="text-sm mt-2">Додайте учасників, щоб відстежувати відвідуваність</p>}
                </div>
              ) : (
                choir?.members?.map((member) => {
                  const absences = getAbsenceCount(member.id);
                  return (
                    <div
                      key={member.id}
                      onClick={() => {
                        if (canEdit) {
                          setEditingMember(member);
                          setShowEditMemberModal(true);
                        }
                      }}
                      className={`p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors ${canEdit ? 'cursor-pointer active:scale-[0.99]' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm relative">
                          {member.name?.[0]?.toUpperCase() || "?"}
                          {absences > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {absences}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-white font-bold flex items-center gap-2">
                            {member.name}
                            {getVoiceBadge(member.voice)}
                          </p>
                          <div className="flex items-center gap-2">
                            {getRoleBadge(member.role)}
                            {absences > 0 && (
                              <span className="text-[10px] text-orange-400">
                                {absences} {absences === 1 ? 'пропуск' : absences < 5 ? 'пропуски' : 'пропусків'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="text-text-secondary/50 group-hover:text-white transition-colors">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Stats summary */}
            {services.length > 0 && (choir?.members || []).length > 0 && (
              <div className="mt-8 p-4 bg-white/5 border border-white/5 rounded-2xl">
                <p className="text-white text-sm font-bold mb-2">📊 Статистика</p>
                <p className="text-text-secondary text-sm">
                  Всього служінь: {services.length} • Учасників: {choir?.members?.length || 0}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#09090b]/90 backdrop-blur-xl border-t border-white/5 px-4 pb-safe pt-2 z-20">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">

          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 flex-1 p-2 rounded-xl active:scale-95 transition-all ${activeTab === 'home' ? 'text-white' : 'text-text-secondary'}`}
          >
            <Home className={`w-6 h-6 ${activeTab === 'home' ? 'fill-white/20' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wide">Головна</span>
          </button>

          <button
            onClick={() => setActiveTab('songs')}
            className={`flex flex-col items-center gap-1 flex-1 p-2 rounded-xl active:scale-95 transition-all ${activeTab === 'songs' ? 'text-white' : 'text-text-secondary'}`}
          >
            <Music2 className={`w-6 h-6 ${activeTab === 'songs' ? 'fill-white/20' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wide">Пісні</span>
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`flex flex-col items-center gap-1 flex-1 p-2 rounded-xl active:scale-95 transition-all ${activeTab === 'members' ? 'text-white' : 'text-text-secondary'}`}
          >
            <Users className={`w-6 h-6 ${activeTab === 'members' ? 'fill-white/20' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wide">Учасники</span>
          </button>

        </div>
      </nav>
      {/* Admin Code Creation Modal */}
      {showAdminCodeModal && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Створити адмін-код</h3>
                <button onClick={() => setShowAdminCodeModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Назва ролі (опціонально)
                </label>
                <input
                  type="text"
                  value={newAdminLabel}
                  onChange={(e) => setNewAdminLabel(e.target.value)}
                  placeholder="напр. Секретар"
                  className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Дозволи
                </label>
                <div className="space-y-2">
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <button
                      key={perm.key}
                      onClick={() => togglePermission(perm.key)}
                      className={`w-full p-3 rounded-xl border text-left text-sm transition-all ${selectedPermissions.includes(perm.key)
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                        : 'bg-black/20 border-white/5 text-text-secondary hover:border-white/20'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedPermissions.includes(perm.key) ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'
                          }`}>
                          {selectedPermissions.includes(perm.key) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {perm.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={createAdminCode}
                disabled={selectedPermissions.length === 0 || creatingAdminCode}
                className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creatingAdminCode ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Створити код'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Name Modal */}
      {showEditName && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowEditName(false)}
        >
          <div
            className="bg-[#18181b] w-full max-w-sm rounded-3xl border border-white/10 p-6 shadow-2xl animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-white">Змінити ім'я</h3>
              <button
                onClick={() => setShowEditName(false)}
                className="p-1 text-text-secondary hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Ваше ім'я
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Введіть нове ім'я"
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 text-white"
                  autoFocus
                />
              </div>

              <button
                onClick={handleSaveName}
                disabled={savingName || !newName.trim()}
                className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingName ? <Loader2 className="animate-spin" /> : "Зберегти"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );

}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
