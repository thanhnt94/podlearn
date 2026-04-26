import React, { useState, useEffect, useRef } from 'react';
import { 
    ChevronLeft, 
    FastForward, Rewind, Play, Pause,
    Plus, Type, AlignLeft,
    CheckCircle2, Info, Search
} from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';
import { VideoSection } from './VideoSection';

interface SubtitleSyncStudioProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SubtitleSyncStudio: React.FC<SubtitleSyncStudioProps> = ({ isOpen, onClose }) => {
    const { 
        currentTime, duration, isPlaying,
        s1Lines, s2Lines, s3Lines,
        saveTrackShifts, requestSeek, setPlaying,
        updateSubtitleLine
    } = usePlayerStore();

    const [zoom, setZoom] = useState(100); 
    const [offsets, setOffsets] = useState({ s1: 0, s2: 0, s3: 0 });
    const [isSaving, setIsSaving] = useState(false);
    
    // Layout Resize State
    const [leftPanelWidth, setLeftPanelWidth] = useState(450);
    const [isResizingPanel, setIsResizingPanel] = useState(false);

    const timelineRef = useRef<HTMLDivElement>(null);
    const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const [selectedLine, setSelectedLine] = useState<{ track: 's1' | 's2' | 's3', index: number } | null>(null);
    const [editText, setEditText] = useState('');

    const currentCluster = (() => {
        const find = (lines: any[]) => lines.findIndex(l => currentTime >= l.start && currentTime <= l.end);
        return {
            s1: find(s1Lines),
            s2: find(s2Lines),
            s3: find(s3Lines)
        };
    })();

    // Handle Ctrl + Scroll to Zoom
    useEffect(() => {
        const timeline = timelineRef.current;
        if (!timeline) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const factor = e.deltaY > 0 ? 0.9 : 1.1;
                
                setZoom(prev => {
                    const newZoom = Math.max(20, Math.min(prev * factor, 1000));
                    return newZoom;
                });
            }
        };

