import React, { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  audioStream: MediaStream | null;
  isActive: boolean;
  color?: string;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ 
  audioStream, 
  isActive, 
  color = '#3b82f6' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!isActive || !audioStream) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(audioStream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      requestRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        
        ctx.fillStyle = color;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      audioContext.close();
    };
  }, [audioStream, isActive, color]);

  return (
    <div className="w-full h-24 bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700">
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={100} 
        className="w-full h-full"
      />
    </div>
  );
};

export default WaveformVisualizer;
