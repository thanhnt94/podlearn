import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';

export const TranscriptBody: React.FC = () => {
    const { 
        subtitles, s2Lines, s3Lines, 
        activeLineIndex, requestSeek, settings 
    } = usePlayerStore();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Helper to find matching lines from other tracks
    const getAlternativeLines = (time: number) => {
        const findMatch = (lines: any[]) => lines.find(l => Math.abs(l.start - time) < 0.5);
        return {
            s2: settings.s2.enabled ? findMatch(s2Lines) : null,
            s3: settings.s3.enabled ? findMatch(s3Lines) : null
        };
    };

    // Auto-scroll logic
    useEffect(() => {
        if (activeLineIndex !== -1 && lineRefs.current[activeLineIndex]) {
            lineRefs.current[activeLineIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [activeLineIndex]);

    if (subtitles.length === 0) {
        return (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center min-h-[400px] text-center px-6"
            >
                <div className="w-24 h-24 bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] flex items-center justify-center mb-8 border border-white/5 shadow-2xl">
                    <div className="w-12 h-12 border-2 border-slate-800 border-t-sky-500 rounded-full animate-spin" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Analyzing Waves</h3>
                <p className="text-slate-500 text-xs max-w-[240px] leading-relaxed mb-10 font-medium uppercase tracking-widest">
                    No active subtitle streams detected. Configure tracks to proceed.
                </p>
                
                <button 
                    onClick={() => (window as any).openSettings?.()}
                    className="px-10 py-4 bg-white text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-sky-400 transition-all active:scale-95 shadow-xl shadow-white/5"
                >
                    Link Neural Track
                </button>
            </motion.div>
        );
    }

    return (
        <motion.div 
            initial="hidden"
            animate="show"
            variants={{
                show: { transition: { staggerChildren: 0.05 } }
            }}
            ref={scrollContainerRef} className="space-y-4"
        >
            {subtitles.map((line, i) => {
                const alts = getAlternativeLines(line.start);
                const isActive = i === activeLineIndex;

                return (
                    <motion.div 
                        key={i} 
                        variants={{
                            hidden: { opacity: 0, x: -10 },
                            show: { opacity: 1, x: 0 }
                        }}
                        ref={el => { lineRefs.current[i] = el; }}
                        className={`group cursor-pointer p-6 rounded-[2rem] transition-all border border-transparent 
                            ${isActive 
                                ? 'bg-sky-500/10 border-sky-500/20 shadow-[0_0_40px_rgba(56,189,248,0.08)]' 
                                : 'hover:border-white/5 hover:bg-white/5'
                            }`}
                        onClick={() => requestSeek(line.start, i)}
                    >
                        <div className="flex items-start gap-6">
                            <span className={`text-[10px] font-black font-mono mt-1.5 w-12 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-700'}`}>
                                {formatTime(line.start)}
                            </span>
                            <div className="space-y-3 flex-1">
                                {/* Primary Track (S1) */}
                                <p className={`text-lg leading-relaxed transition-all tracking-tight ${isActive ? 'text-white font-black' : 'text-slate-300 font-medium'}`}>
                                    {line.text}
                                </p>
                                
                                <AnimatePresence>
                                    {/* Secondary Track (S2) */}
                                    {alts.s2 && (
                                        <motion.p 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className={`text-sm leading-relaxed transition-colors font-semibold ${isActive ? 'text-emerald-400' : 'text-emerald-500/40'}`}
                                        >
                                            {alts.s2.text}
                                        </motion.p>
                                    )}

                                    {/* Tertiary Track (S3) */}
                                    {alts.s3 && (
                                        <motion.p 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className={`text-[13px] leading-relaxed transition-colors font-medium ${isActive ? 'text-amber-400' : 'text-amber-500/40'}`}
                                        >
                                            {alts.s3.text}
                                        </motion.p>
                                    )}
                                </AnimatePresence>

                                {line.trans && !alts.s2 && !alts.s3 && (
                                    <p className="text-[11px] text-slate-600 italic font-medium tracking-tight bg-white/5 px-3 py-1.5 rounded-xl w-fit">
                                        {line.trans}
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                );
            })}
            <div className="h-64" /> {/* Extra bottom padding */}
        </motion.div>
    );
};

function formatTime(seconds: number) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
}