        timeline.addEventListener('wheel', handleWheel, { passive: false });
        return () => timeline.removeEventListener('wheel', handleWheel);
    }, []);

    useEffect(() => {
        if (timelineRef.current && !isDraggingTimeline) {
            const scrollPos = currentTime * zoom - (timelineRef.current.clientWidth / 2);
            timelineRef.current.scrollLeft = scrollPos;
        }
    }, [currentTime, zoom, isDraggingTimeline]);

    useEffect(() => {
        if (selectedLine) {
            const lines = selectedLine.track === 's1' ? s1Lines : selectedLine.track === 's2' ? s2Lines : s3Lines;
            setEditText(lines[selectedLine.index]?.text || '');
        }
    }, [selectedLine, s1Lines, s2Lines, s3Lines]);

    // Panel Resize Logic
    useEffect(() => {
        if (!isResizingPanel) return;
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = e.clientX;
            if (newWidth >= 300 && newWidth <= 800) setLeftPanelWidth(newWidth);
        };
        const handleMouseUp = () => setIsResizingPanel(false);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingPanel]);

    const handleSnapToPrimary = () => {
        if (currentCluster.s1 === -1) return;
        const primary = s1Lines[currentCluster.s1];
        if (currentCluster.s2 !== -1) updateSubtitleLine('s2', currentCluster.s2, { start: primary.start, end: primary.end });
        if (currentCluster.s3 !== -1) updateSubtitleLine('s3', currentCluster.s3, { start: primary.start, end: primary.end });
    };

    const handleUpdateText = async () => {
        if (!selectedLine) return;
        try {
            await updateSubtitleLine(selectedLine.track, selectedLine.index, { text: editText });
        } catch (err) { alert("Failed to update text."); }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (offsets.s1 !== 0) await saveTrackShifts('s1', offsets.s1);
            if (offsets.s2 !== 0) await saveTrackShifts('s2', offsets.s2);
            if (offsets.s3 !== 0) await saveTrackShifts('s3', offsets.s3);
            alert("Subtitle alignment saved successfully!");
            setOffsets({ s1: 0, s2: 0, s3: 0 });
        } catch (err) { alert("Failed to save shifts."); } finally { setIsSaving(false); }
    };

    const handleTimelineMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.subtitle-block')) return;
        setIsDraggingTimeline(true);
        setStartX(e.pageX - (timelineRef.current?.offsetLeft || 0));
        setScrollLeft(timelineRef.current?.scrollLeft || 0);
    };

    const handleTimelineMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingTimeline || !timelineRef.current) return;
        const x = e.pageX - timelineRef.current.offsetLeft;
        const walk = (x - startX);
        timelineRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleTimelineMouseUp = () => setIsDraggingTimeline(false);

    const handleTimelineClick = (e: React.MouseEvent) => {
        if (isDraggingTimeline) return;
        if ((e.target as HTMLElement).closest('.subtitle-block')) return;
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
        const time = clickX / zoom;
        requestSeek(Math.max(0, Math.min(duration, time)));
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m}:${s < 10 ? '0' + s : s}.${ms < 10 ? '0' + ms : ms}`;
    };

    if (!isOpen) return null;

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col overflow-hidden font-inter"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-3 border-b border-white/10 bg-slate-900/80 backdrop-blur-2xl shrink-0">
                <div className="flex items-center gap-6">
                    <button onClick={onClose} className="group flex items-center gap-2 p-2 text-slate-400 hover:text-white transition-all">
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest mr-2">Exit Studio</span>
                    </button>
                    <h2 className="text-lg font-black text-white tracking-tighter uppercase">Sync Studio <span className="text-sky-500 italic">Ultra v3.3</span></h2>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-950 rounded-xl border border-white/5">
                        <div className="flex flex-col"><span className="text-[7px] text-slate-600 font-black uppercase">Time</span><span className="text-xs font-mono text-white tabular-nums">{formatTime(currentTime)}</span></div>
                        <div className="w-px h-5 bg-white/10" />
                        <div className="flex items-center gap-3">
                            <Search size={10} className="text-slate-500" />
                            <span className="text-[7px] text-slate-600 font-black uppercase">Zoom</span>
                            <input type="range" min="20" max="600" value={zoom} onChange={e => setZoom(parseInt(e.target.value))} className="w-24 accent-sky-500 h-0.5 bg-slate-800 rounded-full" />
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={isSaving || (offsets.s1 === 0 && offsets.s2 === 0 && offsets.s3 === 0)} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${isSaving ? 'bg-slate-800 text-slate-500' : 'bg-sky-500 text-slate-950 hover:bg-sky-400'}`}>
                        {isSaving ? <Plus className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Deploy
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-row overflow-hidden">
                <div style={{ width: `${leftPanelWidth}px` }} className="flex flex-col bg-slate-950 border-r border-white/5 p-6 gap-6 shrink-0 overflow-y-auto custom-scrollbar">
                    <div className="aspect-video bg-black rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl relative shrink-0"><VideoSection /><div className="absolute top-4 left-4 px-3 py-1 bg-slate-950/80 backdrop-blur-md text-white text-[8px] font-black uppercase rounded-lg border border-white/10">Monitor</div></div>
                    <div className="flex-1 bg-slate-900/30 rounded-[2.5rem] border border-white/5 p-8 flex flex-col gap-6">
                        <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Type size={12} className="text-sky-500" /> Inspector</h3>
                        {selectedLine ? (
                            <div className="flex-1 flex flex-col gap-6">
                                <textarea value={editText} onChange={e => setEditText(e.target.value)} className="flex-1 bg-slate-950/40 border border-white/10 rounded-3xl p-5 text-white text-base leading-relaxed focus:border-sky-500/30 outline-none resize-none shadow-inner" placeholder="Text..." />
                                <div className="flex gap-2"><button onClick={handleUpdateText} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all">Update</button><button onClick={handleSnapToPrimary} className="px-5 py-3.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-slate-950 transition-all">Snap</button></div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30"><AlignLeft size={24} className="text-slate-600 mb-3" /><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select a line</p></div>
                        )}
                    </div>
                </div>

                <div onMouseDown={() => setIsResizingPanel(true)} className={`w-1.5 cursor-col-resize hover:bg-sky-500/50 transition-colors z-30 shrink-0 flex items-center justify-center ${isResizingPanel ? 'bg-sky-500' : 'bg-transparent'}`}><div className="w-0.5 h-10 bg-white/10 rounded-full" /></div>

                <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
                    <div className="flex items-center justify-between px-10 py-4 border-b border-white/5 bg-slate-900/10">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-4 bg-slate-900/50 p-1 rounded-full border border-white/5">
                                <button onClick={() => requestSeek(currentTime - 5)} className="p-3 text-slate-400 hover:text-white"><Rewind size={18} /></button>
                                <button onClick={() => setPlaying(!isPlaying)} className="w-12 h-12 bg-white text-slate-950 rounded-full flex items-center justify-center hover:scale-105 transition-all">{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-0.5" fill="currentColor" />}</button>
                                <button onClick={() => requestSeek(currentTime + 5)} className="p-3 text-slate-400 hover:text-white"><FastForward size={18} /></button>
                            </div>
                            <div className="flex items-center gap-5">
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-sky-500" /><span className="text-[8px] font-black text-slate-500 uppercase">Primary</span></div>
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[8px] font-black text-slate-500 uppercase">VN</span></div>
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-[8px] font-black text-slate-500 uppercase">EN</span></div>
                            </div>
                        </div>
                        <div className="text-[8px] text-slate-600 font-black uppercase tracking-[0.4em] flex items-center gap-3"><Info size={10} /> Ctrl + Scroll to Zoom Timeline</div>
                    </div>

                    <div 
                        ref={timelineRef}
                        className="flex-1 overflow-x-auto overflow-y-hidden relative select-none custom-scrollbar-hidden"
                        onMouseDown={handleTimelineMouseDown} onMouseMove={handleTimelineMouseMove} onMouseUp={handleTimelineMouseUp} onMouseLeave={handleTimelineMouseUp} onClick={handleTimelineClick}
                    >
                        {/* Ruler */}
                        <div className="h-10 border-b border-white/5 relative flex items-end" style={{ width: `${duration * zoom}px` }}>
                            {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
                                i % 1 === 0 && (<div key={i} className="absolute h-3 border-l border-white/10" style={{ left: `${i * zoom}px` }}>{i % 5 === 0 && <span className="text-[9px] text-slate-500 font-mono absolute top-[-20px] left-1">{formatTime(i)}</span>}</div>)
                            ))}
                        </div>

                        {/* Tracks */}
                        <div className="flex flex-col h-[calc(100%-40px)]" style={{ width: `${duration * zoom}px` }}>
                            <TrackRow lines={s1Lines} color="sky" zoom={zoom} currentTime={currentTime} selectedLine={selectedLine?.track === 's1' ? selectedLine.index : null} onSelect={idx => setSelectedLine({ track: 's1', index: idx })} onTimeChange={(idx, s, e) => updateSubtitleLine('s1', idx, { start: s, end: e })} />
                            <TrackRow lines={s2Lines} color="emerald" zoom={zoom} currentTime={currentTime} selectedLine={selectedLine?.track === 's2' ? selectedLine.index : null} onSelect={idx => setSelectedLine({ track: 's2', index: idx })} onTimeChange={(idx, s, e) => updateSubtitleLine('s2', idx, { start: s, end: e })} />
                            <TrackRow lines={s3Lines} color="amber" zoom={zoom} currentTime={currentTime} selectedLine={selectedLine?.track === 's3' ? selectedLine.index : null} onSelect={idx => setSelectedLine({ track: 's3', index: idx })} onTimeChange={(idx, s, e) => updateSubtitleLine('s3', idx, { start: s, end: e })} />
                        </div>

                        {/* Playhead */}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-white z-[100] pointer-events-none shadow-[0_0_15px_white]" style={{ left: `${currentTime * zoom}px` }}>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-b-xl flex items-center justify-center"><div className="w-0.5 h-2 bg-sky-500 rounded-full" /></div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const TrackRow: React.FC<{ 
    lines: any[], color: string, zoom: number, currentTime: number, 
    selectedLine: number | null, onSelect: (idx: number) => void, 
    onTimeChange: (idx: number, start: number, end: number) => void 
}> = ({ lines, color, zoom, currentTime, selectedLine, onSelect, onTimeChange }) => (
    <div className="flex-1 border-b border-white/5 relative group hover:bg-white/[0.01]">
        {lines.map((line, i) => (
            <SubtitleBlock 
                key={i} line={line} prevLine={lines[i-1]} nextLine={lines[i+1]}
                color={color} zoom={zoom} 
                isActive={currentTime >= line.start && currentTime <= line.end}
                isSelected={selectedLine === i}
                onSelect={() => onSelect(i)}
                onTimeChange={(s, e) => onTimeChange(i, s, e)}
            />
        ))}
    </div>
);

