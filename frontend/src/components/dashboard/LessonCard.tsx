import React from 'react';
import { Play, CheckCircle2, Clock, Trash2, Layers, Plus, Globe, Lock, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';

interface LessonCardProps {
    lesson: any;
    onDelete?: (id: number) => void;
    onDeleteGlobal?: (id: number) => void;
    onToggleVisibility?: (videoId: number, visibility: 'public' | 'private') => void;
}

export const LessonCard: React.FC<LessonCardProps> = ({ lesson, onDelete, onDeleteGlobal, onToggleVisibility }) => {
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
        <div className="group relative bg-slate-900 border border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:border-sky-500/30 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            
            {/* Thumbnail Wrapper */}
            <Link to={`/player/lesson/${lesson.id}`} className="block relative aspect-video overflow-hidden">
                <img 
                    src={video.thumbnail_url} 
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                
                {/* Play Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
                    <div className="w-16 h-16 bg-sky-500 text-slate-950 rounded-full flex items-center justify-center shadow-2xl shadow-sky-500/40">
                        <Play size={28} fill="currentColor" className="ml-1" />
                    </div>
                </div>

                {/* Status Badges */}
                <div className="absolute top-4 left-4 flex gap-2">
                    {is_completed && (
                        <div className="bg-sky-500 text-slate-950 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg">
                            <CheckCircle2 size={12} strokeWidth={3} /> Completed
                        </div>
                    )}
                    {video.visibility === 'public' && (
                        <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg backdrop-blur-md">
                            <Globe size={12} strokeWidth={3} /> Featured
                        </div>
                    )}
                </div>

                {/* Duration Badge */}
                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-black text-white/80 tabular-nums">
                    {formatDuration(video.duration_seconds)}
                </div>

                {/* Neon Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.8)] transition-all duration-1000 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </Link>

            {/* Content Body */}
            <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <Link to={`/player/lesson/${lesson.id}`}>
                        <h3 className="text-base font-bold text-white line-clamp-2 leading-tight group-hover:text-sky-400 transition-colors">
                            {video.title}
                        </h3>
                    </Link>
                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                            <ShieldCheck size={12} className="text-sky-500" />
                            {video.channel_title || 'PodLearn Library'}
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                            {progressPercent}% Done
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-tighter">
                            <Clock size={12} />
                            {last_accessed ? `Studied ${new Date(last_accessed).toLocaleDateString()}` : 'New Lesson'}
                        </div>
                        
                        {/* Playlist Add Action */}
                        <div className="relative">
                            <button 
                                onClick={(e) => { e.preventDefault(); setShowPlaylistSelector(!showPlaylistSelector); }}
                                className={`p-1.5 rounded-lg transition-all ${showPlaylistSelector ? 'bg-sky-500 text-slate-950 scale-110 shadow-lg' : 'text-slate-700 hover:text-sky-400 hover:bg-sky-500/10'}`}
                                title="Add to Set"
                            >
                                <Layers size={14} />
                            </button>
                            
                            {showPlaylistSelector && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-[60] overflow-hidden">
                                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-white/5 mb-1">Add to Set</p>
                                     <div className="max-h-40 overflow-y-auto custom-scrollbar">
                                         {playlists.map(p => (
                                             <button 
                                                key={p.id}
                                                onClick={() => { addVideoToPlaylist(p.id, video.id); setShowPlaylistSelector(false); }}
                                                className="w-full text-left px-3 py-2 text-xs font-bold text-slate-300 hover:bg-sky-500 hover:text-slate-950 rounded-xl transition-all flex items-center justify-between group/p"
                                             >
                                                 <span className="truncate">{p.name}</span>
                                                 <Plus size={12} className="opacity-0 group-hover/p:opacity-100" />
                                             </button>
                                         ))}
                                         {playlists.length === 0 && (
                                             <p className="text-[10px] italic text-slate-600 p-2">No sets created yet.</p>
                                         )}
                                     </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {onDelete && (
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (window.confirm('Remove this lesson from your library? Your notes for this video will be lost.')) {
                                        onDelete(lesson.id);
                                    }
                                }}
                                className="p-2 text-slate-700 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                title="Remove from Personal Library"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        
                        {onDeleteGlobal && (window as any).__PODLEARN_DATA__?.is_admin && (
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (window.confirm('!!! DANGER !!!\n\nThis will PERMANENTLY delete this video and ALL user lessons, notes, and progress for EVERYONE. Continue?')) {
                                        onDeleteGlobal(video.id);
                                    }
                                }}
                                className="p-2 text-red-600 hover:text-red-400 hover:bg-red-900/40 rounded-xl transition-all border border-red-900/30"
                                title="ADMIN: Global Delete (Wipes Everything)"
                            >
                                <Trash2 size={16} className="fill-red-600/20" />
                            </button>
                        )}

                        {onToggleVisibility && (window as any).__PODLEARN_DATA__?.is_admin && (
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    const nextStatus = video.visibility === 'public' ? 'private' : 'public';
                                    onToggleVisibility(video.id, nextStatus);
                                }}
                                className={`p-2 rounded-xl transition-all border ${video.visibility === 'public' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-white/10'}`}
                                title={video.visibility === 'public' ? "Set to Private" : "Feature in Discovery"}
                            >
                                {video.visibility === 'public' ? <Globe size={16} /> : <Lock size={16} />}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
