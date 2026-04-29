import React, { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle2, Flame, Gauge, Volume2, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion } from 'framer-motion';

const SPEEDS = [0.75, 1.0, 1.25];

export const MasteryPanel: React.FC = () => {
    const { 
        subtitles, activeLineIndex, requestSeek, setPlaying, currentTime, setPlaybackRate, setMode
    } = usePlayerStore();
    
    const [step, setStep] = useState(0); // 0, 1, 2 index of SPEEDS
    const [autoMode, setAutoMode] = useState(true);
    const masteringIndexRef = useRef(activeLineIndex);
    const activeLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;
    const lastTriggerRef = useRef(-1);

    const lastSeekIndexRef = useRef(-1);
    // Initial setup for new line
    useEffect(() => {
        setMode('shadowing');
        return () => setMode('watch');
    }, [setMode]);

    useEffect(() => {
        if (!activeLine || activeLineIndex === lastSeekIndexRef.current) return;
        
        lastSeekIndexRef.current = activeLineIndex;
        masteringIndexRef.current = activeLineIndex; // PIN THIS INDEX
        setStep(0);
        lastTriggerRef.current = -1;
        startStep(0);
    }, [activeLineIndex, activeLine]);

    // Loop logic
    useEffect(() => {
        // Use the pinned index to find the line we ARE mastering
        const masteringLine = masteringIndexRef.current !== -1 ? subtitles[masteringIndexRef.current] : null;
        if (!masteringLine || !autoMode) return;

        // Detect end of line (with padding)
        const padding = 0.3;
        if (currentTime >= masteringLine.end + padding && lastTriggerRef.current !== step) {
            lastTriggerRef.current = step;
            
            // Move to next step or stop
            if (step < SPEEDS.length - 1) {
                const nextStep = step + 1;
                setTimeout(() => {
                    setStep(nextStep);
                    // Explicitly use the pinned index for the next step seek
                    setPlaybackRate(SPEEDS[nextStep]);
                    requestSeek(masteringLine.start, masteringIndexRef.current);
                    setTimeout(() => setPlaying(true), 150);
                }, 800); 
            } else {
                // End of mastery loop -> PAUSE and wait for user
                setPlaying(false);
            }
        }
    }, [currentTime, subtitles, step, autoMode, requestSeek, setPlaying, setPlaybackRate]);

    const startStep = (sIdx: number) => {
        const masteringLine = masteringIndexRef.current !== -1 ? subtitles[masteringIndexRef.current] : null;
        if (!masteringLine) return;
        setPlaybackRate(SPEEDS[sIdx]);
        requestSeek(masteringLine.start, masteringIndexRef.current);
        setTimeout(() => setPlaying(true), 150);
    };

    const handleManualStep = (idx: number) => {
        setAutoMode(false);
        setStep(idx);
        startStep(idx);
    };

    const handleNext = () => {
        const nextIdx = activeLineIndex + 1;
        if (nextIdx < subtitles.length) {
            setPlaying(false);
            requestSeek(subtitles[nextIdx].start, nextIdx);
        }
    };

    const handlePrev = () => {
        const prevIdx = activeLineIndex - 1;
        if (prevIdx >= 0) {
            setPlaying(false);
            requestSeek(subtitles[prevIdx].start, prevIdx);
        }
    };

    const progress = ((step + 1) / SPEEDS.length) * 100;

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Header */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/50">Mastery Loop</span>
                    <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${autoMode ? 'bg-orange-500 animate-pulse' : 'bg-slate-700'}`} />
                         <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{autoMode ? 'Auto-Cycle Active' : 'Manual Mode'}</span>
                    </div>
                 </div>
                 <h3 className="text-sm font-bold text-slate-400">Tự động tăng tốc độ sau mỗi lần nghe để tai bạn thích nghi với người bản xứ.</h3>
            </div>

            {/* Visualizer Area */}
            <div className="flex-1 flex flex-col justify-center gap-12 p-6">
                
                {/* Speed Gauges */}
                <div className="grid grid-cols-3 gap-4">
                    {SPEEDS.map((s, i) => {
                        const isActive = step === i;
                        const isDone = step > i;
                        return (
                            <button 
                                key={i}
                                onClick={() => handleManualStep(i)}
                                className={`relative p-6 rounded-3xl border transition-all flex flex-col items-center gap-3 ${
                                    isActive 
                                        ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.1)] scale-105 z-10' 
                                        : isDone 
                                            ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' 
                                            : 'bg-slate-900/40 border-white/5 opacity-40 hover:opacity-100'
                                }`}
                            >
                                {isDone && <div className="absolute top-2 right-2 text-emerald-500"><CheckCircle2 size={14} /></div>}
                                <div className={`p-3 rounded-full ${isActive ? 'bg-orange-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                                    {i === 0 ? <Volume2 size={20} /> : i === 1 ? <Gauge size={20} /> : <Flame size={20} />}
                                </div>
                                <div className="text-center">
                                    <span className="block text-[10px] font-black uppercase tracking-tighter text-slate-500 mb-1">Step {i+1}</span>
                                    <span className={`text-xl font-black ${isActive ? 'text-white' : 'text-slate-600'}`}>{s}x</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Progress Line */}
                <div className="px-4 space-y-4">
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-400"
                        />
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <span>Luyện tai</span>
                        <span>Chuẩn</span>
                        <span>Thử thách</span>
                    </div>
                </div>

                {/* Content Preview (Optional) */}
                <div className="text-center p-8 bg-white/5 rounded-3xl border border-white/5">
                    <p className="text-xl font-bold text-white mb-2 leading-tight">{activeLine?.text}</p>
                    <p className="text-slate-500 italic text-sm">{activeLine?.trans}</p>
                </div>

            </div>

            {/* Actions */}
            <div className="flex flex-col gap-4 pb-6">
                <div className="flex gap-4">
                    <button 
                        onClick={handlePrev}
                        disabled={activeLineIndex <= 0}
                        className="p-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl transition-all disabled:opacity-20"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    
                    <button 
                        onClick={() => { setAutoMode(true); startStep(0); setStep(0); }}
                        className="flex-1 py-4 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Play size={16} fill="currentColor" /> Restart Cycle
                    </button>

                    <button 
                        onClick={handleNext}
                        disabled={activeLineIndex >= subtitles.length - 1}
                        className="p-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl transition-all disabled:opacity-20"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>

                <button 
                    onClick={handleNext}
                    className="w-full py-5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black uppercase tracking-[0.2em] text-[12px] rounded-2xl shadow-xl shadow-sky-500/20 transition-all flex items-center justify-center gap-2 group"
                >
                    <CheckCircle2 size={20} className="group-hover:scale-110 transition-transform" /> MASTERED & NEXT SENTENCE
                </button>
            </div>
        </div>
    );
};
