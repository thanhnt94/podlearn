import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, LogOut, User, Settings, ShieldCheck } from 'lucide-react';
import { AppLogo } from './AppLogo';
import { NotificationBell } from './NotificationBell';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';

export const MobileHeader: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAppStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const username = (user as any)?.username || 'User';
    const isVip = (user as any)?.is_vip || (user as any)?.is_admin;
    const roleName = (user as any)?.role?.toUpperCase() || 'FREE';

    // Handle click outside to close menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="md:hidden sticky top-0 z-[100] bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
            <AppLogo iconSize={36} textSize="text-base" />
            
            <div className="flex items-center gap-4 text-slate-400">
                <button 
                    onClick={() => isVip && navigate('/import')} 
                    className={`p-2 rounded-full transition-colors ${
                        isVip ? 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20' : 'bg-slate-800 text-slate-600 opacity-50'
                    }`}
                >
                    <Plus size={20} strokeWidth={2.5} />
                </button>
                <button className="p-2 hover:bg-white/5 rounded-full transition-colors hidden sm:block">
                    <Search size={22} />
                </button>
                <NotificationBell />
                
                {/* User Avatar & Dropdown */}
                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`w-9 h-9 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border flex items-center justify-center font-black text-[10px] transition-all duration-300 ${
                            isMenuOpen ? 'border-sky-500 ring-4 ring-sky-500/10' : 'border-white/10 hover:border-white/20'
                        }`}
                    >
                        <span className="text-sky-400">{username[0].toUpperCase()}</span>
                    </button>

                    <AnimatePresence>
                        {isMenuOpen && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                                className="absolute right-0 mt-3 w-64 bg-[#0f172a]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-[110]"
                            >
                                {/* Header Info */}
                                <div className="p-5 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 font-black">
                                            {username[0].toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white leading-none mb-1">{username}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded ${
                                                    isVip ? 'bg-amber-400/10 text-amber-400' : 'bg-slate-800 text-slate-500'
                                                }`}>
                                                    {roleName}
                                                </span>
                                                {isVip && <ShieldCheck size={10} className="text-amber-400" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu Items */}
                                <div className="p-2">
                                    <button 
                                        onClick={() => { setIsMenuOpen(false); navigate('/profile'); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:bg-white/5 hover:text-white transition-all text-xs font-bold"
                                    >
                                        <User size={16} className="text-sky-400" />
                                        My Profile
                                    </button>
                                    <button 
                                        onClick={() => { setIsMenuOpen(false); navigate('/settings'); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:bg-white/5 hover:text-white transition-all text-xs font-bold"
                                    >
                                        <Settings size={16} className="text-slate-500" />
                                        Settings
                                    </button>
                                    
                                    <div className="h-px bg-white/5 my-2 mx-2" />
                                    
                                    <button 
                                        onClick={() => logout()}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-400 hover:bg-rose-500/10 transition-all text-xs font-black uppercase tracking-widest"
                                    >
                                        <LogOut size={16} />
                                        Sign Out
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
};
