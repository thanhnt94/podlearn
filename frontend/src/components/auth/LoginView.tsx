import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Sparkles, Lock, User, ArrowRight, Globe } from 'lucide-react';

export const LoginView: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const login = useAppStore(state => state.login);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        
        const success = await login({ username, password });
        if (!success) {
            setError('Invalid credentials. Please try again.');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-6 overflow-hidden">
            {/* Animated Background Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />

            <div className="w-full max-w-md relative">
                {/* Logo Area */}
                <div className="flex flex-col items-center mb-10 space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-sky-500/20 rotate-3 group hover:rotate-0 transition-transform">
                        <Sparkles className="text-white" size={32} fill="currentColor" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">PodLearn <span className="text-sky-500 not-italic">Studio</span></h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1">Headless Content Engine</p>
                    </div>
                </div>

                {/* Login Form Card */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-500 transition-colors" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder:text-slate-600 focus:border-sky-500/50 outline-none transition-all"
                                    required
                                />
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-500 transition-colors" size={18} />
                                <input 
                                    type="password" 
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder:text-slate-600 focus:border-sky-500/50 outline-none transition-all"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold uppercase tracking-widest p-3 rounded-xl text-center">
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-4 rounded-2xl shadow-xl shadow-sky-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSubmitting ? 'Authenticating...' : (
                                <>Enter Studio <ArrowRight size={14} /></>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-white/5 flex flex-col items-center space-y-4">
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Enterprise Sign In</p>
                        <div className="flex gap-4">
                            <button className="w-12 h-12 bg-slate-950 border border-white/5 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all">
                                <Globe size={20} />
                            </button>
                            <button 
                                onClick={() => window.location.href = '/api/identity/sso/login'}
                                className="px-6 h-12 bg-slate-950 border border-white/5 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all text-[10px] font-black uppercase tracking-widest"
                            >
                                Central SSO
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-center mt-8 text-[10px] font-bold text-slate-700 uppercase tracking-widest">
                    &copy; 2026 PodLearn Headless &bull; v2.0-Alpha
                </p>
            </div>
        </div>
    );
};
