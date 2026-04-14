import React from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';

export const SubtitleOverlay: React.FC = () => {
    const { s1Lines, s2Lines, s3Lines, aiInsights, currentTime, settings, trackIds } = usePlayerStore();
    
    // Find active lines for each track independently
    const findActiveLine = (lines: any[]) => {
        return lines.find(line => (currentTime >= line.start - 0.2) && (currentTime <= line.end + 0.2));
    };

    const getLineForTrack = (sid: 's1' | 's2' | 's3', lines: any[]) => {
        if (!settings[sid].enabled) return null;
        if (trackIds[sid] === 'ai') {
            const ai = aiInsights.find(i => (currentTime >= i.start - 0.2) && (currentTime <= i.end + 0.2));
            return ai ? { text: ai.short, isAi: true } : null;
        }
        return findActiveLine(lines);
    };

    const l1 = getLineForTrack('s1', s1Lines);
    const l2 = getLineForTrack('s2', s2Lines);
    const l3 = getLineForTrack('s3', s3Lines);

    if (!l1 && !l2 && !l3) return null;

    const convertHexToRgba = (hex: string, opacity: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    const renderTrack = (sid: 's1' | 's2' | 's3', line: any) => {
        if (!line) return null;
        const s = settings[sid];
        return (
            <div 
                className="absolute inset-x-0 flex justify-center pointer-events-none transition-all duration-300 px-[5%]"
                style={{ bottom: `${s.position}%` }}
            >
                <div 
                    className="px-4 py-2 rounded-xl shadow-2xl text-center font-bold border border-white/5"
                    style={{
                        fontSize: `clamp(10px, ${s.fontSize}cqw, 100px)`,
                        color: s.color,
                        backgroundColor: convertHexToRgba(s.bgColor, s.bgOpacity),
                        lineHeight: 1.2,
                        backdropFilter: 'blur(8px)'
                    }}
                >
                    {line.text}
                </div>
            </div>
        );
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden" 
             style={{ containerType: 'size' }}>
            {renderTrack('s1', l1)}
            {renderTrack('s2', l2)}
            {renderTrack('s3', l3)}
        </div>
    );
};
