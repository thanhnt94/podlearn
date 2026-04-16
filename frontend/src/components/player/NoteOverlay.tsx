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
        <div className={`absolute inset-0 pointer-events-none z-40 flex ${alignmentClasses[alignment]}`}
             style={{ containerType: 'size' }}>
            <div className={`flex ${stackClass} gap-[1cqw] max-w-[80%] md:max-w-[30%] p-[2cqw]`}>
                <AnimatePresence mode="popLayout">
                    {activeNotes.map((note) => (
                        <motion.div
                            key={note.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={`w-fit flex items-center gap-[0.8cqw] p-[0.4cqw] rounded-[0.6cqw] border transition-all duration-700 pointer-events-auto relative overflow-hidden ${currentTheme.container}`}
                        >
                            {/* Glow Pulse Background effect */}
                            <motion.div 
                                animate={{ opacity: [0, 0.3, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className={`absolute inset-0 pointer-events-none blur-xl bg-current opacity-5`}
                            />

                            {/* Scaling Icon Container */}
                            <div className={`rounded-full flex items-center justify-center shrink-0 z-10 ${currentTheme.iconBg}`}
                                 style={{ width: 'clamp(14px, 3.5cqw, 26px)', height: 'clamp(14px, 3.5cqw, 26px)' }}>
                                <Lightbulb size="55%" className={currentTheme.iconColor} fill="currentColor" />
                            </div>

                            <div className="flex flex-col z-10">
                                <span className="font-bold leading-tight whitespace-pre-wrap"
                                      style={{ fontSize: `clamp(9px, ${(settings.notes.fontSize || 2.5) * 0.7}cqw, 24px)` }}>
                                    {note.content}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};
