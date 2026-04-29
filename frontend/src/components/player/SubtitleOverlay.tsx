import React from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';

export const SubtitleOverlay: React.FC = () => {
    const { 
        s1Lines, s2Lines, s3Lines, aiInsights, currentTime, settings, trackIds,
        showFurigana, analyzedWords, originalLang 
    } = usePlayerStore();
    
    // Find active lines for each track independently
    const findActiveLine = (lines: any[]) => {
        return lines.find(line => (currentTime >= line.start) && (currentTime <= line.end));
    };

    const getLineForTrack = (sid: 's1' | 's2' | 's3', lines: any[]) => {
        if (!settings[sid].enabled) return null;
        if (trackIds[sid] === 'ai') {
            const ai = aiInsights.find(i => (currentTime >= i.start) && (currentTime <= i.end));
            return ai ? { text: ai.short, isAi: true } : null;
        }
        return findActiveLine(lines);
    };

    const activeTracks = [
        { id: 's1' as const, line: getLineForTrack('s1', s1Lines) },
        { id: 's2' as const, line: getLineForTrack('s2', s2Lines) },
        { id: 's3' as const, line: getLineForTrack('s3', s3Lines) }
    ].filter(t => !!t.line);

    if (activeTracks.length === 0) return null;

    const convertHexToRgba = (hex: string, opacity: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    const renderLine = (sid: 's1' | 's2' | 's3', line: any) => {
        const s = settings[sid];
        const alignDefault = s.textAlign || 'center';
        
        return (
            <div 
                key={sid}
                className={`flex pointer-events-none transition-all duration-300 px-2 w-full ${
                    alignDefault === 'left' ? 'justify-start' : 
                    alignDefault === 'right' ? 'justify-end' : 'justify-center'
                }`}
            >
                <div 
                    className={`px-4 py-2 rounded-xl shadow-2xl font-bold border border-white/5 max-w-[90%] sm:max-w-[80%] ${
                        alignDefault === 'left' ? 'text-left' : 
                        alignDefault === 'right' ? 'text-right' : 'text-center'
                    }`}
                    style={{
                        fontSize: `clamp(10px, ${s.fontSize}cqw, 100px)`,
                        color: s.color,
                        backgroundColor: convertHexToRgba(s.bgColor, s.bgOpacity),
                        lineHeight: 1.3,
                        backdropFilter: 'blur(8px)',
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}
                >
                    {sid === 's1' && originalLang === 'ja' && showFurigana && analyzedWords.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-x-1">
                            {analyzedWords.map((word, idx) => (
                                <ruby key={idx} className="ruby-base">
                                    {word.surface}
                                    {word.reading && word.reading !== word.surface && (
                                        <rt className="text-[0.4em] mb-[-0.2em] opacity-80">{word.reading}</rt>
                                    )}
                                </ruby>
                            ))}
                        </div>
                    ) : (
                        line.text
                    )}
                </div>
            </div>
        );
    };

    // Split into Top and Bottom groups
    const bottomGroup = activeTracks
        .filter(t => settings[t.id].position < 50)
        .sort((a, b) => settings[a.id].position - settings[b.id].position);

    const topGroup = activeTracks
        .filter(t => settings[t.id].position >= 50)
        .sort((a, b) => settings[b.id].position - settings[a.id].position); // Top-most first in Flex column

    const minBottom = bottomGroup.length > 0 ? Math.min(...bottomGroup.map(t => settings[t.id].position)) : null;
    const maxTop = topGroup.length > 0 ? Math.max(...topGroup.map(t => settings[t.id].position)) : null;

    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden" 
             style={{ containerType: 'size' }}>
            
            {/* Bottom Stack: Flex Col Reverse (lowest pos at bottom) */}
            {bottomGroup.length > 0 && (
                <div 
                    className="absolute inset-x-0 flex flex-col-reverse gap-2 transition-all duration-300"
                    style={{ bottom: `${minBottom}%` }}
                >
                    {bottomGroup.map(t => renderLine(t.id, t.line))}
                </div>
            )}

            {/* Top Stack: Flex Col (highest pos at top) */}
            {topGroup.length > 0 && (
                <div 
                    className="absolute inset-x-0 flex flex-col gap-2 transition-all duration-300"
                    style={{ top: `${100 - (maxTop || 100)}%` }}
                >
                    {topGroup.map(t => renderLine(t.id, t.line))}
                </div>
            )}
        </div>
    );
};
