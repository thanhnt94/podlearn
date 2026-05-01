import React from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Plus, Scissors, RotateCcw, Check, X, Zap, Loader2, Languages, GripVertical } from 'lucide-react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { soundEffects } from '../../services/SoundEffectsService';

const TokenEditChip = ({ token, isLast, onMerge, onDelete, onClick }: any) => {
    const isSkip = token.lemma_override === 'skip';

    return (
        <div 
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl group relative transition-all duration-300 border cursor-pointer ${
                isSkip 
                ? 'bg-slate-900/40 border-white/5 opacity-50 scale-95' 
                : 'bg-slate-900 border-white/10 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]'
            }`}
        >
            <div className="min-w-[30px] px-1 flex flex-col items-center">
                <span className={`text-sm font-bold tracking-tight transition-colors ${isSkip ? 'text-slate-500' : 'text-amber-200 group-hover:text-white'}`}>
                    {token.surface}
                </span>
                {token.lemma_override && token.lemma_override !== 'skip' && (
                    <span className="text-[9px] text-amber-500/40 font-black uppercase tracking-widest -mt-0.5">
                        {token.lemma_override}
                    </span>
                )}
                {isSkip && (
                    <span className="text-[8px] text-rose-500/60 font-black uppercase tracking-[0.2em] -mt-0.5">SKIP</span>
                )}
            </div>

            <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                {!isLast && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onMerge(); }} 
                        className="p-1.5 text-slate-500 hover:text-sky-400 hover:bg-sky-400/10 rounded-lg transition-all"
                        title="Merge with next"
                    >
                        <GripVertical size={14} />
                    </button>
                )}
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                    className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Remove token"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

export const LearningFocusBar: React.FC = () => {
    const { 
        analyzedWords, 
        showFurigana, 
        toggleFurigana,
        subtitles,
        activeLineIndex,
        lessonId,
        appendNote,
        hasTokens,
        checkScanStatus,
        fetchAnalyzedWords,
        isManualAnalysis,
        scanFullLesson
    } = usePlayerStore();

    const [isEditing, setIsEditing] = React.useState(false);
    const [editTokens, setEditTokens] = React.useState<any[]>([]);
    const [isScanningGlobal, setIsScanningGlobal] = React.useState(false);

    const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
    const [editValue, setEditValue] = React.useState('');
    const [editSkip, setEditSkip] = React.useState(false);

    const openEditor = (idx: number) => {
        const token = editTokens[idx];
        setEditingIdx(idx);
        setEditValue(token.surface);
        setEditSkip(token.lemma_override === 'skip');
    };

    const applyTokenChanges = () => {
        if (editingIdx === null) return;
        const newTokens = [...editTokens];
        newTokens[editingIdx] = { 
            ...newTokens[editingIdx], 
            surface: editValue.trim(), 
            lemma_override: editSkip ? 'skip' : (newTokens[editingIdx].lemma_override === 'skip' ? null : newTokens[editingIdx].lemma_override)
        };
        setEditTokens(newTokens);
        setEditingIdx(null);
    };

    // Tooltip State
    const [hoveredToken, setHoveredToken] = React.useState<{word: any, rect: DOMRect} | null>(null);
    const tooltipTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTokenMouseEnter = (e: React.MouseEvent, word: any) => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredToken({ word, rect });
    };

    const handleTokenMouseLeave = () => {
        tooltipTimer.current = setTimeout(() => {
            setHoveredToken(null);
        }, 150);
    };

    const handleTooltipMouseEnter = () => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    };

    const handleTooltipMouseLeave = () => {
        tooltipTimer.current = setTimeout(() => {
            setHoveredToken(null);
        }, 150);
    };

    const handleStartScan = async () => {
        // Try to get lessonId from store or URL as fallback
        const effectiveId = lessonId || parseInt(window.location.pathname.split('/').pop() || '0');
        
        console.log("Starting scan for lesson:", effectiveId);
        if (!effectiveId || effectiveId === 0) {
            console.error("No lessonId found for scan");
            return;
        }

        setIsScanningGlobal(true);
        try {
            await scanFullLesson('mazii_offline');
            await checkScanStatus();
            console.log("Scan completed successfully");
        } catch (e) {
            console.error("Scan error in FocusBar:", e);
        } finally {
            setIsScanningGlobal(false);
        }
    };

    React.useEffect(() => {
        if (lessonId) checkScanStatus();
    }, [lessonId]);

    const handleAddToVocab = async (word: any) => {
        if (!lessonId) return;
        const currentLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;
        const timestamp = currentLine ? currentLine.start : 0;

        try {
            const response = await axios.post(`/api/study/vocab/add`, {
                lesson_id: lessonId,
                term: word.lemma || word.surface,
                reading: word.reading,
                definition: Array.isArray(word.meanings) ? word.meanings.join(', ') : word.meanings,
                example: currentLine ? currentLine.text : '',
                timestamp: timestamp
            });
            
            soundEffects.vibrate(50);
            if (response.data.note_id) {
                const newNote = {
                    id: response.data.note_id,
                    timestamp: timestamp,
                    content: `**${word.lemma || word.surface}**${word.reading ? ` [${word.reading}]` : ''}\n${Array.isArray(word.meanings) ? word.meanings.join(', ') : word.meanings}`,
                    created_at: new Date().toISOString()
                };
                appendNote(newNote);
            }
        } catch (err) {
            console.error("Save failed", err);
        }
    };

    const handleMergeTokens = (idx: number) => {
        if (idx >= editTokens.length - 1) return;
        const newTokens = [...editTokens];
        const next = newTokens[idx + 1];
        newTokens[idx] = {
            ...newTokens[idx],
            surface: newTokens[idx].surface + next.surface,
            lemma_override: null // Reset lemma on merge
        };
        newTokens.splice(idx + 1, 1);
        setEditTokens(newTokens);
    };

    const startEditing = () => {
        setEditTokens(analyzedWords.map((w: any) => ({
            surface: w.surface,
            lemma_override: w.lemma_override || (w.lemma && w.lemma !== w.surface ? w.lemma : null)
        })));
        setIsEditing(true);
    };

    const saveEditing = async () => {
        if (!lessonId || activeLineIndex === -1) return;
        try {
            await axios.post('/api/study/vocab/tokens/save', {
                lesson_id: lessonId,
                line_index: activeLineIndex,
                tokens: editTokens
            });
            await fetchAnalyzedWords(currentLine?.text || '', 'ja');
            await checkScanStatus();
            setIsEditing(false);
        } catch (e) {
            console.error("Save failed", e);
        }
    };

    const resetEditing = async () => {
        if (!lessonId || activeLineIndex === -1) return;
        if (!confirm("Reset segmentation for this line?")) return;
        try {
            await axios.delete('/api/study/vocab/tokens/clear', {
                data: { lesson_id: lessonId, line_index: activeLineIndex }
            });
            await fetchAnalyzedWords(currentLine?.text || '', 'ja');
            setIsEditing(false);
        } catch (e) { console.error(e); }
    };

    const currentLine = activeLineIndex !== -1 ? subtitles[activeLineIndex] : null;

    // AUTO-ANALYZE
    React.useEffect(() => {
        if (currentLine && !isManualAnalysis && hasTokens) {
            fetchAnalyzedWords(currentLine.text, 'ja');
        }
    }, [activeLineIndex, hasTokens, isManualAnalysis]);

    if (!currentLine) return (
        <div className="w-full bg-slate-950/80 border-t border-white/5 backdrop-blur-xl px-4 py-2 h-[110px] flex items-center justify-center z-[999]">
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">Playback idle • Select a line to start analysis</p>
        </div>
    );

    return (
        <div className="w-full bg-slate-950/90 border-t border-white/5 backdrop-blur-3xl px-4 py-1 h-[110px] flex flex-col shadow-[0_-30px_60px_rgba(0,0,0,0.8)] relative transition-all duration-500 z-[999]">
            
            {/* NEEDS SCAN STATE - STATIC FLOW */}
            {!hasTokens && !isManualAnalysis ? (
                <div className="w-full h-full flex items-center justify-center">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-8 px-8 py-4 rounded-3xl border border-amber-500/40 bg-amber-500/5 shadow-2xl backdrop-blur-xl"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                                <Zap size={20} fill="currentColor" />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-white font-black text-xs uppercase tracking-widest leading-none">Lesson Scan Required</h3>
                                <p className="text-slate-400 text-[9px] font-medium mt-1">Enable smart analysis for all lines</p>
                            </div>
                        </div>
                        
                        <div className="h-8 w-px bg-white/10" />

                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStartScan();
                            }}
                            disabled={isScanningGlobal}
                            className={`px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center gap-3 relative z-[1000] cursor-pointer active:scale-90 active:brightness-125 ${
                                isScanningGlobal 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 hover:scale-105 shadow-amber-500/40 border-b-4 border-amber-700'
                            }`}
                        >
                            {isScanningGlobal ? (
                                <><Loader2 size={18} className="animate-spin" /> ANALYZING...</>
                            ) : (
                                <>START ANALYSIS NOW</>
                            )}
                        </button>
                    </motion.div>
                </div>
            ) : (
                <div className="w-full h-full relative flex items-center justify-center">
                    {/* Left Controls */}
                    <div className="absolute left-0 flex flex-col gap-1.5">
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStartScan();
                            }}
                            disabled={isScanningGlobal}
                            className={`p-1.5 rounded-xl transition-all flex items-center justify-center ${
                                isScanningGlobal 
                                ? 'text-amber-500 bg-amber-500/10 animate-pulse' 
                                : 'text-slate-600 hover:text-amber-400 hover:bg-white/10 bg-white/5 border border-white/5'
                            }`}
                            title="Re-scan Full Lesson"
                        >
                            {isScanningGlobal ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} fill="currentColor" />}
                        </button>
                        <button 
                            onClick={toggleFurigana}
                            className={`p-3 rounded-2xl transition-all shadow-xl ${
                                showFurigana 
                                ? 'text-sky-400 bg-sky-500/20 border border-sky-400/30 shadow-sky-500/20' 
                                : 'text-slate-500 hover:text-white bg-white/5 border border-white/5'
                            }`}
                            title="Toggle Furigana (F)"
                        >
                            <Languages size={20} />
                        </button>
                    </div>

                    {/* Right Control: Edit Mode */}
                    <div className="absolute right-0 flex items-center gap-2">
                        <button 
                            onClick={isEditing ? saveEditing : startEditing}
                            className={`p-3 rounded-2xl transition-all ${isEditing ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20' : (isManualAnalysis ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-500 hover:text-white bg-white/5')}`}
                            title={isEditing ? "Save (E)" : "Edit Segmentation (E)"}
                        >
                            {isEditing ? <Check size={20} /> : <Scissors size={20} />}
                        </button>
                    </div>

                    {/* Center: Content */}
                    <div className="w-full h-full overflow-y-auto no-scrollbar px-16 flex items-center justify-center">
                        <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-4 py-4">
                            {isEditing ? (
                                <div className="flex flex-wrap items-center justify-center gap-3 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 w-full relative">
                                    {editTokens.map((token, i) => (
                                        <TokenEditChip 
                                            key={i}
                                            token={token}
                                            isLast={i === editTokens.length - 1}
                                            onClick={() => openEditor(i)}
                                            onMerge={() => handleMergeTokens(i)}
                                            onDelete={() => setEditTokens(editTokens.filter((_, idx) => idx !== i))}
                                        />
                                    ))}
                                    <button onClick={resetEditing} className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 hover:text-white transition-colors ml-4">
                                        <RotateCcw size={12} /> Reset
                                    </button>

                                    {/* MODAL EDITOR OVERLAY */}
                                    {createPortal(
                                        <AnimatePresence>
                                            {editingIdx !== null && (
                                                <motion.div 
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4"
                                                    onClick={() => setEditingIdx(null)}
                                                >
                                                    <motion.div 
                                                        initial={{ scale: 0.9, y: 20 }}
                                                        animate={{ scale: 1, y: 0 }}
                                                        className="bg-slate-900 border border-white/10 rounded-[40px] p-10 shadow-2xl w-full max-w-md flex flex-col gap-8"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <h2 className="text-white text-xl font-black uppercase tracking-[0.2em]">Edit Word</h2>
                                                            <button 
                                                                onClick={() => setEditSkip(!editSkip)}
                                                                className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                                                                    editSkip ? 'bg-rose-500 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'
                                                                }`}
                                                            >
                                                                {editSkip ? 'Skipped' : 'Skip this word'}
                                                            </button>
                                                        </div>

                                                        <input 
                                                            autoFocus
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') applyTokenChanges();
                                                                if (e.key === 'Escape') setEditingIdx(null);
                                                            }}
                                                            className="bg-slate-950 border border-white/5 text-3xl font-black text-amber-200 px-8 py-6 rounded-[30px] outline-none text-center focus:border-amber-500/40 transition-all shadow-inner"
                                                        />

                                                        <div className="flex gap-4">
                                                            <button 
                                                                onClick={applyTokenChanges}
                                                                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-5 rounded-[25px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-amber-500/20"
                                                            >
                                                                Save Changes
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditingIdx(null)}
                                                                className="px-8 bg-white/5 hover:bg-white/10 text-white font-black py-5 rounded-[25px] uppercase tracking-[0.2em] transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>,
                                        document.body
                                    )}
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {analyzedWords.map((word: any, idx: number) => (
                                        <motion.div 
                                            key={`${activeLineIndex}-${idx}`}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`flex flex-col items-center justify-end group relative min-h-[40px] ${word.pos === '助詞' ? 'cursor-default opacity-60' : 'cursor-help'}`}
                                            onMouseEnter={word.pos === '助詞' ? undefined : ((e) => handleTokenMouseEnter(e, word))}
                                            onMouseLeave={word.pos === '助詞' ? undefined : handleTokenMouseLeave}
                                        >
                                            {showFurigana && word.furigana && (
                                                <span className="text-[9px] font-bold text-sky-400/80 mb-0">
                                                    {word.furigana}
                                                </span>
                                            )}
                                            <span 
                                                className={`text-base md:text-xl font-black tracking-tight transition-all duration-300 ${
                                                    word.pos === '助詞' ? 'text-slate-600' : 'text-white group-hover:text-sky-400 group-hover:scale-110'
                                                }`}
                                            >
                                                {word.surface}
                                            </span>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TOOLTIP PORTAL */}
            {hoveredToken && createPortal(
                <div 
                    className="fixed z-[99999] origin-bottom animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
                    style={{ 
                        left: hoveredToken.rect.left + hoveredToken.rect.width / 2, 
                        top: hoveredToken.rect.top - 15,
                        transform: 'translate(-50%, -100%)' 
                    }}
                    onMouseEnter={handleTooltipMouseEnter}
                    onMouseLeave={handleTooltipMouseLeave}
                >
                    <div className="w-96 bg-[#0a0a0c]/95 border border-white/10 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.9)] backdrop-blur-2xl overflow-hidden border-t-white/20">
                        <div className="bg-gradient-to-b from-white/5 to-transparent p-8 pb-4">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <h4 className="text-3xl font-black text-white tracking-tight">
                                        {hoveredToken.word.lemma && hoveredToken.word.lemma !== 'skip' 
                                            ? hoveredToken.word.lemma 
                                            : hoveredToken.word.surface}
                                    </h4>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-sky-400 font-black tracking-widest uppercase bg-sky-400/10 px-2.5 py-1 rounded-lg border border-sky-400/20">
                                            {hoveredToken.word.reading || '...'}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
                                    <Zap size={20} />
                                </div>
                            </div>
                        </div>
                        
                        <div className="px-8 pb-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                    {hoveredToken.word.meanings && hoveredToken.word.meanings.length > 0 ? (
                                        hoveredToken.word.meanings.map((m: string, i: number) => (
                                            <div key={i} className="flex gap-4 text-sm text-slate-200 leading-relaxed bg-white/5 p-3 rounded-2xl border border-white/5">
                                                <span className="text-sky-500 font-black text-xs opacity-60 mt-0.5">{i+1}</span>
                                                <p className="font-medium tracking-wide">{m}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[11px] text-slate-600 italic text-center p-4">No definition found.</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 pointer-events-auto pt-2">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddToVocab(hoveredToken.word); }}
                                    className="flex-1 flex items-center justify-center gap-3 py-4 bg-sky-500 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-sky-400 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    <Plus size={18} strokeWidth={4} /> Add To Vocab
                                </button>
                                <a 
                                    href={`https://jisho.org/search/${hoveredToken.word.lemma || hoveredToken.word.surface}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-16 flex items-center justify-center bg-white/5 rounded-2xl text-slate-500 hover:bg-white/10 hover:text-white transition-all border border-white/10"
                                >
                                    <ExternalLink size={18} />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
