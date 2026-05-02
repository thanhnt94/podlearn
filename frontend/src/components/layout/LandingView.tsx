import React from 'react';
import { ArrowRight, Play, Shield, Zap, Headphones, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppLogo } from './AppLogo';

export const LandingView: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-hidden selection:bg-sky-500/30">
            {/* Background Decorative Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-amber-500/5 rounded-full blur-[100px]" />
            </div>

            {/* Navbar */}
            <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
                <AppLogo iconSize={44} textSize="text-2xl" />
                
                <div className="flex items-center gap-8">
                    <button 
                        onClick={() => window.location.href = '/login'}
                        className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                        Login
                    </button>
                    <button 
                        onClick={() => window.location.href = '/login'}
                        className="px-8 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl shadow-sky-500/20 transition-all active:scale-95"
                    >
                        Get Started
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32">
                <div className="flex flex-col items-center text-center space-y-8">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500/10 border border-sky-500/20 rounded-full"
                    >
                        <Zap size={14} className="text-sky-400" fill="currentColor" />
                        <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Next-Gen Language Learning</span>
                    </motion.div>

                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-6xl md:text-8xl font-black tracking-tight leading-[0.9] max-w-4xl"
                    >
                        MASTER ANY <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-amber-400">LANGUAGE</span> THROUGH PODCASTS.
                    </motion.h2>

                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-400 text-lg md:text-xl max-w-2xl font-medium leading-relaxed"
                    >
                        The ultimate AI-powered ecosystem for immersive study. 
                        Interactive transcripts, hands-free mode, and real-time analysis.
                    </motion.p>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-6 pt-8"
                    >
                        <button 
                            onClick={() => window.location.href = '/login'}
                            className="group relative px-12 py-5 bg-white text-slate-950 font-black rounded-2xl flex items-center justify-center gap-3 overflow-hidden transition-all hover:pr-14"
                        >
                            <span className="relative z-10 uppercase tracking-widest text-xs">Start Learning Now</span>
                            <ArrowRight size={18} className="absolute right-6 opacity-0 group-hover:opacity-100 transition-all" />
                        </button>
                        
                        <button className="px-10 py-5 bg-slate-900 border border-white/5 hover:border-white/20 font-black rounded-2xl flex items-center justify-center gap-3 transition-all text-xs uppercase tracking-widest">
                            <Play size={18} fill="currentColor" />
                            Watch Demo
                        </button>
                    </motion.div>
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40">
                    {[
                        { 
                            icon: <Headphones className="text-sky-400" />, 
                            title: "Hands-Free Mode", 
                            desc: "Learn while you move. Dynamic audio generation with interval pauses for active recall." 
                        },
                        { 
                            icon: <BookOpen className="text-indigo-400" />, 
                            title: "AI Analysis", 
                            desc: "Instant breakdown of grammar, vocabulary, and nuances for every sentence." 
                        },
                        { 
                            icon: <Shield className="text-amber-400" />, 
                            title: "Personal Vault", 
                            desc: "Save notes, flashcards, and progress across all your devices securely." 
                        }
                    ].map((f, i) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + (i * 0.1) }}
                            className="p-10 bg-slate-900/40 backdrop-blur-sm border border-white/5 rounded-[3rem] space-y-6 group hover:border-white/10 transition-all"
                        >
                            <div className="w-14 h-14 bg-slate-950 rounded-2xl flex items-center justify-center shadow-inner">
                                {f.icon}
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-xl font-black uppercase tracking-wider">{f.title}</h3>
                                <p className="text-slate-500 text-sm font-medium leading-relaxed">{f.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/5 py-12 text-center">
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em]">
                    &copy; 2026 PodLearn Headless &bull; CORE ENGINE V2.5
                </p>
            </footer>
        </div>
    );
};
