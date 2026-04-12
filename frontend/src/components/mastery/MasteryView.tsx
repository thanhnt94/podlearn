import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Book, Layers, Languages, GraduationCap, Play, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';

export const MasteryView: React.FC = () => {
    const { sets, fetchDashboard, isLoading } = useAppStore();

    useEffect(() => {
        fetchDashboard();
    }, []);

    const categories = [
        { id: 'mastery_grammar', label: 'Grammar Mastery', icon: <GraduationCap size={24} className="text-blue-400" />, color: 'from-blue-500/10' },
        { id: 'mastery_vocab', label: 'Vocabulary Sets', icon: <Languages size={24} className="text-sky-400" />, color: 'from-sky-500/10' },
        { id: 'mastery_sentence', label: 'Common Patterns', icon: <Layers size={24} className="text-purple-400" />, color: 'from-purple-500/10' },
    ];

    if (isLoading) return <div className="flex-1 bg-slate-950 flex items-center justify-center font-black text-slate-800 animate-pulse">ORGANIZING YOUR KNOWLEDGE...</div>;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-950 px-6 md:px-10 pb-24 custom-scrollbar">
            <div className="max-w-7xl mx-auto pt-12 space-y-12">
                
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sky-400">
                        <Book size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Learning Hub</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <h1 className="text-4xl font-black text-white tracking-tight">Mastery Decks</h1>
                        <button className="px-6 py-3 bg-sky-500 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-400 transition-all active:scale-95 shadow-lg shadow-sky-500/20">
                            Create New Deck
                        </button>
                    </div>
                </div>

                {/* Categories & Decks */}
                <div className="space-y-16">
                    {categories.map(cat => {
                        const catSets = sets.filter(s => s.set_type === cat.id);
                        return (
                            <section key={cat.id} className="space-y-8">
                                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 bg-gradient-to-br ${cat.color} to-slate-900 rounded-2xl border border-white/5`}>
                                            {cat.icon}
                                        </div>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">{cat.label}</h2>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-600">{catSets.length} COLLECTIONS</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {catSets.map(set => (
                                        <motion.div 
                                            key={set.id}
                                            whileHover={{ y: -5 }}
                                            className="group bg-slate-900/50 border border-white/5 p-6 rounded-[2.5rem] hover:bg-slate-900 transition-all duration-300 relative overflow-hidden"
                                        >
                                            {/* Decorative background element */}
                                            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${cat.color} to-transparent opacity-10 blur-2xl group-hover:opacity-30 transition-opacity`} />
                                            
                                            <div className="flex items-start justify-between relative z-10">
                                                <div className="space-y-4">
                                                    <div>
                                                        <h3 className="text-lg font-black text-white line-clamp-1">{set.title}</h3>
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">{set.visibility}</p>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-6">
                                                        <div>
                                                            <div className="text-2xl font-black text-white">{set.count}</div>
                                                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Items</div>
                                                        </div>
                                                        <div className="w-[1px] h-8 bg-white/5" />
                                                        <div>
                                                            <div className="text-2xl font-black text-white">{Math.floor(Math.random() * 100)}%</div>
                                                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Mastery</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <button className="p-2 hover:bg-white/5 rounded-xl text-slate-600 hover:text-white transition-colors">
                                                        <MoreVertical size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-8 flex gap-3 relative z-10">
                                                <a href={`/sets/${set.id}`} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-center">
                                                    View Details
                                                </a>
                                                {set.first_sentence_id ? (
                                                    <a href={`/practice/sentence/${set.first_sentence_id}`} className="px-5 py-3 bg-white/10 hover:bg-sky-500 hover:text-slate-900 text-white rounded-2xl flex items-center justify-center transition-all group-hover:shadow-lg group-hover:shadow-sky-500/20">
                                                        <Play size={16} fill="currentColor" />
                                                    </a>
                                                ) : (
                                                    <button disabled className="px-5 py-3 bg-white/5 text-slate-700 rounded-2xl cursor-not-allowed">
                                                        <Play size={16} fill="currentColor" />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}

                                    {catSets.length === 0 && (
                                        <div className="col-span-full py-12 px-8 bg-slate-950/50 border border-dashed border-white/5 rounded-[2.5rem] flex items-center justify-center gap-4 group">
                                            <div className="text-slate-700 font-bold uppercase text-[10px] tracking-widest">No decks in this category yet</div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
