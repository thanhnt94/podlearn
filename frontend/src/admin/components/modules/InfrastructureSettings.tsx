import React, { useEffect, useState } from 'react';
import { 
  Server, Save, RefreshCw, Network, 
  ShieldCheck, AlertTriangle, Globe
} from 'lucide-react';
import axios from 'axios';
import type { AdminSettings } from '../../types';

export const InfrastructureSettings: React.FC = () => {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get('/api/admin/settings');
        setSettings(response.data);
      } catch (err) {
        console.error('Settings fetch failure:', err);
      } finally {
        setLoading(false);
      }
    };
      
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await axios.post('/api/admin/settings/proxy', { 
        proxy_url: settings.YOUTUBE_PROXY_URL
      });
      alert('Network Infrastructure Synchronized.');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to update proxy settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <div className="animate-pulse flex items-center justify-center p-20 text-sky-500 font-black tracking-widest uppercase">Initializing Infrastructure Control...</div>;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Infrastructure Hub</h3>
          <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mt-2">Manage Network Proxies and Extraction Tunneling</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-10 py-5 bg-sky-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_0_40px_rgba(14,165,233,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
          Apply Infrastructure Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* YouTube Extraction Proxy */}
        <div className="glass p-10 rounded-[3rem] space-y-8">
           <div className="flex items-center gap-4 mb-2">
             <div className="p-3 bg-white/5 rounded-2xl text-amber-500">
                <Globe size={24} />
             </div>
             <div>
                <h4 className="text-lg font-black text-white uppercase italic">Extraction Tunneling</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bypass YouTube Bot Detection</p>
             </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">YouTube Proxy URL</label>
              <input 
                type="text"
                value={settings.YOUTUBE_PROXY_URL}
                onChange={(e) => setSettings({...settings, YOUTUBE_PROXY_URL: e.target.value})}
                placeholder="http://user:pass@host:port"
                className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-8 py-5 text-sm font-mono focus:border-sky-500/30 transition-all outline-none"
              />
              <p className="text-[9px] font-bold text-slate-600 uppercase px-1">Supported formats: http://, https://, socks5://</p>
              
              <div className="bg-sky-500/5 border border-sky-500/10 p-5 rounded-2xl flex items-start gap-4">
                 <ShieldCheck className="text-sky-500 flex-shrink-0" size={18} />
                 <p className="text-[9px] font-bold text-sky-500/70 uppercase leading-relaxed">
                   Using a residential proxy is highly recommended for VPS environments. This setting applies to both yt-dlp metadata extraction and direct VTT downloads.
                 </p>
              </div>
           </div>
        </div>

        {/* Network Status */}
        <div className="glass p-10 rounded-[3rem] space-y-8">
           <div className="flex items-center gap-4">
             <div className="p-3 bg-white/5 rounded-2xl text-emerald-500">
                <Network size={24} />
             </div>
             <div>
                <h4 className="text-lg font-black text-white uppercase italic">System Topology</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Network Health</p>
             </div>
           </div>

           <div className="space-y-6">
              <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                 <span className="text-[10px] font-black text-slate-400 uppercase">Extraction Node</span>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
                 </div>
              </div>

              <div className="bg-rose-500/5 border border-rose-500/10 p-5 rounded-2xl flex items-start gap-4">
                 <AlertTriangle className="text-rose-500 flex-shrink-0" size={18} />
                 <p className="text-[9px] font-bold text-rose-500/70 uppercase leading-relaxed">
                   Incorrect proxy credentials will cause all video imports and subtitle extractions to fail globally. Test your proxy URL locally before deploying here.
                 </p>
              </div>
           </div>
        </div>
      </div>

      {/* Infrastructure Core */}
      <div className="glass p-12 rounded-[4rem] relative overflow-hidden bg-gradient-to-br from-slate-900/40 to-transparent">
        <div className="flex flex-col md:flex-row items-center gap-12">
           <div className="w-24 h-24 bg-sky-500/10 rounded-[2rem] flex items-center justify-center text-sky-500 flex-shrink-0 border border-sky-500/20 shadow-[0_0_50px_rgba(14,165,233,0.1)]">
              <Server size={48} />
           </div>
           <div className="space-y-4">
              <h4 className="text-xl font-black text-white uppercase tracking-tighter italic">Resilience Engineering</h4>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                PodLearn's extraction engine is designed to be geographically agnostic. By providing an external proxy, you decouple the application's IP identity from its processing tasks, ensuring 99.9% availability even under aggressive platform throttling.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};
