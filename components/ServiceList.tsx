"use client";

import { useState, useEffect } from "react";
import { Service } from "@/types";
import { getServices, addService, deleteService } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Plus, ChevronRight, X, Trash2, Loader2 } from "lucide-react";

interface ServiceListProps {
    onSelectService: (service: Service) => void;
    canEdit: boolean;
}

export default function ServiceList({ onSelectService, canEdit }: ServiceListProps) {
    const { userData } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Create form
    const [newTitle, setNewTitle] = useState("Служіння");
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        refreshServices();
    }, [userData?.choirId]);

    const refreshServices = async () => {
        if (!userData?.choirId) return;
        setLoading(true);
        const fetched = await getServices(userData.choirId);
        setServices(fetched);
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!userData?.choirId) return;

        await addService(userData.choirId, {
            title: newTitle,
            date: newDate,
            songs: []
        });

        setShowCreateModal(false);
        setNewTitle("Служіння");
        setNewDate(new Date().toISOString().split('T')[0]);
        refreshServices();
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!userData?.choirId) return;

        if (confirm("Видалити це служіння?")) {
            await deleteService(userData.choirId, id);
            refreshServices();
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('uk-UA', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        }).format(date);
    };

    const isToday = (dateStr: string) => {
        const today = new Date().toISOString().split('T')[0];
        return dateStr === today;
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-white/20" /></div>;
    }

    return (
        <div className="max-w-md mx-auto px-4 py-4 space-y-6 pb-24">

            {/* Upcoming Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest pl-2">Найближчі служіння</h2>
                {canEdit && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="text-black bg-white hover:bg-gray-200 p-2 rounded-xl transition-colors shadow-lg shadow-white/10"
                        title="Додати служіння"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                )}
            </div>

            {services.length === 0 ? (
                <div className="text-center py-20 bg-surface/30 rounded-3xl border border-white/5 mx-2">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white/50">
                        <Calendar className="w-8 h-8" />
                    </div>
                    <p className="text-text-secondary font-medium">Немає запланованих служінь</p>
                    {canEdit && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-6 px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors font-medium text-sm border border-white/5"
                        >
                            Створити перше
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {services.map(service => (
                        <div
                            key={service.id}
                            onClick={() => onSelectService(service)}
                            className={`relative group p-5 rounded-2xl border transition-all cursor-pointer overflow-hidden ${isToday(service.date) ? 'bg-white/10 border-white/20' : 'bg-surface border-white/5 hover:border-white/10'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isToday(service.date) ? 'text-white' : 'text-text-secondary'}`}>
                                        {isToday(service.date) ? 'Сьогодні' : formatDate(service.date)}
                                    </p>
                                    <h3 className="text-xl font-bold text-white mb-2">{service.title}</h3>

                                    <div className="flex items-center gap-2">
                                        <div className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${isToday(service.date) ? 'bg-white text-black border-white' : 'bg-white/5 text-text-secondary border-white/5'}`}>
                                            {service.songs.length} пісень
                                        </div>
                                    </div>
                                </div>

                                <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white transition-colors" />
                            </div>

                            {canEdit && (
                                <button
                                    onClick={(e) => handleDelete(e, service.id)}
                                    className="absolute top-4 right-4 p-2 text-text-secondary hover:text-red-500 hover:bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#18181b] w-full max-w-sm rounded-3xl border border-white/10 p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Нове служіння</h3>
                            <button onClick={() => setShowCreateModal(false)}>
                                <X className="w-6 h-6 text-text-secondary hover:text-white" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Назва</label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Дата</label>
                                <input
                                    type="date"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30 appearance-none"
                                />
                            </div>

                            <button
                                onClick={handleCreate}
                                className="w-full py-4 bg-white text-black font-bold rounded-xl mt-4 hover:bg-gray-200 transition-colors"
                            >
                                Створити
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
