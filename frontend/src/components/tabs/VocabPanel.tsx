import React, { useState, useEffect, useRef } from 'react';
import { Book, Plus, Check, Search, Loader2, Activity, Globe, Languages, ChevronDown, Trash2, ChevronLeft, ChevronRight, Scissors, X, RotateCcw, GripVertical } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import axios from 'axios';

interface AnalyzedVocab {
    id: string; // STABLE UNIQUE ID for Reorder
    original: string;
    lemma: string;
    reading: string;
    pos: string;
    meanings: string[];
    source?: string;
    timestamp: number;
}

interface SavedVocab {
    item_id: number;
    term: string;
    definition: string;
    reading: string;
    source: string;
}

type DictPriority = 'jamdict' | 'mazii_online' | 'mazii_offline' | 'javidict' | 'suge' | 'edit_segments';

const DICT_OPTIONS: { value: DictPriority; label: string; desc: string }[] = [
    { value: 'mazii_offline', label: 'MAZII OFFLINE (VN)', desc: 'Vietnamese (285k terms)' },
    { value: 'javidict', label: 'JAVIDICT (VN)', desc: 'Vietnamese (80k terms)' },
    { value: 'suge', label: 'SUGE DICT (VN)', desc: 'Vietnamese (212k terms)' },
    { value: 'jamdict', label: 'JAMDICT (EN)', desc: 'English - Local' },
    { value: 'edit_segments', label: '🛠️ EDIT SEGMENTATION', desc: 'Control how sentences are split' }
];

// Helper to generate a session-stable semi-unique ID
const generateId = (lemma: string, idx: number) => `${lemma}_${idx}_${Math.random().toString(36).substr(2, 9)}`;

