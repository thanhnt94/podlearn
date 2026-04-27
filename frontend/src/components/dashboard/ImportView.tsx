import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Plus, 
    Loader2, AlertCircle, CheckCircle2, 
    Sparkles, Globe, ArrowLeft, Video as Youtube, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

export const ImportView: React.FC = () => {
    const navigate = useNavigate();
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState('ja');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
    
    const userData = (window as any).__PODLEARN_DATA__ || {};
    const isVip = userData.is_at_least_vip || userData.is_admin;

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!youtubeUrl.trim()) return;

        setIsLoading(true);
        setStatus({ type: 'idle', message: '' });

        try {
            const data = (window as any).__PODLEARN_DATA__ || {};
            const res = await axios.post('/api/video/import', 
                { 
                    youtube_url: youtubeUrl,
                    language_code: selectedLanguage 
                },
                { headers: { 'X-CSRF-Token': data.csrf_token } }
            );

            if (res.data.success) {
                setStatus({ 
                    type: 'success', 
                    message: `Success! "${res.data.title}" is being processed. redirecting...` 
                });
                // Redirect to dashboard after a short delay
                setTimeout(() => navigate('/'), 2000);
            } else {
                setStatus({ type: 'error', message: res.data.error || 'Failed to import video.' });
            }
        } catch (err: any) {
            console.error("Import error", err);
            const errMsg = err.response?.data?.error || 'An unexpected error occurred. Please check the URL.';
            setStatus({ type: 'error', message: errMsg });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-slate-950 px-6 md:px-10 pb-20 custom-scrollbar">
            <div className="max-w-3xl mx-auto pt-20 flex flex-col items-center">
                
                {/* Back Button */}
                <motion.button 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => navigate('/')}
                    className="self-start flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-12 group"
                >
                    <div className="p-2 bg-slate-900 rounded-xl group-hover:bg-sky-500/10 group-hover:text-sky-400 transition-all shadow-xl">
                        <ArrowLeft size={18} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Back to Studio</span>
                </motion.button>

                {/* Header Decoration */}
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-24 h-24 bg-sky-500/10 rounded-[2.5rem] flex items-center justify-center mb-8 relative"
                >
                    <div className="absolute inset-0 bg-sky-500/20 blur-2xl rounded-full animate-pulse" />
                    <Youtube size={48} className="text-sky-500 relative z-10" fill="currentColor" />
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-slate-900 border border-sky-500/30 rounded-full flex items-center justify-center">
                        <Plus size={16} className="text-sky-400" />
                    </div>
                </motion.div>

                <div className="text-center space-y-3 mb-12">
                    <div className="flex items-center justify-center gap-2 text-sky-400">
                        <Sparkles size={16} fill="currentColor" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Resource Ingestion</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">Expand Your Knowledge</h1>
                    <p className="text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                        Paste a YouTube URL below. We'll automatically identify language tracks, extract metadata, and prepare your interactive transcript.
                    </p>
                </div>

                {/* Main Input Form */}
                <motion.form 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    onSubmit={handleImport}
                    className="w-full bg-slate-900/50 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-xl shadow-2xl relative overflow-hidden"
                >
                    {/* Background glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-sky-500/5 blur-[100px] pointer-events-none" />
                    
                    <div className="space-y-6 relative z-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">YouTube URL</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-400 transition-colors">
                                    <Globe size={20} />
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    value={youtubeUrl}
                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                    disabled={isLoading || status.type === 'success'}
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl pl-12 pr-6 py-5 text-sm focus:border-sky-500/50 outline-none transition-all placeholder:text-slate-800 font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Video Native Language</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { code: 'ja', name: 'Japanese', icon: '🇯🇵' },
                                    { code: 'en', name: 'English', icon: '🇺🇸' },
                                    { code: 'ko', name: 'Korean', icon: '🇰🇷' },
                                    { code: 'zh', name: 'Chinese', icon: '🇨🇳' }
                                ].map((lang) => (
                                    <button
                                        key={lang.code}
                                        type="button"
                                        onClick={() => setSelectedLanguage(lang.code)}
                                        className={`flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all ${
                                            selectedLanguage === lang.code
                                            ? 'bg-sky-500/10 border-sky-500/50 text-white'
                                            : 'bg-slate-950/30 border-white/5 text-slate-500 hover:border-white/10'
                                        }`}
                                    >
                                        <span className="text-lg">{lang.icon}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{lang.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading || !youtubeUrl || status.type === 'success' || !isVip}
                            className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] ${
                                isLoading || status.type === 'success' || !isVip
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'
                                : 'bg-sky-500 text-slate-950 hover:bg-sky-400 hover:shadow-sky-500/20'
                            }`}
                        >
                            {isLoading ? (
                                <><Loader2 size={18} className="animate-spin" /> Analyzing Signals...</>
                            ) : status.type === 'success' ? (
                                <><CheckCircle2 size={18} /> Initialized</>
                            ) : !isVip ? (
                                <><Lock size={18} /> VIP Required</>
                            ) : (
                                'Process & Import'
                            )}
                        </button>

                        {!isVip && (
                            <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col items-center gap-3 text-center">
                                <Sparkles className="text-amber-400" size={24} />
                                <div className="space-y-1">
                                    <h4 className="text-amber-400 text-xs font-black uppercase tracking-widest">Upgrade to VIP</h4>
                                    <p className="text-slate-400 text-[10px] font-medium leading-relaxed">
                                        Tính năng thêm video mới chỉ dành cho thành viên VIP. Tài khoản Miễn phí có thể học các video đã có sẵn trong hệ thống (giới hạn 10 phút/video).
                                    </p>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => navigate('/')}
                                    className="px-6 py-2 bg-amber-500 text-slate-950 text-[10px] font-black rounded-lg hover:bg-amber-400 transition-all"
                                >
                                    NÂNG CẤP NGAY
                                </button>
                            </div>
                        )}

                        {/* Status Messages */}
                        <AnimatePresence mode="wait">
                            {status.type !== 'idle' && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={`p-4 rounded-xl flex items-start gap-3 border ${
                                        status.type === 'success' 
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                                    }`}
                                >
                                    {status.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                                    <span className="text-xs font-bold leading-relaxed">{status.message}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.form>

                {/* Footer Tip */}
                <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-8 text-slate-600 text-[10px] font-black uppercase tracking-widest text-center"
                >
                    High-accuracy transcription requires the video to have <span className="text-slate-400">Captions</span> or <span className="text-slate-400">Subtitles</span> available.
                </motion.p>
            </div>
        </div>
    );
};
