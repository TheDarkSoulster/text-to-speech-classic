// ===== STATE MANAGEMENT =====
let voices = [];
let currentUtterance = null;
let isPaused = false;
let history = [];
const MAX_HISTORY = 10;

// ===== DOM ELEMENTS =====
const textInput = document.getElementById('textInput');
const charCount = document.getElementById('charCount');
const voiceSelect = document.getElementById('voiceSelect');
const rateControl = document.getElementById('rateControl');
const rateValue = document.getElementById('rateValue');
const pitchControl = document.getElementById('pitchControl');
const pitchValue = document.getElementById('pitchValue');
const volumeControl = document.getElementById('volumeControl');
const volumeValue = document.getElementById('volumeValue');
const playButton = document.getElementById('playButton');
const pauseButton = document.getElementById('pauseButton');
const resumeButton = document.getElementById('resumeButton');
const stopButton = document.getElementById('stopButton');
const clearButton = document.getElementById('clearButton');
const visualizer = document.getElementById('visualizer');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = statusIndicator.querySelector('.status-text');
const historyList = document.getElementById('historyList');
const clearHistory = document.getElementById('clearHistory');

// ===== INITIALIZATION =====
function init() {
    loadVoices();
    loadHistory();
    attachEventListeners();
    updateCharCount();
    
    // Load voices when they change (some browsers load asynchronously)
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }
}

