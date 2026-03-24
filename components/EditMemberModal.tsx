"use client";

import { useState, useEffect } from "react";
import { ChoirMember, UserRole } from "@/types";
import { X, Trash2, Save, Merge, Plus } from "lucide-react";
import ConfirmationModal from "./ConfirmationModal";
import { useTranslation, TranslationKey } from "@/contexts/TranslationContext";

interface EditMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: ChoirMember | null;
    onSave: (member: ChoirMember) => Promise<void>;
    onDelete?: (memberId: string) => Promise<void>;
    onMergeClick?: (member: ChoirMember) => void;
}

export default function EditMemberModal({ isOpen, onClose, member, onSave, onDelete, onMergeClick }: EditMemberModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [role, setRole] = useState<UserRole>('member');
    const [roleLabel, setRoleLabel] = useState("");
    const [showCustomRole, setShowCustomRole] = useState(false);
    const [voice, setVoice] = useState<string>("");
    const [showCustomVoice, setShowCustomVoice] = useState(false);
    const [customVoice, setCustomVoice] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const standardVoices = ['Soprano', 'Alto', 'Tenor', 'Bass'];
    const voiceLabelKeys: Record<string, TranslationKey> = {
        Soprano: 'members.voice_soprano',
        Alto: 'members.voice_alto',
        Tenor: 'members.voice_tenor',
        Bass: 'members.voice_bass'
    };

    useEffect(() => {
        if (member) {
            setName(member.name);
            setRole(member.role);
            setRoleLabel(member.roleLabel || "");
            setShowCustomRole(!!(member.roleLabel && member.roleLabel !== 'Регент' && member.roleLabel !== 'Керівник'));

            const v = member.voice || "";
            if (v && !standardVoices.includes(v)) {
                // Custom voice
                setVoice("");
                setCustomVoice(v);
                setShowCustomVoice(true);
            } else {
                setVoice(v);
                setCustomVoice("");
                setShowCustomVoice(false);
            }
        } else {
            setName("");
            setRole('member');
            setRoleLabel("");
            setShowCustomRole(false);
            setVoice("");
            setCustomVoice("");
            setShowCustomVoice(false);
        }
        setError(null);
    }, [member, isOpen]);

    if (!isOpen) return null;

    const effectiveVoice = showCustomVoice ? customVoice.trim() : voice;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
            setError(t('members.error_name_req'));
            return;
        }
        setLoading(true);
        try {
            await onSave({
                id: member?.id || `manual_${Date.now()}`,
                name: name.trim(),
                role,
                roleLabel: showCustomRole ? roleLabel.trim() : undefined,
                voice: effectiveVoice ? (effectiveVoice as any) : undefined
            });
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('members.error_saving'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!member?.id || !onDelete) return;
        setLoading(true);
        await onDelete(member.id);
        setShowDeleteConfirm(false);
        onClose();
        setLoading(false);
    };

    const isEditing = !!member;

    return (
        <>
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-surface border border-border w-full max-w-sm p-6 rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-text-primary">
                            {isEditing ? t('members.edit_title') : t('members.new_title')}
                        </h3>
                        <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name */}
                        <div>
                            <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">{t('members.name_label')}</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder={t('members.name_placeholder')}
                                className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl focus:border-text-secondary/50 focus:bg-surface outline-none transition-all"
                            />
                        </div>

                        {/* Role */}
                        <div>
                            <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">{t('members.role_label')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setRole('member'); setShowCustomRole(false); setRoleLabel(""); }}
                                    className={`p-3 rounded-xl text-sm font-bold transition-all ${role === 'member' && !showCustomRole ? 'bg-primary text-background' : 'bg-surface-highlight text-text-secondary hover:bg-surface-highlight/80'}`}
                                >
                                    {t('members.role_chorist')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setRole('regent'); setShowCustomRole(false); setRoleLabel(""); }}
                                    className={`p-3 rounded-xl text-sm font-bold transition-all ${role === 'regent' && !showCustomRole ? 'bg-primary text-background' : 'bg-surface-highlight text-text-secondary hover:bg-surface-highlight/80'}`}
                                >
                                    {t('members.role_regent')}
                                </button>
                            </div>
                            {/* Custom Role Toggle */}
                            {!showCustomRole ? (
                                <button
                                    type="button"
                                    onClick={() => setShowCustomRole(true)}
                                    className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    {t('members.role_other')}
                                </button>
                            ) : (
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={roleLabel}
                                        onChange={e => setRoleLabel(e.target.value)}
                                        placeholder={t('members.role_placeholder')}
                                        className="flex-1 p-2.5 bg-surface-highlight text-text-primary border border-primary/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setShowCustomRole(false); setRoleLabel(""); }}
                                        className="p-2.5 text-text-secondary hover:text-text-primary bg-surface-highlight rounded-xl border border-border"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Voice */}
                        <div>
                            <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">{t('members.voice_label')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                {standardVoices.map((v) => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => {
                                            setVoice(voice === v ? "" : v);
                                            setShowCustomVoice(false);
                                            setCustomVoice("");
                                        }}
                                        className={`p-3 rounded-xl text-sm font-bold transition-all ${voice === v && !showCustomVoice ? 'bg-primary text-background' : 'bg-surface-highlight text-text-secondary hover:bg-surface-highlight/80'}`}
                                    >
                                        {t(voiceLabelKeys[v])}
                                    </button>
                                ))}
                            </div>
                            {/* Custom Voice Toggle */}
                            {!showCustomVoice ? (
                                <button
                                    type="button"
                                    onClick={() => { setShowCustomVoice(true); setVoice(""); }}
                                    className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    {t('members.voice_other')}
                                </button>
                            ) : (
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={customVoice}
                                        onChange={e => setCustomVoice(e.target.value)}
                                        placeholder={t('members.voice_placeholder')}
                                        className="flex-1 p-2.5 bg-surface-highlight text-text-primary border border-primary/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setShowCustomVoice(false); setCustomVoice(""); }}
                                        className="p-2.5 text-text-secondary hover:text-text-primary bg-surface-highlight rounded-xl border border-border"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-xl mt-4">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 mt-6">
                            {isEditing && onDelete && (
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"
                                    title={t('members.delete_tooltip')}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                            {isEditing && onMergeClick && (
                                <button
                                    type="button"
                                    onClick={() => onMergeClick(member)}
                                    className="p-3 bg-purple-500/10 text-purple-500 rounded-xl hover:bg-purple-500/20 transition-colors"
                                    title={t('members.merge_tooltip')}
                                >
                                    <Merge className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading || !name.trim()}
                                className="flex-1 p-3 bg-primary text-background rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                            >
                                {loading ? <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> {t('common.save')}</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title={t('members.delete_title')}
                message={t('members.delete_confirm', { name })}
                confirmLabel={t('songs.add.delete')}
                isDestructive
            />
        </>
    );
}
