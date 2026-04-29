import React, { useState, useEffect } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { Dashboard } from './components/modules/Dashboard'
import { MemberHub } from './components/modules/MemberHub'
import { AISettings } from './components/modules/AISettings'
import { SSOSettings } from './components/modules/SSOSettings'

// Fallback Module Component
const PlaceholderModule: React.FC<{ name: string }> = ({ name }) => (
  <div className="flex flex-col items-center justify-center p-20 glass rounded-[3rem] border-dashed border-2 border-white/10">
    <div className="w-20 h-20 bg-sky-500/10 rounded-full flex items-center justify-center mb-6">
      <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
    <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Deploying {name}</h3>
    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Constructing modern administrative interface...</p>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return ['dashboard', 'members', 'ai-studio', 'ecosystem', 'settings'].includes(hash) ? hash : 'dashboard';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['dashboard', 'members', 'ai-studio', 'ecosystem', 'settings'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (tab: string) => {
    window.location.hash = tab;
    setActiveTab(tab);
  };

  const renderModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'members':
        return <MemberHub />;
      case 'ai-studio':
        return <AISettings />;
      case 'ecosystem':
        return <SSOSettings />;
      case 'settings':
        return <PlaceholderModule name="System Settings" />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <MainLayout activeTab={activeTab} onTabChange={handleTabChange}>
      {renderModule()}
    </MainLayout>
  )
}

export default App