const SubtitleBlock: React.FC<{ 
    line: any, prevLine: any, nextLine: any, color: string, zoom: number, 
    isActive: boolean, isSelected: boolean, onSelect: () => void, 
    onTimeChange: (start: number, end: number) => void 
}> = ({ line, prevLine, nextLine, color, zoom, isActive, isSelected, onSelect, onTimeChange }) => {
    const blockRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const colors: any = { sky: 'bg-sky-500/10 border-sky-500/30 text-sky-200', emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200', amber: 'bg-amber-500/10 border-amber-500/30 text-amber-200' };

    const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'left' | 'right') => {
        e.stopPropagation(); onSelect(); setIsDragging(true);
        const initialX = e.pageX; const initialStart = line.start; const initialEnd = line.end; const duration = initialEnd - initialStart;
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = (moveEvent.pageX - initialX) / zoom;
            let newStart = initialStart; let newEnd = initialEnd;
            const minStart = prevLine ? prevLine.end + 0.01 : 0; const maxEnd = nextLine ? nextLine.start - 0.01 : Infinity;
            if (type === 'move') {
                newStart = Math.max(minStart, initialStart + deltaX); newEnd = newStart + duration;
                if (newEnd > maxEnd) { newEnd = maxEnd; newStart = newEnd - duration; }
            } else if (type === 'left') { newStart = Math.max(minStart, Math.min(initialStart + deltaX, initialEnd - 0.1));
            } else if (type === 'right') { newEnd = Math.max(initialStart + 0.1, Math.min(maxEnd, initialEnd + deltaX)); }
            if (blockRef.current) { blockRef.current.style.left = `${newStart * zoom}px`; blockRef.current.style.width = `${(newEnd - newStart) * zoom}px`; }
        };
        const handleMouseUp = (upEvent: MouseEvent) => {
            document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); setIsDragging(false);
            const finalDeltaX = (upEvent.pageX - initialX) / zoom;
            let finalStart = initialStart; let finalEnd = initialEnd;
            const minStart = prevLine ? prevLine.end + 0.01 : 0; const maxEnd = nextLine ? nextLine.start - 0.01 : Infinity;
            if (type === 'move') { finalStart = Math.max(minStart, initialStart + finalDeltaX); finalEnd = finalStart + duration; if (finalEnd > maxEnd) { finalEnd = maxEnd; finalStart = finalEnd - duration; }
            } else if (type === 'left') { finalStart = Math.max(minStart, Math.min(initialStart + finalDeltaX, initialEnd - 0.1));
            } else if (type === 'right') { finalEnd = Math.max(initialStart + 0.1, Math.min(maxEnd, initialEnd + finalDeltaX)); }
            onTimeChange(finalStart, finalEnd);
        };
        document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div 
            ref={blockRef} onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={`subtitle-block absolute top-6 bottom-6 rounded-2xl border px-6 flex items-center transition-all cursor-grab active:cursor-grabbing ${colors[color]} ${isActive ? 'brightness-125 border-white/40 z-30' : 'opacity-70 hover:opacity-100'} ${isSelected ? 'ring-2 ring-white z-40 scale-y-105 shadow-xl bg-white/5' : ''} ${isDragging ? 'shadow-2xl z-50 cursor-grabbing' : ''}`}
            style={{ left: `${line.start * zoom}px`, width: `${(line.end - line.start) * zoom}px`, minWidth: '4px' }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
        >
            <div className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-white/20 rounded-l-2xl" onMouseDown={(e) => handleMouseDown(e, 'left')} />
            <span className="text-sm font-bold line-clamp-3 leading-tight overflow-hidden pointer-events-none select-none tracking-tight">{line.text}</span>
            <div className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-white/20 rounded-r-2xl" onMouseDown={(e) => handleMouseDown(e, 'right')} />
        </div>
    );
};
