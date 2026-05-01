import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAppStore } from '../../store/useAppStore';
import { Languages, Edit3, Shield, Globe, Check, X, FileJson, FileText, Loader2 } from 'lucide-react';

export const SubtitleManager: React.FC = () => {
    const { 
        availableTracks, 
        fetchAvailableTracks, 
        translateTrack, 
        exportTrack, 
        updateTrackName,
        trackIds,
        setTrackIds
    } = usePlayerStore();
    const { user } = useAppStore();

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        fetchAvailableTracks();
    }, []);

    const handleTranslate = async (trackId: number) => {
        await translateTrack(trackId, 'vi', `Bản dịch Tiếng Việt (Auto)`);
    };

    const handleSaveName = async (trackId: number) => {
        await updateTrackName(trackId, editName);
        setEditingId(null);
    };

    return (
        <div className="flex flex-col gap-4 p-4 bg-slate-900/50 rounded-xl border border-white/10">
            <div className="flex items-center justify-between">
                <h3 className="text-white font-bold flex items-center gap-2">
                    <Globe size={18} className="text-sky-400" />
                    Subtitle Management
                </h3>
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                    {availableTracks.length} Tracks Available
                </span>
            </div>

            <div className="grid gap-3">
                {availableTracks.map(track => {
                    const isTranslating = track.status === 'translating';
                    const progressPercent = track.total_lines > 0 ? Math.round((track.progress / track.total_lines) * 100) : 0;

                    return (
                        <div key={track.id} className="group relative bg-slate-800/80 hover:bg-slate-800 border border-white/5 p-3 rounded-lg transition-all overflow-hidden">
                            {/* Progress Background Overlay */}
                            {isTranslating && (
                                <div 
                                    className="absolute inset-0 bg-sky-500/10 transition-all duration-500 pointer-events-none" 
                                    style={{ width: `${progressPercent}%` }}
                                />
                            )}

                            <div className="flex items-center justify-between gap-4 relative z-10">
                                <div className="flex-1 min-w-0">
                                    {editingId === track.id ? (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                autoFocus
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="bg-slate-950 border border-sky-500/50 text-white text-sm px-2 py-1 rounded w-full outline-none"
                                            />
                                            <button onClick={() => handleSaveName(track.id)} className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded">
                                                <Check size={16} />
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="p-1 text-rose-500 hover:bg-rose-500/10 rounded">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-bold truncate ${track.is_original ? 'text-sky-400' : 'text-slate-200'}`}>
                                                {track.name}
                                            </span>
                                            {track.is_original && <Shield size={12} className="text-sky-500/50" />}
                                            {isTranslating && (
                                                <span className="flex items-center gap-1 text-[10px] font-black text-sky-400 uppercase">
                                                    <Loader2 size={10} className="animate-spin" />
                                                    {progressPercent}%
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter bg-slate-950 px-1.5 py-0.5 rounded">
                                            {track.language_code}
                                        </span>
                                        {track.is_auto && (
                                            <span className="text-[9px] font-black text-amber-500/50 uppercase tracking-tighter">Auto-Gen</span>
                                        )}
                                        <span className="text-[9px] font-bold text-slate-600 truncate max-w-[100px]">
                                            By {track.uploader_name}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!isTranslating && (
                                        <>
                                            <div className="flex gap-0.5 bg-slate-950 p-0.5 rounded-md mr-1 border border-white/5">
                                                {['s1', 's2', 's3'].map(slot => (
                                                    <button
                                                        key={slot}
                                                        onClick={() => setTrackIds({ [slot]: track.id })}
                                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all ${
                                                            trackIds[slot as keyof typeof trackIds] === track.id
                                                            ? 'bg-sky-500 text-slate-950'
                                                            : 'text-slate-500 hover:text-white'
                                                        }`}
                                                    >
                                                        {slot}
                                                    </button>
                                                ))}
                                            </div>
                                            <button 
                                                onClick={() => { setEditingId(track.id); setEditName(track.name); }}
                                                disabled={track.is_original && user?.role !== 'admin'}
                                                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded disabled:opacity-20"
                                                title={track.is_original ? "Chỉ Admin mới có thể đổi tên bản gốc" : "Rename"}
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleTranslate(track.id)}
                                                className="p-1.5 text-sky-400 hover:bg-sky-400/10 rounded disabled:opacity-50"
                                                title="Translate to Vietnamese"
                                            >
                                                <Languages size={14} />
                                            </button>
                                            <div className="h-4 w-px bg-white/10 mx-1" />
                                            <button 
                                                onClick={() => exportTrack(track.id, 'srt')}
                                                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded"
                                                title="Export SRT"
                                            >
                                                <FileText size={14} />
                                            </button>
                                            <button 
                                                onClick={() => exportTrack(track.id, 'vtt')}
                                                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded"
                                                title="Export VTT"
                                            >
                                                <FileJson size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-2 text-center">
                <p className="text-[10px] text-slate-500 italic">
                    Translations are processed line-by-line to preserve timeline accuracy.
                </p>
            </div>
        </div>
    );
};
