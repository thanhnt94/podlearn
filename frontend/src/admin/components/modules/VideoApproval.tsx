import React, { useState, useEffect } from 'react';
import { 
  Check, X, Search, Globe, 
  Calendar, User, Eye
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

interface PendingVideo {
    id: number;
    title: string;
    created_at: string;
    visibility: string;
    uploader_name?: string;
    thumbnail_url?: string;
}

export const VideoApproval: React.FC = () => {
    const [pending, setPending] = useState<PendingVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchPending = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/admin/pending-videos');
            setPending(response.data);
        } catch (err) {
            console.error("Failed to fetch pending videos", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const handleApprove = async (id: number) => {
        try {
            await axios.post(`/api/admin/video/${id}/approve-public`);
            setPending(prev => prev.filter(v => v.id !== id));
        } catch (err) {
            alert('Failed to approve video');
        }
    };

    const handleReject = async (id: number) => {
        try {
            await axios.post(`/api/admin/video/${id}/reject-public`);
            setPending(prev => prev.filter(v => v.id !== id));
        } catch (err) {
            alert('Failed to reject video');
        }
    };

    const filtered = pending.filter(v => 
        v.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass p-8 rounded-[2.5rem]">
                <div className="space-y-1">
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <Globe className="text-sky-500" size={24} />
                        Public Content Approval
                    </h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                        Review community requests to feature videos in Discovery
                    </p>
                </div>
                <div className="relative flex-1 max-w-md w-full">
                    <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Search pending requests..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-4 pl-14 pr-8 text-sm outline-none focus:border-sky-500/30 transition-all"
                    />
                </div>
            </div>

            {/* Content List */}
            <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode='popLayout'>
                    {loading ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="glass p-6 rounded-[2rem] h-24 animate-pulse opacity-50" />
                        ))
                    ) : filtered.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="glass p-20 rounded-[3rem] text-center space-y-4"
                        >
                            <div className="text-4xl opacity-20">📮</div>
                            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
                                Inbox is empty. No pending requests.
                            </p>
                        </motion.div>
                    ) : (
                        filtered.map(video => (
                            <motion.div 
                                key={video.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="glass group p-6 rounded-[2.5rem] border border-white/5 hover:border-sky-500/30 transition-all flex flex-col md:flex-row items-center gap-6"
                            >
                                {/* Mini Thumbnail Stub or Icon */}
                                <div className="w-full md:w-40 aspect-video bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-white/5">
                                    <Globe className="text-slate-800" size={32} />
                                </div>

                                <div className="flex-1 space-y-2 min-w-0">
                                    <h3 className="text-lg font-black text-white truncate">{video.title}</h3>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                            <Calendar size={12} />
                                            {new Date(video.created_at).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                            <User size={12} />
                                            {video.uploader_name || "System Import"}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                            Pending Review
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <a 
                                        href={`/player/video/${video.id}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="p-4 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                        title="Preview Content"
                                    >
                                        <Eye size={20} />
                                    </a>
                                    <button 
                                        onClick={() => handleReject(video.id)}
                                        className="p-4 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-rose-500/0 hover:shadow-rose-500/20"
                                        title="Reject & Keep Private"
                                    >
                                        <X size={20} />
                                    </button>
                                    <button 
                                        onClick={() => handleApprove(video.id)}
                                        className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/0 hover:shadow-emerald-500/20"
                                        title="Approve & Publish"
                                    >
                                        <Check size={20} />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
