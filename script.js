// Game Configuration
const WORD_CHANGE_INTERVAL = 60; // 1 minute
const TIME_PENALTY = 5;
const MAX_WORD_CHANGES = 3; // Maximum number of word changes before game over
const FINAL_COUNTDOWN = 60; // 1 minute countdown after last word change

// Game State
let secretWord = "";
let currentRow = 0;
let currentTile = 0;
let gameOver = false;
let timeLeft = WORD_CHANGE_INTERVAL;
let timer;
let stats = { wins: 0, streak: 0 };
let wordList = [];
let lockedLetters = new Set();
let guessHistory = [];
let previousGuesses = [];
let gameStarted = false;
let wordChangeCount = 0; // Track number of word changes
let isFinalCountdown = false; // Track if we're in the final countdown

// DOM Elements
const board = document.getElementById("board");
const timerDisplay = document.querySelector(".timer");
const messageDisplay = document.querySelector(".message");
const modal = document.getElementById("modal");
const rulesModal = document.getElementById("rules-modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const playAgainButton = document.getElementById("play-again");
const newGameButton = document.getElementById("new-game");
const startGameButton = document.getElementById("start-game");
const startGameFromRulesButton = document.getElementById("start-game-from-rules");
const winsDisplay = document.getElementById("wins");
const streakDisplay = document.getElementById("streak");
const wordChangesDisplay = document.getElementById("word-changes");
const gameInfo = document.querySelector(".game-info");
const keyboard = document.querySelector(".keyboard");
const wordChangeNotice = document.querySelector(".word-change-notice");

// Load words from file
async function loadWordList() {
    try {
        const response = await fetch('words.txt');
        const text = await response.text();
        wordList = text.split('\n').map(word => word.trim()).filter(word => word.length === 5);
        return true;
    } catch (error) {
        console.error('Error loading word list:', error);
        return false;
    }
}

// Initialize Game
async function initGame() {
    if (wordList.length === 0) {
        const success = await loadWordList();
        if (!success) {
            showModal('Error', 'Failed to load word list. Please try again.');
            return;
        }
    }
    
    // Hide the start game button and show the rules modal
    startGameButton.style.display = "none";
    rulesModal.style.display = "flex";
}

// Timer Logic
function updateTimer() {
    timeLeft -= 0.1;
    timerDisplay.textContent = Math.ceil(timeLeft);
    
    // Update timer color based on remaining time
    if (timeLeft <= 10) {
        timerDisplay.classList.add('critical');
        timerDisplay.classList.remove('warning');
    } else if (timeLeft <= 20) {
        timerDisplay.classList.add('warning');
        timerDisplay.classList.remove('critical');
    }
    
    if (timeLeft <= 0) {
        wordChangeCount++; // Increment word change counter
        wordChangesDisplay.textContent = `${wordChangeCount}/${MAX_WORD_CHANGES}`; // Update display
        
        // Check if we've reached maximum word changes
        if (wordChangeCount >= MAX_WORD_CHANGES && !isFinalCountdown) {
            isFinalCountdown = true;
            timeLeft = FINAL_COUNTDOWN;
            timerDisplay.classList.remove('warning', 'critical');
            messageDisplay.textContent = "Final minute! Game ends when timer reaches zero!";
            return;
        }
        
        // If we're in final countdown and time runs out, end the game
        if (isFinalCountdown) {
            gameOver = true;
            clearInterval(timer);
            recordLoss();
            showModal("Game Over!", `Time's up! The word was ${secretWord}`);
            return;
        }
        
        // 1. Flash effect on empty tiles only
        document.querySelectorAll('.tile').forEach(tile => {
            if (!tile.textContent) { // Only flash empty tiles
                tile.classList.add('word-change-flash');
            }
        });
        
        // 2. Show word change notification with count
        wordChangeNotice.style.display = "flex";
        wordChangeNotice.querySelector('.word-change-text').textContent = `Word Changed! (${wordChangeCount}/${MAX_WORD_CHANGES})`;
        setTimeout(() => {
            wordChangeNotice.style.display = "none";
        }, 2500);
        
        // 3. Change the word (hidden from player)
        const oldWord = secretWord;
        secretWord = getNewWord(oldWord);
        
        // 4. Animate empty tiles (visual effect only)
        for (let i = 0; i < 5; i++) {
            if (oldWord[i] !== secretWord[i] && !lockedLetters.has(i)) {
                const tiles = document.querySelectorAll(`.row .tile:nth-child(${i + 1})`);
                tiles.forEach(tile => {
                    if (!tile.textContent) { // Only animate empty tiles
                        tile.classList.add('shifting');
                        setTimeout(() => {
                            tile.classList.remove('shifting');
                        }, 300);
                    }
                });
            }
        }
        
        // 5. Re-evaluate previous guesses against new word
        setTimeout(() => {
            for (let i = 0; i < previousGuesses.length; i++) {
                const feedback = checkGuess(previousGuesses[i]);
                displayFeedback(i, previousGuesses[i], feedback);
            }
        }, 500);
        
        // 6. Reset timer and styles
        timeLeft = WORD_CHANGE_INTERVAL;
        timerDisplay.classList.remove('warning', 'critical');
        
        // 7. Remove flash effects after animation
        setTimeout(() => {
            document.querySelectorAll('.tile').forEach(tile => {
                tile.classList.remove('word-change-flash');
            });
        }, 1000);
    }
}

function getNewWord(oldWord) {
    let newWord;
    do {
        newWord = wordList[Math.floor(Math.random() * wordList.length)];
    } while (newWord === oldWord);
    return newWord;
}

function animateWordChange(oldWord, newWord) {
    // Only animate the tiles, don't reveal letters
    for (let i = 0; i < 5; i++) {
        if (oldWord[i] !== newWord[i] && !lockedLetters.has(i)) {
            const tiles = document.querySelectorAll(`.row .tile:nth-child(${i + 1})`);
            tiles.forEach(tile => {
                // Only animate empty tiles (not yet guessed)
                if (tile.textContent === "") {
                    tile.classList.add('shifting');
                    setTimeout(() => {
                        tile.classList.remove('shifting');
                    }, 300);
                }
            });
        }
    }
}

// Game Logic
function submitGuess(guess) {
    if (currentTile !== 5) {
        messageDisplay.textContent = "Word too short!";
        return;
    }
    
    if (!isValidWord(guess)) {
        messageDisplay.textContent = "Not in word list!";
        timeLeft = Math.max(0, timeLeft - TIME_PENALTY);
        return;
    }
    
    previousGuesses.push(guess);
    const feedback = checkGuess(guess);
    guessHistory.push(feedback);
    displayFeedback(currentRow, guess, feedback);
    updateLockedLetters(guess, feedback);
    
    if (feedback.every(f => f === '🟩')) {
        gameOver = true;
        clearInterval(timer);
        recordWin();
        showModal("You Win!", `You guessed the word in ${currentRow + 1} attempts!`);
        return;
    }
    
    currentRow++;
    currentTile = 0;
    
    if (currentRow >= 6) {
        gameOver = true;
        clearInterval(timer);
        recordLoss();
        showModal("Game Over!", `The word was ${secretWord}`);
    }
}

// Helper Functions
function checkGuess(guess) {
    const feedback = [];
    const secretArray = secretWord.split('');
    const guessArray = guess.split('');
    
    for (let i = 0; i < 5; i++) {
        if (guessArray[i] === secretArray[i]) {
            feedback[i] = '🟩';
            secretArray[i] = null;
        }
    }
    
    for (let i = 0; i < 5; i++) {
        if (feedback[i] === '🟩') continue;
        const index = secretArray.indexOf(guessArray[i]);
        if (index !== -1) {
            feedback[i] = '🟨';
            secretArray[index] = null;
        } else {
            feedback[i] = '⬜';
        }
    }
    
    return feedback;
}

function displayFeedback(row, guess, feedback) {
    const rowElement = board.children[row];
    for (let i = 0; i < 5; i++) {
        const tile = rowElement.children[i];
        tile.textContent = guess[i];
        tile.className = 'tile';
        
        if (feedback[i] === '🟩') tile.classList.add('correct');
        else if (feedback[i] === '🟨') tile.classList.add('present');
        else tile.classList.add('absent');
    }
    updateKeyboardColors();
}

function updateKeyboardColors() {
    document.querySelectorAll('.key').forEach(key => {
        const letter = key.getAttribute('data-key');
        if (!letter || letter.length !== 1) return;
        
        let state = '';
        for (let row = 0; row <= currentRow; row++) {
            if (row >= board.children.length) continue;
            const rowElement = board.children[row];
            for (let col = 0; col < 5; col++) {
                if (col >= rowElement.children.length) continue;
                const tile = rowElement.children[col];
                if (tile.textContent === letter) {
                    if (tile.classList.contains('correct')) state = 'correct';
                    else if (tile.classList.contains('present') && state !== 'correct') state = 'present';
                    else if (tile.classList.contains('absent') && state !== 'correct' && state !== 'present') state = 'absent';
                }
            }
        }
        
        key.className = 'key';
        if (state === 'correct') key.classList.add('correct');
        else if (state === 'present') key.classList.add('present');
        else if (state === 'absent') key.classList.add('absent');
    });
}

// Event Listeners
startGameButton.addEventListener("click", initGame);
startGameFromRulesButton.addEventListener("click", () => {
    rulesModal.style.display = "none";
    startActualGame();
});
playAgainButton.addEventListener("click", initGame);
newGameButton.addEventListener("click", initGame);
document.getElementById('modal-close').addEventListener('click', () => {
    modal.style.display = 'none';
});

document.addEventListener("keydown", (e) => {
    if (!gameStarted || gameOver) return;
    
    if (e.key === "Enter") {
        submitGuess(getCurrentGuess());
    } else if (e.key === "Backspace") {
        if (currentTile > 0) {
            currentTile--;
            updateTile(currentRow, currentTile, "");
        }
    } else if (/^[a-zA-Z]$/.test(e.key)) {
        if (currentTile < 5) {
            updateTile(currentRow, currentTile, e.key.toUpperCase());
            currentTile++;
        }
    }
});

document.querySelectorAll('.key').forEach(key => {
    key.addEventListener('click', () => {
        if (!gameStarted || gameOver) return;
        const keyValue = key.getAttribute('data-key');
        
        if (keyValue === 'ENTER') {
            submitGuess(getCurrentGuess());
        } else if (keyValue === 'BACKSPACE') {
            if (currentTile > 0) {
                currentTile--;
                updateTile(currentRow, currentTile, "");
            }
        } else if (/^[A-Z]$/.test(keyValue)) {
            if (currentTile < 5) {
                updateTile(currentRow, currentTile, keyValue);
                currentTile++;
            }
        }
    });
});

// Utility Functions
function getCurrentGuess() {
    const row = board.children[currentRow];
    let guess = '';
    for (let i = 0; i < 5; i++) {
        guess += row.children[i].textContent;
    }
    return guess;
}

function updateTile(row, col, letter) {
    const tile = board.children[row].children[col];
    tile.textContent = letter;
}

function updateLockedLetters(guess, feedback) {
    for (let i = 0; i < feedback.length; i++) {
        if (feedback[i] === '🟩') lockedLetters.add(i);
    }
}

function isValidWord(word) {
    return wordList.includes(word);
}

function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = 'flex';
    playAgainButton.style.display = 'block';
}

