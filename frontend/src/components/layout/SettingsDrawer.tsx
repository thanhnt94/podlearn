import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Palette, Save, Check, Clock, StickyNote, 
    Globe, Download, Trash2, RefreshCw, Upload, ExternalLink, 
    Layers, Info, Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/usePlayerStore';
import axios from 'axios';

type MainTab = 'display' | 'notes' | 'library' | 'social';
interface YTTrack { lang_code: string; name: string; is_auto: boolean; }

export const SettingsDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { 
        settings, setTrackSettings, setNoteSettings,
        availableTracks, trackIds, setTrackIds, setAvailableTracks,
        lessonId, videoId, aiInsights,
        ttsTrackSource, setTTSTrackSource,
        saveAsDefaultPreferences, setLessonData
    } = usePlayerStore();

    const [activeMainTab, setActiveMainTab] = useState<MainTab>('display');
    const [activeDisplayTrack, setActiveDisplayTrack] = useState<'s1' | 's2' | 's3'>('s1');
    
    // Status state
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingGlobal, setIsSavingGlobal] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
    const [globalSaveStatus, setGlobalSaveStatus] = useState<'idle' | 'success'>('idle');
    const [isLoadingSources, setIsLoadingSources] = useState(false);
    const [importingLang, setImportingLang] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Source state
    const [ytTracks, setYtTracks] = useState<YTTrack[]>([]);
    const [uploadLang, setUploadLang] = useState('en');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const refreshAvailableTracks = async () => {
        if (!lessonId) return;
        try {
            const res = await axios.get(`/api/subtitles/available/${lessonId}`);
            setAvailableTracks(res.data.subtitles);
        } catch (err) { console.error(err); }
    };

    const fetchYoutubeSources = async () => {
        if (!videoId) return;
        setIsLoadingSources(true);
        try {
            const res = await axios.get(`/api/youtube/subtitles-list/${videoId}`);
            setYtTracks(res.data.subtitles || []);
        } catch (err) { console.error(err); } finally { setIsLoadingSources(false); }
    };

    const handleImport = async (lang: string, isAuto: boolean) => {
        if (!lessonId) return;
        setImportingLang(lang);
        try {
            const data = (window as any).__PODLEARN_DATA__;
            await axios.post(`/api/youtube/subtitles-download/${lessonId}`, {
                lang_code: lang, is_auto: isAuto
            }, { headers: { 'X-CSRF-Token': data.csrf_token } });
            await refreshAvailableTracks();
        } catch (err) { alert("Import failed."); } finally { setImportingLang(null); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !lessonId) return;
        
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('language_code', uploadLang);
        
        try {
            const data = (window as any).__PODLEARN_DATA__;
            await axios.post(`/api/subtitles/upload/${lessonId}`, formData, {
                headers: { 
                    'X-CSRF-Token': data.csrf_token,
                    'Content-Type': 'multipart/form-data'
                }
            });
            await refreshAvailableTracks();
        } catch (err) { alert("Upload failed."); } finally { setIsUploading(false); }
    };

    const handleDeleteTrack = async (id: number) => {
        if (!confirm("Delete track?")) return;
        try {
            const data = (window as any).__PODLEARN_DATA__;
            await axios.delete(`/api/subtitles/${id}`, { headers: { 'X-CSRF-Token': data.csrf_token } });
            await refreshAvailableTracks();
        } catch (err) { console.error(err); }
    };

    const handleSaveSettings = async () => {
        if (!lessonId) return;
        setIsSaving(true);
        try {
            const data = (window as any).__PODLEARN_DATA__;
            await axios.post(`/api/lesson/${lessonId}/set-languages`, {
                s1_track_id: trackIds.s1, s2_track_id: trackIds.s2, s3_track_id: trackIds.s3, settings: settings
            }, { headers: { 'X-CSRF-Token': data.csrf_token } });
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (err) { console.error(err); } finally { setIsSaving(false); }
    };

    const handleSaveAsGlobalDefault = async () => {
        setIsSavingGlobal(true);
        try {
            await saveAsDefaultPreferences();
            setGlobalSaveStatus('success');
            setTimeout(() => setGlobalSaveStatus('idle'), 3000);
        } catch (err) { alert("Failed to save global default."); } finally { setIsSavingGlobal(false); }
    };

    const handleResetToGlobalDefault = async () => {
        if (!confirm("Revert this video's styles to your global default?")) return;
        try {
            const res = await axios.get('/api/user/preferences');
            setLessonData({ global_preferences: res.data, settings_json: "{}" });
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        if (activeMainTab === 'library' && isOpen) fetchYoutubeSources();
    }, [activeMainTab, isOpen]);

    // Categories UI
    const categories = [
        { id: 'display', label: 'Display', icon: <Palette size={20} /> },
        { id: 'notes', label: 'Notes', icon: <StickyNote size={20} /> },
        { id: 'library', label: 'Library', icon: <Globe size={20} /> },
        { id: 'social', label: 'Social', icon: <Layers size={20} /> },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/20 z-[100]" />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed top-0 right-0 h-screen w-full max-w-md bg-slate-900 border-l border-white/10 z-[101] flex flex-col shadow-2xl overflow-hidden">
                        
                        {/* 1. Header & Primary Navigation */}
                        <div className="p-6 pb-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <Layers className="text-sky-500" />
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">STUDIO SETTINGS</span>
                                </h2>
                                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 group">
                                    <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </div>

                            <div className="flex bg-black/40 p-1.5 rounded-2xl gap-2 border border-white/5">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveMainTab(cat.id as MainTab)}
                                        className={`flex-1 flex flex-col items-center py-3 px-2 rounded-xl transition-all relative ${
                                            activeMainTab === cat.id ? 'text-sky-400' : 'text-slate-500 hover:text-white'
                                        }`}
                                    >
                                        <div className={`mb-1 transition-transform ${activeMainTab === cat.id ? 'scale-110' : 'scale-100'}`}>{cat.icon}</div>
                                        <span className="text-[9px] font-black uppercase tracking-widest">{cat.label}</span>
                                        {activeMainTab === cat.id && (
                                            <motion.div layoutId="activeTabGlow" className="absolute inset-0 bg-sky-500/10 rounded-xl" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Content Area */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                           <AnimatePresence mode="wait">
                               {activeMainTab === 'display' && (
                                   <motion.div key="display" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
                                       {/* Track Switcher (Sub-nav) */}
                                       <div className="flex bg-slate-800/50 p-1 rounded-xl gap-1">
                                           {(['s1', 's2', 's3'] as const).map(sid => (
                                               <button key={sid} onClick={() => setActiveDisplayTrack(sid)}
                                                   className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                                       activeDisplayTrack === sid ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500'
                                                   }`}
                                               >
                                                   Track {sid.slice(1)}
                                               </button>
                                           ))}
                                       </div>

                                       <section className="space-y-6">
                                            {/* Track specific editor */}
                                            {(() => {
                                                const s = settings[activeDisplayTrack];
                                                const update = (v: any) => setTrackSettings(activeDisplayTrack, v);
                                                return (
                                                    <div className="space-y-6">
                                                        <div className="bg-white/5 rounded-3xl p-5 border border-white/5 space-y-5">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visibility</span>
                                                                <button onClick={() => update({ enabled: !s.enabled })}
                                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${s.enabled ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                                                                    {s.enabled ? 'ON SCREEN' : 'HIDDEN'}
                                                                </button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source Language</label>
                                                                <select value={trackIds[activeDisplayTrack] || ''} 
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setTrackIds({ [activeDisplayTrack]: val === 'ai-track' ? 'ai' : (parseInt(val) || null) });
                                                                        }}
                                                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-3 text-sm focus:border-sky-500/50 outline-none">
                                                                    <option value="">(Click to assign...)</option>
                                                                    {aiInsights.length > 0 && (
                                                                        <optgroup label="✨ AI Intelligence">
                                                                            <option value="ai-track">🔹 AI Linguistic Insight (VN)</option>
                                                                        </optgroup>
                                                                    )}
                                                                    <optgroup label="Standard Tracks">
                                                                        {availableTracks.map(t => <option key={t.id} value={t.id}>{t.language_code.toUpperCase()} ({t.uploader_name})</option>)}
                                                                    </optgroup>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="bg-white/5 rounded-3xl p-5 border border-white/5 space-y-6">
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center px-1">
                                                                    <h3 className="text-[10px] font-black uppercase text-slate-500">Font Scale</h3>
                                                                    <span className="text-xs font-mono text-sky-400">{(s.fontSize * 10).toFixed(0)}%</span>
                                                                </div>
                                                                <input type="range" min="0.5" max="6" step="0.1" value={s.fontSize} onChange={(e) => update({ fontSize: parseFloat(e.target.value) })}
                                                                       className="w-full h-1.5 bg-slate-800 appearance-none rounded-full accent-sky-500 cursor-pointer" />
                                                            </div>
                                                            <div className="space-y-3 pt-4 border-t border-white/5">
                                                                <div className="flex justify-between items-center px-1">
                                                                    <h3 className="text-[10px] font-black uppercase text-slate-500">Vertical Position</h3>
                                                                    <span className="text-xs font-mono text-sky-400">{s.position}%</span>
                                                                </div>
                                                                <input type="range" min="0" max="100" step="1" value={s.position} onChange={(e) => update({ position: parseInt(e.target.value) })}
                                                                       className="w-full h-1.5 bg-slate-800 appearance-none rounded-full accent-sky-500 cursor-pointer" />
                                                            </div>
                                                            <div className="flex items-center justify-between border-t border-white/5 pt-5">
                                                                <span className="text-[10px] font-black text-slate-500 uppercase">Text Color</span>
                                                                <input type="color" value={s.color} onChange={(e) => update({ color: e.target.value })} className="w-8 h-8 rounded-full bg-transparent p-0 cursor-pointer" />
                                                            </div>
                                                            <div className="flex items-center justify-between border-t border-white/5 pt-5">
                                                                <span className="text-[10px] font-black text-slate-500 uppercase">Background</span>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="bg-black/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                                                        <span className="text-[10px] font-mono text-sky-400">{Math.round(s.bgOpacity * 100)}%</span>
                                                                        <input type="range" min="0" max="1" step="0.05" value={s.bgOpacity} onChange={(e) => update({ bgOpacity: parseFloat(e.target.value) })} className="w-20 accent-sky-500 h-1" />
                                                                    </div>
                                                                    <input type="color" value={s.bgColor} onChange={(e) => update({ bgColor: e.target.value })} className="w-8 h-8 rounded-xl bg-transparent p-0 cursor-pointer" />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between border-t border-white/5 pt-5">
                                                                <span className="text-[10px] font-black text-slate-500 uppercase">Alignment</span>
                                                                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl">
                                                                    {(['left', 'center', 'right'] as const).map(align => (
                                                                        <button 
                                                                            key={align}
                                                                            onClick={() => update({ textAlign: align })}
                                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${(s.textAlign || 'center') === align ? 'bg-sky-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}
                                                                        >
                                                                            {align}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                       </section>

                                        {/* 3. Subtitle Sync Calibration */}
                                        <section className="bg-amber-500/5 rounded-3xl p-6 border border-amber-500/10 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <h4 className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-2"><Clock size={12}/> Sync Calibration</h4>
                                                    <p className="text-[9px] text-slate-600">Manual timing adjustment (±2s)</p>
                                                </div>
                                                <span className={`text-xs font-mono font-bold ${settings.syncOffset < 0 ? 'text-rose-400' : settings.syncOffset > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                    {settings.syncOffset > 0 ? '+' : ''}{settings.syncOffset.toFixed(1)}s
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <input 
                                                    type="range" min="-2" max="2" step="0.1" 
                                                    value={settings.syncOffset || 0} 
                                                    onChange={(e) => usePlayerStore.getState().setSyncOffset(parseFloat(e.target.value))} 
                                                    className="w-full h-1.5 bg-slate-800 appearance-none rounded-full accent-amber-500 cursor-pointer" 
                                                />
                                                <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter text-slate-600">
                                                    <span>Delay Subtitles</span>
                                                    <span>Earlier</span>
                                                </div>
                                            </div>
                                        </section>

                                         <section className="bg-white/5 rounded-[2rem] p-6 border border-white/5 space-y-4">
                                             <div className="flex items-center gap-3 mb-2">
                                                 <div className="w-8 h-8 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-400">
                                                     <Save size={16} />
                                                 </div>
                                                 <div className="flex flex-col">
                                                     <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Global Style Template</h4>
                                                     <p className="text-[9px] text-slate-500">Apply these styles to all future videos</p>
                                                 </div>
                                             </div>
                                             
                                             <div className="grid grid-cols-2 gap-3">
                                                 <button 
                                                     onClick={handleSaveAsGlobalDefault}
                                                     disabled={isSavingGlobal}
                                                     className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                                                         globalSaveStatus === 'success' 
                                                         ? 'bg-emerald-500 text-slate-950' 
                                                         : 'bg-white/5 hover:bg-white/10 text-white border border-white/5'
                                                     }`}
                                                 >
                                                     {isSavingGlobal ? <RefreshCw size={14} className="animate-spin" /> : globalSaveStatus === 'success' ? <Check size={14} /> : <Save size={14} />}
                                                     {globalSaveStatus === 'success' ? 'TEMPLATE SAVED' : 'SAVE AS DEFAULT'}
                                                 </button>

                                                 <button 
                                                     onClick={handleResetToGlobalDefault}
                                                     className="flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-all border border-white/5"
                                                 >
                                                     <RefreshCw size={14} />
                                                     RESET TO DEFAULT
                                                 </button>
                                             </div>
                                         </section>

                                        {/* 4. Neural Learning / Hands-Free Section */}
                                        <section className="bg-sky-500/5 rounded-3xl p-6 border border-sky-500/10 space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-400">
                                                    <RefreshCw size={20} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-sky-400">Neural Hands-Free</h3>
                                                    <p className="text-[10px] text-slate-500 font-medium">Configure the automated voice engine</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">TTS Source Track</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {(['s1', 's2', 's3'] as const).map(sid => (
                                                        <button 
                                                            key={sid}
                                                            onClick={() => setTTSTrackSource(sid)}
                                                            className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                                                                ttsTrackSource === sid 
                                                                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-lg' 
                                                                : 'bg-slate-950 text-slate-500 border-white/5 hover:border-white/10'
                                                            }`}
                                                        >
                                                            Track {sid.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="text-[9px] text-slate-600 px-1 leading-relaxed italic">
                                                    This determines which subtitle language the AI reads during Hands-Free mode. 
                                                    This is <strong>independent</strong> of what you choose to show on video.
                                                </p>
                                            </div>
                                        </section>
                                   </motion.div>
                               )}

                               {activeMainTab === 'notes' && (
                                   <motion.div key="notes" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6 pb-20">
                                       {/* Header Toggle */}
                                       <div className="bg-white/5 rounded-3xl p-6 border border-white/5 flex items-center justify-between">
                                            <div className="space-y-1">
                                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Lightbulb size={16} className="text-sky-400" /> Video Overlays</h3>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Toggle all notes visibility</p>
                                            </div>
                                            <button onClick={() => setNoteSettings({ enabled: !settings.notes.enabled })}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${settings.notes.enabled ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                                                {settings.notes.enabled ? 'ACTIVE' : 'MUTED'}
                                            </button>
                                       </div>

                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Alignment Grid */}
                                            <div className="bg-white/5 rounded-3xl p-6 border border-white/5 space-y-4">
                                                <div className="flex flex-col gap-1">
                                                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">9-Grid Positioning</h4>
                                                    <p className="text-[9px] text-slate-600">Choose where notes appear</p>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 w-32 aspect-square mx-auto">
                                                    {(['topLeft', 'topCenter', 'topRight', 'centerLeft', 'center', 'centerRight', 'bottomLeft', 'bottomCenter', 'bottomRight'] as const).map((pos) => (
                                                        <button
                                                            key={pos}
                                                            onClick={() => setNoteSettings({ alignment: pos })}
                                                            className={`w-full aspect-square rounded-lg border transition-all ${
                                                                settings.notes.alignment === pos 
                                                                ? 'bg-sky-500 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.4)]' 
                                                                : 'bg-slate-800/50 border-white/5 hover:border-white/20'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Visual Theme & Duration */}
                                            <div className="bg-white/5 rounded-3xl p-6 border border-white/5 space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Visual Theme</label>
                                                    <select 
                                                        value={settings.notes.theme}
                                                        onChange={(e) => setNoteSettings({ theme: e.target.value as any })}
                                                        className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 appearance-none cursor-pointer"
                                                    >
                                                        <option value="classic">Classic Cinema</option>
                                                        <option value="cyber">Cyber Blue</option>
                                                        <option value="amber">Ancient Amber</option>
                                                        <option value="ghost">Ghostly (Minimal)</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-3 pt-4 border-t border-white/5">
                                                    <div className="flex justify-between">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Note Font Scale</label>
                                                        <span className="text-xs font-mono text-sky-400">{(settings.notes.fontSize * 10).toFixed(0)}%</span>
                                                    </div>
                                                    <input type="range" min="1" max="6" step="0.1" value={settings.notes.fontSize || 2.5} 
                                                           onChange={(e) => setNoteSettings({ fontSize: parseFloat(e.target.value) })} 
                                                           className="w-full accent-sky-500 h-1 bg-slate-800 rounded-full" />
                                                </div>
                                            </div>
                                       </div>

                                       {/* Timing Settings */}
                                       <div className="bg-white/5 rounded-3xl p-6 border border-white/5 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <div className="space-y-1">
                                                    <h4 className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2"><Clock size={12}/> Early Warning</h4>
                                                    <p className="text-[9px] text-slate-600">Seconds before point of interest</p>
                                                </div>
                                                <span className="text-xs font-mono text-sky-400">-{settings.notes.beforeSecs}s</span>
                                            </div>
                                            <input type="range" min="0" max="10" step="0.5" value={settings.notes.beforeSecs} 
                                                   onChange={(e) => setNoteSettings({ beforeSecs: parseFloat(e.target.value) })} 
                                                   className="w-full accent-sky-500 h-1 bg-slate-800 rounded-full" />
                                       </div>
                                   </motion.div>
                               )}

                               {activeMainTab === 'library' && (
                                   <motion.div key="library" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-10">
                                       
                                       {/* Current Content */}
                                       <section className="space-y-4">
                                           <div className="flex items-center gap-2 px-2">
                                               <Layers size={14} className="text-sky-500" />
                                               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">My Study Tracks</h3>
                                           </div>
                                           <div className="grid gap-3">
                                               {availableTracks.map(t => (
                                                   <div key={t.id} className="group bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition-all">
                                                       <div><div className="text-xs font-bold text-white uppercase">{t.language_code}</div><div className="text-[9px] text-slate-600 tracking-tight">{t.uploader_name} • {t.line_count} lines</div></div>
                                                       <button onClick={() => handleDeleteTrack(t.id)} className="p-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"><Trash2 size={16} /></button>
                                                   </div>
                                               ))}
                                           </div>
                                       </section>

                                       {/* Manual Import Area */}
                                       <section className="bg-slate-800/40 rounded-[2.5rem] p-6 border border-white/5 space-y-6">
                                            <div className="flex items-center gap-2">
                                                <Upload size={14} className="text-sky-500" />
                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Inflow</h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="col-span-1 space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-600 uppercase ml-1">Language</label>
                                                    <select value={uploadLang} onChange={(e) => setUploadLang(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none">
                                                        <option value="en">English</option>
                                                        <option value="vi">Vietnamese</option>
                                                        <option value="ja">Japanese</option>
                                                        <option value="zh">Chinese</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-1 flex items-end">
                                                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                                                            className="w-full py-2 bg-sky-500 text-slate-950 rounded-xl font-bold text-[10px] uppercase transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-sky-500/10">
                                                        {isUploading ? '...' : <><Upload size={12}/> File</>}
                                                    </button>
                                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".srt,.vtt" />
                                                </div>
                                            </div>
                                            <div className="p-3 bg-black/30 rounded-2xl border border-white/5 flex items-start gap-3">
                                                <Info size={14} className="text-slate-500 shrink-0 mt-0.5" />
                                                <p className="text-[9px] leading-relaxed text-slate-500 uppercase font-medium">Supports SRT & VTT. Ensure file encoding is UTF-8 for best results.</p>
                                            </div>
                                       </section>

                                       {/* YouTube Cloud Scan */}
                                       <section className="space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                                <div className="flex items-center gap-2">
                                                    <Globe size={14} className="text-blue-400" />
                                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">YouTube Cloud</h3>
                                                </div>
                                                <button onClick={fetchYoutubeSources} className="p-1 hover:text-sky-400 transition-colors"><RefreshCw size={14} className={isLoadingSources ? 'animate-spin' : ''} /></button>
                                            </div>
                                            <div className="space-y-2">
                                                {isLoadingSources ? (
                                                     <div className="py-10 text-center"><RefreshCw className="animate-spin mx-auto text-slate-700" /></div>
                                                ) : ytTracks.map(t => {
                                                    const isImported = availableTracks.some(at => at.language_code === t.lang_code && at.is_auto_generated === t.is_auto);
                                                    return (
                                                        <div key={t.lang_code + t.is_auto} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                                                            <div><div className="text-xs font-bold text-white flex items-center gap-2 uppercase">{t.name} {t.is_auto && <span className="text-[8px] opacity-40">AUTO</span>}</div></div>
                                                            {isImported ? <Check size={16} className="text-sky-500 mr-2" /> : (
                                                                <button onClick={() => handleImport(t.lang_code, t.is_auto)} disabled={importingLang === t.lang_code}
                                                                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50">
                                                                    {importingLang === t.lang_code ? '...' : <><Download size={14}/> Get</>}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                       </section>

                                       {/* External Tools */}
                                       <section className="bg-blue-500/10 rounded-[2.5rem] p-6 border border-blue-500/20 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <ExternalLink size={14} className="text-blue-400" />
                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Third-party Hub</h3>
                                            </div>
                                            <p className="text-[10px] text-blue-200/60 font-medium">If clouds are empty, try finding subtitles externally and upload back here.</p>
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { name: 'SaveSubs', url: `https://savesubs.com/process?url=${encodeURIComponent(`https://youtube.com/watch?v=${videoId}`)}` },
                                                    { name: 'DualSub', url: `https://dualsub.xyz/` }
                                                ].map(site => (
                                                    <a key={site.name} href={site.url} target="_blank" rel="noreferrer"
                                                       className="px-4 py-2 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-400 transition-all flex items-center gap-2">
                                                        {site.name} <ExternalLink size={10} />
                                                    </a>
                                                ))}
                                            </div>
                                       </section>
                                    </motion.div>
                               )}

                               {activeMainTab === 'social' && (
                                   <motion.div key="social" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
                                       <section className="bg-emerald-500/5 rounded-[2.5rem] p-6 border border-emerald-500/10 space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h3 className="text-sm font-bold text-white uppercase tracking-tight">Community Insight</h3>
                                                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Toggle all user comments</p>
                                                </div>
                                                <button 
                                                    onClick={() => usePlayerStore.getState().setCommunitySettings({ enabled: !settings.community.enabled })}
                                                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${settings.community.enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}
                                                >
                                                    {settings.community.enabled ? 'ACTIVE' : 'OFF'}
                                                </button>
                                            </div>

                                            <div className="space-y-4 pt-6 border-t border-white/5">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Display Mode</label>
                                                    <div className="grid grid-cols-2 gap-2 bg-black/20 p-1 rounded-2xl">
                                                        {(['danmaku', 'fixed'] as const).map(m => (
                                                            <button 
                                                                key={m}
                                                                onClick={() => usePlayerStore.getState().setCommunitySettings({ mode: m })}
                                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.community.mode === m ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                                            >
                                                                {m === 'danmaku' ? 'Floating (Danmaku)' : 'Fixed Overlay'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-4 pt-4">
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center px-1">
                                                            <h3 className="text-[10px] font-black uppercase text-slate-500">Text Size</h3>
                                                            <span className="text-xs font-mono text-emerald-400">{(settings.community.fontSize * 10).toFixed(0)}%</span>
                                                        </div>
                                                        <input type="range" min="1" max="4" step="0.1" value={settings.community.fontSize} 
                                                               onChange={(e) => usePlayerStore.getState().setCommunitySettings({ fontSize: parseFloat(e.target.value) })}
                                                               className="w-full h-1.5 bg-slate-800 appearance-none rounded-full accent-emerald-500 cursor-pointer" />
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center px-1">
                                                            <h3 className="text-[10px] font-black uppercase text-slate-500">Overlay Opacity</h3>
                                                            <span className="text-xs font-mono text-emerald-400">{Math.round(settings.community.opacity * 100)}%</span>
                                                        </div>
                                                        <input type="range" min="0.1" max="1" step="0.05" value={settings.community.opacity} 
                                                               onChange={(e) => usePlayerStore.getState().setCommunitySettings({ opacity: parseFloat(e.target.value) })}
                                                               className="w-full h-1.5 bg-slate-800 appearance-none rounded-full accent-emerald-500 cursor-pointer" />
                                                    </div>
                                                </div>
                                            </div>
                                       </section>

                                       <section className="bg-white/5 rounded-3xl p-6 border border-white/5">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500">
                                                    <Info size={20} />
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">How it works</h4>
                                                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                                        Community comments are tied to specific timestamps. 
                                                        <strong>Danmaku mode</strong> makes them fly across the player, while 
                                                        <strong>Fixed mode</strong> shows them in a dedicated area at the top.
                                                    </p>
                                                </div>
                                            </div>
                                       </section>
                                   </motion.div>
                               )}
                           </AnimatePresence>
                        </div>

                        {/* 3. Footer Action */}
                        <div className="p-6 border-t border-white/5 bg-slate-900/50 backdrop-blur-md">
                            <button onClick={handleSaveSettings} disabled={isSaving} className={`w-full py-5 rounded-[2rem] font-black tracking-[0.2em] uppercase text-xs flex items-center justify-center gap-3 transition-all ${saveStatus === 'success' ? 'bg-sky-500 text-slate-950 shadow-[0_0_40px_rgba(14,165,233,0.3)]' : 'bg-white text-slate-950 active:scale-95'}`}>
                                {isSaving ? <RefreshCw className="animate-spin" /> : saveStatus === 'success' ? <Check size={20} strokeWidth={3} /> : <Save size={20} />}
                                {saveStatus === 'success' ? 'Synchronized' : 'Update Profile'}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
