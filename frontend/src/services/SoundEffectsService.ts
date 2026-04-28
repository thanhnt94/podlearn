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

    public vibrate(pattern: number | number[]): void {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(pattern);
        }
    }

    public play(type: 'success' | 'failure' | 'pop' | 'ding' | 'levelup'): void {
        if (!this.audioContext) return;
        
        // Trigger haptic for certain types
        if (type === 'success' || type === 'levelup') this.vibrate(20);
        if (type === 'failure') this.vibrate([20, 50, 20]);
        if (type === 'pop') this.vibrate(10);

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
            case 'levelup':
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(261.63, now); // C4
                oscillator.frequency.exponentialRampToValueAtTime(523.25, now + 0.1);
                oscillator.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
                oscillator.frequency.exponentialRampToValueAtTime(1046.50, now + 0.4); // C6
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
                oscillator.start(now);
                oscillator.stop(now + 0.6);
                break;
        }
    }
}

export const soundEffects = SoundEffectsService.getInstance();
