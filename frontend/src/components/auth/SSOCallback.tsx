import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

export const SSOCallback: React.FC = () => {
    const { fetchDashboard } = useAppStore();

    useEffect(() => {
        // Parse hash for tokens (e.g., #access_token=xxx&refresh_token=yyy)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
            localStorage.setItem('access_token', accessToken);
            if (refreshToken) {
                localStorage.setItem('refresh_token', refreshToken);
            }
            
            // Re-fetch dashboard to update login state
            fetchDashboard().then(() => {
                window.location.href = '/'; // Clear the hash and go home
            });
        } else {
            console.error("SSO Callback: No access token found in hash.");
            window.location.href = '/login?error=no_token';
        }
    }, []);

    return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center space-y-6">
            <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(14,165,233,0.3)]" />
            <div className="flex flex-col items-center space-y-2">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Securing Session</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] animate-pulse">Syncing with Central Identity Hub...</p>
            </div>
        </div>
    );
};
