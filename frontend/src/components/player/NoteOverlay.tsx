import React from 'react';
import { Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';

export const NoteOverlay: React.FC = () => {
    const { notes, currentTime, settings } = usePlayerStore();

    if (!settings.notes.enabled) return null;

    // Filter notes that should be visible at current time
    const activeNotes = notes.filter(n => {
        const startTime = n.timestamp - settings.notes.beforeSecs;
        const endTime = startTime + settings.notes.duration;
        return currentTime >= startTime && currentTime <= endTime;
    });

    return (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden" 
             style={{ containerType: 'size' }}>
            <AnimatePresence>
                {activeNotes.map((note) => (
                    <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        className="absolute inset-x-0 flex justify-center px-[5%]"
                        style={{ bottom: `${settings.notes.position}%` }}
                    >
                        <div className="flex items-center gap-4 bg-slate-900/90 backdrop-blur-lg border border-white/10 rounded-3xl px-6 py-4 shadow-2xl max-w-[80%]">
                            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-yellow-400/20">
                                <Lightbulb size={20} className="text-slate-950" fill="currentColor" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] font-black uppercase tracking-widest text-yellow-400/60">Study Note</div>
                                <p className="text-white text-sm font-bold leading-tight">
                                    {note.content}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
