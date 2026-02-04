"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { ToolType } from './AnnotationToolbar';

interface AnnotationCanvasProps {
    pageNumber: number;
    pdfUrl: string; // Used as key for storage
    width: number;
    height: number;
    activeTool: ToolType;
    color: string;
    onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
    triggerClear: number; // Increment to trigger clear
    triggerUndo: number; // Increment to trigger undo
    triggerRedo: number; // Increment to trigger redo
}

interface Point {
    x: number;
    y: number;
    pressure?: number;
}

interface Stroke {
    tool: ToolType;
    color: string;
    width: number;
    points: Point[]; // Normalized 0..1
}

export default function AnnotationCanvas({
    pageNumber,
    pdfUrl,
    width,
    height,
    activeTool,
    color,
    onHistoryChange,
    triggerClear,
    triggerUndo,
    triggerRedo
}: AnnotationCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [redoStack, setRedoStack] = useState<Stroke[]>([]);
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    // Storage Key: unique per PDF and Page
    const storageKey = `annotations_${btoa(pdfUrl).slice(0, 32)}_p${pageNumber}`;

    // Load from storage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                setStrokes(parsed);
                // Clear redo stack on load
                setRedoStack([]);
            }
        } catch (e) {
            console.error("Failed to load annotations", e);
        }
    }, [storageKey]);

    // Save to storage
    useEffect(() => {
        if (strokes.length > 0) {
            try {
                // Simplify or compress if needed, for now raw JSON
                localStorage.setItem(storageKey, JSON.stringify(strokes));
            } catch (e) {
                console.error("Storage limit reached?", e);
            }
        } else {
            // If empty, remove key to save space
            localStorage.removeItem(storageKey);
        }

        // Notify parent about history state
        onHistoryChange(strokes.length > 0, redoStack.length > 0);
    }, [strokes, redoStack, storageKey, onHistoryChange]);

    // Handle External Triggers
    useEffect(() => {
        if (triggerClear > 0) {
            setStrokes([]);
            setRedoStack([]);
        }
    }, [triggerClear]);

    // Track previous trigger values with refs to avoid running on first mount
    const prevUndoRef = useRef(triggerUndo);
    const prevRedoRef = useRef(triggerRedo);
    // Store latest state in refs for access inside effects
    const strokesRef = useRef(strokes);
    const redoStackRef = useRef(redoStack);

    // Keep refs updated
    useEffect(() => {
        strokesRef.current = strokes;
    }, [strokes]);

    useEffect(() => {
        redoStackRef.current = redoStack;
    }, [redoStack]);

    useEffect(() => {
        if (triggerUndo !== prevUndoRef.current) {
            prevUndoRef.current = triggerUndo;
            const currentStrokes = strokesRef.current;
            if (currentStrokes.length > 0) {
                const newStrokes = [...currentStrokes];
                const removed = newStrokes.pop();
                if (removed) {
                    setStrokes(newStrokes);
                    setRedoStack(prev => [...prev, removed]);
                }
            }
        }
    }, [triggerUndo]);

    useEffect(() => {
        if (triggerRedo !== prevRedoRef.current) {
            prevRedoRef.current = triggerRedo;
            const currentRedo = redoStackRef.current;
            if (currentRedo.length > 0) {
                const newRedo = [...currentRedo];
                const toRestore = newRedo.pop();
                if (toRestore) {
                    setStrokes(prev => [...prev, toRestore]);
                    setRedoStack(newRedo);
                }
            }
        }
    }, [triggerRedo]);

    // Drawing Logic (Rendering)
    const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
        if (stroke.points.length < 2) return;

        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke.color;

        if (stroke.tool === 'marker') {
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = stroke.width * width * 3; // Thicker relative to width
            // Optimization: Marker behind text? Canvas is on top. 
            // We use multiply blending for marker usually, but simple alpha is okay for MVP
            ctx.globalCompositeOperation = 'multiply';
        } else if (stroke.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = stroke.width * width * 2;
            ctx.globalAlpha = 1;
        } else {
            // Pen
            ctx.globalAlpha = 1;
            ctx.lineWidth = stroke.width * width;
            ctx.globalCompositeOperation = 'source-over';
        }

        // Draw path
        if (stroke.points.length < 2) return;

        ctx.beginPath();
        const first = stroke.points[0];
        ctx.moveTo(first.x * width, first.y * height);

        // Smoothing using quadratic curves
        let i = 0;
        for (i = 1; i < stroke.points.length - 2; i++) {
            const c = (stroke.points[i].x * width);
            const d = (stroke.points[i].y * height);
            const e = (stroke.points[i + 1].x * width);
            const f = (stroke.points[i + 1].y * height);

            // Midpoint
            const midX = (c + e) / 2;
            const midY = (d + f) / 2;

            ctx.quadraticCurveTo(c, d, midX, midY);
        }

        // Last few points
        for (; i < stroke.points.length; i++) {
            const p = stroke.points[i];
            ctx.lineTo(p.x * width, p.y * height);
        }

        ctx.stroke();
    };

    // Render Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Use round cap/join for smoother strokes
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw all saved strokes
        strokes.forEach(s => drawStroke(ctx, s));

        // Draw current stroke being drawn
        if (currentStroke) {
            drawStroke(ctx, currentStroke);
        }

    }, [strokes, currentStroke, width, height]);


    // Event Handlers
    const getPoint = (e: React.PointerEvent): Point => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return {
            x: Number(((e.clientX - rect.left) / width).toFixed(4)), // Optimize storage
            y: Number(((e.clientY - rect.top) / height).toFixed(4)),
            pressure: e.pressure
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault(); // Prevent scrolling
        if (activeTool === 'none' as ToolType) return; // Should not happen if overlay is hidden

        canvasRef.current?.setPointerCapture(e.pointerId);
        setIsDrawing(true);

        const startPoint = getPoint(e);

        setCurrentStroke({
            tool: activeTool,
            color: activeTool === 'eraser' ? '#000000' : color, // Eraser color doesn't matter
            width: activeTool === 'pen' ? 0.003 : 0.02, // Relative width
            points: [startPoint]
        });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        // Always track cursor for eraser indicator
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }

        if (!isDrawing || !currentStroke) return;
        e.preventDefault();

        const point = getPoint(e);
        setCurrentStroke(prev => ({
            ...prev!,
            points: [...prev!.points, point]
        }));
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDrawing || !currentStroke) return;

        canvasRef.current?.releasePointerCapture(e.pointerId);
        setIsDrawing(false);

        // Add to history
        setStrokes(prev => [...prev, currentStroke]);
        setRedoStack([]); // Clear redo on new action
        setCurrentStroke(null);
    };

    const eraserSize = width * 0.02 * 2; // Match eraser stroke width

    return (
        <>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="absolute inset-0 z-20 touch-none"
                style={{ width, height, cursor: activeTool === 'eraser' ? 'none' : 'crosshair' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={(e) => { handlePointerUp(e); setCursorPos(null); }}
            />
            {/* Eraser cursor indicator */}
            {activeTool === 'eraser' && cursorPos && (
                <div
                    className="absolute pointer-events-none z-30 rounded-full border-2 border-gray-800 bg-white/30"
                    style={{
                        width: eraserSize,
                        height: eraserSize,
                        left: cursorPos.x - eraserSize / 2,
                        top: cursorPos.y - eraserSize / 2,
                    }}
                />
            )}
        </>
    );
}

