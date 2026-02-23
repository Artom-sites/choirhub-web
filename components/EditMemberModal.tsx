"use client";

import { useState, useEffect } from "react";
import { ChoirMember, UserRole } from "@/types";
import { X, Trash2, Save, Merge } from "lucide-react";
import ConfirmationModal from "./ConfirmationModal";

interface EditMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: ChoirMember | null;
    onSave: (member: ChoirMember) => Promise<void>;
    onDelete?: (memberId: string) => Promise<void>;
    onMergeClick?: (member: ChoirMember) => void;
}

export default function EditMemberModal({ isOpen, onClose, member, onSave, onDelete, onMergeClick }: EditMemberModalProps) {
    const [name, setName] = useState("");
    const [role, setRole] = useState<UserRole>('member');
    const [voice, setVoice] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (member) {
            setName(member.name);
            setRole(member.role);
            setVoice(member.voice || "");
        } else {
            setName("");
            setRole('member');
            setVoice("");
        }
    }, [member, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        try {
            await onSave({
                id: member?.id || `manual_${Date.now()}`,
                name: name.trim(),
                role,
                voice: voice as any || undefined
            });
            onClose();
        } catch (error) {
            console.error(error);
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
                <div className="bg-surface border border-border w-full max-w-sm p-6 rounded-3xl shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-text-primary">
                            {isEditing ? "Редагувати учасника" : "Новий учасник"}
                        </h3>
                        <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name */}
                        <div>
                            <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">Ім'я та Прізвище</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Ім'я та Прізвище..."
                                className="w-full p-3 bg-surface-highlight text-text-primary border border-border rounded-xl focus:border-text-secondary/50 focus:bg-surface outline-none transition-all"
                            />
                        </div>

                        {/* Role */}
                        <div>
                            <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">Роль</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRole('member')}
                                    className={`p-3 rounded-xl text-sm font-bold transition-all ${role === 'member' ? 'bg-primary text-background' : 'bg-surface-highlight text-text-secondary hover:bg-surface-highlight/80'}`}
                                >
                                    Хорист
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('regent')}
                                    className={`p-3 rounded-xl text-sm font-bold transition-all ${role === 'regent' ? 'bg-primary text-background' : 'bg-surface-highlight text-text-secondary hover:bg-surface-highlight/80'}`}
                                >
                                    Регент
                                </button>
                            </div>
                        </div>

                        {/* Voice */}
                        <div>
                            <label className="text-xs text-text-secondary uppercase font-bold mb-2 block">Партія (Голос)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Soprano', 'Alto', 'Tenor', 'Bass'].map((v) => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => setVoice(voice === v ? "" : v)}
                                        className={`p-3 rounded-xl text-sm font-bold transition-all ${voice === v ? 'bg-primary text-background' : 'bg-surface-highlight text-text-secondary hover:bg-surface-highlight/80'}`}
                                    >
                                        {v === 'Soprano' ? 'Сопрано' : v === 'Alto' ? 'Альт' : v === 'Tenor' ? 'Тенор' : 'Бас'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            {isEditing && onDelete && (
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"
                                    title="Видалити"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                            {isEditing && onMergeClick && (
                                <button
                                    type="button"
                                    onClick={() => onMergeClick(member)}
                                    className="p-3 bg-purple-500/10 text-purple-500 rounded-xl hover:bg-purple-500/20 transition-colors"
                                    title="Об'єднати дублікат"
                                >
                                    <Merge className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading || !name.trim()}
                                className="flex-1 p-3 bg-primary text-background rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                            >
                                {loading ? <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Зберегти</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Видалити учасника?"
                message={`Ви впевнені, що хочете видалити ${name}? Цю дію не можна скасувати.`}
                confirmLabel="Видалити"
                isDestructive
            />
        </>
    );
}
