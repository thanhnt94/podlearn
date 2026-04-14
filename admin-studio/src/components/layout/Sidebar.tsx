import React from 'react';
import { 
  BarChart3, Users, Sparkles, Globe, 
  Settings, LogOut, Layers, ShieldCheck 
} from 'lucide-react';
import { cn } from '../../utils';

interface NavItemProps {
  icon: typeof BarChart3;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-4 px-6 py-4 transition-all duration-300 group relative",
      active ? "text-sky-400" : "text-slate-400 hover:text-white"
    )}
  >
    {active && (
      <div className="absolute left-0 w-1 h-8 bg-sky-500 rounded-r-full shadow-[0_0_15px_rgba(14,165,233,1)]" />
    )}
    <div className={cn(
      "p-2 rounded-xl transition-all duration-300",
      active ? "bg-sky-500/10" : "group-hover:bg-white/5"
    )}>
      <Icon size={20} />
    </div>
    <span className="text-xs font-black uppercase tracking-[0.2em]">{label}</span>
  </button>
);

export const Sidebar: React.FC<{ activeTab: string; onTabChange: (tab: string) => void }> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'ai-studio', label: 'AI Studio', icon: Sparkles },
    { id: 'ecosystem', label: 'Ecosystem', icon: Globe },
    { id: 'settings', label: 'General', icon: Settings },
  ];

  return (
    <aside className="w-80 h-full glass border-r border-white/5 flex flex-col z-50">
      {/* Brand Header */}
      <div className="p-8 pb-12">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-500 rounded-2xl shadow-[0_0_30px_rgba(14,165,233,0.3)]">
            <Layers className="text-slate-950" size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white">ADMIN<span className="text-sky-500">STUDIO</span></h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">AuraFlow Engine</span>
              <div className="w-1 h-1 bg-sky-500 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {menuItems.map(item => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.id}
            onClick={() => onTabChange(item.id)}
          />
        ))}
      </nav>

      {/* Footer / Identity */}
      <div className="p-8 border-t border-white/5">
        <div className="bg-white/5 rounded-3xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center font-black text-[10px]">
              AD
            </div>
            <div>
              <div className="text-[10px] font-black text-white uppercase truncate max-w-[120px]">
                {(window as any).__PODLEARN_ADMIN_DATA__?.username || 'Administrator'}
              </div>
              <div className="flex items-center gap-1 text-[8px] font-bold text-sky-500/70 uppercase">
                <ShieldCheck size={8} /> Admin Access
              </div>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => window.location.href = '/auth/logout'}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-white/5 text-slate-500 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
        >
          <LogOut size={16} />
          Terminate Session
        </button>
      </div>
    </aside>
  );
};
