class MarkovChainGenerator {
    constructor() {
        this.mode = 'rhythm'; // 'rhythm' or 'bassline'

        // --- Rhythm Mode Data ---
        this.rhythmStates = ['kick', 'snare', 'hihat', 'clap', 'tribal-perc', null];
        this.rhythmTransitionMatrix = {
            'kick':        { 'kick': 0.05, 'snare': 0.3, 'hihat': 0.4, 'clap': 0.0, 'tribal-perc': 0.05, null: 0.2 },
            'snare':       { 'kick': 0.4, 'snare': 0.0, 'hihat': 0.4, 'clap': 0.0, 'tribal-perc': 0.0, null: 0.2 },
            'hihat':       { 'kick': 0.1, 'snare': 0.3, 'hihat': 0.1, 'clap': 0.1, 'tribal-perc': 0.2, null: 0.2 },
            'clap':        { 'kick': 0.3, 'snare': 0.0, 'hihat': 0.5, 'clap': 0.0, 'tribal-perc': 0.0, null: 0.2 },
            'tribal-perc': { 'kick': 0.1, 'snare': 0.1, 'hihat': 0.4, 'clap': 0.1, 'tribal-perc': 0.1, null: 0.2 },
            null:          { 'kick': 0.5, 'snare': 0.1, 'hihat': 0.3, 'clap': 0.0, 'tribal-perc': 0.0, null: 0.1 },
        };

        // --- Bassline Mode Data (F# Minor: F#2, C#3, B2, A2) ---
        this.bassStates = [92.50, 138.59, 123.47, 110.00, null];
        this.bassTransitionMatrix = {
            92.50:  { 92.50: 0.1, 138.59: 0.4, 123.47: 0.2, 110.00: 0.1, null: 0.2 },
            138.59: { 92.50: 0.2, 138.59: 0.1, 123.47: 0.4, 110.00: 0.2, null: 0.1 },
            123.47: { 92.50: 0.3, 138.59: 0.2, 123.47: 0.1, 110.00: 0.3, null: 0.1 },
            110.00: { 92.50: 0.5, 138.59: 0.1, 123.47: 0.2, 110.00: 0.1, null: 0.1 },
            null:   { 92.50: 0.6, 138.59: 0.1, 123.47: 0.1, 110.00: 0.1, null: 0.1 },
        };
    }

    setMode(mode) {
        if (['rhythm', 'bassline'].includes(mode)) {
            this.mode = mode;
            console.log(`Markov chain mode set to: ${mode}`);
        }
    }

    chooseNextState(currentState) {
        const matrix = this.mode === 'bassline' ? this.bassTransitionMatrix : this.rhythmTransitionMatrix;
        const probabilities = matrix[currentState];
        if (!probabilities) return null;

        const rand = Math.random();
        let cumulativeProb = 0;

        for (const stateStr in probabilities) {
            cumulativeProb += probabilities[stateStr];
            if (rand < cumulativeProb) {
                const state = stateStr === 'null' ? null : (this.mode === 'bassline' ? parseFloat(stateStr) : stateStr);
                return state;
            }
        }
        return null;
    }

    generatePattern(length = 16) {
        const pattern = [];
        let currentState;

        if (this.mode === 'bassline') {
            // Start with the root note for basslines
            currentState = this.bassStates[0];
        } else {
            // Always start with a kick for rhythm
            currentState = 'kick';
        }
        pattern.push(currentState);

        for (let i = 1; i < length; i++) {
            if (this.mode === 'rhythm' && i % 4 === 0) {
                 currentState = 'kick';
            } else {
                 currentState = this.chooseNextState(currentState);
            }
            pattern.push(currentState);
        }
        return pattern;
    }

    updateMatrix(adjacentMines) {
        // For now, matrix updates only affect the rhythm mode.
        if (this.mode !== 'rhythm') return;

        console.log(`Updating rhythm matrix based on adjacent mines: ${adjacentMines}`);
        const increase = 0.1; // A small, safe amount to increase by

        if (adjacentMines === 0) {
            this.adjustProbability(this.rhythmTransitionMatrix, 'null', 'kick', increase);
        } else if (adjacentMines >= 1 && adjacentMines <= 2) {
            this.adjustProbability(this.rhythmTransitionMatrix, 'kick', 'hihat', increase);
            this.adjustProbability(this.rhythmTransitionMatrix, 'snare', 'hihat', increase);
        } else if (adjacentMines >= 3 && adjacentMines <= 5) {
            this.adjustProbability(this.rhythmTransitionMatrix, 'hihat', 'tribal-perc', increase);
        } else if (adjacentMines >= 6) {
            this.adjustProbability(this.rhythmTransitionMatrix, 'snare', 'tribal-perc', increase);
            this.adjustProbability(this.rhythmTransitionMatrix, 'kick', 'snare', increase);
        }

        console.log("Updated Rhythm Matrix:", this.rhythmTransitionMatrix);
    }

    adjustProbability(matrix, fromState, toState, change) {
        const row = matrix[fromState];
        if (!row || row[toState] === undefined) return;

        // Don't let probability exceed a reasonable limit
        if (row[toState] + change > 0.8) return;

        // Increase the target probability
        row[toState] += change;

        // Normalize the rest of the row
        let otherStatesTotal = 0;
        for (const state in row) {
            if (state !== toState) {
                otherStatesTotal += row[state];
            }
        }

        const scaleFactor = (1.0 - row[toState]) / otherStatesTotal;
        for (const state in row) {
            if (state !== toState) {
                row[state] *= scaleFactor;
            }
        }
    }
}
