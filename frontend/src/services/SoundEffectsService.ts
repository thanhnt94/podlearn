class SoundEffectsService {
    private static instance: SoundEffectsService;
    private audioContext: AudioContext | null = null;

    private constructor() {
        if (typeof window !== 'undefined') {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.audioContext = new AudioContextClass();
            }
        }
    }

    public static getInstance(): SoundEffectsService {
        if (!SoundEffectsService.instance) {
            SoundEffectsService.instance = new SoundEffectsService();
        }
        return SoundEffectsService.instance;
    }

    public play(type: 'success' | 'failure' | 'pop' | 'ding'): void {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        const now = this.audioContext.currentTime;

        switch (type) {
            case 'success':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, now);
                oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.1);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                oscillator.start(now);
                oscillator.stop(now + 0.2);
                break;
            case 'failure':
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(220, now);
                oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.1);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                oscillator.start(now);
                oscillator.stop(now + 0.2);
                break;
            case 'pop':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, now);
                oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.05);
                gainNode.gain.setValueAtTime(0.05, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                oscillator.start(now);
                oscillator.stop(now + 0.05);
                break;
            case 'ding':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(987.77, now); // B5
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;
        }
    }
}

export const soundEffects = SoundEffectsService.getInstance();
