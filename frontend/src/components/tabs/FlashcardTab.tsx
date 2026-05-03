import React, { useState } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Trash2, Edit3, Layers
} from 'lucide-react';

export const FlashcardTab: React.FC = () => {
    const { savedVocab, updateVocab, removeVocab } = usePlayerStore();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState({ reading: '', meaning: '' });
    const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

    const toggleFlip = (id: number) => {
        setFlippedCards(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const startEdit = (item: any) => {
        setEditingId(item.id);
        setEditData({ reading: item.reading || '', meaning: item.meaning || '' });
    };

    const handleSave = async (id: number) => {
        await updateVocab(id, editData);
        setEditingId(null);
    };

    return (
        <div className="p-6 space-y-8 h-full overflow-y-auto no-scrollbar pb-32">
            <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 flex items-center gap-2">
                    <Layers size={14} className="text-emerald-500" />
                    Personal Flashcards
                </h3>
                <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">{savedVocab.length} Cards</span>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {savedVocab.map((item) => {
                    const isFlipped = flippedCards.has(item.id);
                    const isEditing = editingId === item.id;

                    return (
                        <div key={item.id} className="relative group perspective-1000 min-h-[220px]">
                            <AnimatePresence mode="wait">
                                {!isEditing ? (
                                    <motion.div
                                        key={isFlipped ? 'back' : 'front'}
                                        initial={{ rotateY: isFlipped ? -90 : 90, opacity: 0 }}
                                        animate={{ rotateY: 0, opacity: 1 }}
                                        exit={{ rotateY: isFlipped ? 90 : -90, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        onClick={() => toggleFlip(item.id)}
                                        className={`absolute inset-0 w-full h-full bg-slate-900/60 border border-white/5 rounded-[40px] p-8 flex flex-col items-center justify-center cursor-pointer shadow-2xl backdrop-blur-xl hover:border-emerald-500/30 transition-all ${isFlipped ? 'bg-emerald-500/5' : ''}`}
                                    >
                                        {!isFlipped ? (
                                            <div className="text-center space-y-4">
                                                <span className="text-4xl font-black text-white tracking-tight leading-tight block">
                                                    {item.word}
                                                </span>
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-[10px] text-emerald-400 font-black tracking-[0.2em] uppercase bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                                                        Front
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center space-y-6 w-full max-w-sm">
                                                <div className="space-y-2">
                                                    {item.reading && (
                                                        <span className="text-sm font-bold text-emerald-400 block tracking-widest uppercase italic">
                                                            {item.reading}
                                                        </span>
                                                    )}
                                                    <p className="text-lg font-medium text-slate-200 leading-relaxed">
                                                        {item.meaning}
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-[10px] text-amber-400 font-black tracking-[0.2em] uppercase bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                                                        Back
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Card Actions */}
                                        <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                                                className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-2xl hover:bg-emerald-500 transition-all shadow-xl"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); removeVocab(item.word); }}
                                                className="p-3 bg-slate-800 text-slate-400 hover:text-rose-400 rounded-2xl hover:bg-rose-500/20 transition-all shadow-xl"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="edit"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="absolute inset-0 w-full h-full bg-slate-900 border-2 border-emerald-500/50 rounded-[40px] p-8 flex flex-col gap-4 shadow-2xl z-20"
                                    >
                                        <div className="flex-1 space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Word</label>
                                                <div className="px-4 py-3 bg-slate-950/50 rounded-2xl border border-white/5 text-xl font-bold text-slate-400">
                                                    {item.word}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Reading</label>
                                                <input 
                                                    value={editData.reading}
                                                    onChange={(e) => setEditData({ ...editData, reading: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-950 rounded-2xl border border-white/10 focus:border-emerald-500 outline-none text-white transition-all font-medium"
                                                    placeholder="Pronunciation..."
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Meaning</label>
                                                <textarea 
                                                    value={editData.meaning}
                                                    onChange={(e) => setEditData({ ...editData, meaning: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-950 rounded-2xl border border-white/10 focus:border-emerald-500 outline-none text-white transition-all font-medium resize-none"
                                                    rows={3}
                                                    placeholder="Translation / Definition..."
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => handleSave(item.id)}
                                                className="flex-1 py-4 bg-emerald-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg"
                                            >
                                                Save Card
                                            </button>
                                            <button 
                                                onClick={() => setEditingId(null)}
                                                className="px-6 py-4 bg-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}

                {savedVocab.length === 0 && (
                    <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[48px] bg-slate-900/20">
                        <Layers size={40} className="mx-auto text-slate-800 mb-6 opacity-20" />
                        <p className="text-[12px] font-black text-slate-700 uppercase tracking-[0.3em]">No Flashcards</p>
                        <p className="text-[10px] text-slate-800 mt-3 font-medium">Add words from the analysis tab to start studying</p>
                    </div>
                )}
            </div>
        </div>
    );
};
