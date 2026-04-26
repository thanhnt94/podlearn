import React, { useState, useEffect, useRef } from 'react';
import { 
    ChevronLeft, 
    FastForward, Rewind, Play, Pause,
    AlignLeft,
    MousePointer2, Globe,
    Scissors, Merge, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
        updateSubtitleLine, splitSubtitleLine, mergeSubtitleLine, deleteSubtitleLine,
        playbackRate, setPlaybackRate
    } = usePlayerStore();

    const [zoom, setZoom] = useState(100); 
    const [fontSize, setFontSize] = useState(14);
    const [offsets, setOffsets] = useState({ s1: 0, s2: 0, s3: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    
    const [leftPanelWidth, setLeftPanelWidth] = useState(450);
    const [isResizingPanel, setIsResizingPanel] = useState(false);

    const timelineRef = useRef<HTMLDivElement>(null);
    const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Zoom Drag State
    const [isZoomDragging, setIsZoomDragging] = useState(false);
    const [zoomStartX, setZoomStartX] = useState(0);
    const [zoomStartVal, setZoomStartVal] = useState(0);

    // Advanced Selection State
    const [selectedLines, setSelectedLines] = useState<{ track: 's1' | 's2' | 's3', index: number }[]>([]);
    const [inspectorGroup, setInspectorGroup] = useState<{
        s1?: { index: number, text: string },
        s2?: { index: number, text: string },
        s3?: { index: number, text: string }
    } | null>(null);

    const findBestOverlap = (line: any, trackLines: any[]) => {
        if (!line || !trackLines || trackLines.length === 0) return -1;
        const lineMid = (line.start + line.end) / 2;
        let bestIdx = -1;
        let minDiff = Infinity;

        trackLines.forEach((l, idx) => {
            const overlap = Math.max(0, Math.min(line.end, l.end) - Math.max(line.start, l.start));
            if (overlap > 0) {
                const lMid = (l.start + l.end) / 2;
                const diff = Math.abs(lineMid - lMid);
                if (diff < minDiff) { minDiff = diff; bestIdx = idx; }
            }
        });
        return bestIdx;
    };

    const handleLineSelect = (track: 's1' | 's2' | 's3', index: number, isMulti: boolean) => {
        const item = { track, index };
        const lines = track === 's1' ? s1Lines : track === 's2' ? s2Lines : s3Lines;
        const line = lines[index];

        if (isMulti) {
            const exists = selectedLines.findIndex(l => l.track === track && l.index === index);
            if (exists !== -1) setSelectedLines(prev => prev.filter((_, i) => i !== exists));
            else setSelectedLines(prev => [...prev, item]);
        } else {
            setSelectedLines([item]);
            // Update Inspector Group
            const idx1 = track === 's1' ? index : findBestOverlap(line, s1Lines);
            const idx2 = track === 's2' ? index : findBestOverlap(line, s2Lines);
            const idx3 = track === 's3' ? index : findBestOverlap(line, s3Lines);
            setInspectorGroup({
                s1: idx1 !== -1 ? { index: idx1, text: s1Lines[idx1].text } : undefined,
                s2: idx2 !== -1 ? { index: idx2, text: s2Lines[idx2].text } : undefined,
                s3: idx3 !== -1 ? { index: idx3, text: s3Lines[idx3].text } : undefined,
            });
        }
    };

    // Zoom Drag Effect
    useEffect(() => {
        if (!isZoomDragging) return;
        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - zoomStartX;
            const newZoom = Math.max(20, Math.min(zoomStartVal + deltaX * 2, 2000));
            setZoom(newZoom);
        };
        const handleMouseUp = () => setIsZoomDragging(false);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isZoomDragging, zoomStartX, zoomStartVal]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
            switch (e.code) {
                case 'Space': e.preventDefault(); setPlaying(!isPlaying); break;
                case 'ArrowLeft': requestSeek(currentTime - (e.shiftKey ? 1 : 5)); break;
                case 'ArrowRight': requestSeek(currentTime + (e.shiftKey ? 1 : 5)); break;
                case 'Delete': 
                case 'Backspace': 
                    if (selectedLines.length > 0) {
                        if (confirm(`Delete ${selectedLines.length} selected lines?`)) {
                            handleDeleteSelected();
                        }
                    }
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, currentTime, selectedLines]);

    // Auto-Scroll
    useEffect(() => {
        if (timelineRef.current && !isDraggingTimeline && autoScroll && !isZoomDragging) {
            const scrollPos = currentTime * zoom - (timelineRef.current.clientWidth / 2);
            timelineRef.current.scrollLeft = scrollPos;
        }
    }, [currentTime, zoom, isDraggingTimeline, autoScroll, isZoomDragging]);

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

    const handleSaveGroup = async () => {
        if (!inspectorGroup) return;
        try {
            if (inspectorGroup.s1) await updateSubtitleLine('s1', inspectorGroup.s1.index, { text: inspectorGroup.s1.text });
            if (inspectorGroup.s2) await updateSubtitleLine('s2', inspectorGroup.s2.index, { text: inspectorGroup.s2.text });
            if (inspectorGroup.s3) await updateSubtitleLine('s3', inspectorGroup.s3.index, { text: inspectorGroup.s3.text });
        } catch (err) { alert("Failed to update."); }
    };

    const handleDeploy = async () => {
        setIsSaving(true);
        try {
            if (offsets.s1 !== 0) await saveTrackShifts('s1', offsets.s1);
            if (offsets.s2 !== 0) await saveTrackShifts('s2', offsets.s2);
            if (offsets.s3 !== 0) await saveTrackShifts('s3', offsets.s3);
            alert("Changes deployed!");
            setOffsets({ s1: 0, s2: 0, s3: 0 });
        } catch (err) { alert("Failed to deploy."); } finally { setIsSaving(false); }
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
        
        setSelectedLines([]);
        setInspectorGroup(null);

        const rect = timelineRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
        const time = clickX / zoom;
        requestSeek(Math.max(0, Math.min(duration, time)));
    };

    const handleRulerMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsZoomDragging(true);
        setZoomStartX(e.clientX);
        setZoomStartVal(zoom);
    };

    const handleSnapToPrimary = () => {
        const find = (lines: any[]) => lines.findIndex(l => currentTime >= l.start && currentTime <= l.end);
        const s1Idx = find(s1Lines);
        if (s1Idx === -1) return;
        const primary = s1Lines[s1Idx];
        const s2Idx = find(s2Lines);
        const s3Idx = find(s3Lines);
        if (s2Idx !== -1) updateSubtitleLine('s2', s2Idx, { start: primary.start, end: primary.end });
        if (s3Idx !== -1) updateSubtitleLine('s3', s3Idx, { start: primary.start, end: primary.end });
    };

    const handleMergeSelected = async () => {
        if (selectedLines.length < 2) return;
        const track = selectedLines[0].track;
        const sorted = [...selectedLines].filter(l => l.track === track).sort((a, b) => a.index - b.index);
        if (sorted.length < 2) { alert("Please select lines in the SAME track to merge."); return; }
        
        const baseIdx = sorted[0].index;
        for (let i = 0; i < sorted.length - 1; i++) {
            await mergeSubtitleLine(track, baseIdx);
        }
        setSelectedLines([]);
        setInspectorGroup(null);
    };

    const handleDeleteSelected = async () => {
        if (selectedLines.length === 0) return;
        // Group by track
        const tracks = ['s1', 's2', 's3'] as const;
        for (const track of tracks) {
            const trackLines = selectedLines.filter(l => l.track === track).sort((a, b) => b.index - a.index);
            for (const line of trackLines) {
                await deleteSubtitleLine(track, line.index);
            }
        }
        setSelectedLines([]);
        setInspectorGroup(null);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m}:${s < 10 ? '0' + s : s}.${ms < 10 ? '0' + ms : ms}`;
    };

    if (!isOpen) return null;

    const popupPos = (() => {
        if (selectedLines.length === 0 || !timelineRef.current) return null;
        const tracks = { s1: s1Lines, s2: s2Lines, s3: s3Lines };
        const lastSelected = selectedLines[selectedLines.length - 1];
        const line = tracks[lastSelected.track][lastSelected.index];
        if (!line) return null;
        
        const trackY = lastSelected.track === 's1' ? 0 : lastSelected.track === 's2' ? 1 : 2;
        const containerRect = timelineRef.current.getBoundingClientRect();
        const left = (line.start * zoom) - timelineRef.current.scrollLeft;
        const top = 40 + (trackY * ((containerRect.height - 40) / 3));
        
        return { left: left + (line.end - line.start) * zoom / 2, top: top - 45 };
    })();

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col overflow-hidden font-inter text-slate-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-3 border-b border-white/10 bg-slate-900/80 backdrop-blur-2xl shrink-0">
                <div className="flex items-center gap-6">
                    <button onClick={onClose} className="group flex items-center gap-2 p-2 text-slate-400 hover:text-white transition-all bg-white/5 rounded-xl border border-white/5">
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <h2 className="text-lg font-black text-white tracking-tighter uppercase leading-none">Sync Studio <span className="text-sky-500 italic">Ultra v4.0</span></h2>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-6 px-5 py-1.5 bg-slate-950 rounded-2xl border border-white/5">
                        <div className="flex flex-col"><span className="text-[7px] text-slate-600 font-black uppercase">Font</span>
                            <input type="range" min="10" max="24" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-16 accent-sky-500 h-0.5 bg-slate-800 rounded-full" />
                        </div>
                        <div className="flex flex-col"><span className="text-[7px] text-slate-600 font-black uppercase">Speed</span>
                            <div className="flex gap-2 mt-0.5">
                                {[0.5, 0.75, 1, 1.25].map(s => (
                                    <button key={s} onClick={() => setPlaybackRate(s)} className={`text-[9px] font-mono font-bold px-1.5 rounded transition-colors ${playbackRate === s ? 'text-sky-500 bg-sky-500/10' : 'text-slate-500 hover:text-white'}`}>{s}x</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col"><span className="text-[7px] text-slate-600 font-black uppercase">Zoom Scale</span>
                            <input type="range" min="20" max="1000" value={zoom} onChange={e => setZoom(parseInt(e.target.value))} className="w-20 accent-sky-500 h-0.5 bg-slate-800 rounded-full" />
                        </div>
                    </div>
                    <button onClick={handleDeploy} disabled={isSaving} className="px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-sky-500 text-slate-950 hover:bg-sky-400 transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)]">Deploy Changes</button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-row overflow-hidden relative">
                <div style={{ width: `${leftPanelWidth}px` }} className="flex flex-col bg-slate-950 border-r border-white/5 p-6 gap-6 shrink-0 overflow-y-auto custom-scrollbar">
                    <div className="aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative shrink-0"><VideoSection /></div>
                    <div className="flex-1 bg-slate-900/30 rounded-3xl border border-white/5 p-6 flex flex-col gap-5">
                        <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Globe size={12} className="text-sky-500" /> Linked Translation View</h3>
                        {inspectorGroup ? (
                            <div className="flex-1 flex flex-col gap-4">
                                {(['s1', 's2', 's3'] as const).map(track => (
                                    inspectorGroup[track] && (
                                        <div key={track} className="space-y-1.5">
                                            <span className={`text-[7px] font-black uppercase tracking-widest ${track === 's1' ? 'text-sky-500' : track === 's2' ? 'text-emerald-500' : 'text-amber-500'}`}>Track {track.toUpperCase()}</span>
                                            <textarea value={inspectorGroup[track]?.text} onChange={e => setInspectorGroup(prev => prev ? ({ ...prev, [track]: { ...prev[track]!, text: e.target.value } }) : null)} className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-3 text-sm text-white leading-relaxed focus:border-sky-500/30 outline-none resize-none" rows={2} />
                                        </div>
                                    )
                                ))}
                                <div className="mt-2 flex gap-2">
                                    <button onClick={handleSaveGroup} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Save Group</button>
                                    <button onClick={handleSnapToPrimary} className="px-4 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-slate-950 transition-all">Snap Group</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30"><AlignLeft size={24} className="text-slate-600 mb-3" /><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select a block on timeline</p></div>
                        )}
                    </div>
                </div>

                <div onMouseDown={() => setIsResizingPanel(true)} className={`w-1.5 cursor-col-resize hover:bg-sky-500/50 transition-colors z-30 shrink-0 flex items-center justify-center ${isResizingPanel ? 'bg-sky-500' : 'bg-transparent'}`}><div className="w-0.5 h-10 bg-white/10 rounded-full" /></div>

                <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
                    <div className="flex items-center justify-between px-10 py-3 border-b border-white/5 bg-slate-900/10 backdrop-blur-md">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-4 bg-slate-900/50 p-1 rounded-full border border-white/5">
                                <button onClick={() => requestSeek(currentTime - 5)} className="p-2 text-slate-400 hover:text-white"><Rewind size={18} /></button>
                                <button onClick={() => setPlaying(!isPlaying)} className="w-10 h-10 bg-white text-slate-950 rounded-full flex items-center justify-center hover:scale-105 transition-all">{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} className="ml-0.5" fill="currentColor" />}</button>
                                <button onClick={() => requestSeek(currentTime + 5)} className="p-2 text-slate-400 hover:text-white"><FastForward size={18} /></button>
                            </div>
                            <button onClick={() => setAutoScroll(!autoScroll)} className={`flex items-center gap-2 text-[8px] font-black uppercase tracking-widest ${autoScroll ? 'text-sky-400' : 'text-slate-600'}`}><MousePointer2 size={10} /> Auto-Scroll</button>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-sky-500" /><span className="text-[8px] font-black text-slate-500 uppercase">Primary</span></div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[8px] font-black text-slate-500 uppercase">VN</span></div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-[8px] font-black text-slate-500 uppercase">EN</span></div>
                        </div>
                    </div>

                    <div 
                        ref={timelineRef}
                        className="flex-1 overflow-x-auto overflow-y-hidden relative select-none custom-scrollbar-hidden"
                        onMouseDown={handleTimelineMouseDown} 
                        onMouseMove={(e) => { if(isDraggingTimeline) handleTimelineMouseMove(e); }} 
                        onMouseUp={() => { handleTimelineMouseUp(); setIsZoomDragging(false); }} 
                        onMouseLeave={() => { handleTimelineMouseUp(); setIsZoomDragging(false); }} 
                        onClick={(e) => { if(!isDraggingTimeline && !isZoomDragging) handleTimelineClick(e); }}
                    >
                        <AnimatePresence>
                            {popupPos && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                    style={{ position: 'absolute', left: popupPos.left, top: popupPos.top }}
                                    className="z-[200] -translate-x-1/2 flex items-center gap-2 bg-slate-900 border border-white/20 rounded-2xl p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                                >
                                    {selectedLines.length === 1 ? (
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); splitSubtitleLine(selectedLines[0].track, selectedLines[0].index, currentTime); setSelectedLines([]); }}
                                                className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-slate-950 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-sky-400 transition-all"
                                            >
                                                <Scissors size={12} /> Split
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); if(confirm('Delete this line?')) { deleteSubtitleLine(selectedLines[0].track, selectedLines[0].index); setSelectedLines([]); setInspectorGroup(null); } }}
                                                className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleMergeSelected(); }}
                                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all"
                                            >
                                                <Merge size={12} /> Merge ({selectedLines.length})
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); if(confirm(`Delete ${selectedLines.length} lines?`)) handleDeleteSelected(); }}
                                                className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-white/20 rotate-45" />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="h-10 border-b border-white/5 relative flex items-end sticky top-0 z-40 bg-slate-950 cursor-ew-resize transition-colors hover:bg-white/[0.02]" style={{ width: `${duration * zoom}px` }} onMouseDown={handleRulerMouseDown}>
                            {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
                                i % 1 === 0 && (<div key={i} className="absolute h-3 border-l border-white/10" style={{ left: `${i * zoom}px` }}>{i % 5 === 0 && <span className="text-[9px] text-slate-500 font-mono absolute top-[-20px] left-1 tabular-nums">{formatTime(i)}</span>}</div>)
                            ))}
                        </div>

                        <div className="flex flex-col h-[calc(100%-40px)] relative" style={{ width: `${duration * zoom}px` }}>
                            <TrackRow lines={s1Lines} color="sky" zoom={zoom} fontSize={fontSize} currentTime={currentTime} selectedLines={selectedLines.filter(l => l.track === 's1').map(l => l.index)} onSelect={(idx, m) => handleLineSelect('s1', idx, m)} onTimeChange={(idx, s, e) => updateSubtitleLine('s1', idx, { start: s, end: e })} />
                            <TrackRow lines={s2Lines} color="emerald" zoom={zoom} fontSize={fontSize} currentTime={currentTime} selectedLines={selectedLines.filter(l => l.track === 's2').map(l => l.index)} onSelect={(idx, m) => handleLineSelect('s2', idx, m)} onTimeChange={(idx, s, e) => updateSubtitleLine('s2', idx, { start: s, end: e })} />
                            <TrackRow lines={s3Lines} color="amber" zoom={zoom} fontSize={fontSize} currentTime={currentTime} selectedLines={selectedLines.filter(l => l.track === 's3').map(l => l.index)} onSelect={(idx, m) => handleLineSelect('s3', idx, m)} onTimeChange={(idx, s, e) => updateSubtitleLine('s3', idx, { start: s, end: e })} />
                        </div>

                        <div className="absolute top-0 bottom-0 w-0.5 bg-white z-[100] pointer-events-none shadow-[0_0_15px_white]" style={{ left: `${currentTime * zoom}px` }}>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-b-xl flex items-center justify-center shadow-2xl"><div className="w-0.5 h-2 bg-sky-500 rounded-full" /></div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const TrackRow: React.FC<{ 
    lines: any[], color: string, zoom: number, fontSize: number, currentTime: number, 
    selectedLines: number[], onSelect: (idx: number, isMulti: boolean) => void, 
    onTimeChange: (idx: number, start: number, end: number) => void 
}> = ({ lines, color, zoom, fontSize, currentTime, selectedLines, onSelect, onTimeChange }) => (
    <div className="flex-1 border-b border-white/5 relative group hover:bg-white/[0.01]">
        {lines.map((line, i) => (
            <SubtitleBlock 
                key={i} line={line} prevLine={lines[i-1]} nextLine={lines[i+1]}
                color={color} zoom={zoom} fontSize={fontSize}
                isActive={currentTime >= line.start && currentTime <= line.end}
                isSelected={selectedLines.includes(i)}
                onSelect={(m) => onSelect(i, m)}
                onTimeChange={(s, e) => onTimeChange(i, s, e)}
            />
        ))}
    </div>
);

const SubtitleBlock: React.FC<{ 
    line: any, prevLine: any, nextLine: any, color: string, zoom: number, fontSize: number,
    isActive: boolean, isSelected: boolean, onSelect: (isMulti: boolean) => void, 
    onTimeChange: (start: number, end: number) => void 
}> = ({ line, prevLine, nextLine, color, zoom, fontSize, isActive, isSelected, onSelect, onTimeChange }) => {
    const blockRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const colors: any = { sky: 'bg-sky-500/10 border-sky-500/30 text-sky-200', emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200', amber: 'bg-amber-500/10 border-amber-500/30 text-amber-200' };

    const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'left' | 'right') => {
        e.stopPropagation(); onSelect(e.ctrlKey || e.metaKey); setIsDragging(true);
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
            ref={blockRef} 
            className={`subtitle-block absolute top-6 bottom-6 rounded-2xl border px-6 flex items-center transition-all cursor-grab active:cursor-grabbing ${colors[color]} ${isActive ? 'brightness-125 border-white/40 z-30 shadow-lg' : 'opacity-70 hover:opacity-100'} ${isSelected ? 'ring-2 ring-white z-40 scale-y-105 shadow-2xl bg-white/5' : ''} ${isDragging ? 'shadow-2xl z-50 cursor-grabbing' : ''}`}
            style={{ left: `${line.start * zoom}px`, width: `${(line.end - line.start) * zoom}px`, minWidth: '4px' }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
        >
            <div className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-white/20 rounded-l-2xl" onMouseDown={(e) => handleMouseDown(e, 'left')} />
            <span className="font-bold line-clamp-3 leading-tight overflow-hidden pointer-events-none select-none tracking-tight" style={{ fontSize: `${fontSize}px` }}>{line.text}</span>
            <div className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-white/20 rounded-r-2xl" onMouseDown={(e) => handleMouseDown(e, 'right')} />
        </div>
    );
};
