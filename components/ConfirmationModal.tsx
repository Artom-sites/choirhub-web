"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Dialog } from "@capacitor/dialog";
import { hapticLight, hapticSuccess, hapticWarning } from "../hooks/useHaptics";

if (typeof window !== "undefined") {
    (window as any).__destructiveConfirmCallback = (id: string, value: boolean) => {
        const callback = (window as any)[`__destructiveCb_${id}`];
        if (callback) {
            callback(value);
            delete (window as any)[`__destructiveCb_${id}`];
        }
    };
}

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Підтвердити",
    cancelLabel = "Скасувати",
    isDestructive = false
}: ConfirmationModalProps) {
    const [isNativeRendering, setIsNativeRendering] = useState(false);
    
    // Use refs for callbacks to prevent re-triggering Native Dialog on re-renders
    const onCloseRef = useRef(onClose);
    const onConfirmRef = useRef(onConfirm);
    
    useEffect(() => {
        onCloseRef.current = onClose;
        onConfirmRef.current = onConfirm;
    }, [onClose, onConfirm]);

    useEffect(() => {
        if (isOpen && Capacitor.isNativePlatform()) {
            setIsNativeRendering(true);
            hapticLight();
            
            let messageStr = "Ви впевнені, що хочете виконати цю дію?";
            if (typeof message === 'string') {
                messageStr = message;
            } else if (message && typeof (message as any).props?.children === 'string') {
                messageStr = (message as any).props.children;
            }

            if (isDestructive && (window as any).webkit?.messageHandlers?.destructiveConfirm) {
                const callbackId = Math.random().toString(36).substring(7);
                (window as any)[`__destructiveCb_${callbackId}`] = (value: boolean) => {
                    if (value) {
                         hapticWarning();
                         onConfirmRef.current();
                    } else {
                         onCloseRef.current();
                    }
                };
                
                (window as any).webkit.messageHandlers.destructiveConfirm.postMessage({
                    title,
                    message: messageStr,
                    okButtonTitle: confirmLabel,
                    cancelButtonTitle: cancelLabel,
                    callbackId
                });
                return;
            }

            Dialog.confirm({
                title,
                message: messageStr,
                okButtonTitle: confirmLabel,
                cancelButtonTitle: cancelLabel
            }).then(({ value }) => {
                if (value) {
                    if (isDestructive) hapticWarning();
                    else hapticSuccess();
                    
                    onConfirmRef.current();
                } else {
                    onCloseRef.current();
                }
            }).catch((e) => {
                console.error("Native dialog error:", e);
                onCloseRef.current();
            });
        }
    }, [isOpen, title, message, confirmLabel, cancelLabel, isDestructive]);

    const isClientNative = typeof window !== "undefined" && Capacitor.isNativePlatform();

    if (!isOpen) return null;
    // Fix flash: Completely prevent web DOM rendering if we are on native iOS/Android
    if (isClientNative) return null; 

    return (
        <div
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-surface w-full max-w-sm rounded-3xl border border-border p-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Icon */}
                {isDestructive && (
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                )}

                <h3 className="text-xl font-bold text-text-primary text-center mb-2">{title}</h3>
                <div className="text-text-secondary text-center mb-8">{message}</div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${isDestructive
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-primary hover:opacity-90 text-background"
                            }`}
                    >
                        {isDestructive && <Trash2 className="w-4 h-4" />}
                        {confirmLabel}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-surface-highlight border border-border text-text-primary rounded-2xl hover:bg-surface-highlight/80 transition-colors font-medium"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
