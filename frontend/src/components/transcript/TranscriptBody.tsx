import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';

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
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
                <div className="w-8 h-8 border-2 border-slate-700 border-t-sky-500 rounded-full animate-spin" />
                <p className="text-sm font-medium tracking-tight uppercase">Calibrating Transcript Channels...</p>
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
                        onClick={() => requestSeek(line.start)}
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
