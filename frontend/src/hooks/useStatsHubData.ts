import { useState, useEffect } from 'react';

export interface DailyData {
    date: string;
    listening_minutes: number;
    shadowing_count: number;
}

export interface HourlyDistribution {
    hour: string;
    minutes: number;
}

export interface StatsSummary {
    total_listening_time: number; // in seconds
    total_shadowing_count: number;
    total_exp: number;
    current_streak: number;
    daily_data: DailyData[];
    hourly_distribution: HourlyDistribution[];
    activity_mix: {
        listening_minutes: number;
        shadowing_minutes: number;
    };
}

export function useStatsHubData() {
    const [data, setData] = useState<StatsSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<7 | 30 | 90>(30); // Default to 30 days

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('/api/tracking/stats/summary', {
                    headers: {
                        'Accept': 'application/json',
                    }
                });
                if (!response.ok) throw new Error('Failed to fetch stats summary');
                
                const result: StatsSummary = await response.json();
                setData(result);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    // Derived filtered data based on dateRange
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
