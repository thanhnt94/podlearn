import React from 'react';
import { Search } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';

export const DesktopHeader: React.FC = () => {
    const location = useLocation();
    const user = useAppStore(state => state.user);
    const isPlayerRoute = location.pathname.includes('/player/');
    
    if (isPlayerRoute) return null;

    return (
        <header className="hidden md:flex h-20 items-center justify-between px-10 border-b border-white/5 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-400 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search your library, lessons, or grammar..." 
                        className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all"
                    />
                </div>
            </div>

            <div className="flex items-center gap-6 ml-8">
                {user?.is_admin && (
                    <a 
                        href="/admin" 
                        className="flex items-center gap-2 px-4 py-2 bg-sky-500/10 border border-sky-500/20 rounded-2xl hover:bg-sky-500/20 transition-all group/admin"
                    >
                        <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 group-hover/admin:text-sky-300">Admin Studio</span>
                    </a>
                )}
                
                <NotificationBell />
                
                <div className="h-8 w-[1px] bg-white/5 mx-2" />
                
                <button className="flex items-center gap-3 group">
                    <div className="text-right hidden lg:block">
                        <p className="text-xs font-bold text-white">{user?.username || 'User'}</p>
                        {(() => {
                            const role = user?.role || 'free';
                            if (role === 'admin') return <p className="text-[10px] text-sky-400 font-black uppercase tracking-wider">Admin</p>;
                            if (role === 'vip') return <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">VIP User</p>;
                            return <p className="text-[10px] text-slate-500 font-medium">Free User</p>;
                        })()}
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-sky-400 group-hover:border-sky-500/50 transition-all shadow-lg shadow-black/20">
                        {user?.username?.[0].toUpperCase() || 'U'}
                    </div>
                </button>
            </div>
        </header>
    );
};
