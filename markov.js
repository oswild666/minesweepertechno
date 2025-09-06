class MarkovChainGenerator {
    constructor() {
        this.states = ['kick', 'snare', 'hihat', 'clap', 'tribal-perc', null];
        this.transitionMatrix = {
            // Probabilities of transitioning from state (row) to state (col)
            'kick':        { 'kick': 0.05, 'snare': 0.3, 'hihat': 0.4, 'clap': 0.0, 'tribal-perc': 0.05, null: 0.2 },
            'snare':       { 'kick': 0.4, 'snare': 0.0, 'hihat': 0.4, 'clap': 0.0, 'tribal-perc': 0.0, null: 0.2 },
            'hihat':       { 'kick': 0.1, 'snare': 0.3, 'hihat': 0.1, 'clap': 0.1, 'tribal-perc': 0.2, null: 0.2 },
            'clap':        { 'kick': 0.3, 'snare': 0.0, 'hihat': 0.5, 'clap': 0.0, 'tribal-perc': 0.0, null: 0.2 },
            'tribal-perc': { 'kick': 0.1, 'snare': 0.1, 'hihat': 0.4, 'clap': 0.1, 'tribal-perc': 0.1, null: 0.2 },
            null:          { 'kick': 0.5, 'snare': 0.1, 'hihat': 0.3, 'clap': 0.0, 'tribal-perc': 0.0, null: 0.1 },
        };
    }

    chooseNextState(currentState) {
        const probabilities = this.transitionMatrix[currentState];
        if (!probabilities) {
            return null; // Should not happen if matrix is well-defined
        }

        const rand = Math.random();
        let cumulativeProb = 0;

        for (const state in probabilities) {
            cumulativeProb += probabilities[state];
            if (rand < cumulativeProb) {
                // The 'null' state in the matrix becomes a real null in the pattern
                return state === 'null' ? null : state;
            }
        }
        return null; // Fallback
    }

    generatePattern(length = 16) {
        const pattern = [];
        // Always start with a kick on the first beat
        let currentState = 'kick';
        pattern.push(currentState);

        for (let i = 1; i < length; i++) {
            // To ensure a steady beat, we can force a kick on certain steps
            if (i % 4 === 0) {
                 currentState = 'kick';
            } else {
                 currentState = this.chooseNextState(currentState);
            }
            pattern.push(currentState);
        }
        return pattern;
    }

    updateMatrix(adjacentMines) {
        console.log(`Updating matrix based on adjacent mines: ${adjacentMines}`);

        // Note: This is a simplified implementation. A robust version would
        // ensure probabilities don't exceed 1.0 or go below 0.0 and would
        // normalize the rows more carefully. This is for demonstration.

        const increase = 0.1; // A small, safe amount to increase by

        if (adjacentMines === 0) {
            // More kick focus
            this.adjustProbability('null', 'kick', increase);
        } else if (adjacentMines >= 1 && adjacentMines <= 2) {
            // UK funky syncopation
            this.adjustProbability('kick', 'hihat', increase);
            this.adjustProbability('snare', 'hihat', increase); // Snare -> clap is not in the matrix, using hihat
        } else if (adjacentMines >= 3 && adjacentMines <= 5) {
            // Tribal layers
            this.adjustProbability('hihat', 'tribal-perc', increase);
        } else if (adjacentMines >= 6) {
            // Chaos
            this.adjustProbability('snare', 'tribal-perc', increase);
            this.adjustProbability('kick', 'snare', increase);
        }

        console.log("Updated Matrix:", this.transitionMatrix);
    }

    adjustProbability(fromState, toState, change) {
        const row = this.transitionMatrix[fromState];
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
