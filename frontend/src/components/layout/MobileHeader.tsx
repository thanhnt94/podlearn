import { Search, Headphones, Plus } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';

export const MobileHeader: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAppStore();
    const username = (user as any)?.username || 'User';
    const isVip = (user as any)?.is_vip || (user as any)?.is_admin;

    return (
        <header className="md:hidden sticky top-0 z-[100] bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
                    <Headphones size={20} className="text-slate-950" fill="currentColor" />
                </div>
                <span className="text-lg font-black tracking-tighter text-white">PodLearn</span>
            </div>
            
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
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-xs text-sky-400">
                    {username[0].toUpperCase()}
                </div>
            </div>
        </header>
    );
};
