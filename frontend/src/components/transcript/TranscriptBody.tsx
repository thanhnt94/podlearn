import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAppStore } from '../../store/useAppStore';
import { Edit2, Check, X, Plus, Minus } from 'lucide-react';

export const TranscriptBody: React.FC = () => {
    const { 
        subtitles, s2Lines, s3Lines, 
        activeLineIndex, requestSeek,
        updateSubtitleLine
    } = usePlayerStore();
    const { user } = useAppStore();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    const [editingIndex, setEditingIndex] = useState<number | -1>(-1);
    const [editForm, setEditForm] = useState({ text: '', start: 0 });

    const isVip = user?.is_vip || user?.is_admin;

    // Helper to find matching lines from other tracks using temporal overlap
    const getAlternativeLines = (s1Line: any) => {
        const findBestMatch = (lines: any[]) => {
            if (!lines || lines.length === 0) return undefined;
            
            // Refined Strategy: Find the line that has the MOST temporal overlap with s1Line
            // Intersection = min(end1, end2) - max(start1, start2)
            let bestLine = undefined;
            let maxOverlap = -1;

            for (const l of lines) {
                const intersection = Math.min(s1Line.end, l.end) - Math.max(s1Line.start, l.start);
                if (intersection > maxOverlap && intersection > 0) {
                    maxOverlap = intersection;
                    bestLine = l;
                }
            }
            return bestLine;
        };
        
        return {
            s2: findBestMatch(s2Lines),
            s3: findBestMatch(s3Lines)
        };
    };

    // Auto-scroll logic
    useEffect(() => {
        if (activeLineIndex !== -1 && lineRefs.current[activeLineIndex] && editingIndex === -1) {
            lineRefs.current[activeLineIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [activeLineIndex, editingIndex]);

    const handleStartEdit = (index: number, line: any) => {
        setEditingIndex(index);
        setEditForm({ text: line.text, start: line.start });
    };

    const handleSaveEdit = async () => {
        if (editingIndex === -1) return;
        try {
            await updateSubtitleLine('s1', editingIndex, { 
                text: editForm.text, 
                start: editForm.start 
            });
            setEditingIndex(-1);
        } catch (err) {
            alert("Failed to update line. Check console.");
        }
    };

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
                const alts = getAlternativeLines(line);
                const isActive = i === activeLineIndex;
                const isEditing = i === editingIndex;

                return (
                    <div 
                        key={i} 
                        ref={el => { lineRefs.current[i] = el; }}
                        className={`group p-4 rounded-2xl transition-all border 
                            ${isEditing 
                                ? 'bg-slate-900 border-sky-500/50 shadow-2xl scale-[1.02] z-10 sticky top-4 bottom-4' 
                                : isActive 
                                    ? 'bg-sky-500/10 border-sky-500/20 shadow-[0_0_20px_rgba(56,189,248,0.05)]' 
                                    : 'hover:border-white/5 hover:bg-white/5 border-transparent cursor-pointer'
                            }`}
                        onClick={() => !isEditing && requestSeek(line.start, i)}
                    >
                        <div className="flex flex-col gap-3">
                            <div className="flex items-start gap-4">
                                <div className="flex flex-col items-center gap-1 w-10 shrink-0">
                                    <span className={`text-[10px] font-mono mt-1.5 ${isActive ? 'text-sky-400' : 'text-slate-600'}`}>
                                        {formatTime(isEditing ? editForm.start : line.start)}
                                    </span>
                                    {isEditing && (
                                        <div className="flex flex-col gap-1 mt-2">
                                            <button 
                                                onClick={() => setEditForm(f => ({ ...f, start: f.start + 0.1 }))}
                                                className="p-1.5 bg-slate-800 rounded hover:bg-sky-500 transition-colors"
                                            >
                                                <Plus size={10} />
                                            </button>
                                            <button 
                                                onClick={() => setEditForm(f => ({ ...f, start: Math.max(0, f.start - 0.1) }))}
                                                className="p-1.5 bg-slate-800 rounded hover:bg-rose-500 transition-colors"
                                            >
                                                <Minus size={10} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 flex-1">
                                    {isEditing ? (
                                        <div className="space-y-3">
                                            <textarea 
                                                value={editForm.text}
                                                onChange={(e) => setEditForm(f => ({ ...f, text: e.target.value }))}
                                                className="w-full bg-slate-800 border-white/10 rounded-xl p-3 text-white text-base focus:border-sky-500 transition-all outline-none min-h-[100px] resize-none"
                                                autoFocus
                                            />
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={handleSaveEdit}
                                                    className="flex-1 py-2.5 bg-sky-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                                >
                                                    <Check size={14} strokeWidth={3} /> Save Line
                                                </button>
                                                <button 
                                                    onClick={() => setEditingIndex(-1)}
                                                    className="px-4 py-2.5 bg-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-start">
                                                <p className={`text-base leading-relaxed transition-colors flex-1 ${isActive ? 'text-white font-semibold' : 'text-slate-200'}`}>
                                                    {line.text}
                                                </p>
                                                {isVip && !isEditing && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleStartEdit(i, line); }}
                                                        className="p-2 text-slate-600 hover:text-sky-400 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Quick Edit Line"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {/* Alternative Tracks */}
                                            {(alts.s2 || alts.s3) && (
                                                <div className="pt-2 border-t border-white/5 space-y-1">
                                                    {alts.s2 && (
                                                        <p className={`text-sm leading-relaxed transition-colors ${isActive ? 'text-emerald-400' : 'text-emerald-500/60'}`}>
                                                            {alts.s2.text}
                                                        </p>
                                                    )}
                                                    {alts.s3 && (
                                                        <p className={`text-xs leading-relaxed transition-colors font-medium ${isActive ? 'text-amber-400' : 'text-amber-500/60'}`}>
                                                            {alts.s3.text}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {line.trans && !alts.s2 && !alts.s3 && (
                                                <p className="text-xs text-slate-500 italic font-light">{line.trans}</p>
                                            )}
                                        </>
                                    )}
                                </div>
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
    const ms = Math.floor((seconds % 1) * 10);
    return `${min}:${sec < 10 ? '0' + sec : sec}.${ms}`;
}
