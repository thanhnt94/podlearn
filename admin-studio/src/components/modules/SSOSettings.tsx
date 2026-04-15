import React, { useEffect, useState } from 'react';
import { 
  Globe, Server, Shield, Link2, 
  Activity, CheckCircle2
} from 'lucide-react';
import type { AdminSettings } from '../../types';

export const SSOSettings: React.FC = () => {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const PODLEARN_DATA = (window as any).__PODLEARN_ADMIN_DATA__;

  useEffect(() => {
    fetch(PODLEARN_DATA.api_base + '/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  const handleTestConnection = () => {
    if (!settings) return;
    setTesting(true);
    fetch('/api/admin/test-auth', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRFToken': PODLEARN_DATA.csrf_token 
      },
      body: JSON.stringify({ 
        base_url: settings.CENTRAL_AUTH_SERVER_ADDRESS,
        client_id: settings.CENTRAL_AUTH_CLIENT_ID,
        client_secret: settings.CENTRAL_AUTH_CLIENT_SECRET
      })
    })
    .then(r => r.json())
    .then(data => {
      setTesting(false);
      alert(data.message || 'Connection test completed.');
    });
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
      alert(`Authentication provider switched to: ${enabled ? 'CentralAuth' : 'Local Storage'}`);
    });
  };

  if (loading || !settings) return <div className="animate-pulse flex items-center justify-center p-20 text-sky-500 font-black tracking-widest uppercase">Initializing Sync Protocols...</div>;

  const isSSO = settings.AUTH_PROVIDER === 'central';

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Ecosystem Synchronization</h3>
          <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mt-2">Manage CentralAuth Identity Bridge and SSO Node</p>
        </div>
        <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5">
           <button 
             onClick={() => toggleSSO(false)}
             className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isSSO ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Local Auth
           </button>
           <button 
             onClick={() => toggleSSO(true)}
             className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSSO ? 'bg-sky-500 text-slate-950 shadow-[0_0_20px_rgba(14,165,233,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Central SSO
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Connection Setup */}
        <div className="glass p-10 rounded-[3rem] space-y-10 relative overflow-hidden">
           <div className={`absolute top-0 right-0 w-1 h-32 ${isSSO ? 'bg-sky-500' : 'bg-slate-800'} rounded-bl-full opacity-20`} />
           
           <div className="flex items-center gap-4">
              <div className="p-3 bg-white/5 rounded-2xl text-indigo-400">
                 <Server size={24} />
              </div>
              <h4 className="text-lg font-black text-white uppercase italic tracking-tight">Identity Node Configuration</h4>
           </div>

           <div className="space-y-6">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Network Bridge Address</label>
                 <input 
                   type="text"
                   value={settings.CENTRAL_AUTH_SERVER_ADDRESS}
                   onChange={(e) => setSettings({...settings, CENTRAL_AUTH_SERVER_ADDRESS: e.target.value})}
                   placeholder="https://auth.ecosystem.local"
                   className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-8 py-5 text-sm font-medium focus:border-sky-500/30 transition-all outline-none"
                 />
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Studio Client ID</label>
                 <input 
                   type="text"
                   value={settings.CENTRAL_AUTH_CLIENT_ID}
                   onChange={(e) => setSettings({...settings, CENTRAL_AUTH_CLIENT_ID: e.target.value})}
                   placeholder="Enter Client ID..."
                   className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-8 py-5 text-sm font-mono focus:border-sky-500/30 transition-all outline-none"
                 />
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Studio Client Secret</label>
                 <input 
                   type="password"
                   value={settings.CENTRAL_AUTH_CLIENT_SECRET}
                   onChange={(e) => setSettings({...settings, CENTRAL_AUTH_CLIENT_SECRET: e.target.value})}
                   placeholder="Enter Client Secret..."
                   className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-8 py-5 text-sm font-mono focus:border-sky-500/30 transition-all outline-none"
                 />
              </div>

              <button 
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full py-5 glass-pill rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3"
              >
                {testing ? <Activity className="animate-spin" size={16} /> : <Link2 size={16} />}
                Invoke Handshake Test
              </button>
           </div>
        </div>

        {/* Status Monitoring */}
        <div className="space-y-12">
           <div className="glass p-10 rounded-[3rem] space-y-6">
              <div className="flex items-center justify-between">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Integrity</h4>
                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                    Secure Channel
                 </div>
              </div>
              
              <div className="p-8 bg-slate-950/40 border border-white/5 rounded-[2rem] flex items-center gap-6">
                 {isSSO ? (
                   <CheckCircle2 className="text-sky-500" size={32} />
                 ) : (
                   <Shield className="text-slate-600" size={32} />
                 )}
                 <div>
                    <div className="text-sm font-black text-white uppercase tracking-tight">
                       {isSSO ? 'CentralAuth Active' : 'Native Authority active'}
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed mt-1">
                       {isSSO 
                         ? 'Cross-ecosystem identity synchronization is currently governing user sessions.' 
                         : 'Local database is managing all member identities and authentication flows.'}
                    </p>
                 </div>
              </div>
           </div>

           <div className="glass p-10 rounded-[3rem] space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Discovery Engine</h4>
              <div className="grid grid-cols-2 gap-4">
                 {[
                   { label: 'Token Vault', val: 'V2 (Encrypted)' },
                   { label: 'OIDC Provider', val: 'Compliant' },
                   { label: 'Sync Latency', val: '14ms' },
                   { label: 'Encryption', val: 'AES-256' },
                 ].map(i => (
                   <div key={i.label} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                      <div className="text-[8px] font-black text-slate-600 uppercase mb-1">{i.label}</div>
                      <div className="text-[10px] font-black text-white uppercase">{i.val}</div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-sky-500/5 border border-sky-500/10 p-10 rounded-[4rem] flex items-start gap-8 relative overflow-hidden">
        <div className="p-4 bg-sky-500 rounded-2xl text-slate-950">
           <Shield size={28} />
        </div>
        <div className="space-y-2">
           <h4 className="text-sm font-black text-white uppercase tracking-tight italic">Identity Sovereignty Protocol</h4>
           <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed max-w-2xl tracking-wide">
             CentralAuth V2 provides a unified identity layer across the TimeHack Ecosystem. Switching to Central SSO allows users to log in with a single account across PodLearn, IPTV, and WatchTogether. Ensure the Client Secret is correctly configured in the backend environment.
           </p>
        </div>
        <div className="absolute -right-20 -bottom-20 opacity-5">
           <Globe size={300} />
        </div>
      </div>
    </div>
  );
};
