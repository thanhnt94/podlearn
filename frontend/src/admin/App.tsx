import React, { useState, useEffect } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { Dashboard } from './components/modules/Dashboard'
import { MemberHub } from './components/modules/MemberHub'
import { AISettings } from './components/modules/AISettings'
import { SSOSettings } from './components/modules/SSOSettings'
import { VideoApproval } from './components/modules/VideoApproval'

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

import axios from 'axios';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return ['dashboard', 'approvals', 'members', 'ai-studio', 'ecosystem', 'settings'].includes(hash) ? hash : 'dashboard';
  });

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await axios.get('/api/identity/me');
      if (res.data.logged_in && res.data.user.role === 'admin') {
        setIsLoggedIn(true);
      }
    } catch (e) {
      localStorage.removeItem('access_token');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['dashboard', 'approvals', 'members', 'ai-studio', 'ecosystem', 'settings'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post('/api/identity/login', { username, password });
      if (res.data.user.role !== 'admin') {
        setLoginError('Access denied. Admin role required.');
        return;
      }
      localStorage.setItem('access_token', res.data.access_token);
      setIsLoggedIn(true);
    } catch (e) {
      setLoginError('Invalid credentials.');
    }
  };

  const handleTabChange = (tab: string) => {
    window.location.hash = tab;
    setActiveTab(tab);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-white/5 rounded-[2.5rem] p-10 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-sky-500 rounded-2xl flex items-center justify-center shadow-xl shadow-sky-500/20 mb-4">
              <span className="text-2xl text-white font-black">A</span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Admin <span className="text-sky-500 not-italic">Studio</span></h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Internal Identity Required</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Username" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-sky-500/50 transition-all"
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-sky-500/50 transition-all"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold uppercase tracking-widest text-center rounded-xl">
                {loginError}
              </div>
            )}

            <button type="submit" className="w-full py-4 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-sky-500/20">
              Access Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'approvals':
        return <VideoApproval />;
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
