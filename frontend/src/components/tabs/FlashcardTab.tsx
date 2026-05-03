import React, { useState, useMemo, useEffect } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Trash2, Edit3, Layers, Shuffle, 
    ChevronLeft, ChevronRight, CheckCircle2, 
    Circle, RotateCcw, X
} from 'lucide-react';

export const FlashcardTab: React.FC = () => {
    const { savedVocab, updateVocab, removeVocab } = usePlayerStore();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState({ word: '', reading: '', meaning: '' });
    
    // Shuffle logic
    const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
    
    useEffect(() => {
        // Initialize indices if vocab exists and indices are empty or size mismatch
        if (savedVocab.length > 0 && shuffledIndices.length !== savedVocab.length) {
            setShuffledIndices(Array.from({ length: savedVocab.length }, (_, i) => i));
        }
    }, [savedVocab.length]);

    const handleShuffle = () => {
        const indices = [...shuffledIndices];
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        setShuffledIndices(indices);
        setCurrentIndex(0);
        setIsFlipped(false);
    };

    const nextCard = () => {
        if (currentIndex < savedVocab.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    const prevCard = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setIsFlipped(false);
        }
    };

    const currentItem = useMemo(() => {
        if (savedVocab.length === 0 || shuffledIndices.length === 0) return null;
        const realIndex = shuffledIndices[currentIndex];
        return savedVocab[realIndex] || null;
    }, [savedVocab, shuffledIndices, currentIndex]);

    const toggleMastery = async () => {
        if (!currentItem) return;
        const currentMastery = currentItem.extra_data?.mastery_level || 0;
        const newMastery = currentMastery === 1 ? 0 : 1;
        
        await updateVocab(currentItem.id, {
            extra_data: { 
                ...(currentItem.extra_data || {}), 
                mastery_level: newMastery 
            }
        });
    };

    const startEdit = () => {
        if (!currentItem) return;
        setEditingId(currentItem.id);
        setEditData({ 
            word: currentItem.word || '',
            reading: currentItem.reading || '', 
            meaning: currentItem.meaning || '' 
        });
    };

    const handleSaveEdit = async () => {
        if (!currentItem) return;
        // The backend expects 'word' and 'meaning' (definition)
        await updateVocab(currentItem.id, {
            ...editData,
            meaning: editData.meaning // mapped correctly in updateVocab
        });
        setEditingId(null);
    };

    if (savedVocab.length === 0) {
        return (
            <div className="p-6 h-full flex flex-col items-center justify-center space-y-6">
                <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[48px] bg-slate-900/20 w-full">
                    <Layers size={40} className="mx-auto text-slate-800 mb-6 opacity-20" />
                    <p className="text-[12px] font-black text-slate-700 uppercase tracking-[0.3em]">No Flashcards</p>
                    <p className="text-[10px] text-slate-800 mt-3 font-medium px-8">Add words from the analysis tab to start studying</p>
                </div>
            </div>
        );
    }

    if (!currentItem) return null;

    const isMastered = currentItem.extra_data?.mastery_level === 1;

    return (
        <div className="p-6 flex flex-col h-full space-y-6">
            {/* Header / Stats */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex flex-col">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Mastery Mode</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-emerald-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${((currentIndex + 1) / savedVocab.length) * 100}%` }}
                            />
                        </div>
                        <span className="text-[9px] font-bold text-slate-600">{currentIndex + 1} / {savedVocab.length}</span>
                    </div>
                </div>
                <button 
                    onClick={handleShuffle}
                    className="p-3 bg-slate-900 border border-white/5 rounded-2xl text-slate-500 hover:text-white hover:border-white/10 transition-all active:scale-95"
                    title="Shuffle Deck"
                >
                    <Shuffle size={16} />
                </button>
            </div>

            {/* Card Content Area */}
            <div className="flex-1 relative perspective-1000">
                <AnimatePresence mode="wait">
                    {editingId === null ? (
                        <motion.div
                            key={currentItem.id + (isFlipped ? '-back' : '-front')}
                            initial={{ rotateY: isFlipped ? -90 : 90, opacity: 0, scale: 0.9 }}
                            animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                            exit={{ rotateY: isFlipped ? 90 : -90, opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            onClick={() => setIsFlipped(!isFlipped)}
                            className={`absolute inset-0 w-full h-full bg-slate-900/40 border border-white/5 rounded-[48px] p-12 flex flex-col items-center justify-center cursor-pointer shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] backdrop-blur-2xl hover:border-sky-500/20 transition-all ${isFlipped ? 'bg-sky-500/5' : ''}`}
                        >
                            {!isFlipped ? (
                                <div className="text-center space-y-6">
                                    <span className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none block">
                                        {currentItem.word}
                                    </span>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-[10px] text-sky-400 font-black tracking-[0.2em] uppercase bg-sky-400/10 px-4 py-1.5 rounded-full border border-sky-400/20">
                                            Front
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center space-y-8 w-full max-w-sm">
                                    <div className="space-y-3">
                                        {currentItem.reading && (
                                            <span className="text-xl font-bold text-sky-400 block tracking-widest uppercase italic">
                                                {currentItem.reading}
                                            </span>
                                        )}
                                        <p className="text-2xl font-medium text-slate-100 leading-relaxed px-4">
                                            {currentItem.meaning}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-[10px] text-amber-400 font-black tracking-[0.2em] uppercase bg-amber-400/10 px-4 py-1.5 rounded-full border border-amber-400/20">
                                            Back
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Card Header Labels */}
                            {isMastered && (
                                <div className="absolute top-10 left-10 flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                                    <CheckCircle2 size={14} /> Learned
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute inset-0 w-full h-full bg-[#0a0a0c] border border-sky-500/30 rounded-[48px] p-8 flex flex-col gap-6 shadow-2xl z-20 overflow-y-auto no-scrollbar"
                        >
                            <div className="shrink-0 flex items-center justify-between border-b border-white/5 pb-4">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-500">Edit Flashcard</h4>
                                <div className="flex gap-2">
                                    <button onClick={handleSaveEdit} className="p-2 bg-sky-500 text-slate-950 rounded-xl hover:bg-sky-400 transition-all"><CheckCircle2 size={16} /></button>
                                    <button onClick={() => setEditingId(null)} className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:text-white transition-all"><X size={16} /></button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* FRONT SECTION */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Mặt trước (Front)</label>
                                    </div>
                                    <input 
                                        value={editData.word}
                                        onChange={(e) => setEditData({ ...editData, word: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-900/50 rounded-2xl border border-white/5 focus:border-sky-500/50 outline-none text-white transition-all font-black text-2xl tracking-tighter"
                                        placeholder="Nhập từ..."
                                    />
                                </div>

                                {/* BACK SECTION */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Mặt sau (Back)</label>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <input 
                                                value={editData.reading}
                                                onChange={(e) => setEditData({ ...editData, reading: e.target.value })}
                                                className="w-full px-6 py-4 bg-slate-900/50 rounded-2xl border border-white/5 focus:border-amber-500/50 outline-none text-white transition-all font-bold text-lg"
                                                placeholder="Cách đọc (Reading)..."
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-600 uppercase tracking-widest">Reading</span>
                                        </div>
                                        <div className="relative">
                                            <textarea 
                                                value={editData.meaning}
                                                onChange={(e) => setEditData({ ...editData, meaning: e.target.value })}
                                                className="w-full px-6 py-4 bg-slate-900/50 rounded-2xl border border-white/5 focus:border-amber-500/50 outline-none text-white transition-all font-medium resize-none text-base min-h-[120px]"
                                                placeholder="Ý nghĩa (Meaning)..."
                                            />
                                            <span className="absolute right-4 top-4 text-[8px] font-black text-slate-600 uppercase tracking-widest">Meaning</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleSaveEdit}
                                className="w-full py-5 bg-sky-500 text-slate-950 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-sky-400 transition-all shadow-xl shadow-sky-500/10 mt-auto"
                            >
                                Cập nhật thẻ
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Navigation & Actions Footer */}
            <div className="shrink-0 flex flex-col gap-4 pb-12">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={prevCard}
                        disabled={currentIndex === 0}
                        className="p-5 bg-slate-900 border border-white/5 rounded-3xl text-slate-400 hover:text-white hover:border-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    
                    <button 
                        onClick={toggleMastery}
                        className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-[32px] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl border ${
                            isMastered 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/20' 
                            : 'bg-slate-900 text-slate-400 border-white/10 hover:border-emerald-500/40 hover:text-white'
                        }`}
                    >
                        {isMastered ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        {isMastered ? 'Learned' : 'Mark as Learned'}
                    </button>

                    <button 
                        onClick={nextCard}
                        disabled={currentIndex === savedVocab.length - 1}
                        className="p-5 bg-slate-900 border border-white/5 rounded-3xl text-slate-400 hover:text-white hover:border-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>

                <div className="flex justify-center gap-6">
                    <button 
                        onClick={startEdit}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-sky-500 transition-colors"
                    >
                        <Edit3 size={14} /> Edit Card
                    </button>
                    <div className="w-px h-3 bg-white/5" />
                    <button 
                        onClick={() => removeVocab(currentItem.word)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-rose-500 transition-colors"
                    >
                        <Trash2 size={14} /> Remove
                    </button>
                    <div className="w-px h-3 bg-white/5" />
                    <button 
                        onClick={() => setIsFlipped(!isFlipped)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-amber-500 transition-colors"
                    >
                        <RotateCcw size={14} /> Flip Card
                    </button>
                </div>
            </div>
        </div>
    );
};
