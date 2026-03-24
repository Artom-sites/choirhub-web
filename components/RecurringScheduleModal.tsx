"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Calendar, Clock, Mic2, AlertCircle, Loader2, Save, ChevronRight, Settings } from "lucide-react";
import { RecurringSchedule, RecurringRule, ChoirMember } from "@/types";
import { getRecurringSchedule, saveRecurringSchedule, getChoir } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { motion, AnimatePresence } from "framer-motion";

interface RecurringScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    choirId: string;
}


export default function RecurringScheduleModal({ isOpen, onClose, choirId }: RecurringScheduleModalProps) {
    const { user, refreshProfile } = useAuth();
    const { t } = useTranslation();
    const DAYS = t('schedule.days').split(',');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rules, setRules] = useState<RecurringRule[]>([]);
    const [enabled, setEnabled] = useState(true);
    
    // For editing/adding
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<RecurringRule>>({});
    
    // For conductors autocomplete
    const [regents, setRegents] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        
        async function fetchData() {
            setLoading(true);
            try {
                // Proactively refresh profile/claims when opening settings
                // This prevents "permission-denied" if user roles were recently changed
                try {
                    await refreshProfile();
                } catch (e) {
                    console.warn("Failed to refresh profile during schedule open:", e);
                }

                const [schedule, choir] = await Promise.all([
                    getRecurringSchedule(choirId),
                    getChoir(choirId)
                ]);
                
                if (schedule) {
                    setRules(schedule.rules || []);
                    setEnabled(schedule.enabled ?? true);
                }
                
                if (choir) {
                    const list = Array.from(new Set([
                        ...(choir.regents || []),
                        ...(choir.knownConductors || []),
                        ...(choir.members?.filter((m: ChoirMember) => m.role === 'regent' || m.role === 'head' || m.role === 'admin').map((m: ChoirMember) => m.name) || [])
                    ])).filter(Boolean) as string[];
                    setRegents(list);
                }
            } catch (error) {
                console.error("Failed to fetch recurring schedule data:", error);
            } finally {
                setLoading(false);
            }
        }
        
        fetchData();
    }, [isOpen, choirId]);


    const handleSave = async () => {
        if (!user?.uid) return;
        setSaving(true);
        try {
            await saveRecurringSchedule(choirId, {
                rules,
                enabled,
                updatedAt: new Date().toISOString(), // Will be overwritten by serverTimestamp in db.ts anyway
                updatedBy: user.uid
            });
            onClose();
        } catch (error: any) {
            console.error("Failed to save schedule:", error);
            const { Dialog } = await import("@capacitor/dialog");
            
            if (error?.code === 'permission-denied') {
                await Dialog.alert({
                    title: t('schedule.error.access_title'),
                    message: t('schedule.error.access_msg')
                });
            } else {
                await Dialog.alert({
                    title: t('schedule.error.save_title'),
                    message: t('schedule.error.save_msg')
                });
            }
        } finally {
            setSaving(false);
        }
    };

    const addEmptyRule = () => {
        const newId = Math.random().toString(36).substring(2, 9);
        const newRule: RecurringRule = {
            id: newId,
            type: 'rehearsal',
            title: t('schedule.default_title.rehearsal'),
            dayOfWeek: 2, // Tuesday
            time: '18:00',
            enabled: true,
            warmupConductor: ''
        };
        setRules([...rules, newRule]);
        setEditingRuleId(newId);
        setEditForm(newRule);
    };

    const deleteRule = (id: string) => {
        setRules(rules.filter(r => r.id !== id));
        if (editingRuleId === id) setEditingRuleId(null);
    };

    const toggleRule = (id: string) => {
        setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    };

    const startEdit = (rule: RecurringRule) => {
        setEditingRuleId(rule.id);
        setEditForm({ ...rule });
    };

    const saveEdit = () => {
        if (!editingRuleId) return;
        setRules(rules.map(r => r.id === editingRuleId ? { ...r, ...editForm } as RecurringRule : r));
        setEditingRuleId(null);
        setEditForm({});
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-surface w-full max-w-lg rounded-[32px] border border-border shadow-2xl flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-text-primary">{t('schedule.title')}</h3>
                        <p className="text-sm text-text-secondary mt-1">{t('schedule.subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-highlight rounded-full transition-colors">
                        <X className="w-6 h-6 text-text-secondary" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-text-secondary text-sm">{t('schedule.loading')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Global Enable Toggle */}
                            <div className="flex items-center justify-between p-5 bg-surface/50 rounded-3xl border border-border/60 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${enabled ? 'bg-primary/10 text-primary shadow-inner' : 'bg-surface-highlight text-text-secondary'}`}>
                                        <Settings className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="font-bold text-text-primary block">{t('schedule.automation')}</span>
                                        <span className="text-[11px] text-text-secondary font-medium uppercase tracking-wider">{t('schedule.smart')}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setEnabled(!enabled)}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none border ${enabled ? 'bg-primary border-primary/50 shadow-lg shadow-primary/20' : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-300 ${enabled ? 'translate-x-6 scale-105' : 'translate-x-1 scale-90'}`} />
                                </button>
                            </div>

                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between px-1">
                                    <h4 className="text-[11px] font-extrabold text-text-secondary uppercase tracking-[0.2em] opacity-80">{t('schedule.your_schedule')}</h4>
                                    <button 
                                        onClick={addEmptyRule}
                                        className="py-1.5 px-3.5 bg-primary text-background rounded-full text-[11px] font-black flex items-center gap-1.5 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                                    >
                                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                        {t('schedule.add')}
                                    </button>
                                </div>

                                {rules.length === 0 ? (
                                    <div className="py-16 text-center border-2 border-dashed border-border/40 rounded-[32px] bg-surface/20">
                                        <div className="w-16 h-16 bg-surface-highlight rounded-3xl flex items-center justify-center mx-auto mb-4 border border-border/50">
                                            <Calendar className="w-8 h-8 text-text-secondary/40" />
                                        </div>
                                        <p className="text-text-secondary text-sm font-medium px-10">{t('schedule.empty')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {rules.map((rule) => (
                                            <div key={rule.id} className="group relative">
                                                {editingRuleId === rule.id ? (
                                                    <div className="p-5 bg-surface rounded-[28px] border-2 border-primary shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
                                                        {/* Segmented Control for Type */}
                                                        <div className="flex bg-surface-highlight border border-border/60 rounded-[18px] p-1 gap-1">
                                                            <button 
                                                                onClick={() => setEditForm({...editForm, type: 'rehearsal', title: t('schedule.default_title.rehearsal')})}
                                                                className={`flex-1 py-2.5 rounded-[14px] text-xs font-bold transition-all duration-200 ${editForm.type === 'rehearsal' ? 'bg-primary text-background shadow-md' : 'text-text-secondary hover:text-text-primary'}`}
                                                            >{t('schedule.type.rehearsal')}</button>
                                                            <button 
                                                                onClick={() => setEditForm({...editForm, type: 'service', title: t('schedule.default_title.service')})}
                                                                className={`flex-1 py-2.5 rounded-[14px] text-xs font-bold transition-all duration-200 ${editForm.type === 'service' ? 'bg-primary text-background shadow-md' : 'text-text-secondary hover:text-text-primary'}`}
                                                            >{t('schedule.type.service')}</button>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div>
                                                                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 mb-1.5 block opacity-70">{t('schedule.event_name')}</label>
                                                                <input 
                                                                    type="text" 
                                                                    value={editForm.title}
                                                                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                                                                    className="w-full h-13 px-4 bg-surface-highlight border border-border/60 rounded-xl text-sm font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                                    placeholder={t('schedule.event_placeholder')}
                                                                />
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 mb-1.5 block opacity-70">{t('schedule.day')}</label>
                                                                    <div className="relative h-13">
                                                                        <select 
                                                                            value={editForm.dayOfWeek}
                                                                            onChange={e => setEditForm({...editForm, dayOfWeek: Number(e.target.value)})}
                                                                            className="w-full h-full px-4 bg-surface-highlight border border-border/60 rounded-xl text-sm font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                                                        >
                                                                            {DAYS.map((day, i) => <option key={i} value={i}>{day}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 mb-1.5 block opacity-70">{t('schedule.time')}</label>
                                                                    <div className="relative h-13">
                                                                        <input 
                                                                            type="time" 
                                                                            value={editForm.time}
                                                                            onChange={e => setEditForm({...editForm, time: e.target.value})}
                                                                            className="w-full h-full px-4 bg-surface-highlight border border-border/60 rounded-xl text-sm font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 mb-1.5 block opacity-70">{t('schedule.warmup_conductor')}</label>
                                                                <div className="relative h-13">
                                                                    <select 
                                                                        value={editForm.warmupConductor}
                                                                        onChange={e => setEditForm({...editForm, warmupConductor: e.target.value})}
                                                                        className="w-full h-full pl-4 pr-10 bg-surface-highlight border border-border/60 rounded-xl text-sm font-bold text-text-primary appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                                                    >
                                                                        <option value="">{t('schedule.no_conductor')}</option>
                                                                        {regents.map((r, i) => <option key={i} value={r}>{r}</option>)}
                                                                    </select>
                                                                    <Mic2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary/60 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2.5 pt-1">
                                                            <button 
                                                                onClick={saveEdit}
                                                                className="flex-[3] h-12 bg-text-primary text-background rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-md"
                                                            >
                                                                {t('schedule.done')}
                                                            </button>
                                                            <button 
                                                                onClick={() => deleteRule(rule.id)}
                                                                className="flex-1 h-12 bg-danger/10 text-danger rounded-xl text-sm font-bold flex items-center justify-center border border-danger/10 hover:bg-danger/20 active:scale-[0.98] transition-all"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div 
                                                        onClick={() => startEdit(rule)}
                                                        className={`p-4.5 bg-surface-highlight border border-border/40 rounded-[28px] flex items-center justify-between cursor-pointer hover:border-primary/40 hover:bg-surface-highlight/70 transition-all active:scale-[0.99] ${!rule.enabled ? 'opacity-50 grayscale' : ''} shadow-sm group/card`}
                                                    >
                                                        <div className="flex items-center gap-5">
                                                            <div className="w-14 h-14 bg-surface border border-border/50 rounded-2xl flex flex-col items-center justify-center shadow-sm group-hover/card:border-primary/20 transition-colors">
                                                                <span className="text-[10px] font-black text-primary leading-none uppercase tracking-widest">{DAYS[rule.dayOfWeek]}</span>
                                                                <span className="text-sm font-black text-text-primary mt-1">{rule.time}</span>
                                                            </div>
                                                            <div>
                                                                <h5 className="font-bold text-text-primary text-[17px] leading-tight">{rule.title}</h5>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest px-1.5 py-0.5 bg-surface rounded-md border border-border/30">{t('schedule.every_week')}</span>
                                                                    {rule.warmupConductor && (
                                                                        <span className="text-[10px] text-primary/70 font-bold uppercase tracking-widest flex items-center gap-1">
                                                                            <Mic2 className="w-2.5 h-2.5" />
                                                                            {rule.warmupConductor}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-surface border border-border/30 group-hover/card:border-primary/30 group-hover/card:text-primary transition-all shadow-sm">
                                                                <ChevronRight className="w-5 h-5 opacity-40 group-hover/card:opacity-100 transform group-hover/card:translate-x-0.5 transition-all" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>


                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-2 border-t border-border/50 bg-surface rounded-b-[32px] flex gap-3">
                    <button 
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex-1 h-15 bg-text-primary text-background rounded-[22px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-background/10"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 stroke-[2.5]" />}
                        {t('schedule.save')}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
