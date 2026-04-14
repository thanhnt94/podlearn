import React, { useEffect, useState } from 'react';
import { Users, Video, BookOpen, MessageSquare, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../../utils';
import type { AdminStats } from '../../types';

const data = [
  { name: 'Mon', users: 400, content: 240 },
  { name: 'Tue', users: 300, content: 139 },
  { name: 'Wed', users: 200, content: 980 },
  { name: 'Thu', users: 278, content: 390 },
  { name: 'Fri', users: 189, content: 480 },
  { name: 'Sat', users: 239, content: 380 },
  { name: 'Sun', users: 349, content: 430 },
];

const StatCard: React.FC<{ title: string; value: string | number; icon: any; trend: number; color: string }> = ({ title, value, icon: Icon, trend, color }) => (
  <div className="glass p-8 rounded-[2rem] relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
    <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 blur-3xl -mr-8 -mt-8 ${color}`} />
    
    <div className="flex justify-between items-start mb-6">
      <div className={`p-4 rounded-2xl bg-white/5 border border-white/5`}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
      <div className={cn(
        "flex items-center gap-1 text-[10px] font-black uppercase tracking-widest",
        trend > 0 ? "text-emerald-500" : "text-rose-500"
      )}>
        {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {Math.abs(trend)}%
      </div>
    </div>

    <div className="space-y-1">
      <div className="text-3xl font-black text-white tracking-tighter">{value}</div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</div>
    </div>
  </div>
);


export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<AdminStats | null>(null);

    useEffect(() => {
        // In a real app, this would be an API call
        // For now, let's pretendPodLearn data is here
        const PODLEARN_DATA = (window as any).__PODLEARN_ADMIN_DATA__;
        fetch(PODLEARN_DATA.api_base + '/stats')
            .then(r => {
                if (!r.ok) throw new Error('API Unavailable');
                return r.json();
            })
            .then(setStats)
            .catch(err => {
                console.error('Stats fetch failure:', err);
                // Fallback empty stats to stop the loading spinner
                setStats({
                    users_count: 0,
                    videos_count: 0,
                    lessons_count: 0,
                    subtitles_count: 0
                });
            });
    }, []);

    if (!stats) return <div className="animate-pulse flex items-center justify-center p-20 text-sky-500 font-black tracking-widest uppercase">Initializing Interface...</div>;

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <StatCard 
                    title="Active Members" 
                    value={stats.users_count} 
                    icon={Users} 
                    trend={12.5} 
                    color="bg-sky-500" 
                />
                <StatCard 
                    title="Live Lessons" 
                    value={stats.lessons_count} 
                    icon={BookOpen} 
                    trend={8.2} 
                    color="bg-indigo-500" 
                />
                <StatCard 
                    title="Video Library" 
                    value={stats.videos_count} 
                    icon={Video} 
                    trend={-2.4} 
                    color="bg-purple-500" 
                />
                <StatCard 
                    title="AI Subtitles" 
                    value={stats.subtitles_count} 
                    icon={MessageSquare} 
                    trend={45.0} 
                    color="bg-emerald-500" 
                />
            </div>

            {/* Main Visual Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 glass p-10 rounded-[3rem] relative overflow-hidden">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Ecosystem Activity</h3>
                            <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mt-1">Real-time user engagement analysis</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-sky-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase">Users</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase">Content</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorContent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} 
                                />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem'}}
                                    itemStyle={{fontSize: '10px', fontWeight: 900, textTransform: 'uppercase'}}
                                />
                                <Area type="monotone" dataKey="users" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                                <Area type="monotone" dataKey="content" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorContent)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass p-10 rounded-[3rem] space-y-8">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">System Status</h3>
                    <div className="space-y-6">
                        {[
                            { label: 'CentralAuth Bridge', status: 'Online', power: 98 },
                            { label: 'Gemini AI Engine', status: 'Optimal', power: 100 },
                            { label: 'Local Storage', status: 'Healthy', power: 42 },
                            { label: 'Media CDN', status: 'Standby', power: 0 },
                        ].map(sys => (
                            <div key={sys.label} className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    <span>{sys.label}</span>
                                    <span className={sys.status === 'Online' || sys.status === 'Optimal' ? 'text-sky-500' : 'text-slate-400'}>{sys.status}</span>
                                </div>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)] transition-all duration-1000" 
                                        style={{ width: `${sys.power}%` }} 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-6">
                        <div className="bg-sky-500/10 border border-sky-500/20 p-6 rounded-2xl flex items-center gap-4">
                            <Activity className="text-sky-500 animate-pulse" size={24} />
                            <div>
                                <div className="text-[10px] font-black text-white uppercase tracking-widest">Global Heat</div>
                                <div className="text-[8px] font-bold text-sky-500/70 uppercase">Peak execution reached</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
