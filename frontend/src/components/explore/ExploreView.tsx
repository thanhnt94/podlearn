import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { LessonCard } from '../dashboard/LessonCard';
import { Compass, Search, X } from 'lucide-react';

const CATEGORIES = [
    { id: 'all', label: 'All' },
    { id: 'podcast', label: 'Podcast' },
    { id: 'song', label: 'Song' },
    { id: 'interview', label: 'Interview' },
    { id: 'news', label: 'News' }
];

export const ExploreView: React.FC = () => {
    const { communityVideos, fetchDashboard, isLoading } = useAppStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    
    const selectedChannelTitle = searchParams.get('channel');
    const setSelectedChannelTitle = (val: string | null) => {
        const newParams = new URLSearchParams(searchParams);
        if (val) newParams.set('channel', val);
        else newParams.delete('channel');
        setSearchParams(newParams);
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    const filteredVideos = communityVideos.filter(v => {
        const matchesSearch = v.video.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || (v.video.category || 'podcast') === selectedCategory;
        const matchesChannel = !selectedChannelTitle || v.video.channel_title === selectedChannelTitle;
        return matchesSearch && matchesCategory && matchesChannel;
    });

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-slate-950">
                <div className="w-12 h-12 border-4 border-slate-800 border-t-sky-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-950 px-6 md:px-10 pb-20 custom-scrollbar">
            
            {/* Header Area */}
            <div className="max-w-7xl mx-auto pt-12 pb-10 space-y-8">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sky-400">
                        <Compass size={18} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Global Discovery</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">Expand Your Horizons</h1>
                    <p className="text-sm text-slate-500 max-w-2xl font-medium leading-relaxed">
                        Discover trending podcasts shared by the PodLearn community. Join shared workspaces and collaborate on subtitles and notes.
                    </p>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-400 transition-colors" size={20} />
                        <input 
                            type="text" 
                            placeholder="Search podcasts by title or topic..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-sm focus:border-sky-500/50 outline-none transition-all shadow-xl text-white"
                        />
                    </div>
                </div>

                {/* Categories & Channel Filter */}
                <div className="flex flex-col gap-4 mt-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {CATEGORIES.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setSelectedCategory(c.id)}
                                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                    selectedCategory === c.id
                                        ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20'
                                        : 'bg-slate-900 border border-white/5 text-slate-400 hover:text-white hover:border-white/20'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    
                    {selectedChannelTitle && (
                        <div className="flex items-center gap-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                    Channel: {selectedChannelTitle}
                                </span>
                                <button 
                                    onClick={() => setSelectedChannelTitle(null)}
                                    className="p-0.5 hover:bg-indigo-500/20 rounded-md text-indigo-400 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto space-y-12">

                <div className="space-y-8">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-1.5 h-6 bg-sky-500 rounded-full" />
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Recommended For You</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {filteredVideos.map(video => (
                            <div key={video.id} className="hover:-translate-y-2 transition-transform duration-500">
                                <LessonCard 
                                    lesson={video} 
                                    onChannelClick={setSelectedChannelTitle} 
                                />
                            </div>
                        ))}
                        {filteredVideos.length === 0 && (
                            <div className="col-span-full py-20 text-center space-y-4">
                                <div className="text-5xl opacity-20">🔍</div>
                                <p className="text-slate-500 font-bold uppercase tracking-widest">No podcasts match your search</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
