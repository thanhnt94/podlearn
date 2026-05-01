import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, Edit2, Trash2, Save, 
    Upload, Book, FileJson, Languages,
    RotateCcw, Check, ChevronLeft, Layout
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { motion, AnimatePresence } from 'framer-motion';

interface DictManagerStudioProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DictManagerStudio: React.FC<DictManagerStudioProps> = ({ isOpen, onClose }) => {
    const { 
        globalDictionaries, fetchSystemDictionaries, createSystemDictionary,
        fetchDictionaryItems, importToSystemDictionary, updateGlossaryItem, deleteGlossaryItem
    } = usePlayerStore();

    const [selectedDictId, setSelectedDictId] = useState<string | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ term: '', reading: '', meaning: '' });
    const [isCreating, setIsCreating] = useState(false);
    const [newDictForm, setNewDictForm] = useState({ name: '', src: 'ja', target: 'vi' });
    const [jsonInput, setJsonInput] = useState('');
    const [activeTab, setActiveTab] = useState<'manage' | 'import'>('manage');

    useEffect(() => {
        if (isOpen) {
            fetchSystemDictionaries();
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedDictId) {
            loadItems();
        }
    }, [selectedDictId]);

    const loadItems = async () => {
        if (!selectedDictId) return;
        setIsLoading(true);
        try {
            const data = await fetchDictionaryItems(selectedDictId);
            setItems(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateDict = async () => {
        if (!newDictForm.name) return;
        try {
            const res = await createSystemDictionary(newDictForm.name, newDictForm.src, newDictForm.target);
            setIsCreating(false);
            setNewDictForm({ name: '', src: 'ja', target: 'vi' });
            setSelectedDictId(res.id);
        } catch (e) {
            alert("Failed to create dictionary");
        }
    };

    const handleImport = async () => {
        if (!selectedDictId || !jsonInput.trim()) return;
        setIsLoading(true);
        try {
            await importToSystemDictionary(selectedDictId, jsonInput);
            setJsonInput('');
            setActiveTab('manage');
            loadItems();
        } catch (e: any) {
            alert(e.message || "Import failed");
        } finally {
            setIsLoading(false);
        }
    };

    const startEdit = (item: any) => {
        setEditingItemId(item.id);
        setEditForm({ term: item.term, reading: item.reading, meaning: item.definition });
    };

    const saveEdit = async () => {
        if (!editingItemId || !selectedDictId) return;
        try {
            await updateGlossaryItem(editingItemId, { ...editForm, item_id: editingItemId, dict_id: selectedDictId });
            setEditingItemId(null);
            loadItems();
        } catch (e) {
            alert("Save failed");
        }
    };

    const deleteItem = async (id: number) => {
        if (!confirm("Are you sure?") || !selectedDictId) return;
        try {
            await deleteGlossaryItem(id, selectedDictId);
            loadItems();
        } catch (e) {
            alert("Delete failed");
        }
    };

    const filteredItems = items.filter(i => 
        i.term.toLowerCase().includes(searchQuery.toLowerCase()) || 
        i.definition.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedDict = globalDictionaries.find(d => d.id === selectedDictId);

    if (!isOpen) return null;

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] bg-slate-950 flex flex-col overflow-hidden font-inter text-slate-200"
        >
            {/* ═══════════════════════ HEADER ═══════════════════════ */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-3xl shrink-0">
                <div className="flex items-center gap-6">
                    <button onClick={onClose} className="group flex items-center gap-2 p-2 text-slate-400 hover:text-white transition-all bg-white/5 rounded-xl border border-white/5">
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tighter uppercase leading-none flex items-center gap-3">
                            Dictionary Studio <span className="text-[10px] bg-sky-500 text-slate-950 px-2 py-0.5 rounded italic">MASTER</span>
                        </h2>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">Cross-Lesson Vocabulary Management • Wiki-Style Editing</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 text-slate-950 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-sky-400 transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] active:scale-95"
                    >
                        <Plus size={14} />
                        New Dictionary
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white text-slate-950 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                        Exit Studio
                    </button>
                </div>
            </div>

            {/* ═══════════════════════ MAIN CONTENT ═══════════════════════ */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* ─── SIDEBAR: Dictionary List ─── */}
                <div className="w-80 border-r border-white/5 flex flex-col bg-slate-900/10 shrink-0">
                    <div className="p-6 border-b border-white/5">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Book size={12} className="text-sky-500" />
                            System Repositories
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                        {globalDictionaries.map(dict => (
                            <button
                                key={dict.id}
                                onClick={() => setSelectedDictId(dict.id)}
                                className={`w-full text-left p-4 rounded-[2rem] transition-all border group relative overflow-hidden ${
                                    selectedDictId === dict.id 
                                    ? 'bg-sky-500 text-slate-950 border-sky-500 shadow-xl shadow-sky-500/10' 
                                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full ${
                                        selectedDictId === dict.id ? 'bg-slate-950/20 text-slate-950' : 'bg-white/5 text-slate-500'
                                    }`}>
                                        {dict.src} → {dict.target}
                                    </span>
                                    <span className={`text-[9px] font-black ${selectedDictId === dict.id ? 'text-slate-900/60' : 'text-slate-700'}`}>
                                        {dict.count} ITEMS
                                    </span>
                                </div>
                                <div className={`text-sm font-black truncate ${selectedDictId === dict.id ? 'text-slate-950' : 'text-white group-hover:text-sky-400'}`}>
                                    {dict.name}
                                </div>
                                {selectedDictId === dict.id && (
                                    <motion.div layoutId="active-bg" className="absolute right-0 top-0 bottom-0 w-1 bg-slate-950" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─── MAIN AREA: Explorer & Editor ─── */}
                <div className="flex-1 flex flex-col bg-slate-950 relative">
                    {!selectedDict ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-8">
                             <div className="relative">
                                <div className="w-32 h-32 rounded-[3rem] bg-slate-900 flex items-center justify-center shadow-inner border border-white/5">
                                    <Book size={60} className="text-sky-500 opacity-20" />
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-2xl bg-sky-500 flex items-center justify-center shadow-2xl text-slate-950">
                                    <Languages size={24} />
                                </div>
                             </div>
                             <div className="max-w-md space-y-3">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Dictionary Workspace</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed px-12">
                                    Select a dictionary from the sidebar to manage terms, edit definitions, or import bulk data via JSON.
                                </p>
                             </div>
                             <div className="flex gap-3">
                                 {['Unified Database', 'Wiki-Style Edits', 'Instant Search'].map(tag => (
                                     <span key={tag} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                         {tag}
                                     </span>
                                 ))}
                             </div>
                        </div>
                    ) : (
                        <>
                            {/* Tab Bar */}
                            <div className="px-8 py-4 border-b border-white/5 bg-slate-900/20 flex items-center justify-between">
                                <div className="flex items-center gap-8">
                                    {[
                                        { id: 'manage', label: 'Manage Terms', icon: Layout },
                                        { id: 'import', label: 'Import JSON', icon: FileJson }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative py-2 ${
                                                activeTab === tab.id ? 'text-sky-500' : 'text-slate-500 hover:text-white'
                                            }`}
                                        >
                                            <tab.icon size={14} />
                                            {tab.label}
                                            {activeTab === tab.id && (
                                                <motion.div layoutId="studio-tab" className="absolute -bottom-4 left-0 right-0 h-1 bg-sky-500 rounded-full" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {activeTab === 'manage' && (
                                    <div className="relative w-96 group">
                                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-500 transition-colors" />
                                        <input 
                                            type="text"
                                            placeholder="Search within this dictionary..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-slate-900/60 border border-white/10 rounded-2xl pl-12 pr-6 py-2.5 text-xs font-bold text-white outline-none focus:border-sky-500/50 transition-all"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'import' ? (
                                        <motion.div 
                                            key="import"
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                            className="max-w-4xl mx-auto space-y-8"
                                        >
                                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[3rem] p-10 space-y-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                                        <Upload size={24} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-black text-white uppercase tracking-tighter">Bulk Term Import</h4>
                                                        <p className="text-xs text-slate-500 font-bold">Paste JSON data to incrementally update this dictionary.</p>
                                                    </div>
                                                </div>
                                                
                                                <textarea 
                                                    value={jsonInput}
                                                    onChange={(e) => setJsonInput(e.target.value)}
                                                    placeholder='[{"term": "食べる", "meaning": "ăn", "reading": "たべる"}]'
                                                    className="w-full h-80 bg-slate-950/60 border border-white/5 rounded-[2rem] p-8 text-sm font-mono text-emerald-400/80 outline-none focus:border-emerald-500/40 transition-all resize-none custom-scrollbar"
                                                />
                                                
                                                <div className="flex gap-4">
                                                    <button 
                                                        onClick={handleImport}
                                                        disabled={isLoading || !jsonInput.trim()}
                                                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black py-5 rounded-[2rem] flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-500/10 active:scale-95"
                                                    >
                                                        {isLoading ? <RotateCcw size={18} className="animate-spin" /> : <Check size={18} />}
                                                        <span className="uppercase tracking-[0.2em] text-xs">Execute Import Process</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => setActiveTab('manage')}
                                                        className="px-10 bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-[2rem] transition-all border border-white/5"
                                                    >
                                                        BACK
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div 
                                            key="manage"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                            className="max-w-6xl mx-auto space-y-4"
                                        >
                                            {filteredItems.map(item => (
                                                <div 
                                                    key={item.id} 
                                                    className={`group p-6 rounded-[2.5rem] border transition-all relative overflow-hidden ${
                                                        editingItemId === item.id 
                                                        ? 'bg-sky-500/10 border-sky-500/40 shadow-2xl' 
                                                        : 'bg-slate-900/20 border-white/5 hover:bg-white/[0.03]'
                                                    }`}
                                                >
                                                    {editingItemId === item.id ? (
                                                        <div className="space-y-6">
                                                            <div className="grid grid-cols-2 gap-6">
                                                                <div className="space-y-1">
                                                                    <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Term</label>
                                                                    <input 
                                                                        value={editForm.term}
                                                                        onChange={(e) => setEditForm({...editForm, term: e.target.value})}
                                                                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-sm font-bold text-white outline-none focus:border-sky-500/50"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Reading / Hiragana</label>
                                                                    <input 
                                                                        value={editForm.reading}
                                                                        onChange={(e) => setEditForm({...editForm, reading: e.target.value})}
                                                                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-sm font-bold text-white outline-none focus:border-sky-500/50"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Definitions / Meaning</label>
                                                                <textarea 
                                                                    value={editForm.meaning}
                                                                    onChange={(e) => setEditForm({...editForm, meaning: e.target.value})}
                                                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-white outline-none focus:border-sky-500/50 h-32 resize-none"
                                                                />
                                                            </div>
                                                            <div className="flex gap-3 justify-end">
                                                                <button onClick={saveEdit} className="px-6 py-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20">
                                                                    <Save size={14}/> Save Changes
                                                                </button>
                                                                <button onClick={() => setEditingItemId(null)} className="px-6 py-3 rounded-xl bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all">
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start justify-between gap-8">
                                                            <div className="flex-1 flex gap-8">
                                                                <div className="flex flex-col items-center justify-center min-w-[120px] bg-slate-950/50 rounded-2xl p-4 border border-white/5 shadow-inner">
                                                                    <span className="text-2xl font-black text-white">{item.term}</span>
                                                                    {item.reading && <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">{item.reading}</span>}
                                                                </div>
                                                                <div className="flex-1 py-2">
                                                                    <p className="text-sm font-medium text-slate-300 leading-relaxed italic line-clamp-3">
                                                                        {item.definition || 'No definition provided'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 pt-2">
                                                                <button onClick={() => startEdit(item)} className="p-3 bg-white/5 rounded-xl text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all">
                                                                    <Edit2 size={16}/>
                                                                </button>
                                                                <button onClick={() => deleteItem(item.id)} className="p-3 bg-white/5 rounded-xl text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all">
                                                                    <Trash2 size={16}/>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {filteredItems.length === 0 && (
                                                <div className="py-32 flex flex-col items-center justify-center text-slate-800 bg-slate-900/10 rounded-[3rem] border-2 border-dashed border-white/[0.02]">
                                                    <Search size={40} className="opacity-10 mb-6" />
                                                    <p className="text-xs font-black uppercase tracking-[0.4em]">Zero Terms Found</p>
                                                    <p className="text-[10px] font-bold mt-2 text-slate-700">Try adjusting your search query</p>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ─── CREATE DICTIONARY MODAL ─── */}
            <AnimatePresence>
                {isCreating && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                            className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-[3rem] p-10 shadow-2xl space-y-10 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.5)]" />
                            
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Forge New Dictionary</h3>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Create a global system-wide master database</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Identifier / Name</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. 1. Master Kanji List..."
                                        value={newDictForm.name}
                                        onChange={(e) => setNewDictForm({...newDictForm, name: e.target.value})}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-sky-500/40 transition-all shadow-inner"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Source Engine</label>
                                        <div className="relative group">
                                            <select 
                                                value={newDictForm.src}
                                                onChange={(e) => setNewDictForm({...newDictForm, src: e.target.value})}
                                                className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none appearance-none cursor-pointer focus:border-sky-500/40"
                                            >
                                                <option value="ja">Japanese (JP)</option>
                                                <option value="cn">Chinese (CN)</option>
                                                <option value="en">English (EN)</option>
                                                <option value="vi">Vietnamese (VI)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Target Meaning</label>
                                        <div className="relative group">
                                            <select 
                                                value={newDictForm.target}
                                                onChange={(e) => setNewDictForm({...newDictForm, target: e.target.value})}
                                                className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none appearance-none cursor-pointer focus:border-sky-500/40"
                                            >
                                                <option value="vi">Vietnamese (VI)</option>
                                                <option value="en">English (EN)</option>
                                                <option value="cn">Chinese (CN)</option>
                                                <option value="ja">Japanese (JP)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    onClick={handleCreateDict}
                                    className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-5 rounded-[2rem] transition-all active:scale-95 shadow-xl shadow-sky-500/20 uppercase tracking-widest text-[11px]"
                                >
                                    Initialize Repository
                                </button>
                                <button 
                                    onClick={() => setIsCreating(false)}
                                    className="px-10 bg-slate-800 hover:bg-slate-700 text-white font-black py-5 rounded-[2rem] transition-all"
                                >
                                    CANCEL
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
