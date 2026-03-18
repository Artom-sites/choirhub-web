"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Music2, Calendar, BarChart3, Users } from "lucide-react";

interface IntroSlide {
    id: number;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    image: string; // Path to mockup image
}

const slides: IntroSlide[] = [
    {
        id: 0,
        title: "Керуйте хором легко",
        subtitle: "Все для роботи з хором",
        description: "Організовуйте репертуар, плануйте служіння та відстежуйте явку в одному зручному додатку.",
        icon: <Music2 className="w-6 h-6" />,
        color: "from-blue-500/20 to-transparent",
        image: "/apple-touch-icon.png" // Temporary placeholder until real screenshots are generated/referenced
    },
    {
        id: 1,
        title: "Репертуар в одному місці",
        subtitle: "Ваші пісні завжди під рукою",
        description: "Миттєвий пошук, зручні списки та доступ до PDF-нот навіть без інтернету.",
        icon: <Music2 className="w-6 h-6" />,
        color: "from-emerald-500/20 to-transparent",
        image: "/apple-touch-icon.png"
    },
    {
        id: 2,
        title: "Планування служінь",
        subtitle: "Будьте в курсі розкладу",
        description: "Створюйте програми, призначайте пісні та отримуйте підтвердження присутності від хористів.",
        icon: <Calendar className="w-6 h-6" />,
        color: "from-amber-500/20 to-transparent",
        image: "/apple-touch-icon.png"
    }
];

interface StorytellingIntroProps {
    onComplete: () => void;
}

export default function StorytellingIntro({ onComplete }: StorytellingIntroProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [direction, setDirection] = useState(0);

    const nextSlide = () => {
        if (currentSlide === slides.length - 1) {
            onComplete();
        } else {
            setDirection(1);
            setCurrentSlide((prev) => prev + 1);
        }
    };

    const skipIntro = () => onComplete();

    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 1000 : -1000,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 1000 : -1000,
            opacity: 0
        })
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#09090b] text-white flex flex-col overflow-hidden font-sans">
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-b ${slides[currentSlide].color} transition-colors duration-1000 opacity-40`} />
            
            {/* Top Navigation */}
            <div className="relative z-10 flex justify-between items-center p-6 pt-safe">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
                        <img src="/apple-touch-icon.png" alt="Logo" className="w-6 h-6 rounded-md" />
                    </div>
                    <span className="font-bold tracking-tight text-lg">MyChoir</span>
                </div>
                <button 
                    onClick={skipIntro}
                    className="text-white/40 hover:text-white transition-colors text-sm font-medium uppercase tracking-widest"
                >
                    Пропустити
                </button>
            </div>

            {/* Content Slider */}
            <div className="flex-1 relative">
                <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                        key={currentSlide}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                        }}
                        className="absolute inset-0 flex flex-col items-center p-8 text-center"
                    >
                        {/* Text Content */}
                        <div className="mt-4 max-w-sm">
                            <motion.h2 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-3xl sm:text-4xl font-bold tracking-tight mb-2"
                            >
                                {slides[currentSlide].title}
                            </motion.h2>
                            <motion.p 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-white/60 text-lg mb-4"
                            >
                                {slides[currentSlide].subtitle}
                            </motion.p>
                        </div>

                        {/* Device Mockup Visualization */}
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.8, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 40 }}
                            transition={{ delay: 0.4, type: "spring", damping: 20 }}
                            className="relative flex-1 w-full max-w-[280px]"
                        >
                            {/* iPhone Frame Mockup (Simplified CSS) */}
                            <div className="w-full aspect-[9/19.5] bg-[#18181b] rounded-[48px] border-[8px] border-[#27272a] shadow-2xl relative overflow-hidden">
                                {/* Screen Content */}
                                <div className="absolute inset-0 p-2 pt-8">
                                    <div className="w-full h-full rounded-[32px] bg-zinc-950 overflow-hidden relative">
                                        <img 
                                            src={slides[currentSlide].image} 
                                            alt="App Screenshot" 
                                            className="w-full h-full object-cover opacity-80"
                                        />
                                        {/* Dynamic Feature Overlay based on slide */}
                                        <div className="absolute bottom-4 left-4 right-4 bg-zinc-900/90 backdrop-blur-md rounded-2xl p-4 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary">
                                                    {slides[currentSlide].icon}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-xs font-bold uppercase tracking-widest text-white/40">Функція</div>
                                                    <div className="text-sm font-semibold">{slides[currentSlide].subtitle}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Dynamic Island / Notch */}
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full" />
                            </div>

                            {/* Decorative Background Glow */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/20 blur-[100px] -z-10" />
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom Controls */}
            <div className="relative z-10 p-8 pb-safe-offset space-y-6">
                {/* Dots Indicator */}
                <div className="flex justify-center gap-2">
                    {slides.map((slide) => (
                        <div 
                            key={slide.id}
                            className={`h-1.5 transition-all duration-300 rounded-full ${
                                currentSlide === slide.id ? "w-8 bg-white" : "w-1.5 bg-white/20"
                            }`}
                        />
                    ))}
                </div>

                {/* Main Action Button */}
                <button
                    onClick={nextSlide}
                    className="w-full py-5 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-white/5"
                >
                    <span className="text-lg">
                        {currentSlide === slides.length - 1 ? "Почати роботу" : "Продовжити"}
                    </span>
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
