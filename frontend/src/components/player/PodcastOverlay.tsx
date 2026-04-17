import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Headphones, Loader2, Sparkles, AudioLines, 
    Play, Pause, SkipBack, SkipForward, 
    Volume2
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';

export const PodcastOverlay: React.FC = () => {
    const { 
        handsFreeStatus, handsFreeProgress, handsFreeStep,
        handsFreeAudioUrl, handsFreeTaskId, handsFreeDuration,
        isPlaying, setPlaying, lessonTitle, currentTime,
        skipNextSentence, skipPrevSentence
    } = usePlayerStore();

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (handsFreeStatus === 'generating' || (!handsFreeAudioUrl && !handsFreeTaskId)) {
        return (
            <div className="absolute inset-0 z-40 bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
                {/* ... (Existing Generating UI) ... */}
                <div className="relative mb-8">
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="w-32 h-32 border-b-2 border-sky-500 rounded-full"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="text-sky-400 w-10 h-10 animate-pulse" />
                    </div>
                </div>
                
                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">
                    {handsFreeStatus === 'generating' ? 'Generating Podcast' : 'Preparing Engine'}
                </h2>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-tighter mb-8 max-w-md">
                    {handsFreeStatus === 'generating' 
                        ? 'Neural Engine is downloading original audio and stitching in translations...'
                        : 'Verifying lesson data and calculating smart cut points...'}
                </p>

                {handsFreeStatus === 'generating' && (
                    <div className="w-64 h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${handsFreeProgress * 100}%` }}
                            className="h-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)]"
                        />
                    </div>
                )}
                
                <div className="flex items-center gap-2 text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">
                    <Loader2 size={12} className="animate-spin" />
                    <span>{handsFreeStep || 'Initializing'}</span>
                    {handsFreeStatus === 'generating' && <span>{Math.round(handsFreeProgress * 100)}%</span>}
                </div>
            </div>
        );
    }

    if (!handsFreeAudioUrl) return null;

    return (
        <div className="absolute inset-0 z-40 bg-[#020617] flex flex-col items-center justify-center overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-sky-500/10 blur-[120px] rounded-full opacity-50" />
            
            <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-8">
                {/* 1. ALBUM ART SECTION */}
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative w-48 h-48 md:w-60 md:h-60 rounded-[2.5rem] bg-slate-900 border border-white/10 shadow-2xl flex items-center justify-center group overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-transparent opacity-50" />
                    
                    <AnimatePresence mode="wait">
                        {isPlaying ? (
                            <motion.div 
                                key="waves"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="flex items-center gap-1.5"
                            >
                                {[...Array(5)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ height: [30, 80, 40, 100, 50] }}
                                        transition={{ 
                                            duration: 0.8, 
                                            repeat: Infinity, 
                                            delay: i * 0.1, 
                                            ease: "easeInOut" 
                                        }}
                                        className="w-2.5 md:w-3.5 bg-sky-500 rounded-full shadow-[0_0_15px_rgba(14,165,233,0.5)]"
                                    />
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="icon"
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                            >
                                <Headphones size={100} className="text-slate-800" strokeWidth={1} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* 2. TITLE SECTION */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <AudioLines size={14} className="text-sky-500/60" />
                        <span className="text-[9px] font-black text-sky-500 uppercase tracking-[0.4em]">Neural Podcast Active</span>
                    </div>
                    <h2 className="text-lg md:text-xl font-black text-white line-clamp-2 leading-tight px-4">
                        {lessonTitle}
                    </h2>
                </div>

                {/* 3. PROGRESS BAR SECTION */}
                <div className="w-full space-y-3">
                    <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden cursor-pointer group/progress">
                        <motion.div 
                            className="absolute top-0 left-0 h-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
                            style={{ width: `${(currentTime / handsFreeDuration) * 100}%` }}
                        />
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/progress:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 font-bold uppercase tracking-tighter">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(handsFreeDuration)}</span>
                    </div>
                </div>

                {/* 4. CONTROLS SECTION */}
                <div className="flex items-center justify-center gap-8 md:gap-12">
                    <button 
                        onClick={() => skipPrevSentence()}
                        className="p-3 text-slate-400 hover:text-white transition-all hover:scale-110 active:scale-95"
                    >
                        <SkipBack size={32} fill="currentColor" className="opacity-80" />
                    </button>

                    <button 
                        onClick={() => setPlaying(!isPlaying)}
                        className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-90 transition-all"
                    >
                        {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="ml-2" />}
                    </button>

                    <button 
                        onClick={() => skipNextSentence()}
                        className="p-3 text-slate-400 hover:text-white transition-all hover:scale-110 active:scale-95"
                    >
                        <SkipForward size={32} fill="currentColor" className="opacity-80" />
                    </button>
                </div>

                {/* 5. FOOTER STATS */}
                <div className="flex items-center gap-6 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-2">
                        <Volume2 size={12} />
                        <span>Adaptive Audio</span>
                    </div>
                    <div className="w-1 h-1 bg-slate-800 rounded-full" />
                    <span>Background Playback Ready</span>
                </div>
            </div>
        </div>
    );
};
