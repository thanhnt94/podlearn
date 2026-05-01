import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { LessonCard } from './LessonCard';
import { 
    Layers, Plus, Trash2, ArrowLeft, 
    FolderPlus, Folder,
    Play
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

export const SetListView: React.FC<{ onSelect: (id: number) => void }> = ({ onSelect }) => {
    const { playlists, createPlaylist, deletePlaylist, fetchPlaylists } = useAppStore();
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        const success = await createPlaylist(newName);
        if (success) {
            setNewName('');
            setIsCreating(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-10 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sky-500">
                            <Layers size={16} fill="currentColor" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Organization</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">Your Library Sets</h1>
                    </div>

                    <button 
                        onClick={() => setIsCreating(true)}
                        className="bg-sky-500 text-slate-950 px-6 py-4 rounded-[2rem] font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-sky-500/20 hover:scale-105 transition-all"
                    >
                        <Plus size={18} /> New Set
                    </button>
                </div>

                {/* Create Form Overlay */}
                <AnimatePresence>
                    {isCreating && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-slate-900 border border-sky-500/30 rounded-[3rem] p-8 flex flex-col md:flex-row items-center gap-6 shadow-2xl"
                        >
                            <div className="w-16 h-16 bg-sky-500/10 text-sky-500 rounded-[1.5rem] flex items-center justify-center shrink-0">
                                <FolderPlus size={32} />
                            </div>
                            <div className="flex-1 space-y-1 w-full text-center md:text-left">
                                <h3 className="text-lg font-bold text-white">Create a New Collection</h3>
                                <p className="text-xs text-slate-500 font-medium">Organize your podcasts by topic, difficulty, or source.</p>
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Enter set name (e.g. Japanese Business Podcast)"
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 mt-4 text-sm focus:border-sky-500 outline-none transition-all"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsCreating(false)} className="px-6 py-4 text-slate-400 font-bold text-[11px] uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleCreate} className="bg-white text-slate-950 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest">Create Set</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Playlists Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                    {playlists.map(p => (
                        <div 
                            key={p.id}
                            className="group relative bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 flex flex-col justify-between h-64 hover:border-sky-500/40 transition-all duration-500 cursor-pointer"
                            onClick={() => onSelect(p.id)}
                        >
                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="w-14 h-14 bg-white/5 text-slate-400 group-hover:bg-sky-500/10 group-hover:text-sky-500 rounded-2xl flex items-center justify-center transition-all">
                                        <Folder size={28} />
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); deletePlaylist(p.id); }}
                                        className="p-2 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white group-hover:text-sky-400 transition-colors uppercase tracking-tight">{p.name}</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{p.video_count} Items</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Created {new Date(p.created_at).toLocaleDateString()}</div>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-sky-500/20 text-slate-500 group-hover:text-sky-500 transition-all scale-0 group-hover:scale-110">
                                    <Plus size={16} />
                                </div>
                            </div>
                        </div>
                    ))}

                    {playlists.length === 0 && !isCreating && (
                        <div className="col-span-full py-20 bg-slate-900/40 border-2 border-dashed border-white/5 rounded-[3rem] text-center space-y-4">
                            <div className="text-4xl">📁</div>
                            <h3 className="text-slate-400 font-bold italic text-lg">Your Workspace is empty.</h3>
                            <p className="text-xs text-slate-600 uppercase font-black">Create a set to start organizing your podcast library.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const SetDetailView: React.FC<{ playlistId: number, onBack: () => void }> = ({ playlistId, onBack }) => {
    const [data, setData] = useState<{playlist: any, videos: any[]}>({ playlist: null, videos: [] });
    const [isLoading, setIsLoading] = useState(true);
    const { removeVideoFromPlaylist } = useAppStore();

    const fetchDetails = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`/api/study/playlists/${playlistId}/details`);
            setData(res.data);
        } catch (err) {
            console.error("Failed to fetch playlist details", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [playlistId]);

    const handleRemove = async (videoId: string | number) => {
        await removeVideoFromPlaylist(playlistId, videoId);
        fetchDetails(); // Refresh
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-slate-950">
                <div className="w-12 h-12 border-4 border-slate-800 border-t-sky-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-10 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header */}
                <div className="space-y-6">
                    <button 
                        onClick={onBack}
                        className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-sky-500 transition-colors tracking-widest"
                    >
                        <ArrowLeft size={14} /> Back to Sets
                    </button>
                    
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-2">
                             <div className="flex items-center gap-2 text-sky-400">
                                <Folder size={16} fill="currentColor" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Collection Viewer</span>
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase">{data.playlist?.name}</h1>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{data.videos.length} Videos in regular rotation</p>
                        </div>
                    </div>
                </div>

                {/* Videos Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                    {data.videos.map(item => (
                        <div key={item.video_id} className="relative group">
                            <LessonCard 
                                lesson={item} 
                                onDelete={() => handleRemove(item.video_id)} 
                            />
                        </div>
                    ))}
                    {data.videos.length === 0 && (
                        <div className="col-span-full py-24 bg-slate-900/30 border-2 border-dashed border-white/5 rounded-[3.5rem] text-center space-y-6">
                            <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto text-slate-700">
                                <Play size={40} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-slate-500 font-bold text-lg uppercase tracking-widest">This set is empty</h3>
                                <p className="text-[10px] text-slate-700 uppercase font-black">Browse your library and add videos to this collection.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
