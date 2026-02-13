"use client";

import { useState, useMemo } from "react";
import { ChoirMember } from "@/types";
import { X, Merge, AlertTriangle, Loader2, Link2 } from "lucide-react";

interface MergeMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceMember: ChoirMember;
    allMembers: ChoirMember[];
    onMerge: (targetMemberId: string) => Promise<void>;
    mode?: 'merge' | 'link';
}

export default function MergeMemberModal({ isOpen, onClose, sourceMember, allMembers, onMerge, mode = 'merge' }: MergeMemberModalProps) {
    const [targetId, setTargetId] = useState("");
    const [loading, setLoading] = useState(false);

    const isLink = mode === 'link';

    // For link mode: show all members. For merge mode: exclude the source member.
    const availableTargets = useMemo(() => {
        if (isLink) return allMembers;
        return allMembers.filter(m => m.id !== sourceMember.id);
    }, [allMembers, sourceMember.id, isLink]);

    if (!isOpen) return null;

    const handleMerge = async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            await onMerge(targetId);
            onClose();
        } catch (error) {
            console.error(error);
            alert(isLink ? "Помилка прив'язки" : "Помилка об'єднання");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#18181b] border border-white/10 w-full max-w-md p-6 rounded-3xl shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        {isLink
                            ? <><Link2 className="w-5 h-5 text-blue-400" /> Прив&#39;язати до учасника</>
                            : <><Merge className="w-5 h-5 text-purple-400" /> Об&#39;єднати учасників</>
                        }
                    </h3>
                    <button onClick={onClose} className="p-2 text-text-secondary hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className={`${isLink ? 'bg-blue-500/10 border-blue-500/20' : 'bg-yellow-500/10 border-yellow-500/20'} border p-4 rounded-xl flex items-start gap-3`}>
                        {isLink
                            ? <Link2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                            : <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        }
                        <div className={`text-sm ${isLink ? 'text-blue-200/80' : 'text-yellow-200/80'}`}>
                            <p className={`font-bold ${isLink ? 'text-blue-200' : 'text-yellow-200'} mb-1`}>
                                {isLink ? "Прив'язка акаунту" : 'Увага!'}
                            </p>
                            <p>
                                {isLink
                                    ? <>Оберіть учасника зі списку, якому належить акаунт <strong>{sourceMember.name}</strong>. Голоси та відвідуваність будуть зараховуватись цьому учаснику.</>
                                    : <>Ви збираєтесь об&#39;єднати <strong>{sourceMember.name}</strong> з іншим учасником. Вся статистика відвідуваності буде перенесена.</>
                                }
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-xl border border-white/5 opacity-60">
                            <label className="text-xs text-text-secondary uppercase font-bold mb-1 block">
                                {isLink ? 'Акаунт у застосунку' : 'Звідки'}
                            </label>
                            <p className="text-white font-bold text-lg">{sourceMember.name}</p>
                            <p className="text-xs text-text-secondary font-mono">{sourceMember.role}</p>
                        </div>

                        <div className="flex justify-center">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                {isLink
                                    ? <Link2 className="w-4 h-4 text-white/50" />
                                    : <Merge className="w-4 h-4 text-white/50 rotate-90" />
                                }
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">
                                {isLink ? 'Учасник у списку хору' : 'Куди (основний профіль)'}
                            </label>
                            <select
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                className="w-full p-4 bg-black/20 text-white border border-white/10 rounded-xl focus:border-white/30 outline-none transition-all appearance-none"
                            >
                                <option value="">Оберіть учасника...</option>
                                {availableTargets.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}{m.voice ? ` (${m.voice})` : ''}{m.hasAccount ? ' ✓' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleMerge}
                        disabled={!targetId || loading}
                        className={`w-full py-4 ${isLink ? 'bg-blue-500 hover:bg-blue-400' : 'bg-purple-500 hover:bg-purple-400'} text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]`}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLink ? "Прив'язати" : "Об'єднати"}
                    </button>
                </div>
            </div>
        </div>
    );
}
