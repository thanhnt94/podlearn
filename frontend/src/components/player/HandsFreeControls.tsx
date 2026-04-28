import React from 'react';
import { Headset, Play, Pause, SkipForward, SkipBack, Settings } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';

export const HandsFreeControls: React.FC = () => {
    const { 
        handsFreeModeEnabled, setHandsFreeModeEnabled,
        isPlaying, setPlaying, currentTime, requestSeek
    } = usePlayerStore();

    if (!handsFreeModeEnabled) return (
        <button 
            onClick={() => setHandsFreeModeEnabled(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-all border border-white/10"
        >
            <Headset size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Hands-free Mode</span>
        </button>
    );

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1100] bg-slate-900/90 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-10"
            >
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mb-1">Podcast Mode</span>
                    <span className="text-xs font-bold text-white">Hands-free active</span>
                </div>

                <div className="flex items-center gap-6">
                    <button onClick={() => requestSeek(currentTime - 10)} className="text-slate-400 hover:text-white transition-colors">
                        <SkipBack size={24} />
                    </button>
                    
                    <button 
                        onClick={() => setPlaying(!isPlaying)}
                        className="w-14 h-14 bg-white text-slate-950 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                    >
                        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} className="ml-1" fill="currentColor" />}
                    </button>

                    <button onClick={() => requestSeek(currentTime + 10)} className="text-slate-400 hover:text-white transition-colors">
                        <SkipForward size={24} />
                    </button>
                </div>

                <button 
                    onClick={() => setHandsFreeModeEnabled(false)}
                    className="p-3 text-slate-500 hover:text-red-400 transition-colors"
                >
                    <Settings size={20} />
                </button>
            </motion.div>
        </AnimatePresence>
    );
};
