import React, { useState, useEffect } from 'react';
import { Book, Plus, Search, ExternalLink } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import axios from 'axios';

interface VocabItem {
  id: number;
  term: string;
  definition: string;
  example?: string;
}

export const VocabPanel: React.FC = () => {
    const { lessonId } = usePlayerStore();
    const [vocab, setVocab] = useState<VocabItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchVocab();
    }, [lessonId]);

    const fetchVocab = async () => {
        if (!lessonId) return;
        try {
            const response = await axios.get(`/api/vocab/list/${lessonId}`);
            setVocab(response.data);
        } catch (err) {
            console.error("Failed to fetch vocab");
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Search / Add Bar */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex-1 flex items-center px-4 gap-3 bg-slate-950/50 rounded-xl border border-white/5">
                    <Search size={18} className="text-slate-500" />
                    <input 
                        type="text"
                        placeholder="Quick search terms..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-transparent py-3 text-sm focus:outline-none"
                    />
                </div>
                <button className="bg-sky-500 hover:bg-sky-400 text-slate-950 p-3 rounded-xl transition-all shadow-lg shadow-sky-500/20">
                    <Plus size={20} />
                </button>
            </div>

            {/* Vocab List */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Lesson Vocabulary</span>
                    <span className="text-sky-500">{vocab.length} Items</span>
                </div>
                
                {vocab.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-slate-600 gap-2">
                        <Book size={32} strokeWidth={1.5} className="opacity-20" />
                        <p className="text-xs">Select words from transcript to save here.</p>
                    </div>
                ) : (
                    vocab.filter(v => v.term.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                        <div key={item.id} className="group bg-slate-900/40 border border-white/5 rounded-xl p-4 hover:border-sky-500/30 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-lg text-sky-400">{item.term}</h4>
                                <button className="text-slate-600 hover:text-sky-500 transition-colors">
                                    <ExternalLink size={14} />
                                </button>
                            </div>
                            <p className="text-sm text-slate-200 mb-2">{item.definition}</p>
                            {item.example && (
                                <p className="text-[11px] text-slate-500 italic bg-white/5 p-2 rounded-lg border-l-2 border-sky-500/30">
                                    "{item.example}"
                                </p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
