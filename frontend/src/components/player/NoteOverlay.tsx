import React from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb } from 'lucide-react';

export const NoteOverlay: React.FC = () => {
    const { currentTime, notes, settings } = usePlayerStore();
    const { enabled, duration, alignment, theme } = settings.notes;

    if (!enabled) return null;

    // Filter active notes
    const activeNotes = notes.filter(n => 
        currentTime >= n.timestamp && 
        currentTime <= n.timestamp + duration
    );

    if (activeNotes.length === 0) return null;

    // Theme Styles - Refined for compact look
    const themeStyles = {
        classic: {
            container: "bg-slate-900/95 text-white border-white/20 shadow-xl",
            iconBg: "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.3)]",
            iconColor: "text-slate-950"
        },
        cyber: {
            container: "bg-blue-600/30 text-blue-100 border-blue-500/40 backdrop-blur-md shadow-lg",
            iconBg: "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]",
            iconColor: "text-white"
        },
        amber: {
            container: "bg-amber-600/30 text-amber-100 border-amber-500/40 backdrop-blur-md shadow-lg",
            iconBg: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]",
            iconColor: "text-slate-950"
        },
        ghost: {
            container: "bg-transparent text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] border-transparent",
            iconBg: "bg-white/10 backdrop-blur-[2px]",
            iconColor: "text-yellow-400"
        }
    };

    // Alignment Container Classes - Clean Flexbox Logic
    const alignmentClasses = {
        topLeft: "items-start justify-start",
        topCenter: "items-start justify-center",
        topRight: "items-start justify-end",
        centerLeft: "items-center justify-start",
        center: "items-center justify-center",
        centerRight: "items-center justify-end",
        bottomLeft: "items-end justify-start",
        bottomCenter: "items-end justify-center",
        bottomRight: "items-end justify-end",
    };

    const isBottom = alignment.startsWith('bottom');
    const stackClass = isBottom ? "flex-col-reverse" : "flex-col";
    const currentTheme = themeStyles[theme] || themeStyles.classic;

    return (
        <div className={`absolute inset-0 pointer-events-none z-40 p-8 flex ${alignmentClasses[alignment]}`}>
            <div className={`flex ${stackClass} gap-2.5 max-w-[90%] md:max-w-[40%]`}>
                <AnimatePresence mode="popLayout">
                    {activeNotes.map((note) => (
                        <motion.div
                            key={note.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={`w-fit flex items-center gap-3 p-2 px-4 rounded-2xl border transition-all duration-700 pointer-events-auto relative overflow-hidden ${currentTheme.container}`}
                        >
                            {/* Glow Pulse Background effect */}
                            <motion.div 
                                animate={{ opacity: [0, 0.3, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className={`absolute inset-0 pointer-events-none blur-xl bg-current opacity-5`}
                            />

                            {/* Compact Icon Container */}
                            <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${currentTheme.iconBg}`}>
                                <Lightbulb size={16} className={currentTheme.iconColor} fill="currentColor" />
                            </div>

                            <div className="flex flex-col z-10">
                                <span className="text-[13px] md:text-sm font-bold leading-tight whitespace-pre-wrap">{note.content}</span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};
