import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Lock, User, ArrowRight } from 'lucide-react';
import { AppLogo } from '../layout/AppLogo';

export const LoginView: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const { login, authConfig, fetchAuthConfig } = useAppStore();

    // Parse backdoor/fallback query params
    const queryParams = new URLSearchParams(window.location.search);
    const isBackdoor = queryParams.get('backdoor') === '1' || queryParams.get('fallback') === '1';

    // 1. Fetch Auth Config on Mount
    useEffect(() => {
        fetchAuthConfig();
    }, [fetchAuthConfig]);

    // 2. Perform Client-Side SSO Auto-Redirect
    useEffect(() => {
        if (authConfig && authConfig.sso_enabled && !isBackdoor && authConfig.jump_url) {
            window.location.href = authConfig.jump_url;
        }
    }, [authConfig, isBackdoor]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        
        const success = await login({ username, password, is_backdoor: isBackdoor });
        if (!success) {
            setError('Invalid credentials. Please try again.');
        }
        setIsSubmitting(false);
    };

    // If loading SSO configuration
    if (!authConfig) {
        return (
            <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center space-y-6 z-[200]">
                <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_30px_rgba(99,102,241,0.2)]" />
                <div className="flex flex-col items-center space-y-2">
                    <h2 className="text-xl font-black text-white uppercase tracking-widest text-center">Initializing Auth Engine</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] animate-pulse text-center">Please wait...</p>
                </div>
            </div>
        );
    }

    // If SSO is active and we are NOT using the backdoor, show a premium redirecting screen
    if (authConfig?.sso_enabled && !isBackdoor) {
        return (
            <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center space-y-6 z-[200]">
                <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(14,165,233,0.3)]" />
                <div className="flex flex-col items-center space-y-2">
                    <h2 className="text-xl font-black text-white uppercase tracking-widest text-center">Redirecting to SSO</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] animate-pulse text-center">Connecting with Central Identity Hub...</p>
                </div>
            </div>
        );
    }

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
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-2 mb-8">
                        <h2 className="text-lg font-black text-white uppercase tracking-widest">
                            {isBackdoor ? 'Emergency Bypass' : 'Studio Access'}
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                            {isBackdoor ? 'Local Administrator Backdoor Authentication' : 'Local Identity Credentials'}
                        </p>
                    </div>

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

                        {authConfig?.sso_enabled && (
                            <button 
                                type="button"
                                onClick={() => {
                                    if (authConfig.jump_url) {
                                        window.location.href = authConfig.jump_url;
                                    }
                                }}
                                className="w-full text-center text-[9px] font-black text-slate-600 hover:text-white uppercase tracking-widest transition-colors mt-2"
                            >
                                Back to SSO Access
                            </button>
                        )}
                    </form>
                </div>

                <p className="text-center mt-8 text-[10px] font-bold text-slate-700 uppercase tracking-widest">
                    &copy; 2026 PodLearn Headless &bull; v2.0-Alpha
                </p>
            </div>
        </div>
    );
};
