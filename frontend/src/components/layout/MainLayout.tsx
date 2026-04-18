import React from 'react';
import { useLocation } from 'react-router-dom';
import { SettingsDrawer } from './SettingsDrawer';
import { MainSidebar } from './MainSidebar';
import { MobileHeader } from './MobileHeader';
import { DesktopHeader } from './DesktopHeader';
import { BottomNav } from './BottomNav';
import { AchievementModal } from '../dashboard/AchievementModal';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const location = useLocation();
  const isPlayerRoute = location.pathname.includes('/player/');

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <AchievementModal />

      {/* 1. Header cho Mobile (Ẩn trên Desktop và ẩn khi ở trong Player) */}
      {!isPlayerRoute && <MobileHeader />}

      <div className="flex-1 flex relative overflow-hidden">
        {/* 2. Sidebar - Floating Overlay with Fixed Base */}
        <div className={`hidden md:block shrink-0 z-50 transition-all duration-300 ${
            isPlayerRoute ? 'w-20' : 'w-[280px]'
        }`}>
           <MainSidebar />
        </div>

        {/* 3. Main Container */}
        <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
          {!isPlayerRoute && <DesktopHeader />}
          <main className={`flex-1 flex flex-col relative ${isPlayerRoute ? 'pb-0' : 'pb-20'} md:pb-0 overflow-y-auto md:overflow-hidden`}>
            {children}
          </main>
        </div>
      </div>

      {/* 4. Bottom Nav cho Mobile (Ẩn trên Desktop) */}
      {!isPlayerRoute && <BottomNav />}
    </div>
  );
};
