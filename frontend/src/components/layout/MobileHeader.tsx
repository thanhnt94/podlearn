import React from 'react';
import { Bell, Search, Headphones } from 'lucide-react';

export const MobileHeader: React.FC = () => {
    const username = (window as any).__PODLEARN_DATA__?.username || 'User';

    return (
        <header className="md:hidden sticky top-0 z-[100] bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
                    <Headphones size={20} className="text-slate-950" fill="currentColor" />
                </div>
                <span className="text-lg font-black tracking-tighter text-white">PodLearn</span>
            </div>
            
            <div className="flex items-center gap-4 text-slate-400">
                <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <Search size={22} />
                </button>
                <div className="relative">
                    <Bell size={22} />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-sky-500 border-2 border-slate-950 rounded-full" />
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-xs text-sky-400">
                    {username[0].toUpperCase()}
                </div>
            </div>
        </header>
    );
};
