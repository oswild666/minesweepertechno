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
        this.chordModeTimer = null;
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
        if (!soundToPlay) return;

        console.log(`Scheduling ${soundToPlay} at step ${step} for time ${time}`);

        if (this.markovChain.mode === 'chords') {
            // It's a chord name string, like 'maj7'
            const rootMidi = 53; // F#3 as root
            this.playChord(soundToPlay, rootMidi, time);
        } else {
            // It's a rhythm sound name or a bass frequency
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
        // --- Main Synth Nodes ---
        const osc = this.audioContext.createOscillator();
        const filter = this.audioContext.createBiquadFilter();
        const gain = this.audioContext.createGain();

        // --- LFO Nodes for Filter Modulation ---
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();

        // --- Connections ---
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioContext.destination);

        // LFO connection
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);


        // --- Sound Synthesis ---
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        // --- LFO Configuration ---
        lfo.type = 'sine';
        lfo.frequency.value = 4; // 4 Hz wobble
        lfoGain.gain.value = 50; // Modulate by +/- 50 Hz

        // --- Filter Envelope ---
        filter.type = 'lowpass';
        // Base frequency is set, LFO will modulate around this
        filter.frequency.setValueAtTime(300, time);
        // The initial "pluck" from the envelope is now removed to favor LFO modulation.
        // We can add it back if needed, but for now, let's hear the LFO.

        // --- Volume Envelope ---
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        // --- Start & Stop ---
        osc.start(time);
        lfo.start(time);
        osc.stop(time + 0.2);
        lfo.stop(time + 0.2);
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

    startEmergencyMode() {
        this.stop(); // Stop the main sequencer

        const osc = this.audioContext.createOscillator();
        const distortion = this.audioContext.createWaveShaper();
        const gain = this.audioContext.createGain();

        // Create a distortion curve
        const amount = 400;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = i * 2 / n_samples - 1;
            curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
        }
        distortion.curve = curve;
        distortion.oversample = '4x';

        osc.connect(distortion);
        distortion.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, this.audioContext.currentTime);

        gain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.5);

        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + 1.5);
    }

    playFmNote(carrierFreq, time) {
        const carrier = this.audioContext.createOscillator();
        const modulator = this.audioContext.createOscillator();
        const modulatorGain = this.audioContext.createGain();
        const masterGain = this.audioContext.createGain();

        // Connections
        modulator.connect(modulatorGain);
        modulatorGain.connect(carrier.frequency);
        carrier.connect(masterGain);
        masterGain.connect(this.audioContext.destination);

        // --- FM Synthesis Parameters ---
        const modRatio = 1.4; // Classic E. Piano sound
        const modIndex = carrierFreq * 1.5;
        const decay = 1.0;

        // Modulator setup
        modulator.frequency.value = carrierFreq * modRatio;
        modulatorGain.gain.setValueAtTime(modIndex, time);
        modulatorGain.gain.exponentialRampToValueAtTime(0.001, time + decay * 0.8);

        // Carrier setup
        carrier.frequency.value = carrierFreq;
        carrier.type = 'sine';

        // Master Volume Envelope
        masterGain.gain.setValueAtTime(0.3, time); // Chords can be loud, lower the gain
        masterGain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        // Start & Stop
        modulator.start(time);
        carrier.start(time);
        modulator.stop(time + decay);
        carrier.stop(time + decay);
    }

    playChord(chordName, rootMidi, time) {
        const chordFrequencies = CHORD_LIBRARY.getChordFrequencies(rootMidi, chordName);
        if (chordFrequencies) {
            chordFrequencies.forEach(freq => {
                this.playFmNote(freq, time);
            });
        }
    }

    startChordMode() {
        clearTimeout(this.chordModeTimer);
        this.markovChain.setMode('chords');
        this.regeneratePattern();

        const secondsPerBeat = 60.0 / this.bpm;
        const duration = 16 * 0.25 * secondsPerBeat;
        this.chordModeTimer = setTimeout(() => this.stopChordMode(), duration * 1000);
    }

    stopChordMode() {
        this.markovChain.setMode('rhythm');
        this.regeneratePattern();
    }
}

const audioEngine = new AudioEngine();
