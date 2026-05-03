import React, { useState, useEffect } from 'react';
import { 
    X, Palette, Check, Clock, 
    Globe, Download, Trash2, RefreshCw, Upload,
    Layers, Languages, Edit3, ChevronLeft,
    Zap, Gauge, Users, AlignLeft, AlignCenter, AlignRight, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAppStore } from '../../store/useAppStore';
import axios from 'axios';

interface YTTrack { lang_code: string; name: string; is_auto: boolean; }

export const SettingsDrawer: React.FC = () => {
    const { 
        isSettingsOpen: isOpen, setIsSettingsOpen: onClose,
        settingsTab: activeTab, setSettingsTab: setActiveTab,
        settings, setTrackSettings, setNoteSettings, setCommunitySettings, saveSettings,
        lessonId, videoId,
        saveAsDefaultPreferences,
        availableTracks, fetchAvailableTracks, translateTrack, exportTrack, updateTrackMetadata,
        trackIds, setTrackIds,
        sourceTrackId, setSourceTrackId,
        autoSegmentationEnabled, setAutoSegmentationEnabled,
        playbackRate, setPlaybackRate,
        fetchAnalyzedWords, subtitles, activeLineIndex,
        originalLang, setSyncOffset
    } = usePlayerStore();
    const { user } = useAppStore();

    const [activeDisplayTrack, setActiveDisplayTrack] = useState<'s1' | 's2' | 's3'>('s1');
    const [librarySubTab, setLibrarySubTab] = useState<'tracks' | 'upload' | 'cloud'>('tracks');
    
    // Status state
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingGlobal, setIsSavingGlobal] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
    const [globalSaveStatus, setGlobalSaveStatus] = useState<'idle' | 'success'>('idle');
    const [isLoadingSources, setIsLoadingSources] = useState(false);
    const [isUploadingText, setIsUploadingText] = useState(false);

    const [isImportingId, setIsImportingId] = useState<string | null>(null);
    const [isTranslatingId, setIsTranslatingId] = useState<number | null>(null);
    const [isChangingLangId, setIsChangingLangId] = useState<number | null>(null);

    // Source state
    const [ytTracks, setYtTracks] = useState<YTTrack[]>([]);
    const [uploadLang, setUploadLang] = useState('en');
    const [uploadName, setUploadName] = useState('');
    const [pastedText, setPastedText] = useState('');

    const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
    const [editTrackName, setEditTrackName] = useState('');
    const [isEditingContentId, setIsEditingContentId] = useState<number | null>(null);
    const [editContentText, setEditContentText] = useState('');
    const [isFetchingContent, setIsFetchingContent] = useState(false);
    const [isSavingContent, setIsSavingContent] = useState(false);

    // Custom Dict state
    const [customDictText, setCustomDictText] = useState('');
    const [customDictLang, setCustomDictLang] = useState('ja-vi');
    const [isSavingCustomDict, setIsSavingCustomDict] = useState(false);
    const [isFetchingCustomDict, setIsFetchingCustomDict] = useState(false);

    const fetchCustomDict = async () => {
        if (!lessonId) return;
        setIsFetchingCustomDict(true);
        try {
            const res = await axios.get(`/api/study/vocab/custom-dict/${lessonId}`);
            if (res.data.success) {
                setCustomDictText(res.data.text);
                setCustomDictLang(res.data.lang_tag || 'ja-vi');
            }
        } catch (err) {} finally { setIsFetchingCustomDict(false); }
    };

    const handleSaveCustomDict = async () => {
        if (!lessonId || !customDictText.trim()) return;
        setIsSavingCustomDict(true);
        try {
            const res = await axios.post(`/api/study/vocab/import-custom-dict`, {
                lesson_id: lessonId,
                text: customDictText,
                lang_tag: customDictLang
            });
            if (res.data.success) {
                alert(`Imported ${res.data.count} items!`);
                if (activeLineIndex !== -1) {
                    const currentText = subtitles[activeLineIndex]?.text || '';
                    const selectedTrack = availableTracks.find(t => t.id === sourceTrackId);
                    const srcLang = selectedTrack?.language_code || originalLang || 'ja';
                    await fetchAnalyzedWords(currentText, srcLang);
                }
            }
        } catch (err: any) {
            alert(err.response?.data?.error || "Save failed.");
        } finally { setIsSavingCustomDict(true); setTimeout(() => setIsSavingCustomDict(false), 2000); }
    };

    useEffect(() => {
        if (isOpen && activeTab === 'vocab') fetchCustomDict();
    }, [isOpen, activeTab]);

    const fetchYoutubeSources = async () => {
        if (!videoId) return;
        setIsLoadingSources(true);
        try {
            const res = await axios.get(`/api/study/youtube/subtitles-list/${videoId}`);
            setYtTracks(res.data.subtitles || []);
        } catch (err) { console.error(err); } finally { setIsLoadingSources(false); }
    };

    const handleImport = async (lang: string, isAuto: boolean) => {
        if (!lessonId) return;
        const trackIdKey = lang + (isAuto ? '_auto' : '');
        setIsImportingId(trackIdKey);
        try {
            const res = await axios.post(`/api/study/youtube/subtitles-download/${lessonId}`, {
                lang_code: lang, is_auto: isAuto
            });
            const newTrackId = res.data.track_id;
            if (newTrackId) {
                pollTrackStatus(newTrackId);
            } else {
                setIsImportingId(null);
                alert("YouTube từ chối yêu cầu. Vui lòng thử lại sau.");
            }
        } catch (err) { 
            alert("Lỗi kết nối YouTube."); 
            setIsImportingId(null);
        }
    };

    const pollTrackStatus = async (tid: number) => {
        let attempts = 0;
        const maxAttempts = 30;
        const interval = setInterval(async () => {
            attempts++;
            try {
                const res = await axios.get(`/api/content/subtitles/available/${lessonId}`);
                const track = (res.data.subtitles || []).find((t: any) => t.id === tid);
                if (track) {
                    if (track.status === 'completed') {
                        clearInterval(interval);
                        setIsImportingId(null);
                        await fetchAvailableTracks();
                    } else if (track.status === 'failed') {
                        clearInterval(interval);
                        setIsImportingId(null);
                        alert(`Tải thất bại: ${track.note || '429 chặn yêu cầu'}`);
                    }
                }
            } catch (e) { console.error("Polling error", e); }
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                setIsImportingId(null);
                alert("Quá thời gian tải (Timeout).");
            }
        }, 1500);
    };

    const handleTextUpload = async () => {
        if (!pastedText || !lessonId) return;
        setIsUploadingText(true);
        try {
            await axios.post(`/api/study/subtitles/upload-text/${lessonId}`, {
                text: pastedText,
                language_code: uploadLang,
                name: uploadName
            });
            setPastedText('');
            setUploadName('');
            await fetchAvailableTracks();
            alert("Subtitles imported successfully!");
        } catch (err: any) { 
            alert(err.response?.data?.message || "Upload failed."); 
        } finally { setIsUploadingText(false); }
    };

    const handleSaveAsGlobalDefault = async () => {
        setIsSavingGlobal(true);
        try {
            await saveAsDefaultPreferences();
            setGlobalSaveStatus('success');
            setTimeout(() => setGlobalSaveStatus('idle'), 3000);
        } catch (err) { alert("Failed to save global default."); } finally { setIsSavingGlobal(false); }
    };

    const handleSaveTrackName = async (tid: number) => {
        await updateTrackMetadata(tid, { name: editTrackName });
        setEditingTrackId(null);
    };

    const handleEditContent = async (tid: number) => {
        setIsFetchingContent(true);
        setIsEditingContentId(tid);
        try {
            const res = await axios.get(`/api/content/subtitles/${tid}/export?format=srt`);
            setEditContentText(res.data);
        } catch (err) {
            alert("Failed to fetch subtitle content.");
            setIsEditingContentId(null);
        } finally { setIsFetchingContent(false); }
    };

    const handleSaveContent = async () => {
        if (!isEditingContentId || !editContentText) return;
        setIsSavingContent(true);
        try {
            await axios.patch(`/api/content/subtitles/${isEditingContentId}/full`, { content: editContentText });
            await fetchAvailableTracks();
            setIsEditingContentId(null);
            setEditContentText('');
        } catch (err: any) {
            alert(err.response?.data?.error || "Failed to save content.");
        } finally { setIsSavingContent(false); }
    };

    const handleDeleteTrack = async (tid: number) => {
        if (!confirm("!!! DELETE TRACK !!!\n\nThis will permanently remove this subtitle file. Are you sure?")) return;
        try {
            await axios.delete(`/api/content/subtitles/${tid}`);
            await fetchAvailableTracks();
        } catch (err) { alert("Failed to delete track."); }
    };

    const handleApplyVocabSettings = async () => {
        setIsSaving(true);
        try {
            await axios.patch(`/api/study/lesson/${lessonId}/settings`, {
                sourceTrackId,
                autoSegmentationEnabled,
                analysisSource: autoSegmentationEnabled ? 'auto' : 'track'
            });
            if (activeLineIndex !== -1) {
                const currentText = subtitles[activeLineIndex]?.text || '';
                const selectedTrack = availableTracks.find(t => t.id === sourceTrackId);
                const srcLang = selectedTrack?.language_code || originalLang || 'ja';
                await fetchAnalyzedWords(currentText, srcLang);
            }
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) { console.error(err); } finally { setIsSaving(false); }
    };

    useEffect(() => {
        if (activeTab === 'subtitles' && librarySubTab === 'cloud' && isOpen) fetchYoutubeSources();
    }, [activeTab, librarySubTab, isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => onClose(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed top-0 right-0 h-screen w-full max-w-md bg-slate-950 border-l border-white/10 z-[101] flex flex-col shadow-2xl overflow-hidden font-inter">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 bg-slate-900/20 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                {activeTab !== 'hub' && (
                                    <button onClick={() => setActiveTab('hub')} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-all">
                                        <ChevronLeft size={20} />
                                    </button>
                                )}
                                <h2 className="text-xl font-black tracking-tighter uppercase text-white flex items-center gap-2">
                                    <Layers className="text-sky-500" />
                                    {activeTab === 'hub' ? 'Studio Hub' : activeTab.toUpperCase()}
                                </h2>
                            </div>
                            <button onClick={() => onClose(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-400">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content (Scrollable) */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-40">
                            <AnimatePresence mode="wait">
                                {activeTab === 'hub' && (
                                    <motion.div key="hub" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
                                        <HubCard 
                                            title="Subtitle Studio" 
                                            desc="Manage tracks, cloud sync, and timing" 
                                            icon={<Languages size={24} />} 
                                            color="sky" 
                                            onClick={() => setActiveTab('subtitles')}
                                        />
                                        <HubCard 
                                            title="Display & Style" 
                                            desc="Font sizes, colors, and positioning" 
                                            icon={<Palette size={24} />} 
                                            color="purple" 
                                            onClick={() => setActiveTab('display')}
                                        />
                                        <HubCard 
                                            title="Vocab Engine" 
                                            desc="Analysis mode and dictionary settings" 
                                            icon={<Zap size={24} />} 
                                            color="amber" 
                                            onClick={() => setActiveTab('vocab')}
                                        />

                                        <div className="pt-8 space-y-4 border-t border-white/5">
                                            <div className="flex items-center gap-2 px-2">
                                                <Gauge size={16} className="text-slate-500" />
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quick Controls</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="bg-white/5 rounded-3xl p-5 border border-white/5 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-slate-300">Playback Speed</span>
                                                        <span className="text-xs font-black text-sky-400">{playbackRate}x</span>
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                                                            <button key={r} onClick={() => setPlaybackRate(r)}
                                                                className={`py-2 rounded-xl text-[10px] font-black transition-all ${playbackRate === r ? 'bg-sky-500 text-slate-950 shadow-lg' : 'bg-slate-900 text-slate-500'}`}
                                                            >
                                                                {r}x
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {activeTab === 'subtitles' && (
                                    <motion.div key="subtitles" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                        <div className="flex bg-slate-900 rounded-2xl p-1 gap-1">
                                            {[
                                                { id: 'tracks', label: 'Library', icon: <Layers size={14} /> },
                                                { id: 'upload', label: 'Upload', icon: <Upload size={14} /> },
                                                { id: 'cloud', label: 'Cloud', icon: <Globe size={14} /> }
                                            ].map(t => (
                                                <button key={t.id} onClick={() => setLibrarySubTab(t.id as any)}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${librarySubTab === t.id ? 'bg-sky-500 text-slate-950 shadow-lg' : 'text-slate-500'}`}
                                                >
                                                    {t.icon} {t.label}
                                                </button>
                                            ))}
                                        </div>

                                        {librarySubTab === 'tracks' && (
                                            <div className="space-y-4">
                                                {availableTracks.map(track => (
                                                    <div key={track.id} className={`bg-slate-900/60 rounded-3xl p-5 border border-white/5 space-y-4 ${trackIds.s1 === track.id || trackIds.s2 === track.id || trackIds.s3 === track.id ? 'ring-1 ring-sky-500/50' : ''}`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className={`text-xs font-bold truncate ${track.is_original ? 'text-sky-400' : 'text-white'}`}>
                                                                        [{track.language_code?.toUpperCase()}] {track.name}
                                                                    </h4>
                                                                    {editingTrackId === track.id ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <input autoFocus value={editTrackName} onChange={e => setEditTrackName(e.target.value)} className="bg-slate-950 border border-white/10 rounded px-2 py-0.5 text-[10px] outline-none" />
                                                                            <button onClick={() => handleSaveTrackName(track.id)} className="text-emerald-500"><Check size={12} /></button>
                                                                            <button onClick={() => setEditingTrackId(null)} className="text-rose-500"><X size={12} /></button>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={() => { setEditingTrackId(track.id); setEditTrackName(track.name); }} className="text-slate-500 hover:text-white"><Edit3 size={12} /></button>
                                                                    )}
                                                                </div>
                                                                <p className="text-[9px] text-slate-500 font-black uppercase mt-1">
                                                                    {track.line_count} lines • {track.uploader_name || 'System'}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                {['s1', 's2', 's3'].map(slot => (
                                                                    <button key={slot} 
                                                                        onClick={() => {
                                                                            const currentId = trackIds[slot as keyof typeof trackIds];
                                                                            setTrackIds({ [slot]: currentId === track.id ? null : track.id });
                                                                        }}
                                                                        className={`w-8 h-8 rounded-lg text-[9px] font-black flex items-center justify-center transition-all ${trackIds[slot as keyof typeof trackIds] === track.id ? 'bg-sky-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-500'}`}
                                                                    >
                                                                        T{slot.slice(1)}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                            <div className="flex gap-2">
                                                                <button onClick={() => handleEditContent(track.id)} className="p-2 text-amber-500 bg-amber-500/10 rounded-lg hover:bg-amber-500/20">
                                                                    {isFetchingContent && isEditingContentId === track.id ? <RefreshCw size={14} className="animate-spin" /> : <Edit3 size={14} />}
                                                                </button>
                                                                
                                                                {/* Change Language (Globe) */}
                                                                <div className="relative">
                                                                    <button 
                                                                        onClick={() => setIsChangingLangId(isChangingLangId === track.id ? null : track.id)} 
                                                                        className={`p-2 rounded-lg transition-all ${isChangingLangId === track.id ? 'bg-sky-500 text-slate-950' : 'text-sky-500 bg-sky-500/10 hover:bg-sky-500/20'}`}
                                                                    >
                                                                        <Globe size={14} />
                                                                    </button>
                                                                    <AnimatePresence>
                                                                        {isChangingLangId === track.id && (
                                                                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-full left-0 mb-2 bg-slate-900 border border-white/10 rounded-xl p-1.5 flex gap-1 z-50 shadow-2xl">
                                                                                {['vi', 'en', 'ja', 'cn', 'kr', 'fr', 'de'].map(l => (
                                                                                    <button key={l} onClick={async () => { await updateTrackMetadata(track.id, { language_code: l }); setIsChangingLangId(null); }} className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${track.language_code === l ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{l}</button>
                                                                                ))}
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>

                                                                <button 
                                                                    onClick={async () => {
                                                                        setIsTranslatingId(track.id);
                                                                        try { await translateTrack(track.id, 'vi', `${track.name} (VN)`); } finally { setIsTranslatingId(null); }
                                                                    }} 
                                                                    disabled={isTranslatingId !== null}
                                                                    className="p-2 text-sky-500 bg-sky-500/10 rounded-lg hover:bg-sky-500/20 disabled:opacity-50"
                                                                >
                                                                    {isTranslatingId === track.id ? <RefreshCw size={14} className="animate-spin" /> : <Languages size={14} />}
                                                                </button>
                                                                <button onClick={() => exportTrack(track.id, 'srt')} className="p-2 text-slate-400 hover:text-white"><Download size={14} /></button>
                                                            </div>
                                                            <button onClick={() => handleDeleteTrack(track.id)} disabled={track.is_original && user?.role !== 'admin'} className="p-2 text-slate-700 hover:text-rose-500 disabled:opacity-20"><Trash2 size={14} /></button>
                                                        </div>
                                                        {isEditingContentId === track.id && (
                                                            <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-top-2">
                                                                <textarea value={editContentText} onChange={e => setEditContentText(e.target.value)} className="w-full h-48 bg-slate-950 border border-white/10 rounded-xl p-3 text-[10px] font-mono text-slate-400 outline-none resize-none" />
                                                                <div className="flex gap-2">
                                                                    <button onClick={handleSaveContent} disabled={isSavingContent} className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                                                                        {isSavingContent ? 'Saving...' : 'Save Changes'}
                                                                    </button>
                                                                    <button onClick={() => setIsEditingContentId(null)} className="px-4 py-2 bg-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">Cancel</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {librarySubTab === 'upload' && (
                                            <div className="space-y-6 bg-slate-900/40 rounded-3xl p-6 border border-white/5">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Language</label>
                                                        <select value={uploadLang} onChange={e => setUploadLang(e.target.value)} className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-sky-400 outline-none">
                                                            <option value="en">English</option><option value="vi">Vietnamese</option><option value="ja">Japanese</option>
                                                        </select>
                                                    </div>
                                                    <input type="text" value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="Track Name (Optional)" className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-sky-500/50" />
                                                    <textarea value={pastedText} onChange={e => setPastedText(e.target.value)} placeholder="Paste SRT content here..." className="w-full h-32 bg-slate-950 border border-white/10 rounded-xl p-4 text-xs font-mono text-slate-400 outline-none resize-none" />
                                                    <button onClick={handleTextUpload} disabled={!pastedText || isUploadingText} className="w-full py-4 bg-sky-500 text-slate-950 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-sky-500/20 active:scale-95 disabled:opacity-50">
                                                        {isUploadingText ? 'Processing...' : 'Import Content'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {librarySubTab === 'cloud' && (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-2">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Available on YouTube</span>
                                                    <button onClick={fetchYoutubeSources} className="text-sky-400 p-2"><RefreshCw size={14} className={isLoadingSources ? 'animate-spin' : ''} /></button>
                                                </div>
                                                <div className="grid gap-3">
                                                    {ytTracks.map(t => (
                                                        <div key={t.lang_code + t.is_auto} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                                            <div>
                                                                <h5 className="text-xs font-bold text-slate-200">{t.name}</h5>
                                                                <p className="text-[9px] text-slate-500 font-black uppercase mt-0.5">{t.is_auto ? 'Auto-generated' : 'Official Subtitles'}</p>
                                                            </div>
                                                            <button 
                                                                onClick={() => handleImport(t.lang_code, t.is_auto)} 
                                                                disabled={isImportingId !== null}
                                                                className="px-4 py-2 bg-sky-500/10 border border-sky-500/20 text-sky-500 rounded-xl text-[10px] font-black uppercase hover:bg-sky-500 hover:text-slate-950 transition-all disabled:opacity-50"
                                                            >
                                                                {isImportingId === (t.lang_code + (t.is_auto ? '_auto' : '')) ? (
                                                                    <RefreshCw size={14} className="animate-spin" />
                                                                ) : 'Import'}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <section className="bg-amber-500/5 rounded-3xl p-6 border border-amber-500/10 space-y-4 mt-8">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-2"><Clock size={12}/> Sync Calibration</h4>
                                                <span className="text-xs font-mono font-bold text-amber-400">{settings.syncOffset > 0 ? '+' : ''}{(settings.syncOffset || 0).toFixed(1)}s</span>
                                            </div>
                                            <input type="range" min="-5" max="5" step="0.1" value={settings.syncOffset || 0} onChange={(e) => setSyncOffset(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-800 appearance-none rounded-full accent-amber-500 cursor-pointer" />
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === 'display' && (
                                    <motion.div key="display" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                        <div className="flex bg-slate-900 p-1 rounded-2xl gap-1">
                                            {(['s1', 's2', 's3'] as const).map(sid => (
                                                <button key={sid} onClick={() => setActiveDisplayTrack(sid)}
                                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeDisplayTrack === sid ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-500'}`}
                                                >
                                                    Track {sid.slice(1)}
                                                </button>
                                            ))}
                                        </div>

                                        {(() => {
                                            const s = settings[activeDisplayTrack];
                                            const update = (v: any) => setTrackSettings(activeDisplayTrack, v);
                                            return (
                                                <div className="space-y-6">
                                                    <div className="bg-white/5 rounded-[2.5rem] p-6 border border-white/5 space-y-6">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase">Visibility</span>
                                                            <button onClick={() => update({ enabled: !s.enabled })} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${s.enabled ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                                {s.enabled ? 'ON SCREEN' : 'HIDDEN'}
                                                            </button>
                                                        </div>
                                                        <StyleSlider label="Font Scale" val={`${(s.fontSize * 10).toFixed(0)}%`} min={0.5} max={6} step={0.1} value={s.fontSize} onChange={v => update({ fontSize: v })} />
                                                        <StyleSlider label="Vertical Pos" val={`${s.position}%`} min={0} max={100} step={1} value={s.position} onChange={v => update({ position: v })} />
                                                        
                                                        <div className="space-y-4">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase px-1">Text Alignment</span>
                                                            <div className="flex bg-slate-900/60 p-1 rounded-xl border border-white/5 gap-1">
                                                                {(['left', 'center', 'right'] as const).map(align => (
                                                                    <button key={align} onClick={() => update({ textAlign: align })}
                                                                        className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all ${s.textAlign === align ? 'bg-purple-500 text-white' : 'text-slate-500'}`}
                                                                    >
                                                                        {align === 'left' ? <AlignLeft size={14} /> : align === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between border-t border-white/5 pt-5">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase">Color & Opacity</span>
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex gap-2">
                                                                    <input type="color" value={s.color} onChange={e => update({ color: e.target.value })} title="Text Color" className="w-8 h-8 rounded-full bg-transparent p-0 cursor-pointer border-none shadow-xl shadow-black/40" />
                                                                    <input type="color" value={s.bgColor} onChange={e => update({ bgColor: e.target.value })} title="BG Color" className="w-8 h-8 rounded-xl bg-transparent p-0 cursor-pointer border-none shadow-xl shadow-black/40" />
                                                                </div>
                                                                <div className="flex flex-col gap-1 w-24">
                                                                    <span className="text-[8px] font-black text-slate-600 uppercase">BG Opacity</span>
                                                                    <input type="range" min="0" max="1" step="0.1" value={s.bgOpacity} onChange={e => update({ bgOpacity: parseFloat(e.target.value) })} className="w-full accent-purple-500" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Notes Section */}
                                        <section className="bg-amber-500/5 rounded-[2.5rem] p-6 border border-amber-500/10 space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400"><Clock size={20} /></div>
                                                <div className="flex flex-col">
                                                    <h3 className="text-xs font-black uppercase text-amber-400">Notes Display</h3>
                                                </div>
                                                <button onClick={() => setNoteSettings({ enabled: !settings.notes.enabled })} className={`ml-auto px-4 py-2 rounded-xl text-[10px] font-black transition-all ${settings.notes.enabled ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                                                    {settings.notes.enabled ? 'ENABLED' : 'DISABLED'}
                                                </button>
                                            </div>
                                            {settings.notes.enabled && (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <StyleSlider label="Size" val={`${(settings.notes.fontSize * 10).toFixed(0)}%`} min={1} max={6} step={0.1} value={settings.notes.fontSize} onChange={v => setNoteSettings({ fontSize: v })} />
                                                        <StyleSlider label="Vertical" val={`${settings.notes.position}%`} min={0} max={100} step={1} value={settings.notes.position} onChange={v => setNoteSettings({ position: v })} />
                                                    </div>
                                                </div>
                                            )}
                                        </section>

                                        {/* Social Section */}
                                        <section className="bg-emerald-500/5 rounded-[2.5rem] p-6 border border-emerald-500/10 space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400"><Users size={20} /></div>
                                                <div className="flex flex-col">
                                                    <h3 className="text-xs font-black uppercase text-emerald-400">Social Mode</h3>
                                                </div>
                                                <button onClick={() => setCommunitySettings({ enabled: !settings.community.enabled })} className={`ml-auto px-4 py-2 rounded-xl text-[10px] font-black transition-all ${settings.community.enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                                                    {settings.community.enabled ? 'ONLINE' : 'OFFLINE'}
                                                </button>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === 'vocab' && (
                                    <motion.div key="vocab" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                        <div className="space-y-4">
                                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"><Globe size={12} className="text-amber-500" /> Source Track</label>
                                            <select value={sourceTrackId || ''} onChange={e => setSourceTrackId(Number(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none">
                                                <option value="" disabled>Select track...</option>
                                                {availableTracks.map(t => (
                                                    <option key={t.id} value={t.id}>[{t.language_code?.toUpperCase()}] {t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="p-6 rounded-[2.5rem] bg-slate-900/40 border border-white/5 flex items-center justify-between">
                                             <span className="text-[10px] font-black text-white uppercase">Analysis Mode</span>
                                             <button onClick={() => setAutoSegmentationEnabled(!autoSegmentationEnabled)} className={`w-12 h-6 rounded-full relative transition-all ${autoSegmentationEnabled ? 'bg-amber-500' : 'bg-slate-800'}`}>
                                                 <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${autoSegmentationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                             </button>
                                         </div>

                                         <div className="space-y-6 pt-6 border-t border-white/5">
                                             <div className="flex items-center gap-2 px-2">
                                                 <Edit3 size={16} className="text-sky-500" />
                                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Custom Lesson Dictionary</span>
                                             </div>
                                             
                                             <div className="bg-slate-900/60 rounded-[2.5rem] p-6 border border-white/5 space-y-4">
                                                 <div className="flex items-center justify-between px-1">
                                                     <label className="text-[9px] font-black uppercase text-slate-500">Language Pair</label>
                                                     <select 
                                                        value={customDictLang} 
                                                        onChange={e => setCustomDictLang(e.target.value)}
                                                        className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold text-sky-400 outline-none"
                                                     >
                                                         <option value="ja-vi">JP → VI</option>
                                                         <option value="ja-en">JP → EN</option>
                                                         <option value="en-vi">EN → VI</option>
                                                     </select>
                                                 </div>

                                                 <div className="relative">
                                                     <textarea 
                                                        value={customDictText}
                                                        onChange={e => setCustomDictText(e.target.value)}
                                                        placeholder="Mặt trước | Mặt sau&#10;Ví dụ:&#10;こんにちは | Xin chào&#10;世界 | Thế giới"
                                                        className="w-full h-40 bg-slate-950 border border-white/10 rounded-2xl p-4 text-xs font-mono text-slate-400 outline-none resize-none focus:border-sky-500/50 transition-all"
                                                     />
                                                     {isFetchingCustomDict && (
                                                         <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                                                             <RefreshCw size={20} className="text-sky-500 animate-spin" />
                                                         </div>
                                                     )}
                                                 </div>

                                                 <button 
                                                    onClick={handleSaveCustomDict}
                                                    disabled={isSavingCustomDict || !customDictText.trim()}
                                                    className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 ${
                                                        isSavingCustomDict ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-slate-950 shadow-sky-500/20'
                                                    }`}
                                                 >
                                                     {isSavingCustomDict ? 'DICT SAVED!' : 'SAVE CUSTOM DICT'}
                                                 </button>

                                                 <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider text-center px-4">
                                                     Custom dict will be prioritized first during word analysis.
                                                 </p>
                                             </div>
                                         </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 p-6 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 space-y-3">
                            <div className="flex gap-3">
                                {activeTab === 'vocab' ? (
                                    <button onClick={handleApplyVocabSettings} disabled={isSaving} className="flex-1 py-4 bg-amber-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50">
                                        {saveStatus === 'success' ? 'UPDATED!' : 'APPLY & REFRESH'}
                                    </button>
                                ) : (
                                    <button onClick={async () => { setIsSaving(true); await saveSettings(); setSaveStatus('success'); setTimeout(() => setSaveStatus('idle'), 2000); setIsSaving(false); }} disabled={isSaving || activeTab === 'hub'} className="flex-1 py-4 bg-sky-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-sky-500/20 active:scale-95 disabled:opacity-50">
                                        {saveStatus === 'success' ? 'LESSON SAVED!' : 'SAVE FOR THIS LESSON'}
                                    </button>
                                )}
                                {activeTab !== 'hub' && (
                                    <button onClick={handleSaveAsGlobalDefault} disabled={isSavingGlobal} className="p-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl transition-all">
                                        {globalSaveStatus === 'success' ? <Check size={16} className="text-emerald-500" /> : <Shield size={16} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

const HubCard: React.FC<{ title: string, desc: string, icon: React.ReactNode, color: string, onClick: () => void }> = ({ title, desc, icon, color, onClick }) => {
    const colors: any = {
        sky: 'text-sky-400 bg-sky-400/10 border-sky-400/20 hover:border-sky-400/50',
        purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20 hover:border-purple-400/50',
        amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50'
    };
    return (
        <button onClick={onClick} className={`w-full p-6 rounded-[2rem] border transition-all flex items-center gap-6 text-left group ${colors[color]}`}>
            <div className="p-4 bg-black/20 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
            <div className="flex-1">
                <h4 className="text-base font-black uppercase tracking-tight text-white mb-1">{title}</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{desc}</p>
            </div>
        </button>
    );
};

const StyleSlider: React.FC<{ label: string, val: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void }> = ({ label, val, min, max, step, value, onChange }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
            <h3 className="text-[10px] font-black uppercase text-slate-500">{label}</h3>
            <span className="text-xs font-mono text-white/80">{val}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
               className="w-full h-1.5 bg-slate-800 appearance-none rounded-full accent-sky-500 cursor-pointer" />
    </div>
);
