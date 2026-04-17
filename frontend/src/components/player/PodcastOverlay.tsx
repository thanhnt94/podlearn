import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Headphones, Loader2, Sparkles, AudioLines, 
    Play, Pause, SkipBack, SkipForward, 
    Volume2, Tv, Wand2, ArrowRight
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';

export const PodcastOverlay: React.FC = () => {
    const { 
        handsFreeStatus, handsFreeProgress, handsFreeStep,
        handsFreeAudioUrl, handsFreeOriginalUrl, handsFreeDuration,
        handsFreeType, setHandsFreeType,
        isPlaying, setPlaying, lessonTitle, currentTime,
        skipNextSentence, skipPrevSentence,
        setTTSTrackSource, ttsTrackSource,
        generateHandsFreeMixed
    } = usePlayerStore();

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const isGenerating = handsFreeStatus === 'generating';
    const isReady = handsFreeType === 'original' ? !!handsFreeOriginalUrl : !!handsFreeAudioUrl;

    // --- RENDER: LOADING/GENERATING ---
    if (isGenerating) {
        return (
            <div className="absolute inset-0 z-40 bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
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
                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Generating Mixed Podcast</h2>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-tighter mb-8 max-w-md">
                    Neural Engine is grouping sentences and stitching in translations...
                </p>
                <div className="w-64 h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${handsFreeProgress * 100}%` }}
                        className="h-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)]"
                    />
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">
                    <Loader2 size={12} className="animate-spin" />
                    <span>{handsFreeStep || 'Processing'}</span>
                    <span>{Math.round(handsFreeProgress * 100)}%</span>
                </div>
            </div>
        );
    }

    // --- RENDER: SETTINGS (MIX MODE ONLY) ---
    if (handsFreeType === 'mixed' && !handsFreeAudioUrl) {
        return (
            <div className="absolute inset-0 z-40 bg-[#020617] flex flex-col items-center justify-center p-8">
                {/* Tabs in settings too */}
                <div className="absolute top-8 left-1/2 -translate-x-1/2 flex bg-slate-900/80 p-1 rounded-2xl border border-white/5 backdrop-blur-xl">
                    <button onClick={() => setHandsFreeType('original')} className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${(handsFreeType as string) === 'original' ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>ORIGINAL</button>
                    <button onClick={() => setHandsFreeType('mixed')} className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${(handsFreeType as string) === 'mixed' ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>BILINGUAL MIX</button>
                </div>

                <div className="max-w-md w-full bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-10 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-sky-500/10 rounded-2xl flex items-center justify-center mb-8">
                        <Wand2 className="text-sky-400" size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">Bilingual Podcast</h2>
                    <p className="text-slate-500 text-sm mb-10 leading-relaxed uppercase tracking-tighter font-bold">
                        Create a custom audio session by interleaving original sentences with neural translations.
                    </p>

                    <div className="w-full space-y-4 mb-10">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest text-left block w-full mb-1">Select Translation Track</label>
                        <div className="flex flex-col gap-2 w-full">
                            {['s1', 's2', 's3'].map((sid) => (
                                <button 
                                    key={sid}
                                    onClick={() => setTTSTrackSource(sid as any)}
                                    className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${ttsTrackSource === sid ? 'bg-sky-500/10 border-sky-500/50 text-white' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'}`}
                                >
                                    <span className="text-xs font-bold font-mono">TRACK {sid.toUpperCase()}</span>
                                    {ttsTrackSource === sid && <ArrowRight size={14} className="text-sky-400" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button 
                         onClick={() => generateHandsFreeMixed()}
                         className="w-full py-5 bg-sky-500 text-slate-950 rounded-2xl font-black text-sm tracking-widest shadow-[0_0_30px_rgba(14,165,233,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        START GENERATING
                    </button>
                </div>
            </div>
        );
    }

    // --- RENDER: MAIN PLAYER ---
    return (
        <div className="absolute inset-0 z-40 bg-[#020617] flex flex-col items-center justify-center overflow-hidden">
            {/* Tab Bar */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 flex bg-slate-900/80 p-1 rounded-2xl border border-white/5 backdrop-blur-xl z-[100]">
                <button onClick={() => setHandsFreeType('original')} className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${(handsFreeType as string) === 'original' ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>ORIGINAL</button>
                <button onClick={() => setHandsFreeType('mixed')} className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${(handsFreeType as string) === 'mixed' ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>BILINGUAL MIX</button>
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-sky-500/10 blur-[120px] rounded-full opacity-50" />
            
            <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-8 mt-12">
                {/* Album Art Section */}
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
                                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                                        className="w-2.5 md:w-3.5 bg-sky-500 rounded-full shadow-[0_0_15px_rgba(14,165,233,0.5)]"
                                    />
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div key="icon" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                                {handsFreeType === 'original' ? <Tv size={100} className="text-slate-800" strokeWidth={1} /> : <Headphones size={100} className="text-slate-800" strokeWidth={1} />}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Title Section */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <AudioLines size={14} className="text-sky-500/60" />
                        <span className="text-[9px] font-black text-sky-500 uppercase tracking-[0.4em]">{handsFreeType === 'original' ? 'YouTube Audio Stream' : 'Neural Podcast Stream'}</span>
                    </div>
                    <h2 className="text-lg md:text-xl font-black text-white line-clamp-2 leading-tight px-4">{lessonTitle}</h2>
                </div>

                {/* Progress Bar */}
                <div className="w-full space-y-3">
                    {!isReady ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-sky-500" size={24} />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Preparing Audio Stream...</span>
                        </div>
                    ) : (
                        <>
                            <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden cursor-pointer group/progress">
                                <motion.div 
                                    className="absolute top-0 left-0 h-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
                                    style={{ width: `${(currentTime / handsFreeDuration) * 100}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-500 font-bold tracking-tighter uppercase font-black">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(handsFreeDuration)}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-8 md:gap-12">
                    <button onClick={() => skipPrevSentence()} className="p-3 text-slate-400 hover:text-white"><SkipBack size={32} fill="currentColor" /></button>
                    <button 
                        onClick={() => setPlaying(!isPlaying)}
                        disabled={!isReady}
                        className={`w-20 h-20 md:w-24 md:h-24 flex items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-90 transition-all ${!isReady ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
                    >
                        {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="ml-2" />}
                    </button>
                    <button onClick={() => skipNextSentence()} className="p-3 text-slate-400 hover:text-white"><SkipForward size={32} fill="currentColor" /></button>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-6 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-2">
                        <Volume2 size={12} />
                        <span>Background Mode Enabled</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
