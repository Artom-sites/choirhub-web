"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChoirMember } from "@/types";
import { X, Merge, AlertTriangle, Loader2, Link2, Search, Check, ChevronDown, Plus, User } from "lucide-react";
import Fuse from 'fuse.js';

interface MergeMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceMember: ChoirMember;
    allMembers: ChoirMember[];
    onMerge: (targetMemberId: string) => Promise<void>;
    onCreateNew?: (sourceMember: ChoirMember) => void;
    mode?: 'merge' | 'link';
}

export default function MergeMemberModal({ isOpen, onClose, sourceMember, allMembers, onMerge, onCreateNew, mode = 'merge' }: MergeMemberModalProps) {
    const [targetId, setTargetId] = useState("");
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    const isLink = mode === 'link';

    // For link mode: show members EXCEPT "unassigned app users" (auto-joined accounts without a voice/processing). This allows merging a 2nd device into an already linked profile.
    // For merge mode: show all except the source member.
    const availableTargets = useMemo(() => {
        let targets = allMembers.filter(m => m.id !== sourceMember.id && !(m as any).isDuplicate);

        if (isLink) {
            // An "unassigned app user" is an auto-created member (hasAccount) that hasn't been processed
            // by an admin yet (no voice assigned, no additional devices linked).
            targets = targets.filter(m => {
                // Completely hide "Unknown" or unnamed users from the target list
                if (!m.name || m.name.trim() === "" || m.name.trim().toLowerCase() === "unknown") {
                    return false;
                }

                const isUnassigned = m.hasAccount && !m.voice && (!m.linkedUserIds || m.linkedUserIds.length === 0);
                return !isUnassigned;
            });
        }

        // Deduplicate to avoid React key errors and visual duplicates
        targets = Array.from(new Map(targets.map(m => [m.id, m])).values());

        if (searchQuery.trim()) {
            const fuse = new Fuse(targets, {
                keys: ['name', 'voice', 'role'],
                threshold: 0.3,
                ignoreLocation: true,
                minMatchCharLength: 2,
            });
            targets = fuse.search(searchQuery).map(r => r.item);
        }
        return targets;
    }, [allMembers, sourceMember.id, isLink, searchQuery]);

    const targetMember = useMemo(() => allMembers.find(m => m.id === targetId), [allMembers, targetId]);

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
            <div className="bg-[#18181b] border border-white/10 w-full max-w-md p-6 rounded-3xl shadow-2xl relative">
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

                <div className="space-y-4">
                    {/* Compact context text explaining the action clearly without bulky boxes */}
                    <div className="text-sm text-text-secondary leading-relaxed px-1">
                        {isLink ? (
                            <>Оберіть профіль учасника, до якого потрібно прив&#39;язати акаунт <strong className="text-white">{sourceMember.name}</strong>.</>
                        ) : (
                            <>Оберіть профіль, з яким потрібно об&#39;єднати обліковий запис <strong className="text-white">{sourceMember.name}</strong>. Дані будуть об&#39;єднані.</>
                        )}
                    </div>

                    {/* Search Area */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input
                                type="text"
                                placeholder={isLink ? "Пошук учасника в списку хору..." : "Кого шукаємо?..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-10 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-text-secondary focus:ring-1 focus:ring-background/10 transition-shadow"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-text-secondary hover:text-white rounded-full hover:bg-surface-highlight transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        {onCreateNew && (
                            <button
                                type="button"
                                onClick={() => { onClose(); onCreateNew(sourceMember); }}
                                className="h-[46px] px-4 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl flex items-center justify-center transition-colors flex-shrink-0 border border-primary/20"
                                title="Створити нового учасника"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Scrollable Member List */}
                    <div className="flex flex-col h-[40vh] min-h-[250px] border border-border/60 rounded-xl bg-surface overflow-hidden">
                        <div className="overflow-y-auto w-full custom-scrollbar flex-1">
                            {availableTargets.length > 0 ? (
                                availableTargets.map(m => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setTargetId(m.id)}
                                        className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-surface-highlight transition-colors ${targetId === m.id ? 'bg-primary/10' : ''}`}
                                    >
                                        <div className="flex flex-col">
                                            <span className={`font-medium ${targetId === m.id ? 'text-primary' : 'text-text-primary'}`}>{m.name}</span>
                                            {(m.voice || m.role) && (
                                                <span className="text-xs text-text-secondary mt-0.5 max-w-[200px] truncate">
                                                    {[
                                                        m.role === 'regent' ? 'Регент' : '',
                                                        m.voice ? m.voice : ''
                                                    ].filter(Boolean).join(' • ')}
                                                </span>
                                            )}
                                        </div>
                                        {m.hasAccount && (
                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0" title="Вже має акаунт">
                                                <Check className="w-4 h-4 text-primary" />
                                            </div>
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className="p-4 text-center text-text-secondary text-sm">Нічого не знайдено</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border/50">
                    <button
                        onClick={handleMerge}
                        disabled={!targetId || loading}
                        className={`w-full py-4 ${isLink ? 'bg-blue-500 hover:bg-blue-400' : 'bg-purple-500 hover:bg-purple-400'} text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]`}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLink ? "Прив'язати акаунт" : "Об'єднати профілі")}
                    </button>
                </div>
            </div>
        </div>
    );
}
