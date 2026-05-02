import React from 'react';

interface AppLogoProps {
    className?: string;
    iconSize?: number;
    textSize?: string;
    showText?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({ 
    className = "", 
    iconSize = 40, 
    textSize = "text-xl",
    showText = true 
}) => {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div 
                className="relative flex items-center justify-center shrink-0"
                style={{ width: iconSize, height: iconSize }}
            >
                {/* Background Glow */}
                <div className="absolute inset-0 bg-sky-500/20 blur-xl rounded-full" />
                
                {/* Main Icon Container */}
                <div className="relative w-full h-full bg-gradient-to-tr from-sky-500 via-sky-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20 overflow-hidden group">
                    <svg 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3/5 h-3/5 text-slate-950 group-hover:scale-110 transition-transform duration-500"
                    >
                        <path 
                            d="M8 5V19M12 2V22M16 8V16M20 11V13M4 9V15" 
                            stroke="currentColor" 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        />
                    </svg>
                    
                    {/* Glassmorphism Shine */}
                    <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 -skew-y-12" />
                </div>
            </div>

            {showText && (
                <div className="flex flex-col">
                    <h1 className={`${textSize} font-black tracking-tighter text-white uppercase leading-none`}>
                        POD<span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">LEARN</span>
                    </h1>
                </div>
            )}
        </div>
    );
};
