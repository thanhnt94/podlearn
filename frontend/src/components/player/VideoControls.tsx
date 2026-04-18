import React, { useState, useEffect, useRef } from 'react';
import { 
    Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, 
    Maximize, Repeat, Tv, MessageSquare, Users,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';

export const VideoControls: React.FC = () => {
    const { 
        isPlaying, setPlaying, 
        currentTime, duration, requestSeek,
        skipNextSentence, skipPrevSentence,
        volume, setVolume,
        abLoop, setAbLoop,
        isNativeCCOn, toggleNativeCC, nativeCCLang, setNativeCCLang,
        toggleCommunity,
        settings, setNoteSettings, setTrackSettings,
        handsFreeModeEnabled, handsFreeType, setHandsFreeType
    } = usePlayerStore();

    const [isVisible, setIsVisible] = useState(true);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const handleActivity = () => {
            setIsVisible(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(() => {
                if (isPlaying) setIsVisible(false);
            }, 3000);
        };

        const events = ['mousemove', 'touchstart', 'mousedown'];
        events.forEach(evt => window.addEventListener(evt, handleActivity));
        return () => events.forEach(evt => window.removeEventListener(evt, handleActivity));
    }, [isPlaying]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' + s : s}`;
    };

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = (parseFloat(e.target.value) / 100) * duration;
        requestSeek(time);
    };

    const toggleFullscreen = () => {
        const container = document.getElementById('player-container');
        if (!document.fullscreenElement) {
            container?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <AnimatePresence>
            {(isVisible || !isPlaying) && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-x-0 bottom-0 z-[90] flex flex-col justify-end pointer-events-none"
                    >
                        {/* Shadow Overlay for bottom focus */}
                        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/95 via-black/30 to-transparent pointer-events-none" />

                        {/* Hands-Free Mode Toggle (Only visible if handsFreeModeEnabled is true) */}
                        {handsFreeModeEnabled && (
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 flex bg-slate-900/80 p-1 rounded-2xl border border-white/5 backdrop-blur-xl pointer-events-auto">
                                <button onClick={() => setHandsFreeType('original')} className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${(handsFreeType as string) === 'original' ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>ORIGINAL</button>
                                <button onClick={() => setHandsFreeType('mixed')} className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${(handsFreeType as string) === 'mixed' ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>BILINGUAL MIX</button>
                            </div>
                        )}

                        {/* Bottom Control Bar */}
                        <div className="relative p-3 md:p-5 space-y-3 pointer-events-auto">
                            
                            {/* 1. Seek Bar Area */}
                            <div className="group relative h-10 flex flex-col justify-end">
                                <div className="flex justify-between text-[11px] font-black text-white/50 uppercase tracking-[0.2em] mb-3 px-1">
                                    <span className="bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">{formatTime(currentTime)}</span>
                                    <span className="bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">{formatTime(duration)}</span>
                                </div>
                                <div className="relative h-2 w-full bg-white/10 rounded-full overflow-hidden transition-all duration-300 group-hover:h-4 group-hover:mb-[-4px]">
                                    <motion.div 
                                        initial={false}
                                        animate={{ width: `${(currentTime / duration) * 100}%` }}
                                        className="h-full bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.6)]"
                                    />
                                    <input 
                                        type="range" min="0" max="100" step="0.1"
                                        value={(currentTime / duration) * 100 || 0}
                                        onChange={handleScrub}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                </div>
                            </div>

                            {/* 2. Main Control Row */}
                            <div className="flex flex-wrap items-center justify-between gap-y-4">
                                <div className="flex items-center gap-3 md:gap-8 overflow-x-auto no-scrollbar">
                                    {/* Play/Pause Toggle */}
                                    <button 
                                        onClick={() => setPlaying(!isPlaying)}
                                        className="text-white hover:text-sky-400 transition-all hover:scale-110 shrink-0"
                                    >
                                        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                                    </button>
                                    
                                    {/* ... rest remains mostly same ... */}
                                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                                        <button 
                                            onClick={skipPrevSentence} 
                                            className="text-white/80 hover:text-amber-400 transition-all active:scale-90 p-1.5 bg-white/5 rounded-xl border border-white/10" 
                                            title="Previous Sentence"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        
                                        <div className="flex items-center gap-2 md:gap-4">
                                            <button onClick={() => requestSeek(Math.max(0, currentTime - 5))} className="text-white/60 hover:text-white transition-colors" title="Back 5s">
                                                <RotateCcw size={18} />
                                            </button>
                                            <button onClick={() => requestSeek(Math.min(duration, currentTime + 5))} className="text-white/60 hover:text-white transition-colors" title="Forward 5s">
                                                <RotateCw size={18} />
                                            </button>
                                        </div>
                                        
                                        <button 
                                            onClick={skipNextSentence} 
                                            className="text-white/80 hover:text-amber-400 transition-all active:scale-90 p-1.5 bg-white/5 rounded-xl border border-white/10" 
                                            title="Next Sentence"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>

                                    {/* Volume Control */}
                                    <div className="hidden md:flex items-center gap-4 group/vol">
                                        <button onClick={() => setVolume(volume === 0 ? 100 : 0)} className="text-white/60 hover:text-white transition-colors">
                                            {volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                                        </button>
                                        <input 
                                            type="range" min="0" max="100" value={volume} 
                                            onChange={(e) => setVolume(parseInt(e.target.value))} 
                                            className="w-0 overflow-hidden group-hover/vol:w-24 transition-all accent-sky-500 h-1.5 cursor-pointer" 
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 md:gap-6 ml-auto">
                                    {/* Subtitle Toggles */}
                                    <div className="flex items-center gap-1.5 bg-white/5 backdrop-blur-md rounded-2xl p-1 border border-white/10">
                                        <button 
                                            onClick={toggleNativeCC}
                                            className={`px-2 py-2 md:px-4 rounded-xl flex items-center justify-center transition-all ${isNativeCCOn ? 'bg-red-500/20 text-red-500 shadow-lg' : 'text-white/40 hover:text-white'}`}
                                            title="Native YouTube CC"
                                        >
                                            <Tv size={16} />
                                        </button>
                                        
                                        <AnimatePresence>
                                            {isNativeCCOn && (
                                                <motion.select 
                                                    initial={{ width: 0, opacity: 0 }}
                                                    animate={{ width: 'auto', opacity: 1 }}
                                                    exit={{ width: 0, opacity: 0 }}
                                                    value={nativeCCLang}
                                                    onChange={(e) => setNativeCCLang(e.target.value)}
                                                    className="bg-transparent text-[10px] items-center font-black uppercase text-red-500 outline-none cursor-pointer appearance-none px-1"
                                                >
                                                    <option value="en">EN</option>
                                                    <option value="ja">JA</option>
                                                    <option value="vi">VI</option>
                                                </motion.select>
                                            )}
                                        </AnimatePresence>

                                        {[1, 2, 3].map(num => {
                                            const trackKey = `s${num}` as 's1' | 's2' | 's3';
                                            const isOn = settings[trackKey].enabled;
                                            return (
                                                <button 
                                                    key={num}
                                                    onClick={() => setTrackSettings(trackKey, { enabled: !isOn })}
                                                    className={`px-2 py-2 md:px-4 rounded-xl text-[10px] font-black transition-all ${isOn ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-white/40 hover:text-white'}`}
                                                >
                                                    T{num}
                                                </button>
                                            );
                                        })}
                                        
                                        <div className="w-[1px] h-5 bg-white/10 mx-1" />
                                        
                                        <button 
                                            onClick={() => setNoteSettings({ enabled: !settings.notes.enabled })}
                                            className={`px-2 py-2 md:px-4 rounded-xl flex items-center justify-center transition-all ${settings.notes.enabled ? 'bg-amber-500/20 text-amber-500 shadow-lg' : 'text-white/40 hover:text-white'}`}
                                        >
                                            <MessageSquare size={16} />
                                        </button>
                                        <button 
                                            onClick={toggleCommunity}
                                            className={`px-2 py-2 md:px-4 rounded-xl flex items-center justify-center transition-all ${settings.community.enabled ? 'bg-emerald-500/20 text-emerald-500 shadow-lg' : 'text-white/40 hover:text-white'}`}
                                        >
                                            <Users size={16} />
                                        </button>
                                    </div>

                                 {/* A-B Loop Controls - More compact on mobile */}
                                <div className="flex items-center gap-1 bg-white/5 backdrop-blur-md rounded-xl p-0.5 border border-white/10">
                                    <button 
                                        onClick={() => setAbLoop({ start: currentTime })}
                                        className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black transition-all ${abLoop.start !== null ? 'bg-sky-500 text-slate-950 animate-pulse' : 'text-white/40 hover:text-white'}`}
                                    >
                                        A
                                    </button>
                                    <button 
                                        onClick={() => setAbLoop({ end: currentTime })}
                                        className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black transition-all ${abLoop.end !== null ? 'bg-sky-500 text-slate-950' : 'text-white/40 hover:text-white'}`}
                                    >
                                        B
                                    </button>
                                    {(abLoop.start || abLoop.end) && (
                                        <button onClick={() => setAbLoop({ start: null, end: null })} className="px-1 text-red-500 hover:text-red-400">
                                            <Repeat size={12} />
                                        </button>
                                    )}
                                </div>

                                 {/* Fullscreen */}
                                <button onClick={toggleFullscreen} className="text-white/60 hover:text-white transition-colors shrink-0">
                                    <Maximize size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
