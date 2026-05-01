import { useState, useEffect } from 'react';
import axios from 'axios';

interface DailyData {
    date: string;
    listening_minutes: number;
    shadowing_count: number;
}

interface StatsData {
    total_listening_time: number;
    total_shadowing_count: number;
    total_exp: number;
    current_streak: number;
    daily_data: DailyData[];
    hourly_distribution: Array<{ hour: number, minutes: number }>;
    activity_mix: {
        listening_minutes: number;
        shadowing_minutes: number;
    };
}

export function useStatsHubData() {
    const [data, setData] = useState<StatsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState(30);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true);
                // Use axios for automatic JWT attachment
                const response = await axios.get('/api/study/stats/summary');
                setData(response.data);
            } catch (err: any) {
                console.error("Stats fetch error:", err);
                setError(err.response?.data?.error || err.message || "Failed to fetch stats summary");
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    const filteredDailyData = data?.daily_data.slice(-dateRange) || [];

    return {
        data,
        isLoading,
        error,
        dateRange,
        setDateRange,
        filteredDailyData
    };
}
