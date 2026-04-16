import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import CalendarHeatmap from 'react-calendar-heatmap';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { motion } from 'framer-motion';
import { Upload, Flame, Clock, Target, Star, Calendar } from 'lucide-react';
import { useStatsHubData } from '../../hooks/useStatsHubData';
import { format, parseISO } from 'date-fns';
import 'react-calendar-heatmap/dist/styles.css';

// Recharts Custom Tooltip for dark mode
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-xl">
                <p className="text-slate-400 text-[10px] mb-1 font-bold uppercase">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm font-black" style={{ color: entry.color }}>
                        {entry.name}: {entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export const StatsHub: React.FC = () => {
    const { data, isLoading, error, dateRange, setDateRange, filteredDailyData } = useStatsHubData();

    if (isLoading) {
        return <div className="flex-1 flex items-center justify-center font-black text-slate-500 uppercase tracking-widest animate-pulse">Initializing Neural Link...</div>;
    }

    if (error || !data) {
        return <div className="flex-1 flex items-center justify-center font-black text-red-500">Error loading statistics: {error}</div>;
    }

    const totalHours = Math.floor(data.total_listening_time / 3600);
    const totalMins = Math.floor((data.total_listening_time % 3600) / 60);

    const pieData = [
        { name: 'Listening (Input)', value: data.activity_mix.listening_minutes, color: '#38bdf8' },
        { name: 'Shadowing (Output)', value: data.activity_mix.shadowing_minutes, color: '#a855f7' }
    ].filter(d => d.value > 0);
    if (pieData.length === 0) pieData.push({ name: 'No Data Yet', value: 1, color: '#334155' });

    return (
        <div className="flex-1 overflow-y-auto bg-slate-950 px-4 md:px-8 py-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header & Share */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Statistics Hub</h1>
                        <p className="text-slate-500 uppercase font-bold text-xs tracking-widest mt-1">Deep Learning Analytics</p>
                    </div>
                    <button 
                        onClick={() => alert('Social sharing snapshot triggered!')}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 transition-all font-bold text-sm text-white"
                    >
                        <Upload size={16} /> Share Achievement
                    </button>
                </div>

                {/* Top Quick Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card title="Total Listening" icon={<Clock className="text-sky-500"/>} value={`${totalHours}h ${totalMins}m`} subtitle="All-time accumulation" bg="bg-sky-500/5"/>
                    <Card title="Shadowing Reps" icon={<Target className="text-purple-500" />} value={data.total_shadowing_count} subtitle="Phrases spoken" bg="bg-purple-500/5"/>
                    <Card title="Current Streak" icon={<Flame className="text-orange-500" />} value={data.current_streak} subtitle="Days in a row" bg="bg-orange-500/5"/>
                    <Card title="Experience" icon={<Star className="text-yellow-500" />} value={data.total_exp} subtitle="Total EXP Gained" bg="bg-yellow-500/5"/>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Area Chart: Daily Progress */}
                    <div className="xl:col-span-2 bg-slate-900/50 border border-white/5 rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-white uppercase tracking-wider text-sm flex items-center gap-2"><Calendar size={16} className="text-sky-500"/> Daily Progress</h3>
                            <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                                {[7, 30, 90].map(days => (
                                    <button 
                                        key={days} 
                                        onClick={() => setDateRange(days as any)}
                                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${dateRange === days ? 'bg-sky-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        {days}D
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={filteredDailyData}>
                                    <defs>
                                        <linearGradient id="colorListen" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis 
                                        dataKey="date" 
                                        tickFormatter={str => format(parseISO(str), 'MMM dd')} 
                                        stroke="#334155" 
                                        fontSize={10} 
                                        tickMargin={10}
                                        axisLine={false} 
                                    />
                                    <YAxis 
                                        stroke="#334155" 
                                        fontSize={10} 
                                        axisLine={false} 
                                        tickLine={false} 
                                    />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="listening_minutes" name="Listening (Mins)" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#colorListen)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Pie Chart: Activity Mix */}
                    <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 flex flex-col">
                        <h3 className="font-black text-white uppercase tracking-wider text-sm mb-6">Input vs Output Balance</h3>
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart width={250} height={200}>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip/>} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-4 mt-4 w-full">
                                {pieData.map((entry, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}/>
                                        <span className="text-[10px] uppercase font-bold text-slate-400">{entry.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {/* Bar Chart: Hourly Distribution */}
                     <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6">
                        <h3 className="font-black text-white uppercase tracking-wider text-sm mb-6">Hourly Activity Routine</h3>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.hourly_distribution}>
                                    <XAxis dataKey="hour" tickFormatter={h => `${h}h`} stroke="#334155" fontSize={10} axisLine={false} tickLine={false} />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                    <Bar dataKey="minutes" name="Activity (Mins)" fill="#818cf8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* GitHub Style Heatmap */}
                    <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6">
                        <h3 className="font-black text-white uppercase tracking-wider text-sm mb-6">Annual Consistency</h3>
                        <div className="w-full overflow-x-auto pb-4">
                            <div className="min-w-[600px]">
                                <CalendarHeatmap
                                    startDate={new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
                                    endDate={new Date()}
                                    values={data.daily_data.map(d => ({ date: d.date, count: d.listening_minutes + d.shadowing_count }))}
                                    classForValue={(value) => {
                                        if (!value || value.count === 0) return 'fill-slate-800';
                                        if (value.count < 15) return 'fill-sky-900/60';
                                        if (value.count < 30) return 'fill-sky-700/80';
                                        if (value.count < 60) return 'fill-sky-500';
                                        return 'fill-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]'; // High activity
                                    }}
                                    tooltipDataAttrs={(value: any) => ({
                                        'data-tooltip-id': 'heatmap-tooltip',
                                        'data-tooltip-content': value.date ? `${value.date}: ${Math.floor(value.count || 0)} activity score` : 'No activity'
                                    } as any)}
                                    showWeekdayLabels={true}
                                />
                                <ReactTooltip id="heatmap-tooltip" place="top" variant="dark" className="!bg-slate-900 !text-xs !font-bold !border !border-white/10 !rounded-xl" />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

const Card = ({ title, value, subtitle, icon, bg }: any) => (
    <motion.div whileHover={{ y: -4 }} className={`${bg} border border-white/5 rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl`}>
        <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{title}</span>
            <div className="p-2 bg-white/5 rounded-xl">{icon}</div>
        </div>
        <h2 className="text-3xl font-black text-white">{value}</h2>
        <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{subtitle}</p>
    </motion.div>
);