export const VocabPanel: React.FC = () => {
    const { 
        lessonId, s1Lines, activeLineIndex, requestSeek, 
        setPlaying, setLockedPaused, setSeeking,
        addNote, fetchNotes
    } = usePlayerStore();
    
    // States
    const [savedVocab, setSavedVocab] = useState<SavedVocab[]>([]);
    const [dynamicVocab, setDynamicVocab] = useState<AnalyzedVocab[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [newTerm, setNewTerm] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [dictPriority, setDictPriority] = useState<DictPriority>('mazii_offline');
    const [activeSubTab, setActiveSubTab] = useState<'live' | 'all'>('live');
    const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
    const currentLineStartRef = useRef<number>(0);

    // Drag-and-Drop Optimization
    const [localVocab, setLocalVocab] = useState<AnalyzedVocab[]>([]);
    const isReorderingRef = useRef(false);
    const currentTextRef = useRef<string>('');
    const hasPausedOnModeEntry = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Auto-pause only ONCE when entering Segmentation Editor
    useEffect(() => {
        if (dictPriority === 'edit_segments') {
            if (!hasPausedOnModeEntry.current) {
                setPlaying(false);
                hasPausedOnModeEntry.current = true;
            }
        } else {
            hasPausedOnModeEntry.current = false;
            setLockedPaused(false);
        }
    }, [dictPriority, setPlaying, setLockedPaused]);

    // Sync with Subtitles
    useEffect(() => {
        const line = s1Lines[activeLineIndex];
        
        // IMMEDIATE CLEANUP on Nav to prevent "stalling" visuals
        setDynamicVocab([]);
        if (!isReorderingRef.current) setLocalVocab([]);

        if (line && line.text) {
            currentLineStartRef.current = line.start;
            analyzeSentence(line.text, dictPriority);
        } else {
            setDynamicVocab([]);
            setLocalVocab([]);
            currentTextRef.current = '';
            // Don't reset ref if we're just analyzing
        }

        // Cleanup previous request if it's still running
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [activeLineIndex, s1Lines, dictPriority]);

    useEffect(() => {
        fetchSavedVocab();
    }, [lessonId, dictPriority]); 

    // DEBOUNCED SAVE for Reordering
    useEffect(() => {
        if (!isReorderingRef.current || localVocab.length === 0) return;

        const timer = setTimeout(async () => {
            console.log("Syncing reordered tokens to server...");
            const tokens = localVocab.map(v => v.lemma);
            await saveTokens(tokens);
            isReorderingRef.current = false;
        }, 1000);

        return () => clearTimeout(timer);
    }, [localVocab]);

    const analyzeSentence = async (text: string, priority: string) => {
        // Cancel any existing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        currentTextRef.current = text;
        setIsAnalyzing(true);

        try {
            const response = await axios.post('/api/vocab/analyze', { 
                text, 
                priority: priority === 'edit_segments' ? 'mazii_offline' : priority,
                lesson_id: lessonId,
                line_index: activeLineIndex,
                timestamp: currentLineStartRef.current // PASS THE TIME HERE
            }, {
                signal: abortControllerRef.current.signal
            });
            
            if (text !== currentTextRef.current) return;
            
            // Assign Stable IDs and TIMESTAMPS to Incoming Data
            const stableData: AnalyzedVocab[] = response.data.map((item: any, idx: number) => ({
                ...item,
                id: generateId(item.lemma, idx),
                timestamp: currentLineStartRef.current
            }));

            setDynamicVocab(stableData);
            
            // Sync local state for DND if not currently reordering
            if (!isReorderingRef.current) {
                setLocalVocab(stableData);
            }
        } catch (err: any) {
            if (err.name === 'CanceledError' || axios.isCancel(err)) {
                // Ignore cancelation
            } else {
                console.error("Analysis failed", err);
            }
        } finally {
            // Only stop analyzing if this was the latest text
            if (text === currentTextRef.current) {
                setIsAnalyzing(false);
            }
        }
    };

    const fetchSavedVocab = async () => {
        if (!lessonId) return;
        try {
            const response = await axios.get(`/api/vocab/list/${lessonId}`, {
                params: { priority: dictPriority === 'edit_segments' ? 'mazii_offline' : dictPriority }
            });
            setSavedVocab(response.data.vocab || []);
        } catch (err) {
            console.error("Failed to fetch saved vocab");
        }
    };

    const handleRemoveTerm = async (term: string) => {
        if (!lessonId) return;
        try {
            await axios.delete('/api/vocab/remove', {
                data: { lesson_id: lessonId, term }
            });
            fetchSavedVocab();
        } catch (err) {
            console.error("Removal failed");
        }
    };

    const handleSaveToVocab = async (item: AnalyzedVocab) => {
        const noteTimestamp = item.timestamp || 0;

        try {
            const response = await axios.post(`/api/vocab/add`, {
                lesson_id: lessonId,
                term: item.lemma,
                reading: item.reading,
                definition: Array.isArray(item.meanings) ? item.meanings.join(', ') : item.meanings,
                example: item.original,
                timestamp: noteTimestamp
            });
            
            fetchSavedVocab();
            
            if (response.data.note_id) {
                const newNote = {
                    id: response.data.note_id,
                    timestamp: noteTimestamp,
                    content: `**${item.lemma}**${item.reading ? ` [${item.reading}]` : ''}\n${Array.isArray(item.meanings) ? item.meanings.join(', ') : item.meanings}`,
                    created_at: new Date().toISOString()
                };
                addNote(newNote); // Use hook function
                
                // Track locally that we added this to show the V icon
                setJustAdded(prev => new Set(prev).add(item.id));
            }
            fetchNotes(); // Use hook function
        } catch (err) {
            console.error("Save failed", err);
        }
    };

    const handleNextLine = () => {
        if (activeLineIndex < s1Lines.length - 1) {
            const nextIdx = activeLineIndex + 1;
            const nextLine = s1Lines[nextIdx];
            if (nextLine) {
                // MODIFIED: "Buffered Preview" Nav (Play then Pause after 0.2s)
                if (dictPriority === 'edit_segments') {
                    setLockedPaused(false); // Unblock
                    setPlaying(true); // Start playing
                    requestSeek(nextLine.start + 0.1, nextIdx); // Seek to new time WITH 0.1s OFFSET
                    
                    // After 0.5s, auto-pause and re-lock
                    setTimeout(() => {
                        setPlaying(false);
                        setLockedPaused(true);
                        setSeeking(false); // Release transport lock
                    }, 500);
                } else {
                    requestSeek(nextLine.start);
                }
            }
        }
    };

    const handlePrevLine = () => {
        if (activeLineIndex > 0) {
            const prevIdx = activeLineIndex - 1;
            const prevLine = s1Lines[prevIdx];
            if (prevLine) {
                if (dictPriority === 'edit_segments') {
                    setLockedPaused(false);
                    setPlaying(true);
                    requestSeek(prevLine.start + 0.1, prevIdx);
                    
                    setTimeout(() => {
                        setPlaying(false);
                        setLockedPaused(true);
                        setSeeking(false);
                    }, 500);
                } else {
                    requestSeek(prevLine.start);
                }
            }
        }
    };

    // SEGMENTATION CONTROL ACTIONS
    const handleAddSegment = async (token: string) => {
        if (!lessonId || !token.trim()) return;
        const currentTokens = localVocab.map(v => v.lemma);
        if (currentTokens.includes(token)) return;
        
        const newTokens = [...currentTokens, token.trim()];
        await saveTokens(newTokens);
    };

    const handleRemoveSegment = async (token: string) => {
        const newTokens = localVocab.map(v => v.lemma).filter(t => t !== token);
        await saveTokens(newTokens);
    };

    const handleReorderSegments = (newVocabList: AnalyzedVocab[]) => {
        isReorderingRef.current = true;
        setLocalVocab(newVocabList);
    };

    const handleResetSegments = async () => {
        if (!lessonId) return;
        if (!confirm("Reset segmentation for this line to default?")) return;
        try {
            await axios.delete('/api/vocab/tokens/clear', {
                data: { lesson_id: lessonId, line_index: activeLineIndex }
            });
            const line = s1Lines[activeLineIndex];
            if (line) analyzeSentence(line.text, dictPriority);
        } catch (err) {
            console.error("Reset failed");
        }
    };

    const handleResetAllSegments = async () => {
        if (!lessonId) return;
        if (!confirm("Are you sure you want to reset ALL segments to default for this entire lesson? This cannot be undone.")) return;
        
        try {
            await axios.delete('/api/vocab/tokens/clear-all', { data: { lesson_id: lessonId } });
            // Re-fetch current line to reflect changes
            const line = s1Lines[activeLineIndex];
            if (line) analyzeSentence(line.text, dictPriority);
        } catch (e) {
            console.error("Reset all failed", e);
        }
    };

    const saveTokens = async (tokens: string[]) => {
        if (!lessonId) return;
        try {
            await axios.post('/api/vocab/tokens/save', {
                lesson_id: lessonId,
                line_index: activeLineIndex,
                tokens
            });
            const line = s1Lines[activeLineIndex];
            if (line) {
                const response = await axios.post('/api/vocab/analyze', { 
                    text: line.text, 
                    priority: dictPriority === 'edit_segments' ? 'mazii_offline' : dictPriority,
                    lesson_id: lessonId,
                    line_index: activeLineIndex
                });
                
                const stableData: AnalyzedVocab[] = response.data.map((item: any, idx: number) => ({
                    ...item,
                    id: generateId(item.lemma, idx)
                }));
                
                setDynamicVocab(stableData);
                if (!isReorderingRef.current) {
                    setLocalVocab(stableData);
                }
            }
        } catch (err) {
            console.error("Token save failed", err);
        }
    };

    const filteredSaved = savedVocab.filter(v => 
        v.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
        v.definition.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getBadge = (source?: string) => {
        switch(source) {
            case 'javidict': return { text: 'JD', color: 'bg-emerald-500 text-slate-950' };
            case 'suge': return { text: 'SG', color: 'bg-amber-500 text-slate-950' };
            case 'mazii_offline': return { text: 'MZO', color: 'bg-sky-500 text-slate-950' };
            case 'jamdict': return { text: 'JAM', color: 'bg-slate-700 text-slate-300' };
            default: return { text: 'OFF', color: 'bg-slate-800 text-slate-500' };
        }
    };

    const currentLine = s1Lines[activeLineIndex];

    return (
        <div className="flex flex-col h-full gap-4 pb-20 overflow-y-auto custom-scrollbar relative">
            
            {/* Header / Tab Switcher */}
            <div className="space-y-3 sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md pt-1 pb-3 shadow-2xl px-1">
                <div className="flex p-1 bg-slate-900/80 rounded-xl border border-white/5">
                    <button 
                        onClick={() => setActiveSubTab('live')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSubTab === 'live' ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Activity size={14} /> Live
                    </button>
                    <button 
                        onClick={() => setActiveSubTab('all')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSubTab === 'all' ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Book size={14} /> All Vocab
                    </button>
                </div>

                {/* Dictionary Priority Dropdown */}
                <div className="px-1 relative">
                    <div className="relative group">
                        <select 
                            value={dictPriority}
                            onChange={(e) => setDictPriority(e.target.value as DictPriority)}
                            className={`w-full bg-slate-900/50 border rounded-xl px-10 py-3 text-xs font-bold appearance-none cursor-pointer focus:outline-none transition-all hover:bg-slate-900 ${dictPriority === 'edit_segments' ? 'border-amber-500/50 text-amber-500' : 'border-white/10 text-white focus:border-sky-500'}`}
                        >
                            {DICT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        {dictPriority === 'edit_segments' ? (
                            <Scissors size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500" />
                        ) : (
                            <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-500" />
                        )}
                        <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-sky-500 transition-colors" />
                    </div>
                </div>
            </div>

            {activeSubTab === 'live' ? (
                <section className="space-y-4 px-1">
                    
                    {/* CONDITIONAL SENTENCE DISPLAY (Only in Edit mode) */}
                    {dictPriority === 'edit_segments' && (
                        <motion.div 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900/60 rounded-3xl border border-white/5 p-5 space-y-4 shadow-xl mb-2"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-white/5">
                                <button 
                                    onClick={handlePrevLine}
                                    disabled={activeLineIndex <= 0}
                                    className="p-2 text-slate-500 hover:text-sky-400 disabled:opacity-20 transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                    Sentence {activeLineIndex + 1} / {s1Lines.length}
                                </span>
                                <button 
                                    onClick={handleNextLine}
                                    disabled={activeLineIndex >= s1Lines.length - 1}
                                    className="p-2 text-slate-500 hover:text-sky-400 disabled:opacity-20 transition-colors"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                            
                            <div className="py-2">
                                <p className="text-lg font-bold text-white text-center leading-relaxed">
                                    {currentLine?.text || "No text available"}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <div className="flex-1 flex items-center px-4 gap-3 bg-slate-950/50 rounded-xl border border-amber-500/30 transition-all">
                                    <Plus size={14} className="text-amber-500" />
                                    <input 
                                        type="text"
                                        placeholder="Add custom word chunk..."
                                        value={newTerm}
                                        onChange={(e) => setNewTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleAddSegment(newTerm);
                                                setNewTerm('');
                                            }
                                        }}
                                        className="w-full bg-transparent py-3 text-[11px] font-bold focus:outline-none placeholder:text-slate-700 text-white"
                                    />
                                </div>
                                {newTerm.trim() && (
                                    <button 
                                        onClick={() => {
                                            handleAddSegment(newTerm);
                                            setNewTerm('');
                                        }}
                                        className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg bg-amber-500 text-slate-950 shadow-amber-500/20 active:scale-95"
                                    >
                                        Tag
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* DYNAMIC MODE: EDIT SEGMENTATION OR WORD ANALYSIS */}
                    <div className="px-1">
                        {dictPriority === 'edit_segments' ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <Scissors size={14} className="text-amber-500" />
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-500/70">Segmentation Editor</h3>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={handleResetAllSegments}
                                            className="flex items-center gap-2 text-[9px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition-all border border-slate-800 hover:border-red-900 shadow-lg group"
                                            title="Reset ALL segments to default for this entire lesson"
                                        >
                                            <RotateCcw size={10} className="group-hover:rotate-[-45deg] transition-transform" />
                                            <span className="font-bold">RE-SYNC ALL</span>
                                        </button>
                                        <button 
                                            onClick={handleResetSegments}
                                            className="flex items-center gap-1.5 text-[9px] text-slate-600 hover:text-white font-black uppercase tracking-widest transition-colors"
                                        >
                                            <RotateCcw size={12} /> Reset to Auto
                                        </button>
                                    </div>
                                </div>
                                
                                <Reorder.Group 
                                    axis="y" 
                                    values={localVocab} 
                                    onReorder={handleReorderSegments}
                                    className="space-y-2 p-5 bg-amber-500/5 rounded-3xl border border-amber-500/10 min-h-[100px]"
                                >
                                    <AnimatePresence mode="popLayout">
                                        {localVocab.map((item) => (
                                            <Reorder.Item 
                                                key={item.id} 
                                                value={item}
                                                className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-900 border border-amber-500/20 rounded-xl group cursor-grab active:cursor-grabbing shadow-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <GripVertical size={14} className="text-slate-700 group-hover:text-amber-500 transition-colors" />
                                                    <span className="text-sm font-bold text-amber-200">{item.original}</span>
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveSegment(item.lemma);
                                                    }}
                                                    className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-700 hover:text-red-500 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </Reorder.Item>
                                        ))}
                                    </AnimatePresence>
                                </Reorder.Group>

                                <p className="px-2 text-[9px] text-slate-600 font-medium italic leading-relaxed">
                                    * Kéo thả để đổi thứ tự. Bạn có thể nhấn Play để nghe lại audio.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between px-1 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Languages size={16} className="text-sky-400" />
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Word Analysis</h3>
                                    </div>
                                    {isAnalyzing && (
                                        <div className="flex items-center gap-1.5 text-[9px] text-sky-400 font-black tracking-widest">
                                            <Loader2 size={12} className="animate-spin" /> ANALYZING
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-3">
                                    <AnimatePresence mode="popLayout">
                                        {Array.isArray(dynamicVocab) && dynamicVocab.length > 0 ? (
                                        dynamicVocab.map((item) => {
                                            const badge = getBadge(item.source);
                                            return (
                                            <motion.div 
                                                key={item.id}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="rounded-2xl p-4 bg-slate-900/30 border border-white/5 hover:border-sky-500/30 transition-all group relative overflow-hidden"
                                            >
                                                <div className={`absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black uppercase rounded-bl-lg shadow-lg ${badge.color}`}>
                                                    {badge.text}
                                                </div>
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-lg font-bold text-white leading-none">{item.lemma}</h4>
                                                            <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded">[{item.reading}]</span>
                                                        </div>
                                                        <p className="text-[13px] text-slate-400 pr-10 leading-relaxed font-medium">
                                                            {Array.isArray(item.meanings) ? item.meanings.join(', ') : item.meanings}
                                                        </p>
                                                    </div>
                                                    {(() => {
                                                        const isJustAdded = justAdded.has(item.id);
                                                        return (
                                                            <button 
                                                                onClick={() => handleSaveToVocab(item)}
                                                                className={`p-3 rounded-xl transition-all shadow-xl active:scale-90 ${
                                                                    isJustAdded 
                                                                    ? 'bg-emerald-500/20 text-emerald-400' 
                                                                    : 'bg-slate-800/80 hover:bg-sky-500 hover:text-slate-950 text-slate-500'
                                                                }`}
                                                            >
                                                                {isJustAdded ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />}
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
                                            </motion.div>
                                            );
                                        })
                                        ) : !isAnalyzing && (
                                            <div className="text-[10px] text-slate-800 font-black uppercase tracking-[0.2em] text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                                                No results in selected dictionary
                                            </div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            ) : (
                <section className="space-y-4 px-1">
                    {/* ALL VOCAB TAB */}
                    <div className="flex items-center gap-2 px-1 sticky top-[130px] z-10 bg-slate-950/80 backdrop-blur pb-2">
                        <div className="flex-1 flex items-center px-4 gap-3 bg-slate-900/50 rounded-2xl border border-white/5 focus-within:border-sky-500/30 transition-all">
                            <Search size={16} className="text-slate-600" />
                            <input 
                                type="text"
                                placeholder="Search lesson terms..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent py-3.5 text-xs font-bold focus:outline-none placeholder:text-slate-700 text-white"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        {savedVocab.length > 0 ? (
                            filteredSaved.length > 0 ? (
                                filteredSaved.map((v, idx) => {
                                    const badge = getBadge(v.source);
                                    return (
                                    <div key={idx} className="p-4 rounded-2xl bg-slate-900/30 border border-white/5 group hover:border-white/10 transition-all relative overflow-hidden">
                                        <div className={`absolute top-0 right-0 px-2.5 py-1 text-[8px] font-black uppercase rounded-bl-xl opacity-60 group-hover:opacity-100 transition-opacity ${badge.color}`}>
                                            {badge.text}
                                        </div>
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-white font-bold text-[15px]">{v.term}</h4>
                                                    <span className="text-[10px] text-slate-600 font-mono">[{v.reading}]</span>
                                                </div>
                                                <p className="text-sm text-slate-500 leading-relaxed pr-12 font-medium italic">{v.definition}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveTerm(v.term)}
                                                className="p-2.5 text-slate-700 hover:text-red-500 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-20 text-slate-700 uppercase tracking-widest font-black text-[9px]">
                                    No matching terms
                                </div>
                            )
                        ) : (
                            <div className="py-24 text-center bg-slate-900/20 rounded-3xl border-2 border-dashed border-white/5">
                                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Library Empty</p>
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
};
