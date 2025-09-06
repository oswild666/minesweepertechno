const CHORD_LIBRARY = (() => {
    const chordIntervals = {
        // --- 7th Chords ---
        'maj7': [0, 4, 7, 11], // Major 7th
        'dom7': [0, 4, 7, 10], // Dominant 7th
        'min7': [0, 3, 7, 10], // Minor 7th

        // --- 9th Chords ---
        'dom9': [0, 4, 7, 10, 14], // Dominant 9th

        // --- Other ---
        'dim7': [0, 3, 6, 9], // Diminished 7th
        'aug':  [0, 4, 8],     // Augmented triad
    };

    /**
     * Converts a MIDI note number to a frequency in Hz.
     * @param {number} midi - The MIDI note number (e.g., 69 for A4).
     * @returns {number} The frequency in Hz.
     */
    function midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    /**
     * Generates an array of frequencies for a given chord.
     * @param {number} rootMidi - The MIDI note number for the root of the chord.
     * @param {string} type - The type of chord (e.g., 'maj7', 'dim7').
     * @returns {number[] | null} An array of frequencies, or null if the type is unknown.
     */
    function getChordFrequencies(rootMidi, type) {
        const intervals = chordIntervals[type];
        if (!intervals) {
            console.error(`Unknown chord type: ${type}`);
            return null;
        }

        return intervals.map(interval => midiToFreq(rootMidi + interval));
    }

    // Expose the public methods
    return {
        getChordFrequencies,
        getAvailableChordTypes: () => Object.keys(chordIntervals),
    };
})();
