import React, { useState, useEffect, useRef } from 'react';
import { 
    Play, Pause, Volume2, VolumeX, 
    Maximize,
    ChevronLeft, ChevronRight, Settings, Languages, Repeat,
    Gauge, Check, MessageSquare, StickyNote, Layout, Move
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { BackgroundAudioPlayer } from './BackgroundAudioPlayer';

export const VideoControls: React.FC = () => {
    const { 
        isPlaying, setPlaying, 
        currentTime, duration, requestSeek,
        skipNextSentence, skipPrevSentence,
        volume, setVolume,
        setIsSettingsOpen, setSettingsTab,
        handsFreeModeEnabled, handsFreeType, setHandsFreeType,
        isVideoLooping, setIsVideoLooping,
        playbackRate, setPlaybackRate,
        trackIds, setTrackIds,
        availableTracks,
        settings, setTrackSettings, setNoteSettings, setCommunitySettings
    } = usePlayerStore();

    const [isVisible, setIsVisible] = useState(true);
    const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
    const [quickSettingsView, setQuickSettingsView] = useState<'main' | 'speed' | 'subtitles' | 'overlays' | 'position'>('main');
    const [activePositionTrack, setActivePositionTrack] = useState<'s1' | 's2' | 's3' | 'notes'>('s1');
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const handleActivity = () => {
            setIsVisible(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(() => {
                if (isPlaying && !isQuickSettingsOpen) setIsVisible(false);
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

    const toggleFullscreen = async () => {
        const container = document.getElementById('player-container');
        if (!document.fullscreenElement) {
            try {
                await container?.requestFullscreen();
                // Attempt to lock orientation to landscape on mobile devices
                if (screen.orientation && (screen.orientation as any).lock) {
                    await (screen.orientation as any).lock('landscape').catch((err: any) => {
                        console.warn("Orientation lock not supported or failed:", err);
                    });
                }
            } catch (err) {
                console.error("Fullscreen failed:", err);
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            // Unlock orientation when exiting
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
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
                                    {/* Background Audio Mode (Mobile) */}
                                    <BackgroundAudioPlayer />

                                     {/* Loop Toggle Button */}
                                     <button 
                                         onClick={() => setIsVideoLooping(!isVideoLooping)}
                                         className={`p-2.5 rounded-2xl transition-all ${isVideoLooping ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-white/5 text-white/60 hover:text-white border border-white/10'}`}
                                         title={isVideoLooping ? "Tắt tự động lặp lại" : "Bật tự động lặp lại"}
                                     >
                                         <Repeat size={20} className={isVideoLooping ? 'animate-pulse' : ''} />
                                     </button>

                                     {/* Subtitle Studio Button */}
                                     <button 
                                         onClick={() => {
                                             setSettingsTab('subtitles');
                                             setIsSettingsOpen(true);
                                         }}
                                         className="p-2.5 rounded-2xl bg-white/5 text-white/60 hover:text-white border border-white/10 transition-all hover:bg-sky-500/10 hover:border-sky-500/30"
                                     >
                                         <Languages size={20} />
                                     </button>

                                     {/* Settings (Hub) Button -> Replaced with YouTube-style Quick Settings */}
                                     <div className="relative">
                                         <AnimatePresence>
                                             {isQuickSettingsOpen && (
                                                 <motion.div 
                                                     initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                     animate={{ opacity: 1, y: 0, scale: 1 }}
                                                     exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                     className="absolute bottom-full right-0 mb-4 w-72 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto"
                                                 >
                                                     <div className="p-2">
                                                         {quickSettingsView === 'main' && (
                                                             <div className="space-y-1">
                                                                 <button onClick={() => setQuickSettingsView('speed')} className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group text-left">
                                                                     <div className="flex items-center gap-3">
                                                                         <Gauge size={18} className="text-slate-400 group-hover:text-sky-400" />
                                                                         <span className="text-xs font-bold text-white">Tốc độ phát</span>
                                                                     </div>
                                                                     <div className="flex items-center gap-2">
                                                                         <span className="text-[10px] font-black text-sky-400">{playbackRate}x</span>
                                                                         <ChevronRight size={14} className="text-slate-600" />
                                                                     </div>
                                                                 </button>
                                                                 <button onClick={() => setQuickSettingsView('subtitles')} className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group text-left">
                                                                     <div className="flex items-center gap-3">
                                                                         <Languages size={18} className="text-slate-400 group-hover:text-sky-400" />
                                                                         <span className="text-xs font-bold text-white">Phụ đề</span>
                                                                     </div>
                                                                     <div className="flex items-center gap-2">
                                                                         <span className="text-[10px] font-black text-sky-400 uppercase">
                                                                             {[trackIds.s1, trackIds.s2, trackIds.s3].filter(Boolean).length} Active
                                                                         </span>
                                                                         <ChevronRight size={14} className="text-slate-600" />
                                                                     </div>
                                                                 </button>
                                                                 <button onClick={() => setQuickSettingsView('overlays')} className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group text-left">
                                                                     <div className="flex items-center gap-3">
                                                                         <Layout size={18} className="text-slate-400 group-hover:text-sky-400" />
                                                                         <span className="text-xs font-bold text-white">Hiển thị & Lớp phủ</span>
                                                                     </div>
                                                                     <ChevronRight size={14} className="text-slate-600" />
                                                                 </button>
                                                                 <div className="h-px bg-white/5 my-2 mx-4" />
                                                                 <button 
                                                                     onClick={() => {
                                                                         setSettingsTab('hub');
                                                                         setIsSettingsOpen(true);
                                                                         setIsQuickSettingsOpen(false);
                                                                     }}
                                                                     className="w-full flex items-center gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all group text-left"
                                                                 >
                                                                     <Settings size={18} className="text-slate-400 group-hover:text-sky-400" />
                                                                     <span className="text-xs font-bold text-white">Cài đặt chi tiết</span>
                                                                 </button>
                                                             </div>
                                                         )}
                                                         {quickSettingsView === 'speed' && (
                                                             <div className="space-y-1">
                                                                 <button onClick={() => setQuickSettingsView('main')} className="w-full flex items-center gap-3 p-4 border-b border-white/5 mb-2 hover:bg-white/5 rounded-2xl text-left">
                                                                     <ChevronLeft size={16} className="text-slate-400" />
                                                                     <span className="text-xs font-black uppercase tracking-widest text-slate-400">Tốc độ</span>
                                                                 </button>
                                                                 {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                                                                     <button key={r} onClick={() => { setPlaybackRate(r); setIsQuickSettingsOpen(false); }} className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all text-left">
                                                                         <span className="text-xs font-bold text-white">{r === 1 ? 'Bình thường' : `${r}x`}</span>
                                                                         {playbackRate === r && <Check size={16} className="text-sky-400" />}
                                                                     </button>
                                                                 ))}
                                                             </div>
                                                         )}
                                                         {quickSettingsView === 'subtitles' && (
                                                             <div className="space-y-1">
                                                                  <button onClick={() => setQuickSettingsView('main')} className="w-full flex items-center gap-3 p-4 border-b border-white/5 mb-2 hover:bg-white/5 rounded-2xl text-left">
                                                                     <ChevronLeft size={16} className="text-slate-400" />
                                                                     <span className="text-xs font-black uppercase tracking-widest text-slate-400">Phụ đề</span>
                                                                 </button>
                                                                 {['s1', 's2', 's3'].map(slot => (
                                                                     <div key={slot} className="px-4 py-3 flex items-center justify-between gap-4">
                                                                         <span className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap">Slot {slot.slice(1)}</span>
                                                                         <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1 justify-end">
                                                                             {availableTracks.map(t => (
                                                                                 <button 
                                                                                     key={t.id}
                                                                                     onClick={() => {
                                                                                         const currentId = trackIds[slot as keyof typeof trackIds];
                                                                                         setTrackIds({ [slot]: currentId === t.id ? null : t.id });
                                                                                     }}
                                                                                     className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all shrink-0 ${trackIds[slot as keyof typeof trackIds] === t.id ? 'bg-sky-500 text-slate-950 shadow-lg' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                                                                                 >
                                                                                     {t.language_code}
                                                                                 </button>
                                                                             ))}
                                                                         </div>
                                                                     </div>
                                                                 ))}
                                                             </div>
                                                         )}
                                                         {quickSettingsView === 'overlays' && (
                                                             <div className="space-y-1">
                                                                 <button onClick={() => setQuickSettingsView('main')} className="w-full flex items-center gap-3 p-4 border-b border-white/5 mb-2 hover:bg-white/5 rounded-2xl text-left">
                                                                     <ChevronLeft size={16} className="text-slate-400" />
                                                                     <span className="text-xs font-black uppercase tracking-widest text-slate-400">Hiển thị</span>
                                                                 </button>
                                                                 <div className="grid grid-cols-3 gap-2 p-2">
                                                                     {['s1', 's2', 's3'].map(slot => (
                                                                         <button 
                                                                            key={slot} 
                                                                            onClick={() => setTrackSettings(slot as any, { enabled: !settings[slot as 's1' | 's2' | 's3'].enabled })}
                                                                            className={`py-3 rounded-xl text-[10px] font-black transition-all ${settings[slot as 's1' | 's2' | 's3'].enabled ? 'bg-sky-500 text-slate-950' : 'bg-white/5 text-slate-500'}`}
                                                                         >
                                                                             T{slot.slice(1)}
                                                                         </button>
                                                                     ))}
                                                                 </div>
                                                                 <button onClick={() => setNoteSettings({ enabled: !settings.notes.enabled })} className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group text-left">
                                                                     <div className="flex items-center gap-3">
                                                                         <StickyNote size={18} className="text-amber-500" />
                                                                         <span className="text-xs font-bold text-white">Ghi chú (Notes)</span>
                                                                     </div>
                                                                     <div className={`w-10 h-5 rounded-full relative transition-all ${settings.notes.enabled ? 'bg-amber-500' : 'bg-slate-800'}`}>
                                                                         <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-all ${settings.notes.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                                                     </div>
                                                                 </button>
                                                                 <button onClick={() => setCommunitySettings({ enabled: !settings.community.enabled })} className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group text-left">
                                                                     <div className="flex items-center gap-3">
                                                                         <MessageSquare size={18} className="text-emerald-500" />
                                                                         <span className="text-xs font-bold text-white">Cộng đồng (Social)</span>
                                                                     </div>
                                                                     <div className={`w-10 h-5 rounded-full relative transition-all ${settings.community.enabled ? 'bg-emerald-500' : 'bg-slate-800'}`}>
                                                                         <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-all ${settings.community.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                                                     </div>
                                                                 </button>
                                                                 <div className="h-px bg-white/5 my-2 mx-4" />
                                                                 <button onClick={() => setQuickSettingsView('position')} className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group text-left">
                                                                     <div className="flex items-center gap-3">
                                                                         <Move size={18} className="text-purple-400" />
                                                                         <span className="text-xs font-bold text-white">Vị trí phụ đề</span>
                                                                     </div>
                                                                     <ChevronRight size={14} className="text-slate-600" />
                                                                 </button>
                                                             </div>
                                                         )}
                                                         {quickSettingsView === 'position' && (
                                                             <div className="space-y-1">
                                                                 <button onClick={() => setQuickSettingsView('overlays')} className="w-full flex items-center gap-3 p-4 border-b border-white/5 mb-2 hover:bg-white/5 rounded-2xl text-left">
                                                                     <ChevronLeft size={16} className="text-slate-400" />
                                                                     <span className="text-xs font-black uppercase tracking-widest text-slate-400">Vị trí</span>
                                                                 </button>
                                                                 <div className="flex p-2 gap-1 overflow-x-auto no-scrollbar">
                                                                     {['s1', 's2', 's3', 'notes'].map(sid => (
                                                                         <button key={sid} onClick={() => setActivePositionTrack(sid as any)}
                                                                             className={`px-3 py-2 rounded-lg text-[9px] font-black transition-all shrink-0 ${activePositionTrack === sid ? 'bg-purple-500 text-white shadow-lg' : 'bg-slate-900 text-slate-500'}`}
                                                                         >
                                                                             {sid === 'notes' ? 'Ghi chú' : `Slot ${sid.slice(1)}`}
                                                                         </button>
                                                                     ))}
                                                                 </div>
                                                                 <div className="grid grid-cols-1 gap-1 p-2">
                                                                     {[
                                                                         { label: 'Trên cùng (Top)', val: 85 },
                                                                         { label: 'Chính giữa (Mid)', val: 50 },
                                                                         { label: 'Dưới cùng (Bottom)', val: 12 },
                                                                     ].map(pos => (
                                                                         <button 
                                                                            key={pos.label} 
                                                                            onClick={() => {
                                                                                if (activePositionTrack === 'notes') {
                                                                                    setNoteSettings({ position: pos.val });
                                                                                } else {
                                                                                    setTrackSettings(activePositionTrack, { position: pos.val });
                                                                                }
                                                                            }}
                                                                            className={`w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all text-left`}
                                                                         >
                                                                             <span className="text-xs font-bold text-white">{pos.label}</span>
                                                                             {(activePositionTrack === 'notes' ? settings.notes.position : settings[activePositionTrack].position) === pos.val && <Check size={16} className="text-purple-400" />}
                                                                         </button>
                                                                     ))}
                                                                 </div>
                                                             </div>
                                                         )}
                                                     </div>
                                                 </motion.div>
                                             )}
                                         </AnimatePresence>
                                         <button 
                                             onClick={() => {
                                                 setIsQuickSettingsOpen(!isQuickSettingsOpen);
                                                 setQuickSettingsView('main');
                                             }}
                                             className={`p-2.5 rounded-2xl transition-all ${isQuickSettingsOpen ? 'bg-sky-500 text-slate-950 shadow-lg' : 'bg-white/5 text-white/60 hover:text-white border border-white/10'}`}
                                         >
                                             <Settings size={20} className={isQuickSettingsOpen ? 'rotate-90 transition-transform duration-300' : 'transition-transform duration-300'} />
                                         </button>
                                     </div>

                                     {/* Fullscreen */}
                                     <button onClick={toggleFullscreen} className="text-white/60 hover:text-white transition-colors shrink-0 p-2">
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
