import React from 'react';
import { Play, CheckCircle2, Clock, User, Trash2, Layers, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';

interface LessonCardProps {
    lesson: any;
    onDelete?: (id: number) => void;
}

export const LessonCard: React.FC<LessonCardProps> = ({ lesson, onDelete }) => {
    const { video, time_spent, is_completed, last_accessed } = lesson;
    const { playlists, addVideoToPlaylist } = useAppStore();
    const [showPlaylistSelector, setShowPlaylistSelector] = React.useState(false);

    const progressPercent = Math.min(100, Math.round((time_spent / (video.duration_seconds || 1)) * 100));

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    return (
        <motion.div 
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[3rem] overflow-hidden transition-all duration-500 hover:border-sky-500/30 hover:shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
        >
            
            {/* Thumbnail Wrapper */}
            <Link to={`/player/lesson/${lesson.id}`} className="block relative aspect-video overflow-hidden">
                <motion.img 
                    src={video.thumbnail_url} 
                    alt={video.title}
                    className="w-full h-full object-cover"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 group-hover:opacity-40 transition-opacity" />
                
                {/* Play Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
                    <div className="w-16 h-16 bg-sky-500 text-slate-950 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(14,165,233,0.6)]">
                        <Play size={28} fill="currentColor" className="ml-1" />
                    </div>
                </div>

                {/* Status Badges */}
                <div className="absolute top-5 left-5 flex gap-2">
                    {is_completed && (
                        <div className="bg-sky-500 text-slate-950 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-sky-500/20">
                            <CheckCircle2 size={12} strokeWidth={4} /> Completed
                        </div>
                    )}
                </div>

                {/* Duration Badge */}
                <div className="absolute bottom-5 right-5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black text-white/90 tabular-nums border border-white/5">
                    {formatDuration(video.duration_seconds)}
                </div>

                {/* Neon Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/5 overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 shadow-[0_0_20px_rgba(14,165,233,0.8)]"
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                </div>
            </Link>

            {/* Content Body */}
            <div className="p-8 space-y-6">
                <div className="space-y-3">
                    <Link to={`/player/lesson/${lesson.id}`}>
                        <h3 className="text-lg font-black text-white line-clamp-2 leading-snug group-hover:text-sky-400 transition-colors tracking-tight">
                            {video.title}
                        </h3>
                    </Link>
                    <div className="flex items-center gap-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                        <div className="flex items-center gap-2 truncate max-w-[160px] text-sky-500/80">
                            <User size={12} className="shrink-0" />
                            {video.channel_title || video.owner_name}
                        </div>
                        <div className="flex items-center gap-2 font-mono text-slate-400">
                            {progressPercent}% <span className="text-slate-700">Studied</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg">
                            <Clock size={12} />
                            {last_accessed ? `Accessed ${new Date(last_accessed).toLocaleDateString()}` : 'New Mission'}
                        </div>
                        
                        {/* Playlist Add Action */}
                        <div className="relative">
                            <button 
                                onClick={(e) => { e.preventDefault(); setShowPlaylistSelector(!showPlaylistSelector); }}
                                className={`p-2 rounded-xl transition-all ${showPlaylistSelector ? 'bg-sky-500 text-slate-950 scale-110 shadow-lg shadow-sky-500/20' : 'text-slate-500 hover:text-sky-400 hover:bg-sky-500/10'}`}
                                title="Add to Set"
                            >
                                <Layers size={16} />
                            </button>
                            
                            <AnimatePresence>
                                {showPlaylistSelector && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                        className="absolute bottom-full left-0 mb-3 w-56 bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl p-3 z-[60] overflow-hidden backdrop-blur-3xl"
                                    >
                                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-white/5 mb-2">Add to Collection</p>
                                         <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1">
                                             {playlists.map(p => (
                                                 <button 
                                                    key={p.id}
                                                    onClick={() => { addVideoToPlaylist(p.id, video.id); setShowPlaylistSelector(false); }}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-sky-500 hover:text-slate-950 rounded-xl transition-all flex items-center justify-between group/p"
                                                 >
                                                     <span className="truncate">{p.name}</span>
                                                     <Plus size={14} className="opacity-0 group-hover/p:opacity-100" />
                                                 </button>
                                             ))}
                                             {playlists.length === 0 && (
                                                 <p className="text-[10px] italic text-slate-600 p-2 text-center">No sets found.</p>
                                             )}
                                         </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {onDelete && (
                        <button 
                            onClick={() => onDelete(lesson.id)}
                            className="p-2.5 text-slate-700 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
