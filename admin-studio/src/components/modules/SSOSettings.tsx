import React, { useEffect, useState } from 'react';
import { 
  Globe, Server, Shield, 
  Activity, CheckCircle2, Zap, AlertTriangle,
  Lock, Fingerprint, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AdminSettings } from '../../types';

export const SSOSettings: React.FC = () => {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [clientSecret, setClientSecret] = useState((window as any).__PODLEARN_ADMIN_DATA__?.sso_client_secret || '');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const PODLEARN_DATA = (window as any).__PODLEARN_ADMIN_DATA__;

  useEffect(() => {
    fetch(PODLEARN_DATA.api_base + '/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  const handleTestConnection = async () => {
    if (!settings) return;
    setTesting(true);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/admin/test-auth', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRFToken': PODLEARN_DATA.csrf_token 
        },
        body: JSON.stringify({ 
          base_url: settings.CENTRAL_AUTH_SERVER_ADDRESS,
          client_id: settings.CENTRAL_AUTH_CLIENT_ID,
          client_secret: clientSecret
        })
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
      if (data.success) {
        // Refresh masked secret display if needed
      }
    } catch (err) {
      setTestResult({ success: false, message: 'Network Protocol Error: Could not reach backend.' });
    } finally {
      setTesting(false);
    }
  };

  const toggleSSO = (enabled: boolean) => {
    if (!settings) return;
    fetch('/api/admin/toggle-sso', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRFToken': PODLEARN_DATA.csrf_token 
      },
      body: JSON.stringify({ enabled })
    })
    .then(r => r.json())
    .then(() => {
      setSettings({...settings, AUTH_PROVIDER: enabled ? 'central' : 'local'});
    });
  };

  if (loading || !settings) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Activity className="animate-spin text-sky-500" size={40} />
      <div className="text-[10px] font-black tracking-widest uppercase text-slate-500 animate-pulse">Initializing Sync Protocols...</div>
    </div>
  );

  const isSSO = settings.AUTH_PROVIDER === 'central';

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header & Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Fingerprint className="text-sky-500" size={20} />
            <span className="text-[10px] font-black text-sky-500 uppercase tracking-[0.3em]">Identity Bridge</span>
          </div>
          <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Ecosystem Synchronization</h3>
          <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mt-3">Manage CentralAuth Node & Power Pairing Protocol</p>
        </div>
        
        <div className="flex p-1.5 bg-white/5 rounded-[1.25rem] border border-white/10 backdrop-blur-md">
           <button 
             onClick={() => toggleSSO(false)}
             className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${!isSSO ? 'bg-white/10 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Native Auth
           </button>
           <button 
             onClick={() => toggleSSO(true)}
             className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${isSSO ? 'bg-sky-500 text-slate-950 shadow-[0_0_30px_rgba(14,165,233,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Central SSO
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Handshake Configuration */}
        <div className="glass p-10 rounded-[3.5rem] space-y-10 relative overflow-hidden group">
           <div className={`absolute top-0 right-0 w-1.5 h-40 ${isSSO ? 'bg-sky-500' : 'bg-slate-700'} rounded-bl-full transition-colors duration-500`} />
           
           <div className="flex items-center gap-4">
              <div className="p-4 bg-sky-500/10 rounded-2xl text-sky-400 border border-sky-500/20">
                 <Server size={24} />
              </div>
              <div>
                <h4 className="text-lg font-black text-white uppercase tracking-tight">Node Configuration</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Setup secure handshake parameters</p>
              </div>
           </div>

           <div className="space-y-8">
              <div className="space-y-3">
                 <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                   <Globe size={12} /> Server Address
                 </label>
                 <input 
                   type="text"
                   value={settings.CENTRAL_AUTH_SERVER_ADDRESS}
                   onChange={(e) => setSettings({...settings, CENTRAL_AUTH_SERVER_ADDRESS: e.target.value})}
                   placeholder="http://127.0.0.1:5000"
                   autoComplete="off"
                   className="w-full bg-slate-950/60 border border-white/5 rounded-2xl px-8 py-6 text-sm font-medium focus:border-sky-500/40 focus:bg-slate-950/80 transition-all outline-none"
                 />
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-3">
                   <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                     <Lock size={12} /> Client ID
                   </label>
                   <input 
                     type="text"
                     value={settings.CENTRAL_AUTH_CLIENT_ID}
                     onChange={(e) => setSettings({...settings, CENTRAL_AUTH_CLIENT_ID: e.target.value})}
                     placeholder="podlearn-v1"
                     autoComplete="off"
                     className="w-full bg-slate-950/60 border border-white/5 rounded-2xl px-8 py-6 text-sm font-mono focus:border-sky-500/40 focus:bg-slate-950/80 transition-all outline-none"
                   />
                </div>

                <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 flex items-center gap-2">
                   <Shield size={12} /> Client Secret
                </label>
                <div className="relative">
                  <input 
                    type={showSecret ? "text" : "password"} 
                    value={clientSecret} 
                    onChange={e => setClientSecret(e.target.value)}
                    placeholder="Enter secret key..."
                    autoComplete="new-password"
                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-6 pr-16 text-sm outline-none focus:border-indigo-500/50 transition-all text-white font-mono" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-all"
                  >
                    {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={async () => {
                    if (!settings) return;
                    setTesting(true);
                    try {
                      const res = await fetch('/api/admin/save-auth-settings', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'X-CSRFToken': PODLEARN_DATA.csrf_token 
                        },
                        body: JSON.stringify({ 
                          base_url: settings.CENTRAL_AUTH_SERVER_ADDRESS,
                          client_id: settings.CENTRAL_AUTH_CLIENT_ID,
                          client_secret: clientSecret
                        })
                      });
                      const data = await res.json();
                      setTestResult({ success: data.success, message: data.message });
                    } catch (err) {
                      setTestResult({ success: false, message: 'Lỗi khi lưu cấu hình.' });
                    } finally {
                      setTesting(false);
                    }
                  }}
                  disabled={testing}
                  className="py-6 bg-white/5 hover:bg-white/10 rounded-3xl border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all flex items-center justify-center gap-4 group/btn"
                >
                  <Lock size={18} className="text-slate-400" />
                  <span>Save Config</span>
                </button>

                <button 
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="py-6 bg-sky-500 hover:bg-sky-400 rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] text-slate-950 transition-all flex items-center justify-center gap-4 group/btn overflow-hidden relative shadow-[0_0_30px_rgba(14,165,233,0.3)]"
                >
                  <motion.div 
                    animate={testing ? { rotate: 360 } : {}}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    {testing ? <Activity size={18} /> : <Zap size={18} className="group-hover/btn:scale-110 transition-transform" />}
                  </motion.div>
                  <span>{testing ? 'Testing...' : 'Invoke Pairing'}</span>
                </button>
              </div>

              <AnimatePresence>
                {testResult && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className={`p-6 rounded-3xl flex items-start gap-4 border ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
                  >
                    {testResult.success ? <CheckCircle2 size={24} className="shrink-0" /> : <AlertTriangle size={24} className="shrink-0" />}
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest">{testResult.success ? 'Handshake Successful' : 'Handshake Failed'}</p>
                      <p className="text-xs font-bold leading-relaxed">{testResult.message}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
        </div>

        {/* Status Monitoring & Discovery */}
        <div className="space-y-8 flex flex-col justify-center">
           <div className="glass p-12 rounded-[4rem] space-y-8 relative overflow-hidden">
              <div className="flex items-center justify-between">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operational Integrity</h4>
                 <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest ${isSSO ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                    <Activity size={12} className={isSSO ? 'animate-pulse' : ''} />
                    {isSSO ? 'Central Session Active' : 'Native Authority'}
                 </div>
              </div>
              
              <div className="p-10 bg-slate-950/40 border border-white/5 rounded-[3rem] flex items-center gap-8 shadow-inner">
                 <div className={`p-6 rounded-[2rem] ${isSSO ? 'bg-sky-500 text-slate-950 shadow-[0_0_40px_rgba(14,165,233,0.3)]' : 'bg-slate-800 text-slate-400'}`}>
                   {isSSO ? <CheckCircle2 size={36} /> : <Shield size={36} />}
                 </div>
                 <div className="space-y-2">
                    <div className="text-xl font-black text-white uppercase tracking-tighter">
                       {isSSO ? 'SSO Link Established' : 'Offline Mode'}
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                       {isSSO 
                         ? 'Identity synchronization is active. All login requests are delegated to Central Auth.' 
                         : 'Local database is managing access. Internal pairing protocols are bypassed.'}
                    </p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 {[
                   { label: 'Sync Version', val: 'V2.1 (Power)', color: 'text-sky-400' },
                   { label: 'Encryption', val: 'AES-GCM', color: 'text-slate-400' },
                   { label: 'Token Type', val: 'JWT/Bearer', color: 'text-slate-400' },
                   { label: 'Ecosystem', val: 'Verified', color: 'text-emerald-400' },
                 ].map(i => (
                   <div key={i.label} className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <div className="text-[8px] font-black text-slate-600 uppercase mb-1 tracking-widest">{i.label}</div>
                      <div className={`text-[11px] font-black uppercase tracking-tight ${i.color}`}>{i.val}</div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-sky-500/5 border border-sky-500/10 p-10 rounded-[3.5rem] flex items-start gap-8 relative overflow-hidden group">
              <div className="p-4 bg-sky-500 rounded-2xl text-slate-950 shadow-lg group-hover:scale-110 transition-transform duration-500">
                 <Shield size={28} />
              </div>
              <div className="space-y-3">
                 <h4 className="text-sm font-black text-white uppercase tracking-tight italic">Security Sovereignty Protocol</h4>
                 <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed max-w-md tracking-wider">
                   Hoạt động đăng nhập trái phép sẽ bị chặn bởi lớp bảo mật Ecosystem Sync. Hãy đảm bảo Client Secret được giữ bí mật và không được chia sẻ ngoài hệ thống Power Pairing.
                 </p>
              </div>
              <div className="absolute -right-16 -bottom-16 opacity-[0.03] rotate-12 group-hover:rotate-45 transition-transform duration-1000">
                 <Globe size={240} />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
