class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.soundBuffers = new Map();
        this.isPlaying = false;
        this.bpm = 120.0;
        this.currentStep = 0;
        this.nextNoteTime = 0.0;
        this.scheduleAheadTime = 0.1; // seconds
        this.lookahead = 25.0; // ms
        this.timerID = null;
        this.totalSteps = 16;
        this.pattern = []; // This will be generated dynamically

        this.markovChain = new MarkovChainGenerator();

        // F# Minor Scale (2 octaves)
        this.fSharpMinorScale = [
             92.50, 103.83, 110.00, 123.47, 138.59, 146.83, 164.81, // F#2 to E3
             185.00, 207.65, 220.00, 246.94, 277.18, 293.66, 329.63  // F#3 to E4
        ];

        this.basslineTimer = null;
    }

    init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    async loadSound(url, name) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            // This will fail for empty files, which is expected for now.
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.soundBuffers.set(name, audioBuffer);
        } catch (error) {
            console.warn(`Could not decode audio data for ${name}. This is a placeholder.`, error);
            this.soundBuffers.set(name, null); // Store null for placeholders
        }
    }

    async loadAllSounds() {
        await this.loadSound('sounds/kick.wav', 'kick');
        await this.loadSound('sounds/snare.wav', 'snare');
        await this.loadSound('sounds/hihat.wav', 'hihat');
        await this.loadSound('sounds/clap.wav', 'clap');
        await this.loadSound('sounds/tribal-perc.wav', 'tribal-perc');
    }

    play(soundName, time, options = {}) {
        // If the soundName is a number, it's a bass note frequency
        if (typeof soundName === 'number') {
            this.playBassNote(soundName, time);
            return;
        }

        // If we have a real buffer, play it. Otherwise, play a synth tone.
        if (this.soundBuffers.get(soundName)) {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.soundBuffers.get(soundName);
            source.connect(this.audioContext.destination);
            source.start(time);
            return;
        }

        // If we are playing a one-shot melody, options.y will be passed.
        if (soundName === 'melody' && options.y !== undefined) {
            this.playMelody(options.y, time);
            return;
        }

        // --- Fallback RHYTHM Oscillator Sound ---
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        let freq = 440;
        let decay = 0.1;

        switch (soundName) {
            case 'kick':
                freq = 100;
                decay = 0.2;
                osc.type = 'sine';
                break;
            case 'snare':
                freq = 250;
                decay = 0.15;
                osc.type = 'triangle';
                break;
            case 'hihat':
                freq = 2000;
                decay = 0.05;
                osc.type = 'square';
                break;
            case 'clap':
                freq = 800;
                decay = 0.1;
                osc.type = 'sawtooth';
                break;
            default:
                return; // Don't play unknown sounds
        }

        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.5, time); // Start with some volume
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay); // Decay

        osc.start(time);
        osc.stop(time + decay + 0.1);
    }

    playMelody(y, time) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        // Map y-coordinate to a note in the F# minor scale
        const noteIndex = y % this.fSharpMinorScale.length;
        const freq = this.fSharpMinorScale[noteIndex];
        const decay = 0.5; // Longer decay for melody

        osc.type = 'sawtooth'; // A classic synth sound
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.3, time); // Start with some volume
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        osc.start(time);
        osc.stop(time + decay + 0.1);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += 0.25 * secondsPerBeat; // Advance by a 16th note
        this.currentStep = (this.currentStep + 1) % this.totalSteps;
    }

    scheduleNote(step, time) {
        const soundToPlay = this.pattern[step];
        if (soundToPlay) {
            console.log(`Scheduling ${soundToPlay} at step ${step} for time ${time}`);
            this.play(soundToPlay, time);
        }
    }

    scheduler() {
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentStep, this.nextNoteTime);
            this.nextNote();
        }
    }

    start() {
        if (this.isPlaying) return;

        if (!this.audioContext) {
            this.init();
        }

        this.isPlaying = true;
        this.currentStep = 0;
        this.nextNoteTime = this.audioContext.currentTime;

        // Generate a new pattern each time we start
        this.pattern = this.markovChain.generatePattern(this.totalSteps);
        console.log("Generated Pattern:", this.pattern);

        this.scheduler(); // run immediately first time
        this.timerID = setInterval(() => this.scheduler(), this.lookahead);
    }

    stop() {
        this.isPlaying = false;
        clearInterval(this.timerID);
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
    }

    regeneratePattern() {
        this.pattern = this.markovChain.generatePattern(this.totalSteps);
        console.log("Pattern regenerated:", this.pattern);
    }

    playBassNote(freq, time) {
        const osc = this.audioContext.createOscillator();
        const filter = this.audioContext.createBiquadFilter();
        const gain = this.audioContext.createGain();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioContext.destination);

        // Sound Synthesis
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        // Filter Envelope
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, time);
        filter.frequency.linearRampToValueAtTime(300, time + 0.05);

        // Volume Envelope
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        osc.start(time);
        osc.stop(time + 0.2);
    }

    startBasslineMode() {
        clearTimeout(this.basslineTimer); // Clear any previous timer
        this.markovChain.setMode('bassline');
        this.regeneratePattern();

        // Switch back to rhythm mode after 16 beats
        const secondsPerBeat = 60.0 / this.bpm;
        const duration = 16 * 0.25 * secondsPerBeat;
        this.basslineTimer = setTimeout(() => this.stopBasslineMode(), duration * 1000);
    }

    stopBasslineMode() {
        this.markovChain.setMode('rhythm');
        this.regeneratePattern();
    }
}

const audioEngine = new AudioEngine();
