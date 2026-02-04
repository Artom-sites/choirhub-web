"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pen, Highlighter, Eraser, Undo, Redo, Trash2, ChevronDown, X, MoreHorizontal } from "lucide-react";

export type ToolType = 'pen' | 'marker' | 'eraser';

interface AnnotationToolbarProps {
    activeTool: ToolType;
    onToolChange: (tool: ToolType) => void;
    color: string;
    onColorChange: (color: string) => void;
    onUndo: () => void;
    onRedo: () => void;
    onClear: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onClose: () => void;
}

const COLORS = [
    { id: 'black', value: '#000000' },
    { id: 'blue', value: '#007AFF' },
    { id: 'red', value: '#FF3B30' },
    { id: 'green', value: '#34C759' },
];

export default function AnnotationToolbar({
    activeTool,
    onToolChange,
    color,
    onColorChange,
    onUndo,
    onRedo,
    onClear,
    canUndo,
    canRedo,
    onClose
}: AnnotationToolbarProps) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    // When minimized, show floating pen button
    if (isMinimized) {
        return (
            <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-zinc-900/90 backdrop-blur-xl rounded-full flex items-center justify-center text-white shadow-xl border border-white/10"
            >
                <Pen className="w-5 h-5" />
            </motion.button>
        );
    }

    return (
        <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[95vw]"
        >
            {/* Color Popover - rendered outside overflow container */}
            {showColorPicker && activeTool !== 'eraser' && (
                <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-1.5 bg-zinc-800 rounded-xl shadow-2xl border border-white/20 flex gap-1.5"
                    style={{ zIndex: 9999 }}
                >
                    {COLORS.slice(2).map((c) => (
                        <button
                            key={c.id}
                            onClick={() => {
                                onColorChange(c.value);
                                setShowColorPicker(false);
                            }}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${color === c.value
                                ? 'border-white scale-110'
                                : 'border-transparent opacity-80 hover:opacity-100'
                                }`}
                            style={{ backgroundColor: c.value }}
                            aria-label={c.id}
                        />
                    ))}
                </div>
            )}

            {/* Main Toolbar Capsule - compact for mobile with scroll support */}
            <div className="flex items-center gap-0.5 p-1.5 bg-zinc-900/90 backdrop-blur-xl rounded-full shadow-2xl border border-white/10 overflow-x-auto scrollbar-hide max-w-full">

                {/* Tools Group */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-white/10 shrink-0">
                    <ToolButton
                        isActive={activeTool === 'pen'}
                        onClick={() => onToolChange('pen')}
                        icon={<Pen className="w-4 h-4" />}
                        label="Pen"
                    />
                    <ToolButton
                        isActive={activeTool === 'marker'}
                        onClick={() => onToolChange('marker')}
                        icon={<Highlighter className="w-4 h-4" />}
                        label="Marker"
                    />
                    <ToolButton
                        isActive={activeTool === 'eraser'}
                        onClick={() => onToolChange('eraser')}
                        icon={<Eraser className="w-4 h-4" />}
                        label="Eraser"
                    />
                </div>

                {/* Colors Group (Only for Pen/Marker) */}
                {activeTool !== 'eraser' && (
                    <div className="flex items-center gap-1 px-1.5 border-r border-white/10 shrink-0">
                        {/* First 2 colors always visible */}
                        {COLORS.slice(0, 2).map((c) => (
                            <button
                                key={c.id}
                                onClick={() => {
                                    onColorChange(c.value);
                                    setShowColorPicker(false);
                                }}
                                className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${color === c.value
                                    ? 'border-white scale-110'
                                    : 'border-transparent opacity-70 hover:opacity-100'
                                    }`}
                                style={{ backgroundColor: c.value }}
                                aria-label={c.id}
                            />
                        ))}

                        {/* More Colors Button */}
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border-2 ${showColorPicker
                                ? 'border-white bg-white/20'
                                : 'border-white/30 hover:border-white/50'
                                }`}
                        >
                            <MoreHorizontal className="w-4 h-4 text-white" />
                        </button>
                    </div>
                )}

                {/* Actions Group */}
                <div className="flex items-center gap-0.5 pl-1 shrink-0">
                    <IconButton onClick={onUndo} disabled={!canUndo} icon={<Undo className="w-4 h-4" />} />
                    <IconButton onClick={onRedo} disabled={!canRedo} icon={<Redo className="w-4 h-4" />} />
                    <IconButton onClick={onClear} icon={<Trash2 className="w-4 h-4 text-red-400" />} title="Clear Page" />
                    <div className="w-px h-5 bg-white/10 mx-0.5" />
                    <IconButton onClick={() => setIsMinimized(true)} icon={<ChevronDown className="w-4 h-4" />} title="Minimize" />
                    <IconButton onClick={onClose} icon={<X className="w-4 h-4" />} title="Exit" />
                </div>

            </div>
        </motion.div>
    );
}

function ToolButton({ isActive, onClick, icon, label }: { isActive: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${isActive
                ? 'bg-white text-black shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
            title={label}
        >
            {icon}
        </button>
    );
}

function IconButton({ onClick, icon, disabled, title }: { onClick: () => void, icon: React.ReactNode, disabled?: boolean, title?: string }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${disabled
                ? 'opacity-30 cursor-not-allowed'
                : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
        >
            {icon}
        </button>
    );
}
