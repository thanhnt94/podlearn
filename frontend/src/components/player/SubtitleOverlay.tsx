import { usePlayerStore } from '../../store/usePlayerStore';

export const SubtitleOverlay: React.FC = () => {
    const { 
        s1Lines, s2Lines, s3Lines, currentTime, settings, trackIds,
        analyzedWords, originalLang
    } = usePlayerStore();

    const convertHexToRgba = (hex: string, opacity: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    const renderLine = (sid: 's1' | 's2' | 's3', line: any) => {
        const s = settings[sid];
        const alignDefault = s.textAlign || 'center';
        const isAnalyzed = sid === 's1' && originalLang === 'ja' && analyzedWords.length > 0;
        
        return (
            <div 
                key={sid}
                className={`flex pointer-events-none transition-all duration-300 px-2 w-full ${
                    alignDefault === 'left' ? 'justify-start' : 
                    alignDefault === 'right' ? 'justify-end' : 'justify-center'
                }`}
            >
                <div 
                    className={`font-bold px-4 py-2 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-xl transition-all duration-300`}
                    style={{
                        fontSize: `clamp(10px, ${s.fontSize}cqw, 100px)`,
                        color: s.color,
                        backgroundColor: convertHexToRgba(s.bgColor, s.bgOpacity),
                        lineHeight: 1.4,
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        textAlign: 'center',
                        width: 'max-content',
                        maxWidth: '90%',
                        wordBreak: 'break-word'
                    }}
                >
                    {isAnalyzed ? (
                        analyzedWords.map((word: any, idx: number) => (
                            <span key={idx} className="inline-block mx-[0.1em]">
                                {word.surface}
                            </span>
                        ))
                    ) : (
                        (line.text || '').replace(/\s*\[[^\]]*\]\s*/g, '').replace(/\s*[|/]\s*/g, '').trim()
                    )}
                </div>
            </div>
        );
    };

    const getLineForTrack = (tid: 's1' | 's2' | 's3', lines: any[]) => {
        const trackId = trackIds[tid];
        // Must have a track assigned AND track must be enabled (visible)
        if (!trackId || !settings[tid]?.enabled) return null;
        if (!lines || lines.length === 0) return null;
        return lines.find(l => l.start <= currentTime && l.end >= currentTime) || null;
    };

    const activeTracks = [
        { id: 's1' as const, line: getLineForTrack('s1', s1Lines) },
        { id: 's2' as const, line: getLineForTrack('s2', s2Lines) },
        { id: 's3' as const, line: getLineForTrack('s3', s3Lines) }
    ].filter(t => !!t.line);

    if (activeTracks.length === 0) return null;

    // Split into Top and Bottom groups
    const bottomGroup = activeTracks
        .filter(t => settings[t.id].position < 50)
        .sort((a, b) => settings[a.id].position - settings[b.id].position);

    const topGroup = activeTracks
        .filter(t => settings[t.id].position >= 50)
        .sort((a, b) => settings[b.id].position - settings[a.id].position);

    const minBottom = bottomGroup.length > 0 ? Math.min(...bottomGroup.map(t => settings[t.id].position)) : null;
    const maxTop = topGroup.length > 0 ? Math.max(...topGroup.map(t => settings[t.id].position)) : null;

    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden" 
             style={{ containerType: 'size' }}>
            
            {/* Bottom Stack: Flex Col (lowest pos at bottom) */}
            {bottomGroup.length > 0 && (
                <div 
                    className="absolute inset-x-0 flex flex-col-reverse gap-2 transition-all duration-300"
                    style={{ bottom: `${minBottom || 15}%` }}
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
