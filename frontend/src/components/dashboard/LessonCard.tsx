import React from 'react';
import { Play, CheckCircle2, Clock, User, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LessonCardProps {
    lesson: any;
    onDelete?: (id: number) => void;
}

export const LessonCard: React.FC<LessonCardProps> = ({ lesson, onDelete }) => {
    const { video, time_spent, is_completed, last_accessed } = lesson;
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
                        <div className="flex items-center gap-1.5">
                            <User size={12} className="text-sky-500" />
                            {video.owner_name}
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                            {progressPercent}% Done
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-tighter">
                        <Clock size={12} />
                        {last_accessed ? `Studied ${new Date(last_accessed).toLocaleDateString()}` : 'New Lesson'}
                    </div>
                    {onDelete && (
                        <button 
                            onClick={() => onDelete(lesson.id)}
                            className="p-2 text-slate-700 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
