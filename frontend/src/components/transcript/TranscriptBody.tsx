import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';

export const TranscriptBody: React.FC = () => {
    const { 
        subtitles, s2Lines, s3Lines, 
        activeLineIndex, requestSeek 
    } = usePlayerStore();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Helper to find matching lines from other tracks
    const getAlternativeLines = (time: number) => {
        const findMatch = (lines: any[]) => lines.find(l => Math.abs(l.start - time) < 0.5);
        return {
            s2: findMatch(s2Lines),
            s3: findMatch(s3Lines)
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
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
                <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
                    <div className="w-12 h-12 border-2 border-slate-700 border-t-sky-500 rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">Transcript Empty</h3>
                <p className="text-slate-500 text-sm max-w-[240px] leading-relaxed mb-8">
                    No subtitle channels detected for this session. Connect a YouTube caption track to start learning.
                </p>
                
                <button 
                    onClick={() => (window as any).openSettings?.()}
                    className="px-6 py-3 bg-white text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-sky-500 transition-all active:scale-95 shadow-xl"
                >
                    Open Settings
                </button>
            </div>
        );
    }

    return (
        <div ref={scrollContainerRef} className="space-y-4">
            {subtitles.map((line, i) => {
                const alts = getAlternativeLines(line.start);
                const isActive = i === activeLineIndex;

                return (
                    <div 
                        key={i} 
                        ref={el => { lineRefs.current[i] = el; }}
                        className={`group cursor-pointer p-4 rounded-2xl transition-all border border-transparent 
                            ${isActive 
                                ? 'bg-sky-500/10 border-sky-500/20 shadow-[0_0_20px_rgba(56,189,248,0.05)]' 
                                : 'hover:border-white/5 hover:bg-white/5'
                            }`}
                        onClick={() => requestSeek(line.start, i)}
                    >
                        <div className="flex items-start gap-4">
                            <span className={`text-[10px] font-mono mt-1.5 w-10 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-600'}`}>
                                {formatTime(line.start)}
                            </span>
                            <div className="space-y-2 flex-1">
                                {/* Primary Track (S1) */}
                                <p className={`text-base leading-relaxed transition-colors ${isActive ? 'text-white font-semibold' : 'text-slate-200'}`}>
                                    {line.text}
                                </p>
                                
                                {/* Secondary Track (S2) */}
                                {alts.s2 && (
                                    <p className={`text-sm leading-relaxed transition-colors ${isActive ? 'text-emerald-400' : 'text-emerald-500/60'}`}>
                                        {alts.s2.text}
                                    </p>
                                )}

                                {/* Tertiary Track (S3) */}
                                {alts.s3 && (
                                    <p className={`text-xs leading-relaxed transition-colors font-medium ${isActive ? 'text-amber-400' : 'text-amber-500/60'}`}>
                                        {alts.s3.text}
                                    </p>
                                )}

                                {line.trans && !alts.s2 && !alts.s3 && (
                                    <p className="text-xs text-slate-500 italic font-light">{line.trans}</p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            <div className="h-48" /> {/* Extra bottom padding */}
        </div>
    );
};

function formatTime(seconds: number) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
}
