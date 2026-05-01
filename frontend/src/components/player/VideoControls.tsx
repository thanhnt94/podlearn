import React, { useState, useEffect, useRef } from 'react';
import { 
    Play, Pause, Volume2, VolumeX, 
    Maximize, Tv, MessageSquare, Users,
    ChevronLeft, ChevronRight, Settings, Gauge, X
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';

export const VideoControls: React.FC = () => {
    const { 
        isPlaying, setPlaying, 
        currentTime, duration, requestSeek,
        skipNextSentence, skipPrevSentence,
        volume, setVolume,
        playbackRate, setPlaybackRate,
        abLoop, setAbLoop,
        isNativeCCOn, toggleNativeCC, nativeCCLang, setNativeCCLang,
        toggleCommunity,
        settings, setNoteSettings, setTrackSettings,
        handsFreeModeEnabled, handsFreeType, setHandsFreeType
    } = usePlayerStore();

    const [isVisible, setIsVisible] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={skipPrevSentence} 
                                                className="text-white/80 hover:text-amber-400 transition-all active:scale-90 p-2 bg-white/5 rounded-2xl border border-white/10" 
                                                title="Previous Sentence"
                                            >
                                                <ChevronLeft size={24} />
                                            </button>
                                            
                                            <button 
                                                onClick={skipNextSentence} 
                                                className="text-white/80 hover:text-amber-400 transition-all active:scale-90 p-2 bg-white/5 rounded-2xl border border-white/10" 
                                                title="Next Sentence"
                                            >
                                                <ChevronRight size={24} />
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

                                 <div className="flex items-center gap-3 md:gap-5 ml-auto">
                                    {/* Settings Button */}
                                    <button 
                                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                        className={`p-2.5 rounded-2xl transition-all ${isSettingsOpen ? 'bg-sky-500 text-slate-950 shadow-lg' : 'bg-white/5 text-white/60 hover:text-white border border-white/10'}`}
                                    >
                                        <Settings size={20} />
                                    </button>

                                    {/* Fullscreen */}
                                    <button onClick={toggleFullscreen} className="text-white/60 hover:text-white transition-colors shrink-0 p-2">
                                        <Maximize size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modern Settings Overlay Panel */}
                        <AnimatePresence>
                            {isSettingsOpen && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                    className="absolute bottom-24 right-4 w-72 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto"
                                >
                                    <div className="p-6 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Studio Controls</h3>
                                            <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white">
                                                <X size={16} />
                                            </button>
                                        </div>

                                        {/* Playback Speed */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-sky-400">
                                                <Gauge size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Tempo</span>
                                                <span className="ml-auto text-[10px] font-black">{playbackRate}x</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                                    <button 
                                                        key={rate}
                                                        onClick={() => setPlaybackRate(rate)}
                                                        className={`py-2 rounded-xl text-[10px] font-black border transition-all ${playbackRate === rate ? 'bg-sky-500 border-sky-500 text-slate-950 shadow-md' : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'}`}
                                                    >
                                                        {rate}x
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Subtitle Channels */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-purple-400">
                                                <Tv size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Layers</span>
                                            </div>
                                            <div className="flex gap-2">
                                                {[1, 2, 3].map(num => {
                                                    const realKey = `s${num}` as 's1' | 's2' | 's3';
                                                    const isOn = settings[realKey].enabled;
                                                    return (
                                                        <button 
                                                            key={num}
                                                            onClick={() => setTrackSettings(realKey, { enabled: !isOn })}
                                                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${isOn ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 text-slate-400 border border-white/5'}`}
                                                        >
                                                            T{num}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            
                                            {/* Native CC Toggle */}
                                            <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/5">
                                                <button 
                                                    onClick={toggleNativeCC}
                                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${isNativeCCOn ? 'bg-red-500 text-white' : 'text-slate-500'}`}
                                                >
                                                    YOUTUBE CC
                                                </button>
                                                {isNativeCCOn && (
                                                    <select 
                                                        value={nativeCCLang}
                                                        onChange={(e) => setNativeCCLang(e.target.value)}
                                                        className="flex-1 bg-transparent text-[10px] font-black uppercase text-white outline-none cursor-pointer"
                                                    >
                                                        <option value="en">EN</option>
                                                        <option value="ja">JA</option>
                                                        <option value="vi">VI</option>
                                                    </select>
                                                )}
                                            </div>
                                        </div>

                                        {/* Interactive Layers */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button 
                                                onClick={() => setNoteSettings({ enabled: !settings.notes.enabled })}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all border ${settings.notes.enabled ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-white/5 border-white/5 text-slate-500'}`}
                                            >
                                                <MessageSquare size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Notes</span>
                                            </button>
                                            <button 
                                                onClick={toggleCommunity}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all border ${settings.community.enabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-white/5 border-white/5 text-slate-500'}`}
                                            >
                                                <Users size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Social</span>
                                            </button>
                                        </div>

                                        {/* A-B Loop Controls */}
                                        <div className="bg-black/40 rounded-2xl p-3 border border-white/5 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">A-B Repeat</span>
                                                {(abLoop.start || abLoop.end) && (
                                                    <button onClick={() => setAbLoop({ start: null, end: null })} className="text-red-500/60 hover:text-red-500 transition-colors">
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setAbLoop({ start: currentTime })}
                                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${abLoop.start !== null ? 'bg-sky-500 text-slate-950' : 'bg-white/5 text-slate-400'}`}
                                                >
                                                    START
                                                </button>
                                                <button 
                                                    onClick={() => setAbLoop({ end: currentTime })}
                                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${abLoop.end !== null ? 'bg-sky-500 text-slate-950' : 'bg-white/5 text-slate-400'}`}
                                                >
                                                    END
                                                </button>
                                            </div>
                                        </div>

                                        {/* Mobile Volume (Fallback) */}
                                        <div className="md:hidden flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                                            <Volume2 size={16} className="text-slate-500" />
                                            <input 
                                                type="range" min="0" max="100" value={volume} 
                                                onChange={(e) => setVolume(parseInt(e.target.value))} 
                                                className="flex-1 accent-sky-500 h-1" 
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
            )}
        </AnimatePresence>
    );
};