// ===== VOICE LOADING =====
function loadVoices() {
    voices = speechSynthesis.getVoices();
    
    if (voices.length === 0) {
        setTimeout(loadVoices, 100);
        return;
    }
    
    voiceSelect.innerHTML = '';
    
    // Group voices by language
    const voicesByLang = {};
    voices.forEach(voice => {
        const lang = voice.lang.split('-')[0];
        if (!voicesByLang[lang]) {
            voicesByLang[lang] = [];
        }
        voicesByLang[lang].push(voice);
    });
    
    // Create optgroups by language
    Object.keys(voicesByLang).sort().forEach(lang => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = lang.toUpperCase();
        
        voicesByLang[lang].forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} ${voice.localService ? '(Local)' : '(Remote)'}`;
            
            // Select default English voice
            if (voice.lang.startsWith('en') && voice.default) {
                option.selected = true;
            }
            
            optgroup.appendChild(option);
        });
        
        voiceSelect.appendChild(optgroup);
    });
}

// ===== EVENT LISTENERS =====
function attachEventListeners() {
    // Text input
    textInput.addEventListener('input', updateCharCount);
    
    // Control sliders
    rateControl.addEventListener('input', (e) => {
        rateValue.textContent = e.target.value;
    });
    
    pitchControl.addEventListener('input', (e) => {
        pitchValue.textContent = e.target.value;
    });
    
    volumeControl.addEventListener('input', (e) => {
        volumeValue.textContent = e.target.value;
    });
    
    // Playback buttons
    playButton.addEventListener('click', speak);
    pauseButton.addEventListener('click', pause);
    resumeButton.addEventListener('click', resume);
    stopButton.addEventListener('click', stop);
    clearButton.addEventListener('click', clearText);
    
    // Quick phrases
    document.querySelectorAll('.phrase-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const phrase = e.target.dataset.phrase;
            textInput.value = phrase;
            updateCharCount();
            textInput.focus();
        });
    });
    
    // History
    clearHistory.addEventListener('click', () => {
        if (confirm('Clear all history?')) {
            history = [];
            saveHistory();
            renderHistory();
        }
    });
}

// ===== CHARACTER COUNTER =====
function updateCharCount() {
    const count = textInput.value.length;
    charCount.textContent = count;
    
    if (count > 4500) {
        charCount.style.color = 'var(--color-warning)';
    } else if (count === 5000) {
        charCount.style.color = 'var(--color-error)';
    } else {
        charCount.style.color = 'var(--color-text-tertiary)';
    }
}

// ===== SPEECH SYNTHESIS =====
function speak() {
    const text = textInput.value.trim();
    if (!text) return;

    speechSynthesis.cancel();

    setTimeout(() => {
        currentUtterance = new SpeechSynthesisUtterance(text);
    
    if (!text) {
        alert('Please enter some text to speak.');
        return;
    }
    
    // Stop any ongoing speech
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    // Create utterance
    currentUtterance = new SpeechSynthesisUtterance(text);
    
    // Set voice
    const selectedVoice = voices.find(voice => voice.name === voiceSelect.value);
    if (selectedVoice) {
        currentUtterance.voice = selectedVoice;
    }
    
    // Set parameters
    currentUtterance.rate = parseFloat(rateControl.value);
    currentUtterance.pitch = parseFloat(pitchControl.value);
    currentUtterance.volume = parseFloat(volumeControl.value) / 100;
    
    // Event handlers
    currentUtterance.onstart = () => {
        updateStatus('speaking', 'Speaking...');
        updateButtonStates(true);
        visualizer.classList.add('active');
    };
    
    currentUtterance.onend = () => {
        updateStatus('ready', 'Ready');
        updateButtonStates(false);
        visualizer.classList.remove('active');
        isPaused = false;
        
        // Add to history
        addToHistory(text);
    };
    
    currentUtterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        updateStatus('ready', 'Error occurred');
        updateButtonStates(false);
        visualizer.classList.remove('active');
    };
    
    // Speak
    speechSynthesis.speak(currentUtterance);
    isPaused = false;
}}

function pause() {
    if (speechSynthesis.speaking && !isPaused) {
        speechSynthesis.pause();
        isPaused = true;
        updateStatus('paused', 'Paused');
        pauseButton.disabled = true;
        resumeButton.disabled = false;
        visualizer.classList.remove('active');
    }
}

function resume() {
    if (speechSynthesis.paused && isPaused) {
        speechSynthesis.resume();
        isPaused = false;
        updateStatus('speaking', 'Speaking...');
        pauseButton.disabled = false;
        resumeButton.disabled = true;
        visualizer.classList.add('active');
    }
}

function stop() {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        updateStatus('ready', 'Stopped');
        updateButtonStates(false);
        visualizer.classList.remove('active');
        isPaused = false;
    }
}

function clearText() {
    textInput.value = '';
    updateCharCount();
    textInput.focus();
}

// ===== UI UPDATES =====
function updateStatus(state, text) {
    statusText.textContent = text;
    statusIndicator.className = 'status-indicator';
    if (state !== 'ready') {
        statusIndicator.classList.add(state);
    }
}

function updateButtonStates(speaking) {
    playButton.disabled = speaking;
    pauseButton.disabled = !speaking || isPaused;
    resumeButton.disabled = !isPaused;
    stopButton.disabled = !speaking;
}

// ===== HISTORY MANAGEMENT =====
function addToHistory(text) {
    // Check if text already exists in history
    const existingIndex = history.findIndex(item => item.text === text);
    
    if (existingIndex !== -1) {
        // Move to top
        const item = history.splice(existingIndex, 1)[0];
        history.unshift(item);
    } else {
        // Add new item
        history.unshift({
            text: text,
            timestamp: new Date().toISOString()
        });
        
        // Limit history size
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }
    }
    
    saveHistory();
    renderHistory();
}

function saveHistory() {
    try {
        localStorage.setItem('voicelab_history', JSON.stringify(history));
    } catch (e) {
        console.error('Failed to save history:', e);
    }
}

function loadHistory() {
    try {
        const saved = localStorage.getItem('voicelab_history');
        if (saved) {
            history = JSON.parse(saved);
            renderHistory();
        }
    } catch (e) {
        console.error('Failed to load history:', e);
        history = [];
    }
}

function renderHistory() {
    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-state">No history yet. Start speaking!</p>';
        return;
    }
    
    historyList.innerHTML = '';
    
    history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'history-text';
        textDiv.textContent = item.text.length > 150 
            ? item.text.substring(0, 150) + '...' 
            : item.text;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'history-actions';
        
        // Use button
        const useBtn = document.createElement('button');
        useBtn.className = 'history-btn';
        useBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
        useBtn.title = 'Use this text';
        useBtn.onclick = (e) => {
            e.stopPropagation();
            textInput.value = item.text;
            updateCharCount();
            textInput.focus();
        };
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'history-btn';
        deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            history.splice(index, 1);
            saveHistory();
            renderHistory();
        };
        
        actionsDiv.appendChild(useBtn);
        actionsDiv.appendChild(deleteBtn);
        
        historyItem.appendChild(textDiv);
        historyItem.appendChild(actionsDiv);
        
        // Click to use
        historyItem.onclick = () => {
            textInput.value = item.text;
            updateCharCount();
            textInput.focus();
        };
        
        historyList.appendChild(historyItem);
    });
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to speak
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!playButton.disabled) {
            speak();
        }
    }
    
    // Escape to stop
    if (e.key === 'Escape') {
        e.preventDefault();
        stop();
    }
});

// ===== START APPLICATION =====
init();

// ===== PREVENT UNLOAD DURING SPEECH =====
window.addEventListener('beforeunload', (e) => {
    if (speechSynthesis.speaking) {
        e.preventDefault();
        e.returnValue = '';
    }
});
