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

        this.pattern = ['kick', null, 'hihat', null, 'snare', null, 'hihat', null, 'kick', null, 'hihat', null, 'snare', 'clap', 'hihat', null];
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

    play(soundName, time) {
        if (!this.soundBuffers.has(soundName) || this.soundBuffers.get(soundName) === null) {
            // console.log(`Sound not loaded or placeholder: ${soundName}`);
            return; // Don't try to play null buffers
        }
        const source = this.audioContext.createBufferSource();
        source.buffer = this.soundBuffers.get(soundName);
        source.connect(this.audioContext.destination);
        source.start(time);
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
}

const audioEngine = new AudioEngine();
