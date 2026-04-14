import React, { useEffect, useState } from 'react';
import { 
  Sparkles, Save, RefreshCw, Cpu, 
  ShieldCheck, AlertTriangle, Key, CpuIcon, Globe
} from 'lucide-react';
import type { AdminSettings } from '../../types';

export const AISettings: React.FC = () => {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const PODLEARN_DATA = (window as any).__PODLEARN_ADMIN_DATA__;

  useEffect(() => {
    fetch(PODLEARN_DATA.api_base + '/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Settings fetch failure:', err);
        setLoading(false);
      });
      
    refreshModels();
  }, []);

  const handleSave = () => {
    if (!settings) return;
    setSaving(true);
    fetch('/api/admin/settings/gemini', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRFToken': PODLEARN_DATA.csrf_token 
      },
      body: JSON.stringify({ 
        api_key: settings.GEMINI_API_KEY, 
        model: settings.GEMINI_MODEL 
      })
    })
    .then(r => r.json())
    .then(() => {
      setSaving(false);
      alert('AI Configuration Synchronized Successfully.');
    })
    .catch(err => {
      console.error('Save failed:', err);
      setSaving(false);
      alert('Failed to synchronize configuration.');
    });
  };

  const refreshModels = () => {
    setRefreshing(true);
    fetch('/api/admin/settings/gemini/models')
      .then(r => r.json())
      .then(data => {
        if (data.success) setModels(data.models);
        setRefreshing(false);
      });
  };

  if (loading || !settings) return <div className="animate-pulse flex items-center justify-center p-20 text-sky-500 font-black tracking-widest uppercase">Booting Intelligence Module...</div>;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-3xl font-black text-white uppercase tracking-tighter">AI Insight Studio</h3>
          <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mt-2">Manage Google Gemini Integration and Linguistic Engines</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-10 py-5 bg-sky-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_0_40px_rgba(14,165,233,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
          Synchronize Config
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* API Credentials */}
        <div className="glass p-10 rounded-[3rem] space-y-8">
           <div className="flex items-center gap-4 mb-2">
             <div className="p-3 bg-white/5 rounded-2xl text-sky-500">
                <Key size={24} />
             </div>
             <div>
                <h4 className="text-lg font-black text-white uppercase italic">API Authorization</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Google AI Studio Access Key</p>
             </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Gemini API Key</label>
              <input 
                type="password"
                value={settings.GEMINI_API_KEY}
                onChange={(e) => setSettings({...settings, GEMINI_API_KEY: e.target.value})}
                placeholder="Enter your API Key..."
                className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-8 py-5 text-sm font-mono focus:border-sky-500/30 transition-all outline-none"
              />
              <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl flex items-start gap-4">
                 <AlertTriangle className="text-amber-500 flex-shrink-0" size={18} />
                 <p className="text-[9px] font-bold text-amber-500/70 uppercase leading-relaxed">
                   Never share your API Key. It governs the entire linguistic analysis engine. All costs incurred will be billed to your Google Cloud account.
                 </p>
              </div>
           </div>
        </div>

        {/* Model Selection */}
        <div className="glass p-10 rounded-[3rem] space-y-8">
           <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-2xl text-indigo-500">
                   <CpuIcon size={24} />
                </div>
                <div>
                   <h4 className="text-lg font-black text-white uppercase italic">Active Engine</h4>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Model Intelligence Level</p>
                </div>
              </div>
              <button 
                onClick={refreshModels}
                disabled={refreshing}
                className="p-3 rounded-xl glass-pill text-slate-400 hover:text-white transition-all"
              >
                <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              </button>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Deployment Model</label>
              <select 
                value={settings.GEMINI_MODEL}
                onChange={(e) => setSettings({...settings, GEMINI_MODEL: e.target.value})}
                className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-8 py-5 text-sm focus:border-sky-500/30 transition-all outline-none appearance-none"
              >
                {models.length > 0 ? (
                  models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))
                ) : (
                  <option value={settings.GEMINI_MODEL}>{settings.GEMINI_MODEL} (Current)</option>
                )}
              </select>
              
              <div className="bg-sky-500/5 border border-sky-500/10 p-6 rounded-2xl">
                 <div className="flex items-center gap-3 mb-3">
                    <ShieldCheck className="text-sky-500" size={18} />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Deployment Status</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Engine Status</span>
                    <span className="text-[9px] font-black text-sky-500 uppercase">Operational / V1.5</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Advanced Capabilities Feature List */}
      <div className="glass p-12 rounded-[4rem] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
        <h4 className="text-sm font-black text-sky-500 uppercase tracking-[0.3em] mb-10 text-center">INTELLIGENCE CAPABILITIES</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
           {[
             { title: 'Grammar Mapping', desc: 'Detailed structural analysis of target sentences.', icon: Cpu },
             { title: 'Nuance Detection', desc: 'Identify politeness levels and emotional tone.', icon: Sparkles },
             { title: 'Context Logic', desc: 'Cross-reference cultural and situational datasets.', icon: Globe },
           ].map(cap => (
             <div key={cap.title} className="text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-center mx-auto text-slate-400">
                   <cap.icon size={28} />
                </div>
                <div className="text-xs font-black text-white uppercase tracking-widest">{cap.title}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed max-w-[200px] mx-auto italic">
                   {cap.desc}
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};
