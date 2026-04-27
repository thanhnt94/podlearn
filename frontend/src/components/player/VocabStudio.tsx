import React, { useState, useEffect, useRef } from 'react';
import { 
    ChevronLeft, Search, Link2, Unlink,
    X, Zap, Loader2, Play, Pause, Plus, 
    FastForward, Rewind, ArrowDown, ArrowUp, Save
} from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';
import { VideoSection } from './VideoSection';
import axios from 'axios';

interface TokenData {
    surface: string;
    lemma_override: string | null;
}

interface VocabStudioProps {
    isOpen: boolean;
    onClose: () => void;
}

export const VocabStudio: React.FC<VocabStudioProps> = ({ isOpen, onClose }) => {
    const { 
        lessonId, s1Lines, activeLineIndex, requestSeek, 
        isPlaying, setPlaying, scanFullLesson, fetchAnalyzedWords, currentTime
    } = usePlayerStore();

    const [selectedLineIdx, setSelectedLineIdx] = useState(activeLineIndex !== -1 ? activeLineIndex : 0);
    const [editTokens, setEditTokens] = useState<TokenData[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [lineAnalysis, setLineAnalysis] = useState<any[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);

    // Resizable panel
    const [sidebarWidth, setSidebarWidth] = useState(380);
    const [isResizingPanel, setIsResizingPanel] = useState(false);

    const lineListRef = useRef<HTMLDivElement>(null);
    const selectedLineRef = useRef<HTMLButtonElement>(null);

    // Sync selected line with active playback line
    useEffect(() => {
        if (autoScroll && activeLineIndex !== -1 && activeLineIndex !== selectedLineIdx) {
            setSelectedLineIdx(activeLineIndex);
        }
    }, [activeLineIndex, autoScroll]);

    // Auto-scroll the line list
    useEffect(() => {
        if (autoScroll && selectedLineRef.current && lineListRef.current) {
            selectedLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedLineIdx, autoScroll]);

    // Fetch analysis for selected line
    useEffect(() => {
        const fetchLineData = async () => {
            const line = s1Lines[selectedLineIdx];
            if (!line) return;

            setIsAnalyzing(true);
            try {
                const res = await axios.post('/api/video/analyze-sentence', {
                    text: line.text,
                    lang: 'ja',
                    lesson_id: lessonId,
                    active_line_index: selectedLineIdx
                });
                const words = res.data.words || [];
                setLineAnalysis(words);
                setEditTokens(words.map((w: any) => ({
                    surface: w.surface,
                    lemma_override: w.lemma_override || (w.lemma && w.lemma !== w.surface ? w.lemma : null)
                })));
            } catch (e) {
                console.error(e);
            } finally {
                setIsAnalyzing(false);
            }
        };

        if (isOpen) fetchLineData();
    }, [selectedLineIdx, lessonId, isOpen]);

    // Panel Resize
    useEffect(() => {
        if (!isResizingPanel) return;
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = e.clientX;
            if (newWidth >= 300 && newWidth <= 600) setSidebarWidth(newWidth);
        };
        const handleMouseUp = () => setIsResizingPanel(false);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingPanel]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            switch (e.code) {
                case 'Space': e.preventDefault(); setPlaying(!isPlaying); break;
                case 'ArrowLeft': e.preventDefault(); requestSeek(currentTime - 5); break;
                case 'ArrowRight': e.preventDefault(); requestSeek(currentTime + 5); break;
                case 'ArrowUp': 
                    e.preventDefault(); 
                    setSelectedLineIdx(prev => Math.max(0, prev - 1)); 
                    setAutoScroll(false);
                    break;
                case 'ArrowDown': 
                    e.preventDefault(); 
                    setSelectedLineIdx(prev => Math.min(s1Lines.length - 1, prev + 1));
                    setAutoScroll(false);
                    break;
                case 'KeyS':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        handleSaveLine();
                    }
                    break;
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isPlaying, currentTime, isOpen, selectedLineIdx, s1Lines.length, editTokens]);

    const handleSaveLine = async () => {
        if (!lessonId) return;
        setIsSaving(true);
        try {
            await axios.post('/api/vocab/tokens/save', {
                lesson_id: lessonId,
                line_index: selectedLineIdx,
                tokens: editTokens.map(t => ({
                    surface: t.surface,
                    lemma_override: t.lemma_override
                }))
            });
            // Refresh analysis
            const line = s1Lines[selectedLineIdx];
            const res = await axios.post('/api/video/analyze-sentence', {
                text: line.text,
                lang: 'ja',
                lesson_id: lessonId,
                active_line_index: selectedLineIdx
            });
            setLineAnalysis(res.data.words || []);
            
            // Refresh the player's focus bar if this is the active line
            if (selectedLineIdx === activeLineIndex) {
                await fetchAnalyzedWords(line.text, 'ja');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAutoScanAll = async () => {
        if (!confirm("This will overwrite all segmentations with auto-analysis (including lemma detection). Continue?")) return;
        setIsScanning(true);
        try {
            await scanFullLesson('mazii_offline');
            // Refresh current selected line
            const line = s1Lines[selectedLineIdx];
            if (line) {
                const res = await axios.post('/api/video/analyze-sentence', {
                    text: line.text, lang: 'ja', lesson_id: lessonId, active_line_index: selectedLineIdx
                });
                const words = res.data.words || [];
                setLineAnalysis(words);
                setEditTokens(words.map((w: any) => ({
                    surface: w.surface,
                    lemma_override: w.lemma_override || (w.lemma && w.lemma !== w.surface ? w.lemma : null)
                })));
            }
        } catch (e) {
            alert("Scan failed");
        } finally {
            setIsScanning(false);
        }
    };

    const handleAutoDetectLine = async () => {
        const line = s1Lines[selectedLineIdx];
        if (!line) return;
        setIsAnalyzing(true);
        try {
            // Force re-analyze without saved tokens by using the raw analyze endpoint
            const res = await axios.post('/api/video/analyze-sentence', {
                text: line.text, lang: 'ja'
                // No lesson_id → skip saved tokens, get fresh analysis
            });
            const words = res.data.words || [];
            setEditTokens(words.map((w: any) => ({
                surface: w.surface,
                lemma_override: w.lemma && w.lemma !== w.surface ? w.lemma : null
            })));
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const addToken = () => {
        setEditTokens([...editTokens, { surface: '', lemma_override: null }]);
    };

    const removeToken = (i: number) => {
        setEditTokens(editTokens.filter((_, idx) => idx !== i));
    };

    const updateTokenSurface = (i: number, val: string) => {
        const newTokens = [...editTokens];
        newTokens[i] = { ...newTokens[i], surface: val };
        setEditTokens(newTokens);
    };

    const updateTokenLemma = (i: number, val: string) => {
        const newTokens = [...editTokens];
        newTokens[i] = { ...newTokens[i], lemma_override: val || null };
        setEditTokens(newTokens);
    };

    const selectLine = (idx: number) => {
        setSelectedLineIdx(idx);
        setAutoScroll(false);
        const line = s1Lines[idx];
        if (line) requestSeek(line.start);
    };

    const filteredLines = searchTerm 
        ? s1Lines.filter(l => l.text.toLowerCase().includes(searchTerm.toLowerCase()))
        : s1Lines;

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' + sec : sec}`;
    };

    if (!isOpen) return null;

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col overflow-hidden font-inter text-slate-200"
        >
            {/* ═══════════════════════ HEADER ═══════════════════════ */}
            <div className="flex items-center justify-between px-8 py-3 border-b border-white/10 bg-slate-900/80 backdrop-blur-2xl shrink-0">
                <div className="flex items-center gap-6">
                    <button onClick={onClose} className="group flex items-center gap-2 p-2 text-slate-400 hover:text-white transition-all bg-white/5 rounded-xl border border-white/5">
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h2 className="text-lg font-black text-white tracking-tighter uppercase leading-none">
                            Vocab Studio <span className="text-amber-500 italic">v2.0</span>
                        </h2>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Segmentation • Lemma Linking • Dictionary Override</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleAutoScanAll}
                        disabled={isScanning}
                        className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 text-slate-950 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-sky-400 transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] disabled:opacity-50"
                    >
                        {isScanning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} fill="currentColor" />}
                        Auto-Analyze All
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white text-slate-950 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                        Finish
                    </button>
                </div>
            </div>

            {/* ═══════════════════════ MAIN AREA ═══════════════════════ */}
            <div className="flex-1 flex flex-row overflow-hidden relative">
                
                {/* ─────── LEFT PANEL: Sentence List ─────── */}
                <div style={{ width: `${sidebarWidth}px` }} className="flex flex-col bg-slate-950 border-r border-white/5 shrink-0 overflow-hidden">
                    
                    {/* Sentence List Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-900/10 shrink-0">
                        <div className="flex flex-col gap-3 w-full">
                            <div className="flex items-center px-3 gap-2 bg-slate-900 rounded-xl border border-white/5 focus-within:border-sky-500/30 transition-all">
                                <Search size={12} className="text-slate-600" />
                                <input 
                                    type="text"
                                    placeholder="Search sentences..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-transparent py-2 text-[10px] font-bold focus:outline-none placeholder:text-slate-700 text-white w-full"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <button 
                                    onClick={() => setAutoScroll(!autoScroll)}
                                    className={`flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all ${autoScroll ? 'text-sky-400 bg-sky-500/10 border border-sky-500/20' : 'text-slate-600 hover:text-white'}`}
                                >
                                    {autoScroll ? <ArrowDown size={10} /> : <ArrowUp size={10} />}
                                    Auto-Scroll
                                </button>
                                <span className="text-[8px] font-mono text-slate-700">{s1Lines.length} lines</span>
                            </div>
                        </div>
                    </div>

                    {/* Sentence List */}
                    <div ref={lineListRef} className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950/50">
                        {filteredLines.map((line) => {
                            const actualIdx = s1Lines.indexOf(line);
                            const isSelected = selectedLineIdx === actualIdx;
                            const isActive = currentTime >= line.start && currentTime <= line.end;

                            return (
                                <button
                                    key={actualIdx}
                                    ref={isSelected ? selectedLineRef : null}
                                    onClick={() => selectLine(actualIdx)}
                                    className={`w-full text-left px-4 py-4 border-b border-white/[0.03] transition-all relative group ${
                                        isSelected 
                                        ? 'bg-sky-500/10 border-l-4 border-l-sky-500' 
                                        : isActive 
                                        ? 'bg-emerald-500/5 border-l-4 border-l-emerald-500/30' 
                                        : 'hover:bg-white/[0.03] border-l-4 border-l-transparent'
                                    }`}
                                >
                                    {/* Line header */}
                                    <div className="flex items-center gap-3 mb-1.5">
                                        <span className={`text-[8px] font-black uppercase ${isSelected ? 'text-sky-400' : 'text-slate-800'}`}>#{actualIdx + 1}</span>
                                        <span className="text-[8px] font-mono text-slate-800">{formatTime(line.start)}</span>
                                        {isActive && <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />}
                                    </div>

                                    {/* Line text */}
                                    <p className={`text-xs font-bold leading-relaxed ${isSelected ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                                        {line.text}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ─────── Resize Handle ─────── */}
                <div 
                    onMouseDown={() => setIsResizingPanel(true)} 
                    className={`w-1 cursor-col-resize hover:bg-sky-500/50 transition-colors z-30 shrink-0 flex items-center justify-center ${isResizingPanel ? 'bg-sky-500' : 'bg-white/5'}`}
                >
                    <div className="w-[1px] h-12 bg-white/10 rounded-full" />
                </div>

                {/* ─────── RIGHT PANEL: Video + Token Inspector ─────── */}
                <div className="flex-1 flex flex-col bg-slate-900/10 relative overflow-hidden">
                    
                    {/* Top Section: Video & Controls */}
                    <div className="flex flex-col md:flex-row items-center gap-6 p-6 border-b border-white/5 bg-slate-950/40">
                        {/* Mini Video Player */}
                        <div className="w-full md:w-[400px] aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative shrink-0">
                            <VideoSection />
                            {/* Overlay Controls */}
                            <div className="absolute inset-0 flex items-center justify-center gap-6 bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                                <button onClick={() => requestSeek(currentTime - 5)} className="p-3 bg-black/60 rounded-full text-white hover:bg-sky-500 transition-all">
                                    <Rewind size={20} />
                                </button>
                                <button onClick={() => setPlaying(!isPlaying)} className="w-14 h-14 bg-white text-slate-950 rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-xl">
                                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} className="ml-1" fill="currentColor" />}
                                </button>
                                <button onClick={() => requestSeek(currentTime + 5)} className="p-3 bg-black/60 rounded-full text-white hover:bg-sky-500 transition-all">
                                    <FastForward size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Current Sentence Display & Quick Actions */}
                        <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400 text-[10px] font-black uppercase tracking-widest">
                                    Active Sentence #{selectedLineIdx + 1}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setSelectedLineIdx(p => Math.max(0, p-1))} className="p-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5"><ArrowUp size={14}/></button>
                                    <button onClick={() => setSelectedLineIdx(p => Math.min(s1Lines.length-1, p+1))} className="p-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5"><ArrowDown size={14}/></button>
                                </div>
                            </div>
                            <h2 className="text-2xl font-black text-white leading-tight tracking-tight">
                                {s1Lines[selectedLineIdx]?.text || '—'}
                            </h2>
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={handleAutoDetectLine}
                                    disabled={isAnalyzing}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all border border-white/10"
                                >
                                    <Zap size={14} className="text-amber-500" /> Auto-Detect Tokens
                                </button>
                                <button 
                                    onClick={handleSaveLine}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-[0_10px_20px_rgba(16,185,129,0.2)]"
                                >
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Save Changes (Ctrl+S)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Section: Scrollable Token Editor */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                        <div className="max-w-4xl mx-auto space-y-8">
                            
                            {/* Live Preview (Big) */}
                            <div className="bg-slate-950/40 rounded-[2.5rem] border border-white/5 p-10 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-sky-500" />
                                <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest block mb-8 opacity-60">Visual Preview</span>
                                <div className="flex flex-wrap items-end justify-center gap-x-8 gap-y-10">
                                    {isAnalyzing ? (
                                        <div className="flex flex-col items-center gap-4 py-10">
                                            <Loader2 className="animate-spin text-sky-500" size={40} />
                                            <span className="text-[10px] font-black text-slate-500 uppercase">Analyzing linguistic structure...</span>
                                        </div>
                                    ) : lineAnalysis.length > 0 ? (
                                        lineAnalysis.map((word, i) => (
                                            <div key={i} className="flex flex-col items-center gap-2 group">
                                                {word.furigana && <span className="text-sm font-bold text-sky-400/80">{word.furigana}</span>}
                                                <span className="text-4xl md:text-5xl font-black text-white group-hover:text-sky-400 transition-colors">{word.surface}</span>
                                                {word.lemma_override && (
                                                    <span className="text-[10px] font-black text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                                        LINKED: {word.lemma_override}
                                                    </span>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-slate-600 font-bold uppercase tracking-widest text-xs py-10 italic">No analysis data available</p>
                                    )}
                                </div>
                            </div>

                            {/* Token Editor Grid */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Token Segmentation Editor ({editTokens.length})</h4>
                                    <button 
                                        onClick={addToken}
                                        className="flex items-center gap-2 px-4 py-2 bg-sky-500/10 text-sky-400 rounded-lg text-[10px] font-black uppercase hover:bg-sky-500/20 transition-all border border-sky-500/20"
                                    >
                                        <Plus size={14} /> Add Word
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {editTokens.map((token, i) => (
                                        <div key={i} className="flex items-center gap-4 p-5 bg-slate-900/60 rounded-3xl border border-white/5 hover:border-sky-500/30 transition-all group relative">
                                            <div className="flex-1 space-y-3">
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Surface Form</span>
                                                    <input 
                                                        type="text" 
                                                        value={token.surface} 
                                                        onChange={(e) => updateTokenSurface(i, e.target.value)}
                                                        className="w-full bg-slate-950/50 text-base font-bold text-white outline-none px-4 py-2 rounded-xl border border-white/5 focus:border-sky-500/50 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-black text-amber-500/60 uppercase tracking-widest flex items-center gap-1">
                                                        <Link2 size={10} /> Dictionary Lemma (Link)
                                                    </span>
                                                    <div className="relative">
                                                        <input 
                                                            type="text" 
                                                            value={token.lemma_override || ''} 
                                                            onChange={(e) => updateTokenLemma(i, e.target.value)}
                                                            className="w-full bg-amber-500/5 text-sm font-bold text-amber-200 outline-none px-4 py-2 rounded-xl border border-amber-500/10 focus:border-amber-500/50 transition-all"
                                                            placeholder={`= ${token.surface}`}
                                                        />
                                                        {token.lemma_override && (
                                                            <button 
                                                                onClick={() => updateTokenLemma(i, '')}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-amber-500 transition-colors"
                                                            >
                                                                <Unlink size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => removeToken(i)}
                                                className="p-2 text-slate-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 bg-slate-900 rounded-full border border-white/10"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
