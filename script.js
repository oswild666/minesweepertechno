document.addEventListener('DOMContentLoaded', () => {
    const gameBoard = document.getElementById('game-board');
    const ROWS = 16;
    const COLS = 16;
    const MINES_COUNT = 40;

    const MINE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22px" height="22px" fill="#DAA520"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1s.45-1 1-1h12c.55 0 1 .45 1 1z"/></svg>`;
    const FLAG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18px" height="18px" fill="#B71C1C"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>`;


    let board = [];
    let gameOver = false;

    function createBoard() {
        for (let row = 0; row < ROWS; row++) {
            board[row] = [];
            for (let col = 0; col < COLS; col++) {
                board[row][col] = {
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    adjacentMines: 0
                };
            }
        }

        let minesPlaced = 0;
        while (minesPlaced < MINES_COUNT) {
            const row = Math.floor(Math.random() * ROWS);
            const col = Math.floor(Math.random() * COLS);
            if (!board[row][col].isMine) {
                board[row][col].isMine = true;
                minesPlaced++;
            }
        }

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (!board[row][col].isMine) {
                    let mineCount = 0;
                    for (let i = -1; i <= 1; i++) {
                        for (let j = -1; j <= 1; j++) {
                            if (i === 0 && j === 0) continue;
                            const newRow = row + i;
                            const newCol = col + j;
                            if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS && board[newRow][newCol].isMine) {
                                mineCount++;
                            }
                        }
                    }
                    board[row][col].adjacentMines = mineCount;
                }
            }
        }
    }

    function revealCell(row, col) {
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS || board[row][col].isRevealed || board[row][col].isFlagged) {
            return;
        }

        board[row][col].isRevealed = true;

        if (board[row][col].isMine) {
            endGame();
            return;
        }

        // --- Update Markov Chain based on game event ---
        audioEngine.markovChain.updateMatrix(board[row][col].adjacentMines);
        if (audioEngine.isPlaying) {
            audioEngine.regeneratePattern();
        }
        // Play a melodic note based on the cell's y-position
        audioEngine.play('melody', 0, { y: row });
        // ---------------------------------------------

        if (board[row][col].adjacentMines === 0) {
            // If an empty cell is revealed, trigger the bassline mode
            audioEngine.startBasslineMode();
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    if (i === 0 && j === 0) continue;
                    revealCell(row + i, col + j);
                }
            }
        }
    }

    function endGame() {
        gameOver = true;
        board.forEach(row => row.forEach(cell => {
            if (cell.isMine) {
                cell.isRevealed = true;
            }
        }));
        renderBoard();
        setTimeout(() => alert("Game Over!"), 100);
    }

    function handleCellClick(event) {
        if (gameOver) return;

        const target = event.target.closest('.cell');
        if (!target) return;

        const row = parseInt(target.dataset.row, 10);
        const col = parseInt(target.dataset.col, 10);

        revealCell(row, col);
        if (!gameOver) {
            renderBoard();
            checkWinCondition();
        }
    }

    function checkWinCondition() {
        let revealedCount = 0;
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (board[row][col].isRevealed && !board[row][col].isMine) {
                    revealedCount++;
                }
            }
        }

        if (revealedCount === (ROWS * COLS) - MINES_COUNT) {
            gameOver = true;
            setTimeout(() => alert("You Win!"), 100);
        }
    }

    function renderBoard() {
        gameBoard.innerHTML = '';
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = row;
                cell.dataset.col = col;

                const cellData = board[row][col];

                if (cellData.isRevealed) {
                    cell.classList.add('revealed');
                    if (cellData.isMine) {
                        cell.innerHTML = MINE_ICON;
                        cell.classList.add('mine');
                    } else if (cellData.adjacentMines > 0) {
                        cell.textContent = cellData.adjacentMines;
                        cell.classList.add(`c${cellData.adjacentMines}`);
                    }
                } else if (cellData.isFlagged) {
                    cell.innerHTML = FLAG_ICON;
                    cell.classList.add('flagged');
                }

                gameBoard.appendChild(cell);
            }
        }
    }

    function handleContextMenu(event) {
        if (gameOver) return;
        event.preventDefault();

        const target = event.target.closest('.cell');
        if (!target) return;

        const row = parseInt(target.dataset.row, 10);
        const col = parseInt(target.dataset.col, 10);

        if (board[row][col].isRevealed) return;

        board[row][col].isFlagged = !board[row][col].isFlagged;
        renderBoard();
    }

    const startStopBtn = document.getElementById('start-stop-btn');
    const restartBtn = document.getElementById('restart-btn');

    function restartGame() {
        // Stop the sequencer if it's playing
        if (audioEngine.isPlaying) {
            audioEngine.stop();
            startStopBtn.textContent = 'Start';
        }
        gameOver = false;
        createBoard();
        renderBoard();
    }

    startStopBtn.addEventListener('click', () => {
        audioEngine.togglePlayback();
        if (audioEngine.isPlaying) {
            startStopBtn.textContent = 'Stop';
        } else {
            startStopBtn.textContent = 'Start';
        }
    });

    restartBtn.addEventListener('click', restartGame);

    // Load sounds and then create the board
    audioEngine.loadAllSounds().then(() => {
        console.log("All sounds loaded/registered.");
        createBoard();
        renderBoard();
    });

    gameBoard.addEventListener('click', handleCellClick);
    gameBoard.addEventListener('contextmenu', handleContextMenu);
});
