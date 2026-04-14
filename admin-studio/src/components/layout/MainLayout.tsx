import React from 'react';
import { Sidebar } from './Sidebar';
import { Bell, Search, Zap } from 'lucide-react';

export const MainLayout: React.FC<{ children: React.ReactNode; activeTab: string; onTabChange: (tab: string) => void }> = ({ children, activeTab, onTabChange }) => {
  return (
    <div className="flex h-screen w-screen bg-[#020617] text-slate-200 overflow-hidden font-inter">
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <header className="h-24 px-12 flex items-center justify-between z-40 border-b border-white/5 bg-slate-950/20 backdrop-blur-xl">
          <div className="flex items-center gap-8">
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">
              {activeTab.replace('-', ' ')}
            </h2>
            <div className="h-8 w-[1px] bg-white/5" />
            <div className="relative group">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-500 transition-colors" />
              <input 
                type="text" 
                placeholder="GLOBAL SEARCH COMMANDS..."
                className="bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-6 text-[10px] font-black tracking-widest outline-none focus:border-sky-500/20 focus:bg-white/[0.07] transition-all w-80"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-3 rounded-2xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all relative">
              <Bell size={20} />
              <div className="absolute top-3 right-3 w-2 h-2 bg-sky-500 rounded-full border-2 border-[#020617]" />
            </button>
            <button className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-sky-500 text-slate-950 font-black text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(14,165,233,0.3)]">
              <Zap size={16} fill="currentColor" />
              QUICK LAUNCH
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-12 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-12">
            {children}
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-sky-500/5 rounded-full blur-[150px] -mr-96 -mt-96 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] -ml-48 -mb-48 pointer-events-none" />
      </main>
    </div>
  );
};