function recordWin() {
    stats.wins++;
    stats.streak++;
    localStorage.setItem('wordleStats', JSON.stringify(stats));
    updateStatsDisplay();
}

function recordLoss() {
    stats.streak = 0;
    localStorage.setItem('wordleStats', JSON.stringify(stats));
    updateStatsDisplay();
}

function updateStatsDisplay() {
    winsDisplay.textContent = stats.wins;
    streakDisplay.textContent = stats.streak;
}

// Load stats on startup
function loadStats() {
    const savedStats = localStorage.getItem('wordleStats');
    if (savedStats) stats = JSON.parse(savedStats);
    updateStatsDisplay();
}

async function startActualGame() {
    secretWord = wordList[Math.floor(Math.random() * wordList.length)];
    currentRow = 0;
    currentTile = 0;
    gameOver = false;
    timeLeft = WORD_CHANGE_INTERVAL;
    wordChangeCount = 0;
    isFinalCountdown = false;
    wordChangesDisplay.textContent = `0/${MAX_WORD_CHANGES}`;
    lockedLetters.clear();
    guessHistory = [];
    previousGuesses = [];
    messageDisplay.textContent = "";
    
    board.innerHTML = "";
    for (let i = 0; i < 6; i++) {
        const row = document.createElement("div");
        row.className = "row";
        for (let j = 0; j < 5; j++) {
            const tile = document.createElement("div");
            tile.className = "tile";
            row.appendChild(tile);
        }
        board.appendChild(row);
    }
    
    board.style.display = "grid";
    gameInfo.style.display = "flex";
    keyboard.style.display = "flex";
    newGameButton.style.display = "block";
    modal.style.display = "none";
    wordChangeNotice.style.display = "none";
    
    clearInterval(timer);
    timer = setInterval(updateTimer, 100);
    timerDisplay.classList.remove('warning', 'critical');
    
    document.querySelectorAll('.key').forEach(key => {
        key.className = 'key';
        const keyValue = key.getAttribute('data-key');
        if (keyValue === 'ENTER') key.classList.add('correct');
        if (keyValue === 'BACKSPACE') key.classList.add('absent');
    });
    
    gameStarted = true;
}

// Load stats and show start button on page load
window.addEventListener('load', () => {
    loadStats();
    startGameButton.style.display = "block";
});