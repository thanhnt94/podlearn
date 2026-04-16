import React from 'react';
import { useLocation } from 'react-router-dom';
import { MainSidebar } from './MainSidebar';
import { MobileHeader } from './MobileHeader';
import { DesktopHeader } from './DesktopHeader';
import { BottomNav } from './BottomNav';
import { AchievementModal } from '../dashboard/AchievementModal';
import { motion, AnimatePresence } from 'framer-motion';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const isPlayerRoute = location.pathname.includes('/player/');

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-sky-500/30 selection:text-sky-200">
      
      {/* Global Mesh Background */}
      <div className="mesh-bg opacity-40 pointer-events-none" />

      {!isPlayerRoute && (
        <>
          {/* 1. Desktop Sidebar */}
          <div className="hidden md:block w-20 shrink-0 z-50">
             <MainSidebar />
          </div>

          {/* 2. Mobile Top Header */}
          <MobileHeader />
        </>
      )}

      {/* 3. Main Container */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        {!isPlayerRoute && <DesktopHeader />}
        
        <main className={`flex-1 flex flex-col relative ${isPlayerRoute ? 'pb-0' : 'pb-20'} md:pb-0 overflow-y-auto md:overflow-hidden`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="flex-1 flex flex-col"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* 4. Global Modals & Navigation */}
      <AchievementModal />
      {!isPlayerRoute && <BottomNav />}
    </div>
  );
};
