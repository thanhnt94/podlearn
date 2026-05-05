import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    ChevronLeft, Search, Unlink,
    Zap, Loader2, Plus, 
    ArrowDown, ArrowUp, Save,
    List, Map, ExternalLink, Copy, CheckCircle2, Circle,
    Database, FileText, Trash2, Eye, EyeOff, GripVertical,
    Sparkles, Layers, RefreshCw, Code, Maximize2, Minimize2
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';
import axios from 'axios';

interface TokenData {
    id: string; 
    raw: string; 
    lemma_override: string | null;
    is_skipped?: boolean;
}

interface VocabStudioProps {
    isOpen: boolean;
    onClose: () => void;
}

type StudioTab = 'editor' | 'word-map';

export const VocabStudio: React.FC<VocabStudioProps> = ({ isOpen, onClose }) => {
    const { 
        lessonId, activeLineIndex, requestSeek, 
        scanFullLesson, fetchAnalyzedWords,
        wordMap, isWordMapLoading, fetchWordMap, updateWordStatus,
        vocabEditorMode, setVocabEditorMode,
        availableTracks, trackIds,
        activeTrackId, setActiveTrackId
    } = usePlayerStore();

    const [activeTab, setActiveTab] = useState<StudioTab>('editor');
    const [selectedLineIdx, setSelectedLineIdx] = useState(activeLineIndex !== -1 ? activeLineIndex : 0);
    const [editTokens, setEditTokens] = useState<TokenData[]>([]);
    const [rawMarkup, setRawMarkup] = useState('');
    
    const [isSaving, setIsSaving] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const [wordMapSearch, setWordMapSearch] = useState('');
    const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);


    const [trackLines, setTrackLines] = useState<any[]>([]);
    const [isLoadingTrack, setIsLoadingTrack] = useState(false);
    const [propDialog, setPropDialog] = useState<{ isOpen: boolean; tokenIndex: number; newStatus: boolean } | null>(null);
    const [sidebarWidth] = useState(380);

    const lineListRef = useRef<HTMLDivElement>(null);
    const selectedLineRef = useRef<HTMLButtonElement>(null);

    // Initialize active track
    useEffect(() => {
        if (isOpen && lessonId && availableTracks.length > 0 && !activeTrackId) {
            const defaultId = trackIds.s1 || availableTracks[0].id;
            setActiveTrackId(defaultId);
        }
    }, [isOpen, lessonId, availableTracks, trackIds.s1]);

    // Fetch lines
    useEffect(() => {
        const fetchLines = async () => {
            if (!activeTrackId) return;
            setIsLoadingTrack(true);
            try {
                const res = await axios.get(`/api/content/subtitles/${activeTrackId}`);
                const lines = (res.data.content || []).map((line: any, index: number) => ({
                    ...line, index
                }));
                setTrackLines(lines);
                if (selectedLineIdx >= lines.length) setSelectedLineIdx(0);
            } catch (e) {
                console.error("Failed to fetch track lines", e);
            } finally {
                setIsLoadingTrack(false);
            }
        };
        if (isOpen) fetchLines();
    }, [activeTrackId, isOpen]);

    // Helpers
    // Removed getFuriganaGroups helper - using raw markup approach

    const buildMarkupForToken = (t: TokenData) => {
        let result = t.raw;
        if (t.is_skipped) result += '[-]';
        else if (t.lemma_override) result += `[${t.lemma_override}]`;
        return result;
    };

    const parseTokenData = (rawToken: string, fallbackReading?: string): TokenData => {
        let raw = rawToken.replace(/\[.*?\]/g, '').replace(/\|/g, '').trim();
        if (!raw.includes('{') && fallbackReading && raw.match(/[\u4e00-\u9faf\u30a0-\u30ff]/)) {
            raw = `${raw}{${fallbackReading}}`;
        }
        const lemmaMatch = rawToken.match(/\[([^-\]].*?)\]/);
        return {
            id: `token-${Date.now()}-${Math.random()}`,
            raw,
            lemma_override: lemmaMatch ? lemmaMatch[1] : null,
            is_skipped: rawToken.includes('[-]'),
        };
    };

    const renderFurigana = (raw: string, isCompact = false) => {
        if (!raw) return '';
        const parts: React.ReactNode[] = [];
        const regex = /([^{}\s]+)\{([^{}]+)\}|([^{}\s]+)|(\s+)/g;
        let m;
        while ((m = regex.exec(raw)) !== null) {
            if (m[1]) {
                parts.push(<ruby key={parts.length} className="ruby-base">{m[1]}<rt className={`ruby-text font-bold text-sky-400/90 tracking-tight ${isCompact ? 'text-[0.45em]' : 'text-[0.55em]'}`}>{m[2]}</rt></ruby>);
            } else if (m[3]) {
                parts.push(<span key={parts.length}>{m[3]}</span>);
            } else if (m[4]) {
                parts.push(<span key={parts.length} className="whitespace-pre">{m[4]}</span>);
            }
        }
        return <>{parts}</>;
    };

    const stripMarkup = (text: string) => {
        if (!text) return '';
        return text.replace(/\|/g, '').replace(/\[-\]/g, '').replace(/\[.*?\]/g, '').replace(/\{.*?\}/g, '').replace(/\s+/g, ' ').trim();
    };

    const handleRawMarkupChange = (val: string) => {
        setRawMarkup(val);
        const parts = val.split(' | ');
        const newTokens = parts.map(p => parseTokenData(p));
        setEditTokens(newTokens);
    };

    useEffect(() => {
        if (!isAnalyzing) {
            const fullMarkup = editTokens.map(t => buildMarkupForToken(t)).join(' | ');
            setRawMarkup(fullMarkup);
        }
    }, [editTokens, isAnalyzing]);

    useEffect(() => {
        const fetchLineData = async () => {
            const line = trackLines[selectedLineIdx];
            if (!line) return;
            setIsAnalyzing(true);
            try {
                const res = await axios.post('/api/study/video/analyze-sentence', {
                    text: line.text, lang: 'ja', lesson_id: lessonId, active_line_index: selectedLineIdx, mode: vocabEditorMode
                });
                const words = res.data.words || [];
                setEditTokens(words.map((w: any) => {
                    const parsed = parseTokenData(w.surface, w.reading);
                    return { ...parsed, lemma_override: w.lemma_override || (w.lemma && w.lemma !== parsed.raw.replace(/\{.*?\}/g, '') ? w.lemma : null), is_skipped: w.lemma === 'skip' || (w.lemma && w.lemma.startsWith('-')) };
                }));
            } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
        };
        if (isOpen && activeTab === 'editor' && trackLines.length > 0) fetchLineData();
    }, [selectedLineIdx, lessonId, isOpen, activeTab, vocabEditorMode, trackLines]);

    useEffect(() => {
        if (isOpen && activeTab === 'word-map' && lessonId) {
            // trackId must be converted to something axios-safe (number or string, but NOT null/NaN)
            const tid = activeTrackId !== null ? activeTrackId : undefined;
            fetchWordMap(tid as any);
        }
    }, [activeTab, isOpen, activeTrackId, lessonId, fetchWordMap]);

    const handleSaveLine = async () => {
        if (!lessonId || !activeTrackId) return;
        setIsSaving(true);
        try {
            const { updateSubtitleLine } = usePlayerStore.getState();
            if (vocabEditorMode === 'db') {
                await axios.post('/api/study/vocab/tokens/save', {
                    lesson_id: lessonId, line_index: selectedLineIdx,
                    tokens: editTokens.map(t => ({ surface: buildMarkupForToken(t), lemma: t.lemma_override || t.raw.replace(/\{.*?\}/g, ''), is_skipped: t.is_skipped })),
                    sync_global: true
                });
                const cleanText = stripMarkup(trackLines[selectedLineIdx].text);
                const newLines = [...trackLines];
                newLines[selectedLineIdx] = { ...newLines[selectedLineIdx], text: cleanText };
                setTrackLines(newLines);
                if (activeTrackId === trackIds.s1) await updateSubtitleLine('s1', selectedLineIdx, { text: cleanText });
            } else {
                await axios.patch(`/api/study/subtitles/${activeTrackId}/line/${selectedLineIdx}`, { text: rawMarkup });
                const newLines = [...trackLines];
                newLines[selectedLineIdx] = { ...newLines[selectedLineIdx], text: rawMarkup };
                setTrackLines(newLines);
                if (activeTrackId === trackIds.s1) await updateSubtitleLine('s1', selectedLineIdx, { text: rawMarkup });
                await axios.delete('/api/study/vocab/tokens/clear', { data: { lesson_id: lessonId, line_index: selectedLineIdx } });
            }
            if (selectedLineIdx === activeLineIndex && activeTrackId === trackIds.s1) {
                await fetchAnalyzedWords(vocabEditorMode === 'sub' ? rawMarkup : stripMarkup(trackLines[selectedLineIdx].text), 'ja');
            }
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };

    const handleAutoDetectLine = async () => {
        const line = trackLines[selectedLineIdx];
        if (!line) return;
        setIsAnalyzing(true);
        try {
            const res = await axios.post('/api/study/video/analyze-sentence', { text: stripMarkup(line.text), lang: 'ja' });
            const words = res.data.words || [];
            setEditTokens(words.map((w: any) => {
                const parsed = parseTokenData(w.surface, w.reading);
                return { ...parsed, lemma_override: w.lemma && w.lemma !== parsed.raw.replace(/\{.*?\}/g, '') ? w.lemma : null, is_skipped: w.lemma === 'skip' };
            }));
        } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
    };

    const handleAutoScanAll = async () => {
        if (!confirm("Overwrite with auto-analysis?")) return;
        setIsScanning(true);
        try { await scanFullLesson('mazii_offline'); handleAutoDetectLine(); } catch (e) { alert("Scan failed"); } finally { setIsScanning(false); }
    };

    const addToken = (index?: number) => {
        const newToken = { id: `new-${Date.now()}`, raw: '', lemma_override: null, is_skipped: false };
        const newTokens = [...editTokens];
        if (index !== undefined) newTokens.splice(index + 1, 0, newToken);
        else newTokens.push(newToken);
        setEditTokens(newTokens);
    };

    const removeToken = (i: number) => setEditTokens(editTokens.filter((_, idx) => idx !== i));
    const updateTokenField = (i: number, field: keyof TokenData, val: any) => {
        const newTokens = [...editTokens]; newTokens[i] = { ...newTokens[i], [field]: val };
        setEditTokens(newTokens);
    };
    const handleToggleSkip = (i: number) => setPropDialog({ isOpen: true, tokenIndex: i, newStatus: !editTokens[i].is_skipped });
    const confirmSkipAction = async (applyGlobally: boolean) => {
        if (!propDialog) return; const { tokenIndex, newStatus } = propDialog; const token = editTokens[tokenIndex]; updateTokenField(tokenIndex, 'is_skipped', newStatus);
        if (applyGlobally) { try { const lemma = token.lemma_override || token.raw.replace(/\{.*?\}/g, ''); await axios.post('/api/study/vocab/propagate', { lesson_id: lessonId, lemma, status: newStatus ? 'skip' : 'use' }); updateWordStatus(lemma, newStatus ? 'skip' : 'use'); fetchWordMap(activeTrackId as any); } catch (e) { console.error("Propagation failed", e); } }
        setPropDialog(null);
    };



    const selectLine = (idx: number) => { setSelectedLineIdx(idx); setAutoScroll(false); const line = trackLines[idx]; if (line) requestSeek(line.start); };
    const copyWordMapToClipboard = () => { const text = wordMap.filter(w => w.status === 'use').map(w => `${w.reading || w.lemma} | [FREQ: ${w.frequency}]`).join('\n'); navigator.clipboard.writeText(text); };
    const filteredLines = searchTerm ? trackLines.filter(l => l.text.toLowerCase().includes(searchTerm.toLowerCase())) : trackLines;
    const filteredWordMap = wordMapSearch ? wordMap.filter(w => w.lemma.toLowerCase().includes(wordMapSearch.toLowerCase()) || w.reading?.toLowerCase().includes(wordMapSearch.toLowerCase())) : wordMap;
    const wordMapStats = useMemo(() => {
        const stats = { total: wordMap.length, use: wordMap.filter(w => w.status === 'use').length, skip: wordMap.filter(w => w.status === 'skip').length, totalFreq: wordMap.reduce((acc, w) => acc + (w.frequency || 0), 0), sources: {} as Record<string, number> };
        wordMap.forEach(w => { const src = (w as any).source || 'none'; stats.sources[src] = (stats.sources[src] || 0) + 1; });
        return stats;
    }, [wordMap]);

    if (!isOpen) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-[#020617] flex flex-col overflow-hidden font-inter text-slate-200">
            {/* Optimized Header (Fixed) */}
            <div className="flex items-center justify-between px-6 py-2.5 border-b border-white/5 bg-slate-900/40 backdrop-blur-3xl shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition-all bg-white/5 rounded-lg border border-white/5"><ChevronLeft size={18} /></button>
                    <div>
                        <h2 className="text-sm font-black text-white tracking-tighter uppercase flex items-center gap-2">Vocab Studio <span className="px-1.5 py-0.5 bg-sky-500/10 text-sky-400 text-[8px] rounded border border-sky-500/20 italic">v8.0</span></h2>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-950/50 p-0.5 rounded-xl border border-white/5">
                        <select value={activeTrackId || ''} onChange={(e) => setActiveTrackId(e.target.value)} className="bg-transparent text-[9px] font-bold text-white outline-none border-none py-1 pl-3 pr-2">
                            {availableTracks.map(t => (<option key={t.id} value={t.id} className="bg-slate-900">{t.name}</option>))}
                        </select>
                    </div>
                    <div className="flex p-0.5 bg-slate-950/50 rounded-xl border border-white/5">
                        <button onClick={() => setVocabEditorMode('db')} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${vocabEditorMode === 'db' ? 'bg-sky-500 text-slate-950 shadow-inner' : 'text-slate-500'}`}><Database size={12} className="inline mr-1" />DB</button>
                        <button onClick={() => setVocabEditorMode('sub')} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${vocabEditorMode === 'sub' ? 'bg-amber-500 text-slate-950 shadow-inner' : 'text-slate-500'}`}><FileText size={12} className="inline mr-1" />Sub</button>
                    </div>
                    <button onClick={onClose} className="px-6 py-1.5 bg-white text-slate-950 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-200">Finish</button>
                </div>
            </div>

            <div className="flex-1 flex flex-row overflow-hidden relative">
                <div className="w-14 bg-slate-950/80 border-r border-white/5 flex flex-col items-center py-6 gap-6 shrink-0">
                    <button onClick={() => setActiveTab('editor')} className={`p-2.5 rounded-xl transition-all ${activeTab === 'editor' ? 'bg-sky-500 text-slate-950 shadow-xl shadow-sky-500/40' : 'text-slate-600 hover:text-white'}`}><List size={20} /></button>
                    <button onClick={() => setActiveTab('word-map')} className={`p-2.5 rounded-xl transition-all ${activeTab === 'word-map' ? 'bg-sky-500 text-slate-950 shadow-xl shadow-sky-500/40' : 'text-slate-600 hover:text-white'}`}><Map size={20} /></button>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'editor' ? (
                        <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-row overflow-hidden">
                            {/* Sidebar (Fixed width) */}
                            <div style={{ width: `${sidebarWidth}px` }} className="flex flex-col bg-slate-950 border-r border-white/5 shrink-0 overflow-hidden shadow-2xl z-10">
                                <div className="p-4 border-b border-white/5 space-y-3 bg-slate-900/20">
                                    <div className="flex items-center px-3 gap-2 bg-slate-950 rounded-xl border border-white/5 focus-within:border-sky-500/40 transition-all shadow-inner"><Search size={12} className="text-slate-600" /><input type="text" placeholder="Filter..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent py-2 text-[10px] font-bold focus:outline-none placeholder:text-slate-700 text-white w-full" /></div>
                                    <div className="flex items-center justify-between"><button onClick={() => setAutoScroll(!autoScroll)} className={`flex items-center gap-2 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all ${autoScroll ? 'text-sky-400 bg-sky-500/10' : 'text-slate-600'}`}>{autoScroll ? <ArrowDown size={10} /> : <ArrowUp size={10} />}Auto-Scroll</button><span className="text-[8px] font-mono text-slate-700 uppercase tracking-widest">{trackLines.length} Segments</span></div>
                                </div>
                                <div ref={lineListRef} className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950">
                                    {isLoadingTrack ? <div className="p-10 text-center opacity-30 text-[9px] font-black uppercase">Loading...</div> : filteredLines.map((line) => {
                                        const actualIdx = trackLines.indexOf(line); const isSelected = selectedLineIdx === actualIdx;
                                        return <button key={actualIdx} ref={isSelected ? selectedLineRef : null} onClick={() => selectLine(actualIdx)} className={`w-full text-left px-5 py-4 border-b border-white/[0.02] transition-all relative group ${isSelected ? 'bg-sky-500/5 border-l-2 border-l-sky-500' : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'}`}><div className="flex items-center gap-2 mb-1 opacity-30"><span className="text-[8px] font-black font-mono">#{actualIdx + 1}</span></div><p className={`text-[13px] font-bold leading-relaxed truncate ${isSelected ? 'text-white' : 'text-slate-600'}`}>{stripMarkup(line.text)}</p></button>;
                                    })}
                                </div>
                            </div>

                            {/* Main View Area */}
                            <div className="flex-1 flex flex-col bg-slate-900/5 overflow-hidden">
                                {/* COMPACT CONTROL DASHBOARD (Sticky Top) */}
                                <div className="p-4 bg-slate-950/80 border-b border-white/5 backdrop-blur-md z-20">
                                    <div className="max-w-7xl mx-auto flex flex-col gap-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="flex flex-col shrink-0"><span className="text-[8px] font-black text-sky-500 uppercase tracking-[0.2em]">Segmentation</span><h3 className="text-xs font-black text-white uppercase">#{selectedLineIdx + 1}</h3></div>
                                                
                                                {/* COMPACT PREVIEW BOX */}
                                                <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6 py-3 bg-slate-950/60 rounded-2xl border border-white/5 shadow-inner transition-all flex-1 min-h-[60px] ${isPreviewExpanded ? 'min-h-[120px] py-6' : ''}`}>
                                                    {isAnalyzing ? <Loader2 className="animate-spin text-sky-500/30" size={20} /> : editTokens.length > 0 ? editTokens.map((token) => (
                                                        <div key={token.id} className="flex flex-col items-center group relative">
                                                            <span className={`font-black transition-all ${token.is_skipped ? 'text-slate-800 line-through' : 'text-white group-hover:text-sky-400'} ${isPreviewExpanded ? 'text-5xl' : 'text-3xl'}`}>{renderFurigana(token.raw, !isPreviewExpanded)}</span>
                                                        </div>
                                                    )) : <span className="text-slate-800 text-[8px] font-black uppercase">Empty</span>}
                                                </div>
                                                <button onClick={() => setIsPreviewExpanded(!isPreviewExpanded)} className="p-2 text-slate-700 hover:text-slate-400 transition-colors">{isPreviewExpanded ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}</button>
                                            </div>

                                            <div className="flex flex-col gap-2 shrink-0">
                                                <button onClick={handleSaveLine} disabled={isSaving} className="flex items-center justify-center gap-2 px-6 py-2 bg-emerald-500 text-slate-950 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-400 shadow-lg shadow-emerald-500/20">{isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Line</button>
                                                <button onClick={handleAutoDetectLine} className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-900 text-amber-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 border border-white/10"><Zap size={12} fill="currentColor" /> AI Detect</button>
                                            </div>
                                        </div>

                                        {/* COMPACT RAW EDITOR */}
                                        <div className="flex items-center gap-3 bg-slate-950/80 rounded-2xl px-4 py-2 border border-white/5 shadow-inner">
                                            <div className="shrink-0 text-slate-700"><Code size={12} /></div>
                                            <input value={rawMarkup} onChange={(e) => handleRawMarkupChange(e.target.value)} className="flex-1 bg-transparent text-[10px] font-mono text-amber-200/60 outline-none focus:text-amber-200 transition-colors" placeholder="Source Markup (A{B} | C{D})..." />
                                            <button onClick={handleAutoScanAll} disabled={isScanning} className="text-[8px] font-black text-slate-600 hover:text-sky-400 uppercase tracking-widest flex items-center gap-1">Bulk Scan</button>
                                        </div>
                                    </div>
                                </div>

                                {/* SCROLLABLE EDITOR GRID (Maximize this space) */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-950/20">
                                    <div className="max-w-6xl mx-auto">
                                        <div className="flex items-center justify-between mb-4 px-2"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Token Precision Tool ({editTokens.length})</span><button onClick={() => addToken()} className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/5 text-sky-400 rounded-lg text-[9px] font-black uppercase hover:bg-sky-500/10 border border-sky-500/20 transition-all"><Plus size={12} /> Insert</button></div>
                                        <Reorder.Group axis="y" values={editTokens} onReorder={setEditTokens} className="space-y-3 pb-20">
                                            {editTokens.map((token, i) => (
                                                <Reorder.Item key={token.id} value={token} className={`flex flex-col gap-2 p-4 rounded-xl border transition-all group ${token.is_skipped ? 'bg-slate-900/40 border-red-500/5 opacity-40' : 'bg-slate-900/60 border-white/5 hover:border-sky-500/10 shadow-lg'}`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className="cursor-grab active:cursor-grabbing text-slate-800 hover:text-slate-600 transition-colors shrink-0"><GripVertical size={16} /></div>
                                                        
                                                        {/* RAW CODE INPUT */}
                                                        <div className="flex-[2] relative">
                                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-500/40 font-black text-[8px] uppercase tracking-widest">CODE</div>
                                                            <input type="text" value={token.raw} onChange={(e) => updateTokenField(i, 'raw', e.target.value)} className="w-full bg-slate-950/30 text-sm font-black text-white outline-none pl-12 pr-3 py-2.5 rounded-lg border border-white/5 focus:border-sky-500/30" placeholder="Surface{Furigana}..." />
                                                        </div>

                                                        {/* PREVIEW (LIVE) */}
                                                        <div className="flex-1 bg-slate-950/20 px-4 py-2 rounded-lg border border-white/5 flex items-center justify-center min-w-[100px]">
                                                            <span className="text-xl font-black text-white">{renderFurigana(token.raw, true)}</span>
                                                        </div>

                                                        {/* LEMMA / DICTIONARY LINK */}
                                                        <div className="flex-[2] relative">
                                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/20 font-black text-[8px] uppercase tracking-widest">LEMMA</div>
                                                            <input type="text" value={token.lemma_override || ''} onChange={(e) => updateTokenField(i, 'lemma_override', e.target.value || null)} className="w-full bg-amber-500/5 text-[12px] font-bold text-amber-200/70 outline-none pl-12 pr-8 py-2.5 rounded-lg border border-amber-500/5 focus:border-amber-500/20" placeholder={`Auto: ${token.raw.replace(/\{.*?\}/g, '')}`} />
                                                            {token.lemma_override && <button onClick={() => updateTokenField(i, 'lemma_override', null)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-800 hover:text-amber-500"><Unlink size={12} /></button>}
                                                        </div>

                                                        {/* ACTIONS */}
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button onClick={() => handleToggleSkip(i)} className={`p-2 rounded-lg transition-all border ${token.is_skipped ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-white/5 text-slate-700 hover:text-red-400 border-white/5'}`}>{token.is_skipped ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                                                            <button onClick={() => addToken(i)} className="p-2 bg-white/5 text-slate-700 hover:text-sky-400 rounded-lg"><Plus size={14} /></button>
                                                            <button onClick={() => removeToken(i)} className="p-2 bg-white/5 text-slate-700 hover:text-red-500 rounded-lg"><Trash2 size={14} /></button>
                                                        </div>
                                                    </div>
                                                </Reorder.Item>
                                            ))}
                                        </Reorder.Group>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="word-map" initial={{ x: 10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex-1 flex flex-col bg-[#020617] overflow-hidden">
                            <div className="px-12 py-8 border-b border-white/5 flex flex-col bg-slate-900/10 shrink-0 gap-8">
                                <div className="flex items-center justify-between w-full">
                                    <div className="space-y-1"><h3 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">Word Map</h3><p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Dictionary Engine</p></div>
                                    <div className="flex items-center gap-6"><div className="flex items-center px-4 gap-3 bg-slate-950 rounded-2xl border border-white/10 w-80 shadow-inner"><Search size={16} className="text-slate-600" /><input type="text" placeholder="Filter..." value={wordMapSearch} onChange={(e) => setWordMapSearch(e.target.value)} className="bg-transparent py-3 text-xs font-bold focus:outline-none placeholder:text-slate-800 text-white w-full" /></div><button onClick={() => fetchWordMap(activeTrackId || undefined)} className="p-3 bg-slate-800 text-sky-400 hover:bg-sky-500 hover:text-slate-950 rounded-xl transition-all border border-white/5"><RefreshCw size={16} className={isWordMapLoading ? "animate-spin" : ""} /></button><button onClick={copyWordMapToClipboard} className="flex items-center gap-2 px-6 py-3 bg-white text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-xl"><Copy size={14} /> Export</button></div>
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    {[ { label: 'Total Words', val: wordMapStats.total, icon: <Layers size={14} />, col: 'sky' }, { label: 'Total Freq', val: wordMapStats.totalFreq, icon: <Sparkles size={14} />, col: 'amber' }, { label: 'Used / Skip', val: `${wordMapStats.use} / ${wordMapStats.skip}`, icon: <CheckCircle2 size={14} />, col: 'emerald' }].map((s, i) => (
                                        <div key={i} className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 flex items-center gap-3 shadow-inner">
                                            <div className={`p-2 bg-${s.col}-500/10 text-${s.col}-400 rounded-lg`}>{s.icon}</div>
                                            <div><p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">{s.label}</p><p className="text-lg font-black text-white">{s.val}</p></div>
                                        </div>
                                    ))}
                                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 flex flex-wrap gap-1.5 items-center shadow-inner overflow-hidden">
                                        {Object.entries(wordMapStats.sources).map(([src, count]) => (
                                            <span key={src} className="px-2 py-0.5 bg-white/5 text-slate-500 text-[7px] font-black uppercase rounded border border-white/5">{src}: {count}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-10"><div className="max-w-7xl mx-auto"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{filteredWordMap.map((word) => (
                                <motion.div key={word.lemma} className={`p-6 rounded-[2rem] border transition-all group shadow-lg ${word.status === 'skip' ? 'bg-slate-950/40 border-white/5 opacity-40 grayscale' : 'bg-slate-900/40 border-white/5 hover:border-sky-500/20'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-0.5"><span className="text-[9px] font-black text-slate-700 uppercase">{word.reading || '—'}</span><h4 className={`text-2xl font-black tracking-tighter ${word.status === 'skip' ? 'text-slate-600 line-through' : 'text-white'}`}>{word.lemma}</h4></div>
                                        <span className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-500 text-[9px] font-black rounded-lg">{word.frequency}</span>
                                    </div>
                                    <div className="flex items-center gap-2"><button onClick={() => updateWordStatus(word.lemma, word.status === 'skip' ? 'use' : 'skip')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${word.status === 'skip' ? 'bg-slate-800 text-slate-500 hover:bg-sky-500 hover:text-slate-950' : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'}`}>{word.status === 'skip' ? <Circle size={14} /> : <CheckCircle2 size={14} />}{word.status === 'skip' ? 'Restore' : 'Skip'}</button><button className="p-3 bg-slate-800 text-slate-600 hover:text-white rounded-xl transition-colors"><ExternalLink size={14} /></button></div>
                                </motion.div>
                            ))}</div></div></div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Propagation Dialog */}
            <AnimatePresence>
                {propDialog && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPropDialog(null)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 10 }} className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl p-8 flex flex-col items-center text-center gap-5">
                            <div className={`p-4 rounded-full ${propDialog.newStatus ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{propDialog.newStatus ? <EyeOff size={24} /> : <Eye size={24} />}</div>
                            <div className="space-y-1"><h3 className="text-lg font-black text-white uppercase tracking-tight">Sync Visibility</h3><p className="text-[11px] text-slate-400 font-medium">Update <span className="text-sky-400 font-bold">"{editTokens[propDialog.tokenIndex].raw.replace(/\{.*?\}/g, '')}"</span> globally?</p></div>
                            <div className="grid grid-cols-1 w-full gap-2 mt-2"><button onClick={() => confirmSkipAction(false)} className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">This instance only</button><button onClick={() => confirmSkipAction(true)} className="py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Global Sync</button></div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
