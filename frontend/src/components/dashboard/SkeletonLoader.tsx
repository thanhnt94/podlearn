import React from 'react';

export const SkeletonCard: React.FC = () => {
    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] overflow-hidden p-0 animate-pulse">
            <div className="aspect-video bg-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shine" />
            </div>
            <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <div className="h-4 bg-white/5 rounded-full w-3/4" />
                    <div className="h-4 bg-white/5 rounded-full w-1/2" />
                </div>
                <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                    <div className="h-3 bg-white/5 rounded-full w-20" />
                    <div className="h-3 bg-white/5 rounded-full w-16" />
                </div>
            </div>
        </div>
    );
};

export const SkeletonDashboard: React.FC = () => {
    return (
        <div className="max-w-7xl mx-auto px-6 md:px-10 pb-20 mt-12 space-y-12">
            <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-slate-800 rounded-full" />
                <div className="h-6 bg-slate-800 rounded-full w-48" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <SkeletonCard key={i} />
                ))}
            </div>
        </div>
    );
};
