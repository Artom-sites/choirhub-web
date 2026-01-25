"use client";

import { useState, useMemo } from "react";
import { ChoirMember } from "@/types";
import { X, Merge, AlertTriangle, Loader2 } from "lucide-react";

interface MergeMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceMember: ChoirMember;
    allMembers: ChoirMember[];
    onMerge: (targetMemberId: string) => Promise<void>;
}

export default function MergeMemberModal({ isOpen, onClose, sourceMember, allMembers, onMerge }: MergeMemberModalProps) {
    const [targetId, setTargetId] = useState("");
    const [loading, setLoading] = useState(false);

    // Filter out the source member from the potential targets
    const availableTargets = useMemo(() => {
        return allMembers.filter(m => m.id !== sourceMember.id);
    }, [allMembers, sourceMember.id]);

    if (!isOpen) return null;

    const handleMerge = async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            await onMerge(targetId);
            onClose();
        } catch (error) {
            console.error(error);
            alert("Помилка об'єднання");
        } finally {
            setLoading(false);
        }
    };

    const targetMember = allMembers.find(m => m.id === targetId);

    return (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#18181b] border border-white/10 w-full max-w-md p-6 rounded-3xl shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Merge className="w-5 h-5 text-purple-400" />
                        Об'єднати учасників
                    </h3>
                    <button onClick={onClose} className="p-2 text-text-secondary hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-200/80">
                            <p className="font-bold text-yellow-200 mb-1">Увага!</p>
                            <p>
                                Ви збираєтесь об'єднати <strong>{sourceMember.name}</strong> з іншим учасником.
                                Вся статистика відвідуваності буде перенесена до нового профілю, а старий профіль ({sourceMember.name}) буде <strong>видалено</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-xl border border-white/5 opacity-60">
                            <label className="text-xs text-text-secondary uppercase font-bold mb-1 block">Звідки (буде видалено)</label>
                            <p className="text-white font-bold text-lg">{sourceMember.name}</p>
                            <p className="text-xs text-text-secondary font-mono">{sourceMember.role}</p>
                        </div>

                        <div className="flex justify-center">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                <Merge className="w-4 h-4 text-white/50 rotate-90" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">Куди (основний профіль)</label>
                            <select
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                className="w-full p-4 bg-black/20 text-white border border-white/10 rounded-xl focus:border-white/30 outline-none transition-all appearance-none"
                            >
                                <option value="">Оберіть учасника...</option>
                                {availableTargets.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.role})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleMerge}
                        disabled={!targetId || loading}
                        className="w-full py-4 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Об'єднати та Видалити старого"}
                    </button>
                </div>
            </div>
        </div>
    );
}
