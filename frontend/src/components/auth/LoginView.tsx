import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Lock, User, ArrowRight, Globe } from 'lucide-react';
import { AppLogo } from '../layout/AppLogo';

export const LoginView: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showInternal, setShowInternal] = useState(false); // Toggle for local login when SSO is on
    
    const { login, authConfig } = useAppStore();
    const isSSOEnabled = authConfig?.sso_enabled;

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
                <div className="flex flex-col items-center mb-10">
                    <AppLogo iconSize={64} textSize="text-3xl" className="flex-col !gap-6" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-4">Headless Content Engine</p>
                </div>

                {/* Login Form Card */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
                    
                    {isSSOEnabled && !showInternal ? (
                        <div className="space-y-8 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <div className="text-center space-y-2">
                                <h2 className="text-lg font-black text-white uppercase tracking-widest">Enterprise Access</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Centralized Authentication Service is active for this node.</p>
                             </div>

                             <button 
                                onClick={() => window.location.href = '/api/identity/sso/login'}
                                className="w-full h-16 bg-white text-slate-950 font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-white/10 flex items-center justify-center gap-3 transition-all hover:bg-slate-100 active:scale-[0.98]"
                             >
                                <Globe size={20} className="animate-spin-slow" />
                                Sign in with Central SSO
                             </button>

                             <div className="pt-4 flex flex-col items-center gap-4">
                                <div className="flex items-center gap-4 w-full">
                                    <div className="h-px bg-white/5 flex-1" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em]">OR USE LOCAL IDENTITY</span>
                                    <div className="h-px bg-white/5 flex-1" />
                                </div>
                                <button 
                                    onClick={() => setShowInternal(true)}
                                    className="text-[10px] font-black text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
                                >
                                    Internal Admin Login
                                </button>
                             </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

                            {isSSOEnabled && (
                                <button 
                                    onClick={() => setShowInternal(false)}
                                    className="w-full text-center text-[9px] font-black text-slate-600 hover:text-white uppercase tracking-widest transition-colors mt-2"
                                >
                                    Back to SSO Access
                                </button>
                            )}
                        </form>
                    )}
                </div>

                <p className="text-center mt-8 text-[10px] font-bold text-slate-700 uppercase tracking-widest">
                    &copy; 2026 PodLearn Headless &bull; v2.0-Alpha
                </p>
            </div>
        </div>
    );
};
