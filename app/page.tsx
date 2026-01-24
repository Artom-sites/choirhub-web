"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getChoir, createUser, updateChoirMembers, getServices, updateChoirIcon } from "@/lib/db";
import { Service, Choir, UserMembership, ChoirMember } from "@/types";
import SongList from "@/components/SongList";
import ServiceList from "@/components/ServiceList";
import ServiceView from "@/components/ServiceView";
import {
  Music2, Loader2, Copy, Check,
  LogOut, ChevronLeft, Home, User, Users, Repeat,
  PlusCircle, UserPlus, X, Trash2, Camera
} from "lucide-react";
import { collection as firestoreCollection, addDoc, getDocs, where, query, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading: authLoading, signOut, refreshProfile } = useAuth();

  const [choir, setChoir] = useState<Choir | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // Navigation State - driven by URL params
  const activeTabRaw = searchParams.get('tab');
  const activeTab = (activeTabRaw === 'songs' || activeTabRaw === 'members') ? activeTabRaw : 'home';

  const setActiveTab = (tab: 'home' | 'songs' | 'members') => {
    // Update URL without full reload
    const newParams = new URLSearchParams(searchParams.toString());
    if (tab === 'home') newParams.delete('tab');
    else newParams.set('tab', tab);

    router.replace(`/?${newParams.toString()}`, { scroll: false });
  };
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Overlays
  const [showAccount, setShowAccount] = useState(false);
  const [showChoirManager, setShowChoirManager] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Choir Manager State
  const [managerMode, setManagerMode] = useState<'list' | 'create' | 'join'>('list');
  const [newChoirName, setNewChoirName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [managerLoading, setManagerLoading] = useState(false);
  const [managerError, setManagerError] = useState("");

  // Add Member State
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'regent'>('member');

  // Icon upload ref
  const iconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !userData?.choirId) {
      router.push("/setup");
      return;
    }

    async function init() {
      if (userData?.choirId) {
        const [fetchedChoir, fetchedServices] = await Promise.all([
          getChoir(userData.choirId),
          getServices(userData.choirId)
        ]);
        setChoir(fetchedChoir);
        setServices(fetchedServices);
      }
      setPageLoading(false);
    }
    init();

  }, [authLoading, user, userData, router]);

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

  // Add manual member (not a real user, just a name for attendance tracking)
  const handleAddMember = async () => {
    if (!newMemberName.trim() || !choir || !userData?.choirId) return;

    const newMember: ChoirMember = {
      id: `manual_${Date.now()}`, // Manual members get special IDs
      name: newMemberName.trim(),
      role: newMemberRole
    };

    const updatedMembers = [...(choir.members || []), newMember];

    try {
      await updateChoirMembers(userData.choirId, updatedMembers);
      setChoir({ ...choir, members: updatedMembers });
      setNewMemberName("");
      setShowAddMember(false);
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
    } catch (e) {
      console.error(e);
    }
  };

  // Count absences for a member across all services
  const getAbsenceCount = (memberId: string): number => {
    return services.filter(s => s.absentMembers?.includes(memberId)).length;
  };

  const canEdit = userData?.role === 'head' || userData?.role === 'regent';

  // Handle choir icon upload
  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData?.choirId || !canEdit) return;

    // Convert to base64 (keeping it small for Firestore)
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        await updateChoirIcon(userData.choirId, base64);
        setChoir(prev => prev ? { ...prev, icon: base64 } : null);
      } catch (err) {
        console.error("Failed to update icon:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  // If viewing a specific service, render ServiceView full screen
  if (selectedService) {
    return (
      <main className="min-h-screen bg-[#09090b] selection:bg-white/30">
        <ServiceView
          service={selectedService}
          onBack={() => setSelectedService(null)}
          canEdit={canEdit}
        />
      </main>
    );
  }

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; bg: string; text: string }> = {
      head: { label: "Голова", bg: "bg-amber-500/20", text: "text-amber-400" },
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
                        <p className="text-xs text-text-secondary uppercase">{m.role === 'head' ? 'Головний' : m.role === 'regent' ? 'Регент' : 'Хорист'}</p>
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

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#18181b] border border-white/10 w-full max-w-sm p-6 rounded-3xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Додати учасника</h3>
              <button onClick={() => setShowAddMember(false)} className="p-2 text-text-secondary hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">Ім'я</label>
                <input
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  placeholder="Ім'я учасника"
                  className="w-full p-3 bg-black/20 text-white border border-white/10 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">Роль</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewMemberRole('member')}
                    className={`flex-1 p-3 rounded-xl text-sm font-bold transition-all ${newMemberRole === 'member' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                  >
                    Хорист
                  </button>
                  <button
                    onClick={() => setNewMemberRole('regent')}
                    className={`flex-1 p-3 rounded-xl text-sm font-bold transition-all ${newMemberRole === 'regent' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                  >
                    Регент
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddMember}
                className="w-full p-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 mt-4"
              >
                Додати
              </button>
            </div>
          </div>
        </div>
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
                <div>
                  <h3 className="text-xl font-bold text-white">{userData?.name}</h3>
                  <p className="text-sm text-text-secondary">{userData?.choirName}</p>
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
              {userData?.role === 'head' && choir && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-2">Коди доступу</h3>

                  <button
                    onClick={() => copyCode(choir.memberCode)}
                    className="w-full bg-[#18181b] border border-white/5 hover:border-white/30 p-4 rounded-2xl flex items-center justify-between group transition-all"
                  >
                    <div className="text-left">
                      <p className="text-sm text-text-secondary mb-1">Хористи</p>
                      <code className="text-xl font-mono text-white font-bold tracking-wider">{choir.memberCode}</code>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      {copiedCode === choir.memberCode ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-text-secondary group-hover:text-white" />}
                    </div>
                  </button>

                  <button
                    onClick={() => copyCode(choir.regentCode)}
                    className="w-full bg-[#18181b] border border-white/5 hover:border-white/30 p-4 rounded-2xl flex items-center justify-between group transition-all"
                  >
                    <div className="text-left">
                      <p className="text-sm text-text-secondary mb-1">Регенти</p>
                      <code className="text-xl font-mono text-white font-bold tracking-wider">{choir.regentCode}</code>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      {copiedCode === choir.regentCode ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-text-secondary group-hover:text-white" />}
                    </div>
                  </button>
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
          <ServiceList onSelectService={setSelectedService} canEdit={canEdit} />
        )}

        {activeTab === 'songs' && (
          <SongList canAddSongs={canEdit} regents={choir?.regents || []} />
        )}

        {activeTab === 'members' && (
          <div className="max-w-md mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Учасники хору</h2>
              {canEdit && (
                <button
                  onClick={() => setShowAddMember(true)}
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
                      className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors"
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
                          <p className="text-white font-bold">{member.name}</p>
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

                      {canEdit && member.id !== user?.uid && member.role !== 'head' && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 text-text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
    </main>
  );
}
