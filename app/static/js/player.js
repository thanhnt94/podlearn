/**
 * AuraFlow — YouTube IFrame Player Controller
 *
 * Manages:
 *  - YouTube IFrame API embed + ready/state-change events
 *  - Playback time polling for karaoke sync
 *  - Language dropdown population + subtitle loading via API
 */

// ── Dynamic API Loading ────────────────────────────────────────
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
if(firstScriptTag) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
} else {
    document.head.appendChild(tag);
}

// ── State ────────────────────────────────────────────────────
let ytPlayer = null;
let isPlayerReady = false;
let timeUpdateInterval = null;
let abLoopA = null;
let abLoopB = null;
let isMarkedCompleted = false; // Initialized from server later

// Shadowing Mode State
let isShadowingMode = false;
let lastShadowedIndex = -1;
let shadowingPauseTimeout = null;

// Tracking State
let activeStudySeconds = 0;
let lastSyncTime = Date.now();
const SYNC_INTERVAL_MS = 30000; // 30 seconds


// Activity / AFK Logic

let lastActivityTime = Date.now();
let totalSessionSeconds = (typeof INITIAL_STUDY_TIME !== 'undefined') ? INITIAL_STUDY_TIME : 0;
const IDLE_THRESHOLD_MS = 60000; // 60 seconds

// Initialize UI Clock immediately
document.addEventListener('DOMContentLoaded', () => {
    updateSessionClock();
});

// Reset idle timer on any user interaction
['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, () => {
        lastActivityTime = Date.now();
    }, { passive: true });
});

// ── YouTube IFrame API callback (global) ─────────────────────
function onYouTubeIframeAPIReady() {
    // 4. Restore Shadowing Specifics
    if (typeof SHADOW_EXTRA !== 'undefined' && document.getElementById('optShadowExtra')) {
        document.getElementById('optShadowExtra').value = SHADOW_EXTRA;
        const valLabel = document.getElementById('valShadowExtra');
        if (valLabel) valLabel.textContent = SHADOW_EXTRA + 's';
        if (SAVED_SETTINGS.shadowing_hide_subs !== undefined && document.getElementById('toggleShadowHideSubs')) {
            document.getElementById('toggleShadowHideSubs').checked = SAVED_SETTINGS.shadowing_hide_subs;
        }
        if (SAVED_SETTINGS.shadow_accuracy && document.getElementById('optShadowAccuracy')) {
            document.getElementById('optShadowAccuracy').value = SAVED_SETTINGS.shadow_accuracy;
            document.getElementById('valShadowAccuracy').textContent = SAVED_SETTINGS.shadow_accuracy + '%';
        }
        if (SAVED_SETTINGS.shadow_language && document.getElementById('optShadowLanguage')) {
            document.getElementById('optShadowLanguage').value = SAVED_SETTINGS.shadow_language;
        }
        if (SAVED_SETTINGS.shadow_interactive !== undefined) {
            syncShadowInteractive(SAVED_SETTINGS.shadow_interactive);
        }
        
        // Show/Hide Toggles
    }

    console.log('[AuraFlow] UI State restored from saved config');
    console.log('[AuraFlow] YouTube IFrame API loaded');
    ytPlayer = new YT.Player('ytPlayer', {
        videoId: YOUTUBE_ID,
        width: '100%',
        height: '100%',
        playerVars: {
            autoplay: 0,
            modestbranding: 1,
            rel: 0,
            cc_load_policy: 0,
            iv_load_policy: 3,
            playsinline: 1,
            controls: 0,
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError,
        },
    });
}

async function onPlayerReady(event) {
    isPlayerReady = true;
    console.log('[AuraFlow] YouTube player ready');
    
    // Crucial: Wait for language lists to be populated from DB before restoring
    await loadAvailableLanguages();
    
    if (typeof initFromSaved === 'function') {
        try {
            initFromSaved();
        } catch (err) {
            console.error('[AuraFlow] initFromSaved error:', err);
        }
    }
    
    // Start active study time tracking loop
    setInterval(trackActiveStudyTime, 1000);
}




function onPlayerError(event) {
    console.error('[AuraFlow] YouTube player error:', event.data);
}

function onPlayerStateChange(event) {
    const overlay = document.getElementById('videoSubOverlay');
    const playIcon = document.getElementById('playIcon');

    if (event.data === YT.PlayerState.PLAYING) {
        startTimeUpdates();
        if (overlay) overlay.classList.remove('is-interactive');
        if (playIcon) {
            playIcon.setAttribute('data-lucide', 'pause');
            lucide.createIcons();
        }
    } else {
        stopTimeUpdates();
        if (playIcon) {
            playIcon.setAttribute('data-lucide', 'play');
            lucide.createIcons();
        }
        if (event.data === YT.PlayerState.PAUSED) {
            onTimeUpdate(ytPlayer.getCurrentTime());
            if (overlay) overlay.classList.add('is-interactive');
        } else {
            if (overlay) overlay.classList.remove('is-interactive');
        }
    }
}

// ── Time polling ─────────────────────────────────────────────
function startTimeUpdates() {
    stopTimeUpdates();
    timeUpdateInterval = setInterval(() => {
        if (ytPlayer && isPlayerReady) {
            const t = ytPlayer.getCurrentTime();
            onTimeUpdate(t);
        }
    }, 100);
}

function stopTimeUpdates() {
    if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
    }
}

function onTimeUpdate(currentTime) {
    // 1. Update Transcript Highlight
    if (typeof updateTranscriptHighlight === 'function') {
        updateTranscriptHighlight(currentTime);
    }
    // 2. Check Note Popups
    if (typeof checkNotePopup === 'function') {
        checkNotePopup(currentTime);
    }
    // 3. Update Custom Player UI
    updateCustomPlayerUI(currentTime);

    // ── Shadowing Mode Logic ─────────────────────────────────
    if (isShadowingMode && typeof mergedLines !== 'undefined' && mergedLines.length > 0) {
        // Find if we are currently at the end of a line
        const idx = mergedLines.findIndex(l => currentTime >= l.start && currentTime <= l.end);
        
        if (idx !== -1 && idx !== lastShadowedIndex) {
            const line = mergedLines[idx];
            // If we are within 0.2s of the end of this line, trigger pause
            if (currentTime >= line.end - 0.2) {
                lastShadowedIndex = idx;
                pauseForShadowing(line);
            }
        }
    }

    // ── A-B Repeat Logic ─────────────────────────────────────
    if (abLoopA !== null && abLoopB !== null) {
        if (currentTime >= abLoopB) {
            ytPlayer.seekTo(abLoopA, true);
        }
    }
}

function toggleShadowingMode() {
    // Dictation and Shadowing are mutually exclusive
    if (typeof isDictationMode !== 'undefined' && isDictationMode) {
        disableDictationMode();
    }

    isShadowingMode = !isShadowingMode;

    const btn = document.getElementById('btn-shadowing');
    const hud = document.getElementById('shadowingHUD');
    const transcriptLines = document.getElementById('transcriptLines');

    if (btn) {
        if (isShadowingMode) {
            btn.classList.add('btn--accent');
            if (transcriptLines) transcriptLines.classList.add('is-shadowing-mode');
            lastShadowedIndex = -1; // Reset to catch current line if needed
        } else {
            btn.classList.remove('btn--accent');
            if (transcriptLines) transcriptLines.classList.remove('is-shadowing-mode');
            if (shadowingPauseTimeout) {
                clearTimeout(shadowingPauseTimeout);
                shadowingPauseTimeout = null;
            }
            if (hud) {
                hud.classList.remove('active');
                hud.className = 'shadowing-hud'; // Reset all states
            }
        }
    }
}

let currentShadowingLine = null;
let shadowRecognition = null;
let isMinTimePassed = false;
let safetyTimeout = null;
let minTimeTimer = null;
let finalTranscript = '';

function syncShadowInteractive(checked) {
    const hudToggle = document.getElementById('toggleShadowInteractive');
    const modalToggle = document.getElementById('toggleShadowInteractiveModal');
    
    if (hudToggle) hudToggle.checked = checked;
    if (modalToggle) modalToggle.checked = checked;
    
    toggleShadowingTypeUI();
}

function toggleShadowingTypeUI() {
    const isInteractive = document.getElementById('toggleShadowInteractive')?.checked || false;
    if (micContainer) {
        if (isInteractive) micContainer.classList.add('active');
        else micContainer.classList.remove('active');
    }
    
    // If we were in the middle of a pause, toggle behavior
    if (isShadowingMode && currentShadowingLine) {
        if (isInteractive) {
            if (shadowingPauseTimeout) { clearTimeout(shadowingPauseTimeout); shadowingPauseTimeout = null; }
            startShadowSpeechRecognition();
        } else {
            // Re-trigger pause logic to start timer
            pauseForShadowing(currentShadowingLine);
        }
    }
}


function pauseForShadowing(line) {
    if (!ytPlayer || typeof ytPlayer.pauseVideo !== 'function') return;
    
    ytPlayer.pauseVideo();
    currentShadowingLine = line;
    
    const hud = document.getElementById('shadowingHUD');
    if (hud) {
        hud.classList.add('active');
        // Reset state classes
        hud.classList.remove('shadow-state-listening', 'shadow-state-processing', 'shadow-state-success', 'shadow-state-error');
        
        // Populate Flashcard hierarchy
        const targetEl = document.getElementById('shadowResultTarget');
        const guideEl = document.getElementById('shadowResultGuide');
        const translationEl = document.getElementById('shadowResultTranslation');

        if (targetEl) targetEl.textContent = line.texts[0] || "";
        if (guideEl) {
            guideEl.textContent = line.texts[1] || "";
            guideEl.style.display = line.texts[1] ? 'block' : 'none';
        }
        if (translationEl) {
            translationEl.textContent = line.texts[2] || "";
            translationEl.style.display = line.texts[2] ? 'block' : 'none';
        }

        document.getElementById('shadowSpeechStatus').textContent = 'READY';
        document.getElementById('shadowResultSpoken').textContent = '...';
        document.getElementById('btn-shadow-mic')?.classList.remove('active', 'listening', 'processing');
    }

    // Interactive switch
    const isInteractive = document.getElementById('toggleShadowInteractive')?.checked || false;
    const micContainer = document.querySelector('.sentence-card__actions'); // Updated reference
    if (micContainer) {
        if (isInteractive) micContainer.classList.add('active');
        else micContainer.classList.remove('active');
    }

    // Subtitles concealment
    const hideSubs = document.getElementById('toggleShadowHideSubs')?.checked || false;
    if (hideSubs) {
        const subOverlay = document.getElementById('videoSubOverlay');
        if (subOverlay) subOverlay.classList.add('is-hidden');
    }

    if (isInteractive) {
        if (shadowingPauseTimeout) { clearTimeout(shadowingPauseTimeout); shadowingPauseTimeout = null; }
        startShadowSpeechRecognition();
    } else {
        const sentenceDuration = line.end - line.start;
        const extraTime = parseFloat(document.getElementById('optShadowExtra')?.value) || 2.0;
        const pauseTimeMs = Math.max(1000, (sentenceDuration + extraTime) * 1000);
        
        if (shadowingPauseTimeout) clearTimeout(shadowingPauseTimeout);
        shadowingPauseTimeout = setTimeout(() => {
            resumeFromShadowing();
        }, pauseTimeMs);
    }
}

function resumeFromShadowing() {
    if (isShadowingMode && ytPlayer && typeof ytPlayer.playVideo === 'function') {
        ytPlayer.playVideo();
    }
    const hud = document.getElementById('shadowingHUD');
    if (hud) {
        hud.classList.remove('active');
        hud.className = 'shadowing-hud';
    }
    
    const subOverlay = document.getElementById('videoSubOverlay');
    if (subOverlay) subOverlay.classList.remove('is-hidden');

    shadowingPauseTimeout = null;
}

/**
 * AI Pronunciation Scoring via Web Speech API
 */
function startShadowSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Web Speech API is not supported in this browser. Please use Chrome.");
        return;
    }

    if (shadowRecognition) {
        try { shadowRecognition.abort(); } catch(e) {}
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    shadowRecognition = new SpeechRecognition();
    
    // Use the specific shadow language from options if available, else fallback
    const lang = document.getElementById('optShadowLanguage')?.value || (window.SAVED_ORIGINAL || 'ja');
    shadowRecognition.lang = lang;
    shadowRecognition.continuous = true;
    shadowRecognition.interimResults = false;

    const statusEl = document.getElementById('shadowSpeechStatus');
    const hud = document.getElementById('shadowingHUD');
    const micBtn = document.getElementById('btn-shadow-mic');
    const submitBtn = document.getElementById('btn-shadow-submit');
    const originalIcon = micBtn?.innerHTML;

    isMinTimePassed = false;
    finalTranscript = '';

    shadowRecognition.onstart = () => {
        statusEl.textContent = 'LISTENING...';
        hud?.classList.remove('shadow-state-processing', 'shadow-state-success', 'shadow-state-error');
        hud?.classList.add('shadow-state-listening');
        
        micBtn?.classList.remove('processing');
        micBtn?.classList.add('listening');
        if (submitBtn) submitBtn.classList.add('active');

        // Timer Logic
        const durationSec = (currentShadowingLine?.end - currentShadowingLine?.start) || 2;
        
        // Min Time: Don't allow speechend to stop until duration passes
        minTimeTimer = setTimeout(() => {
            isMinTimePassed = true;
            console.log("[ShadowAI] Min time passed. Speechend will now trigger stop.");
        }, durationSec * 1000);

        // Max Time: Auto-stop after double duration
        safetyTimeout = setTimeout(() => {
            console.log("[ShadowAI] Safety timeout reached.");
            forceStopRecognition();
        }, durationSec * 2 * 1000);
    };

    shadowRecognition.onspeechend = () => {
        if (isMinTimePassed) {
            console.log("[ShadowAI] Speechend triggered stop.");
            shadowRecognition.stop();
        }
    };

    shadowRecognition.onerror = (event) => {
        if (event.error === 'aborted') return;
        console.error("Speech Recognition Error:", event.error);
        statusEl.textContent = 'ERROR';
        hud?.classList.add('shadow-state-error');
        cleanupShadowRecognitionUI(originalIcon);
    };

    shadowRecognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
            }
        }
        // Update spoken text area
        const spokenEl = document.getElementById('shadowResultSpoken');
        if (spokenEl) spokenEl.textContent = finalTranscript;
    };

    shadowRecognition.onend = () => {
        cleanupShadowRecognitionUI(originalIcon);
        
        if (finalTranscript.trim()) {
            const originalText = currentShadowingLine?.texts[0] || "";
            calculatePronunciationScore(originalText, finalTranscript.trim(), lang);
        }
        
        // Final UI restoration
        if (micBtn) {
            micBtn.classList.remove('listening');
            micBtn.innerHTML = originalIcon;
        }
    };

    shadowRecognition.start();
}

function forceStopRecognition() {
    if (shadowRecognition) {
        try { shadowRecognition.stop(); } catch(e) {}
    }
}

function cancelShadowingMode() {
    if (shadowRecognition) {
        try { shadowRecognition.abort(); } catch(e) {}
    }
    
    // UI Cleanup
    const hud = document.getElementById('shadowingHUD');
    if (hud) {
        hud.classList.remove('active');
        hud.className = 'shadowing-hud';
    }
    
    const btn = document.getElementById('btn-shadowing');
    if (btn) btn.classList.remove('btn--accent');

    const transcriptLines = document.getElementById('transcriptLines');
    if (transcriptLines) transcriptLines.classList.remove('is-shadowing-mode');

    // Restoration
    const subOverlay = document.getElementById('videoSubOverlay');
    if (subOverlay) subOverlay.classList.remove('is-hidden');

    // Reset local state but KEEP isShadowingMode true so it pauses on next sentence
    // Wait, the user said "quay lại chế độ xem thường" which usually means turning OFF the mode toggle.
    isShadowingMode = false;
    currentShadowingLine = null;

    if (ytPlayer && ytPlayer.playVideo) {
        ytPlayer.playVideo();
    }
    
    cleanupShadowRecognitionUI(null);
}

function cleanupShadowRecognitionUI(originalIcon) {
    const micBtn = document.getElementById('btn-shadow-mic');
    const submitBtn = document.getElementById('btn-shadow-submit');
    
    micBtn?.classList.remove('listening');
    if (submitBtn) submitBtn.classList.remove('active');
    
    clearTimeout(minTimeTimer);
    clearTimeout(safetyTimeout);
}


async function calculatePronunciationScore(original, spoken, langCode) {
    const statusEl = document.getElementById('shadowSpeechStatus');
    const hud = document.getElementById('shadowingHUD');

    if (statusEl) statusEl.textContent = 'PROCESSING...';
    hud?.classList.remove('shadow-state-listening');
    hud?.classList.add('shadow-state-processing');

    try {
        const response = await fetch('/api/score-pronunciation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                original_text: original,
                spoken_text: spoken,
                lang_code: langCode,
                lesson_id: LESSON_ID,
                start_time: currentShadowingLine?.start,
                end_time: currentShadowingLine?.end
            })
        });

        const data = await response.json();
        const score = data.score || 0;
        const threshold = parseFloat(document.getElementById('optShadowAccuracy')?.value) || 80;

        // NEW: Diff Calculation
        const finalTarget = data.original_text || original;
        const finalSpoken = spoken;
        const highlightedHtml = renderShadowDiffHTML(finalTarget, finalSpoken);

        // Update UI Text
        const spokenEl = document.getElementById('shadowResultSpoken');
        const targetEl = document.getElementById('shadowResultTarget');

        if (spokenEl) spokenEl.innerHTML = highlightedHtml;
        if (targetEl) targetEl.textContent = finalTarget;

        if (score >= threshold) {
            if (statusEl) statusEl.textContent = `EXCELLENT`;
            hud?.classList.remove('shadow-state-processing', 'shadow-state-error');
            hud?.classList.add('shadow-state-success');
            
            setTimeout(resumeFromShadowing, 1200);
        } else {
            if (statusEl) statusEl.textContent = `RETRY`;
            hud?.classList.remove('shadow-state-processing', 'shadow-state-success');
            hud?.classList.add('shadow-state-error');
        }
    } catch (err) {
        console.error("[ShadowAI] Analysis failed:", err);
        if (statusEl) statusEl.textContent = "AI ANALYSIS FAILED";
        hud?.classList.remove('shadow-state-processing');
        hud?.classList.add('shadow-state-error');
    }
}

/**
 * Replay the original audio segment of the active sentence
 */
function playOriginalAudio() {
    if (ytPlayer && isPlayerReady && currentShadowingLine) {
        ytPlayer.seekTo(currentShadowingLine.start, true);
        ytPlayer.playVideo();
    }
}

/**
 * ── Word-Level Diff Utility ─────────────────────────────────
 */
function renderShadowDiffHTML(target, spoken) {
    const targetWords = target.split(/\s+/).filter(Boolean);
    const spokenWords = spoken.split(/\s+/).filter(Boolean);

    // 1. Simple LCS-based Diff
    const matrix = Array(targetWords.length + 1).fill().map(() => Array(spokenWords.length + 1).fill(0));
    
    for (let i = 1; i <= targetWords.length; i++) {
        for (let j = 1; j <= spokenWords.length; j++) {
            if (normalizeWord(targetWords[i-1]) === normalizeWord(spokenWords[j-1])) {
                matrix[i][j] = matrix[i-1][j-1] + 1;
            } else {
                matrix[i][j] = Math.max(matrix[i-1][j], matrix[i][j-1]);
            }
        }
    }

    // 2. Backtrack to find differences
    let i = targetWords.length, j = spokenWords.length;
    const result = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && normalizeWord(targetWords[i-1]) === normalizeWord(spokenWords[j-1])) {
            result.unshift({ type: 'correct', value: spokenWords[j-1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || matrix[i][j-1] >= matrix[i-1][j])) {
            result.unshift({ type: 'wrong', value: spokenWords[j-1] });
            j--;
        } else {
            result.unshift({ type: 'missing', value: targetWords[i-1] });
            i--;
        }
    }

    // 3. Render HTML
    return result.map(token => {
        if (token.type === 'correct') return `<span class="word-correct">${token.value}</span>`;
        if (token.type === 'wrong') return `<span class="word-wrong">${token.value}</span>`;
        if (token.type === 'missing') return `<span class="word-missing">${token.value}</span>`;
        return token.value;
    }).join(' ');
}

function normalizeWord(word) {
    return word.replace(/[.,!?;:()]/g, "").toLowerCase();
}







// ── Seek ─────────────────────────────────────────────────────
function togglePlayPause() {
    if (!ytPlayer) return;
    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
    } else {
        ytPlayer.playVideo();
    }
}

function seekRelative(seconds) {
    if (!ytPlayer) return;
    const cur = ytPlayer.getCurrentTime();
    ytPlayer.seekTo(cur + seconds, true);
}

function setPlaybackSpeed(speed) {
    if (!ytPlayer) return;
    ytPlayer.setPlaybackRate(speed);
    const speedBtn = document.getElementById('activeSpeedBtn');
    if (speedBtn) speedBtn.textContent = speed + 'x';
}

function toggleCustomFullscreen() {
    const container = document.getElementById('mainPlayerContainer');
    if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Initializing slider events
document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('progressSlider');
    if (slider) {
        slider.addEventListener('mousedown', () => slider.classList.add('dragging'));
        slider.addEventListener('mouseup', () => slider.classList.remove('dragging'));
        slider.addEventListener('input', (e) => {
            if (!ytPlayer || typeof ytPlayer.getDuration !== 'function') return;
            const duration = ytPlayer.getDuration();
            const time = (e.target.value / 100) * duration;
            ytPlayer.seekTo(time, true);
        });
    }
});

function seekTo(seconds) {
    if (ytPlayer && isPlayerReady) {
        ytPlayer.seekTo(seconds, true);
    }
}

const COMMON_LANGS = [
    { code: 'ja', name: 'Japanese' },
    { code: 'en', name: 'English' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'zh-Hans', name: 'Chinese (Simplified)' },
    { code: 'zh-Hant', name: 'Chinese (Traditional)' },
    { code: 'ko', name: 'Korean' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'es', name: 'Spanish' },
    { code: 'ru', name: 'Russian' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'th', name: 'Thai' },
    { code: 'ar', name: 'Arabic' }
];

async function loadAvailableLanguages() {
    const importSelect = document.getElementById('importLang');
    const displaySub1 = document.getElementById('displaySub1');
    const displaySub2 = document.getElementById('displaySub2');
    const displaySub3 = document.getElementById('displaySub3');

    // Populate Import list
    let importHtml = '';
    for (const lang of COMMON_LANGS) {
        importHtml += `<option value="${lang.code}">${lang.name}</option>`;
    }
    if (importSelect) importSelect.innerHTML = importHtml;

    // Fetch Database available list
    try {
        const res = await fetch(`/api/subtitles/available/${LESSON_ID}`, {
            headers: { 'X-CSRFToken': getCsrfToken() }
        });

        const data = await res.json();
        
        const buildDisplayOptions = (placeholder) => {
            let html = `<option value="">${placeholder}</option>`;
            if (data.subtitles) {
                for (const sub of data.subtitles) {
                    // Use the format requested by user: EN (username)
                    const label = `${sub.language_code.toUpperCase()} (${sub.uploader_name})`;
                    // Value is the track ID now, for precise selection
                    html += `<option value="${sub.id}" data-lang="${sub.language_code}">${label}</option>`;
                }
            }
            return html;
        };

        if (displaySub1) displaySub1.innerHTML = buildDisplayOptions('Subtitle 1');
        if (displaySub2) displaySub2.innerHTML = buildDisplayOptions('Subtitle 2');
        if (displaySub3) displaySub3.innerHTML = buildDisplayOptions('Subtitle 3');

        // Restore saved selections by Track ID first
        if (SAVED_S1_TRACK_ID && displaySub1) displaySub1.value = SAVED_S1_TRACK_ID;
        else if (SAVED_ORIGINAL && displaySub1) {
            // Find a track that matches the old lang_code if ID is missing
            const opt = Array.from(displaySub1.options).find(o => o.dataset.lang === SAVED_ORIGINAL);
            if (opt) displaySub1.value = opt.value;
        }

        if (SAVED_S2_TRACK_ID && displaySub2) displaySub2.value = SAVED_S2_TRACK_ID;
        else if (SAVED_TARGET && displaySub2) {
            const opt = Array.from(displaySub2.options).find(o => o.dataset.lang === SAVED_TARGET);
            if (opt) displaySub2.value = opt.value;
        }

        if (SAVED_S3_TRACK_ID && displaySub3) displaySub3.value = SAVED_S3_TRACK_ID;
        else if (SAVED_THIRD && displaySub3) {
            const opt = Array.from(displaySub3.options).find(o => o.dataset.lang === SAVED_THIRD);
            if (opt) displaySub3.value = opt.value;
        }

    } catch (err) {
        console.error('[AuraFlow] Failed to load DB subtitles:', err);
    }
}

// ── Manual Subtitle Upload ─────────────────────────────────────
let selectedSubtitleFile = null;

function handleFileSelect(event) {
    const file = event.target.files[0];
    const display = document.getElementById('fileNameDisplay');
    const btn = document.getElementById('uploadSubsBtn');
    
    if (file) {
        selectedSubtitleFile = file;
        display.textContent = file.name;
        display.style.color = "var(--text-primary)";
        btn.disabled = false;
    } else {
        selectedSubtitleFile = null;
        display.textContent = "None selected";
        display.style.color = "var(--text-muted)";
        btn.disabled = true;
    }
}

async function uploadSubtitle() {
    if (!selectedSubtitleFile) return;

    const langCode = document.getElementById('importLang').value;
    const nameField = document.getElementById('uploadSubName')?.value || '';
    const noteField = document.getElementById('uploadSubNote')?.value || '';
    const btn = document.getElementById('uploadSubsBtn');
    const status = document.getElementById('transcriptStatus');

    btn.disabled = true;
    btn.innerHTML = 'Uploading...';
    status.textContent = 'Parsing subtitle file...';

    try {
        const formData = new FormData();
        formData.append('file', selectedSubtitleFile);
        formData.append('language_code', langCode);
        formData.append('name', nameField);
        formData.append('note', noteField);

        const res = await fetch(`/api/subtitles/upload/${LESSON_ID}`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() },
            body: formData
        });


        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to upload subtitles');
        }

        // Refresh available subtitles list
        await loadAvailableLanguages();

        // Auto-select the newly uploaded file as Subtitle 1 by ID
        if (data.track_id) {
            const select = document.getElementById('displaySub1');
            if (select) select.value = data.track_id;
        }

        // Switch to manage tab to see library
        switchSubTab('manage');
        await refreshExistingSubs();

        // Reset upload form
        selectedSubtitleFile = null;
        const fileNameDisplay = document.getElementById('fileNameDisplay');
        if (fileNameDisplay) fileNameDisplay.textContent = "Choose File";
        btn.disabled = true;
        btn.innerHTML = 'Upload to Library';
        if (typeof loadShadowingStats === 'function') await loadShadowingStats();

        // Render transcript immediately
        renderTranscript([data.lines]);
        status.textContent = `Displaying: ${langCode.toUpperCase()} (${data.line_count} lines)`;

        // Reset file input and close modal
        selectedSubtitleFile = null;
        document.getElementById('subtitleFile').value = '';
        document.getElementById('fileNameDisplay').textContent = "None selected";
        document.getElementById('fileNameDisplay').style.color = "var(--text-muted)";
        if(document.getElementById('uploadSubName')) document.getElementById('uploadSubName').value = '';
        if(document.getElementById('uploadSubNote')) document.getElementById('uploadSubNote').value = '';
        
        closeModals();

    } catch (err) {
        console.error('[AuraFlow] Subtitle upload error:', err);
        status.textContent = 'Error: ' + err.message;
        alert(err.message);
    } finally {
        if (!selectedSubtitleFile) {
            btn.innerHTML = `Upload`;
            btn.disabled = true;
        }
    }
}

// ── Load Display Subtitles ─────────────────────────────────────
async function loadDisplaySubtitles() {
    const sub1 = document.getElementById('displaySub1').value;
    const sub2 = document.getElementById('displaySub2').value;
    const sub3 = document.getElementById('displaySub3').value;
    
    const btn = document.getElementById('loadSubsBtn');
    const status = document.getElementById('transcriptStatus');

    if (!sub1 && !sub2 && !sub3) {
        // Only alert if this was a manual user action (not auto-load on start)
        if (status && status.textContent.includes('Fetching')) {
            alert('Please select at least one subtitle track to display.');
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Loading...';
    }
    if (status) status.textContent = 'Fetching subtitles...';


    const selectedTracks = [sub1, sub2, sub3];
    const tracksData = [];
    
    try {
        for (let i = 0; i < selectedTracks.length; i++) {
            const trackId = selectedTracks[i];
            if (!trackId) {
                tracksData.push([]);
                continue;
            }

            const res = await fetch(`/api/subtitles/fetch/${LESSON_ID}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ track_id: trackId }),
            });

            const data = await res.json();
            
            if (res.ok) {
                tracksData.push(data.lines);
            } else {
                console.warn(`[AuraFlow] Could not load track ${trackId}:`, data.error);
                tracksData.push([]);
            }
        }

    // Save choice + settings to backend (unified)
    await saveLessonSettings();

    // Load stats before rendering transcript
    if (typeof loadShadowingStats === 'function') await loadShadowingStats();

    renderTranscript(tracksData);
    if (tracksData[0]) {
        // Find language codes for the selected tracks to display in status
        const activeLabels = [];
        [sub1, sub2, sub3].forEach((id, idx) => {
            if (!id) return;
            const select = document.getElementById(`displaySub${idx+1}`);
            const text = select.options[select.selectedIndex]?.text || id;
            activeLabels.push(text);
        });
        status.textContent = `Displaying: ${activeLabels.join(' • ')} (${tracksData[0].length} blocks)`;
    }


    } catch (err) {
        console.error('[AuraFlow] Display load error:', err);
        status.textContent = 'Error: ' + err.message;
    } finally {
        const loadBtn = document.getElementById('loadSubsBtn');
        if (loadBtn) {
            loadBtn.disabled = false;
            loadBtn.textContent = 'Show';
        }
    }

}

// ── Initialization Override ───────────────────────────────────
function initFromSaved() {
    // 1. Restore Language Selections
    // 1. Language Selections already restored by loadAvailableLanguages() using Track IDs

        // 2. Restore Visuals
    if (SAVED_SETTINGS && Object.keys(SAVED_SETTINGS).length > 0) {
        // Helper to set slider and label
        const setSlider = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;
            // Strip units if present
            let cleanVal = val.toString().replace(/px|%/g, '');
            // Convert legacy px to apprx percentage for sliders
            if (val.toString().endsWith('px')) {
                const px = parseFloat(cleanVal);
                if (px > 20) cleanVal = (px / 7).toFixed(1);
                else cleanVal = (px / 10).toFixed(1);
            }
            el.value = cleanVal;
            updateSliderLabel(id, cleanVal);
        };

        // Subtitles
        if (SAVED_SETTINGS.sub1_size) setSlider('optSubSize1', SAVED_SETTINGS.sub1_size);
        if (SAVED_SETTINGS.sub2_size) setSlider('optSubSize2', SAVED_SETTINGS.sub2_size);
        if (SAVED_SETTINGS.sub3_size) setSlider('optSubSize3', SAVED_SETTINGS.sub3_size);
        if (SAVED_SETTINGS.sub1_color && document.getElementById('optSubColor1')) document.getElementById('optSubColor1').value = SAVED_SETTINGS.sub1_color;
        if (SAVED_SETTINGS.sub2_color && document.getElementById('optSubColor2')) document.getElementById('optSubColor2').value = SAVED_SETTINGS.sub2_color;
        if (SAVED_SETTINGS.sub3_color && document.getElementById('optSubColor3')) document.getElementById('optSubColor3').value = SAVED_SETTINGS.sub3_color;
        if (SAVED_SETTINGS.sub_pos && document.getElementById('optSubPos')) document.getElementById('optSubPos').value = SAVED_SETTINGS.sub_pos;
        
        // Notes
        if (SAVED_SETTINGS.note_size) setSlider('optNoteSize', SAVED_SETTINGS.note_size);
        if (SAVED_SETTINGS.note_theme && document.getElementById('optNoteColor')) document.getElementById('optNoteColor').value = SAVED_SETTINGS.note_theme;
        if (SAVED_SETTINGS.note_pos && document.getElementById('optNotePos')) document.getElementById('optNotePos').value = SAVED_SETTINGS.note_pos;
        
        // Transcript
        if (SAVED_SETTINGS.transcript_fs) setSlider('optTranscriptFs', SAVED_SETTINGS.transcript_fs);
        if (SAVED_SETTINGS.transcript_color_1 && document.getElementById('optTranscriptColor1')) document.getElementById('optTranscriptColor1').value = SAVED_SETTINGS.transcript_color_1;
        if (SAVED_SETTINGS.transcript_color_2 && document.getElementById('optTranscriptColor2')) document.getElementById('optTranscriptColor2').value = SAVED_SETTINGS.transcript_color_2;
        if (SAVED_SETTINGS.transcript_color_3 && document.getElementById('optTranscriptColor3')) document.getElementById('optTranscriptColor3').value = SAVED_SETTINGS.transcript_color_3;
        if (SAVED_SETTINGS.transcript_bg && document.getElementById('optTranscriptBg')) document.getElementById('optTranscriptBg').value = SAVED_SETTINGS.transcript_bg;
        
        // Show/Hide Toggles
        const showSub = (SAVED_SETTINGS.show_sub !== undefined) ? SAVED_SETTINGS.show_sub : true;
        const showNote = (SAVED_SETTINGS.show_note !== undefined) ? SAVED_SETTINGS.show_note : true;

        const elSub = document.getElementById('toggleScriptOverlay');
        if (elSub) {
            elSub.checked = showSub;
            toggleOverlay('script');
        }

        const elNote = document.getElementById('toggleNoteOverlay');
        if (elNote) {
            elNote.checked = showNote;
            toggleOverlay('note');
        }
    }


    // Completion state from server
    isMarkedCompleted = (typeof IS_COMPLETED !== 'undefined' && IS_COMPLETED === 'True');
    updateCompletionUI();

    applyVisualOptions();
    
    // Auto-load if languages are selected (checking both Track IDs and legacy codes)
    if (window.SAVED_S1_TRACK_ID || window.SAVED_S2_TRACK_ID || window.SAVED_S3_TRACK_ID || 
        window.SAVED_ORIGINAL || window.SAVED_TARGET || window.SAVED_THIRD) {
        console.log("[AuraFlow] Auto-loading subtitles...");
        setTimeout(loadDisplaySubtitles, 800); // Slightly more delay to ensure all DOM is ready
    }
}



// ── Tab & Overlay Toggles ─────────────────────────────────────
function switchRightTab(tabName, element) {
    // 1. Sync Desktop Tabs
    document.querySelectorAll('.pane-tab').forEach(b => b.classList.remove('active'));
    const desktopBtn = document.getElementById(`tabBtn-${tabName}`);
    if (desktopBtn) desktopBtn.classList.add('active');

    // 2. Sync Mobile Tabs (Pills)
    document.querySelectorAll('.mobile-tab').forEach(b => b.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else {
        // Find corresponding mobile tab if element wasn't passed (e.g. called from code)
        const mobileTabs = document.querySelectorAll('.mobile-tab');
        mobileTabs.forEach(t => {
            if (t.textContent.toLowerCase().includes(tabName.toLowerCase())) {
                t.classList.add('active');
            }
        });
    }

    // 3. Toggle Panes
    document.querySelectorAll('.pane-content').forEach(p => {
        p.classList.remove('active-pane');
        p.style.display = 'none';
    });

    const pane = document.getElementById(`pane-${tabName}`);
    if (pane) {
        pane.classList.add('active-pane');
        pane.style.display = 'flex';
    }
}

function switchModalTab(tabName) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-pane').forEach(p => p.style.display = 'none');

    document.getElementById(`modalTab-${tabName}`).classList.add('active');
    document.getElementById(`modalPane-${tabName}`).style.display = 'block';
}

function toggleOverlay(type) {
    if (type === 'script') {
        const isChecked = document.getElementById('toggleScriptOverlay').checked;
        const overlay = document.getElementById('videoSubOverlay');
        if (overlay) overlay.style.visibility = isChecked ? 'visible' : 'hidden';
    } else if (type === 'note') {
        const isChecked = document.getElementById('toggleNoteOverlay').checked;
        const overlay = document.getElementById('notePopup');
        if (overlay) overlay.style.visibility = isChecked ? 'visible' : 'hidden';
    }
    // Trigger save so it persists
    applyVisualOptions();
}


// ── Modals ────────────────────────────────────────────────────
function openOptionsModal() {
    const modal = document.getElementById('optionsModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
        isInPreviewMode = true;
        if (SAVED_SETTINGS.sub_bg_color) {
            const bgEl = document.getElementById('optSubBgColor');
            if (bgEl) bgEl.value = SAVED_SETTINGS.sub_bg_color;
        }
        if (SAVED_SETTINGS.sub_bg_opacity) {
            const opacityEl = document.getElementById('optSubBgOpacity');
            if (opacityEl) opacityEl.value = SAVED_SETTINGS.sub_bg_opacity;
        }

        applyVisualOptions();
    }, 10);
    
    document.body.style.overflow = 'hidden';
}

function closeModals() {
    document.getElementById('subtitleManagerModal').style.display = 'none';
    
    const optionsModal = document.getElementById('optionsModal');
    if (optionsModal) {
        optionsModal.classList.remove('active');
        isInPreviewMode = false;
        
        // Xóa text preview trên player để trả lại không gian cho sub/note thật
        const subOverlay = document.getElementById('videoSubOverlay');
        if (subOverlay) subOverlay.innerHTML = '';
        
        const noteOverlay = document.getElementById('notePopup');
        if (noteOverlay) noteOverlay.innerHTML = '';

        setTimeout(() => {
            optionsModal.style.display = 'none';
        }, 400);
    }
    
    document.body.style.overflow = 'auto';
}

// ── Subtitle Manager Logic ────────────────────────────────────

function switchSubTab(tabName) {
    // Buttons
    document.querySelectorAll('#subtitleManagerModal .modal-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`subTab-${tabName}`).classList.add('active');

    // Panes
    document.querySelectorAll('#subtitleManagerModal .sub-pane').forEach(p => p.style.display = 'none');
    document.getElementById(`subPane-${tabName}`).style.display = 'block';
}

async function openSubtitleManager() {
    const modal = document.getElementById('subtitleManagerModal');
    modal.style.display = 'block';
    // Small delay to trigger CSS transition
    setTimeout(() => modal.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
    
    switchSubTab('manage');
    await refreshExistingSubs();
}

function closeSubtitleManager() {
    const modal = document.getElementById('subtitleManagerModal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }, 400);
}

async function refreshExistingSubs() {
    const listEl = document.getElementById('existingSubsList');
    listEl.innerHTML = '<div class="loading-state">Syncing library...</div>';

    try {
        const res = await fetch(`/api/subtitles/available/${LESSON_ID}`);
        const data = await res.json();

        if (!data.subtitles || data.subtitles.length === 0) {
            listEl.innerHTML = '<div class="loading-state">No tracks found. Fetch from YouTube or Upload!</div>';
            return;
        }

        let html = '';
        data.subtitles.forEach(sub => {
            const dateStr = sub.fetched_at ? new Date(sub.fetched_at).toLocaleDateString() : 'Unknown date';
            html += `
                <div class="track-card">
                    <div class="track-card__header">
                        <span class="track-card__lang">${sub.language_code.toUpperCase()}</span>
                        <div class="track-card__meta">
                            <div class="track-card__uploader">${sub.uploader_name}</div>
                            <div class="track-card__info">${sub.line_count} lines • ${dateStr}</div>
                        </div>
                        <button class="btn btn--sm track-card__btn-delete" onclick="deleteSubtitle(${sub.id})" title="Delete">
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                    ${sub.note ? `<div style="font-size:11px; opacity:0.6; font-style:italic; margin-bottom: 8px;">"${sub.note}"</div>` : ''}
                    ${sub.note ? `<div style="font-size:11px; opacity:0.6; font-style:italic;">"${sub.note}"</div>` : ''}
                </div>
            `;
        });
        listEl.innerHTML = html;

    } catch (err) {
        listEl.innerHTML = `<div class="error-state">Failed to load: ${err.message}</div>`;
    }
}


async function fetchYoutubeSubs() {
    const listEl = document.getElementById('youtubeSubsList');
    const btn = document.getElementById('btnFetchYtSubs');
    
    btn.disabled = true;
    btn.innerHTML = 'Connecting to YouTube...';
    listEl.innerHTML = '<div class="loading-state">Querying YouTube catalog...</div>';

    try {
        const res = await fetch(`/api/youtube/subtitles-list/${YOUTUBE_ID}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (!data.subtitles || data.subtitles.length === 0) {
            listEl.innerHTML = '<div class="loading-state">No captions found on YouTube.</div>';
            return;
        }

        let html = '';
        data.subtitles.forEach(sub => {
            html += `
                <div class="track-card" style="padding: 10px 14px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size:13px;">
                            <strong style="color:var(--accent);">${sub.lang_code.toUpperCase()}</strong> - ${sub.name}
                        </div>
                        <button class="btn btn--accent btn--sm" onclick="downloadYoutubeSub('${sub.lang_code}', ${sub.is_auto})" style="padding:4px 12px; font-size:11px;">
                            Download
                        </button>
                    </div>
                </div>
            `;
        });
        listEl.innerHTML = html;

    } catch (err) {
        listEl.innerHTML = `<div class="error-state">Failed: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="refresh-cw" style="width:16px; height:16px; margin-right:8px;"></i> Refresh List';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function downloadYoutubeSub(langCode, isAuto) {
    // No confirmation needed for fetch anymore as it's just adding to library
    try {
        const res = await fetch(`/api/youtube/subtitles-download/${LESSON_ID}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ lang_code: langCode, is_auto: isAuto })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Download failed.");

        await loadAvailableLanguages();
        await refreshExistingSubs();
        switchSubTab('manage');
    } catch (err) {
        alert("Error: " + err.message);
    }
}


async function deleteSubtitle(id) {
    if (!confirm("Are you sure you want to PERMANENTLY delete this subtitle track from the database?")) return;

    try {
        const res = await fetch(`/api/subtitles/${id}`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCsrfToken() }
        });

        if (res.ok) {
            await loadAvailableLanguages();
            await refreshExistingSubs();
        } else {
            alert("Failed to delete.");
        }
    } catch (err) {
        console.error("[AuraFlow] Delete error:", err);
    }
}

// ── External Downloaders ──────────────────────────────────────
function openExternalDownloader(site) {
    if (typeof YOUTUBE_ID === 'undefined' || !YOUTUBE_ID) {
        alert('Không tìm thấy ID Video. V vui lòng tải lại trang.');
        return;
    }
    
    const videoUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${YOUTUBE_ID}`);
    let targetUrl = '';
    
    if (site === 'downsub') {
        targetUrl = `https://downsub.com/?url=${videoUrl}`;
    } else if (site === 'savesubs') {
        targetUrl = `https://savesubs.com/process?url=${videoUrl}`;
    } else if (site === 'yousubtitles') {
        targetUrl = `https://www.yousubtitles.com/search?q=${videoUrl}`;
    }
    
    if (targetUrl) {
        window.open(targetUrl, '_blank');
    }
}



// Ensure the buttons in the right pane tabs are conditionally visible
const originalSwitchTab = switchRightTab;
switchRightTab = function(tabName) {
    originalSwitchTab(tabName);
    const actions = document.getElementById('transcriptActionsBtns');
    if (actions) {
        actions.style.display = tabName === 'transcript' ? 'flex' : 'none';
    }
};

let isInPreviewMode = false;

function updateSubPreview() {
    // Wrapper to ensure sliders trigger the full visual refresh
    applyVisualOptions();
}

// ── Visual Settings Application ───────────────────────────────

/**
 * Helper: Chuyển đổi đơn vị % sang cqw (Container Query Width) 
 * để kích thước chữ tỉ lệ thuận với khung player container.
 */
function toResponsiveUnit(val) {
    if (typeof val === 'string' && val.endsWith('%')) {
        return val.replace('%', 'cqw');
    }
    return val;
}

/**
 * Cập nhật nhãn hiển thị bên cạnh thanh trượt (slider)
 */
function updateSliderLabel(id, val) {
    const label = document.getElementById(`val-${id}`);
    if (label) {
        // Clear previous content to avoid any double unit issues
        label.innerHTML = val + (id === 'optTranscriptFs' ? 'rem' : '%');
    }
}

function applyVisualOptions() {
    // 0. Ensure Preview Logic (Inject dummy text before styling applies)
    if (isInPreviewMode) {
        const subOverlay = document.getElementById('videoSubOverlay');
        const notePopup = document.getElementById('notePopup');
        
        if (subOverlay && !document.getElementById('livePreviewLine1')) {
            subOverlay.innerHTML = `
                <span id="livePreviewLine1" class="vso-line">Sample Subtitle Track 1</span>
                <span id="livePreviewLine2" class="vso-line vso-line--1">Dòng phụ đề mẫu thứ hai</span>
                <span id="livePreviewLine3" class="vso-line vso-line--2">Sample translation at the bottom</span>
            `;
        }
        
        if (notePopup && !document.getElementById('livePreviewNote')) {
            notePopup.innerHTML = `
                <div id="livePreviewNote" class="video-note-item">
                    <div style="font-weight:700; margin-bottom:4px; font-size:0.9em; opacity:0.8;">Sample Note</div>
                    <div>This is a preview of how your notes will appear. Adjust size and theme!</div>
                </div>
            `;
        }
    }

    // 1. Subtitles Overlay Override
    const subOverlay = document.getElementById('videoSubOverlay');
    if (subOverlay) {
        const subPos = document.getElementById('optSubPos')?.value || 'bottom';
        
        // Remove all possible old position classes
        subOverlay.classList.remove(
            'vso--pos-top', 'vso--pos-bottom', 
            'vso--pos-top-left', 'vso--pos-top-right', 
            'vso--pos-bottom-left', 'vso--pos-bottom-right'
        );
        
        // Add new position class
        subOverlay.classList.add(`vso--pos-${subPos}`);

        // Background Customization
        const bgColor = document.getElementById('optSubBgColor')?.value || '#000000';
        const bgOpacity = document.getElementById('optSubBgOpacity')?.value || '0.6';
        
        // Convert hex to rgb for rgba
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        subOverlay.style.background = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;

        // Clean up any stray inline styles that might interfere with CSS classes
        subOverlay.style.removeProperty('top');
        subOverlay.style.removeProperty('bottom');
        subOverlay.style.removeProperty('left');
        subOverlay.style.removeProperty('right');
        subOverlay.style.removeProperty('text-align');
        
        // Force visible in preview
        if (isInPreviewMode) {
            subOverlay.style.visibility = 'visible';
            subOverlay.style.display = 'flex';
            
            // APPLY CONTENT STYLING TO DUMMY LINES
            const lp1 = document.getElementById('livePreviewLine1');
            const lp2 = document.getElementById('livePreviewLine2');
            const lp3 = document.getElementById('livePreviewLine3');
            
            if (lp1) {
                const s1 = toResponsiveUnit(document.getElementById('optSubSize1')?.value + '%');
                const s2 = toResponsiveUnit(document.getElementById('optSubSize2')?.value + '%');
                const s3 = toResponsiveUnit(document.getElementById('optSubSize3')?.value + '%');
                const c1 = document.getElementById('optSubColor1')?.value;
                const c2 = document.getElementById('optSubColor2')?.value;
                const c3 = document.getElementById('optSubColor3')?.value;

                lp1.style.fontSize = s1; lp1.style.color = c1; lp1.style.display = 'block';
                lp2.style.fontSize = s2; lp2.style.color = c2; lp2.style.display = 'block';
                lp3.style.fontSize = s3; lp3.style.color = c3; lp3.style.display = 'block';
            }
        }
    }

    // 2. Note Overlay Override
    const noteOverlay = document.getElementById('notePopup');
    if (noteOverlay) {
        let noteSize = document.getElementById('optNoteSize')?.value || '3.5';
        if (!noteSize.endsWith('%')) noteSize += '%';
        
        const noteTheme = document.getElementById('optNoteColor')?.value || 'dark';
        const notePos = document.getElementById('optNotePos')?.value || 'top-right';

        // Sử dụng CSS Variable để có thể override trên mobile
        document.documentElement.style.setProperty('--user-note-fs', toResponsiveUnit(noteSize));
        
        // Remove old positioning
        noteOverlay.style.top = '0';
        noteOverlay.style.bottom = '0';
        noteOverlay.style.left = '0';
        noteOverlay.style.right = '0';
        noteOverlay.style.transform = 'none';

        // Position using Flexbox Alignment
        if (notePos === 'top-right') {
            noteOverlay.style.justifyContent = 'flex-start';
            noteOverlay.style.alignItems = 'flex-end';
        } else if (notePos === 'top-left') {
            noteOverlay.style.justifyContent = 'flex-start';
            noteOverlay.style.alignItems = 'flex-start';
        } else if (notePos === 'bottom-right') {
            noteOverlay.style.justifyContent = 'flex-end';
            noteOverlay.style.alignItems = 'flex-end';
            noteOverlay.style.paddingBottom = '60px'; // Clear YouTube controls
        } else if (notePos === 'bottom-left') {
            noteOverlay.style.justifyContent = 'flex-end';
            noteOverlay.style.alignItems = 'flex-start';
            noteOverlay.style.paddingBottom = '60px'; // Clear YouTube controls
        }

        // Apply theme palettes
        const items = noteOverlay.querySelectorAll('.video-note-item');
        
        items.forEach(item => {
            item.style.padding = '12px 18px';
            item.style.borderRadius = '14px';
            item.style.fontSize = `var(--user-note-fs, ${toResponsiveUnit(noteSize)})`;
            item.style.fontWeight = '500';
            item.style.backdropFilter = 'blur(12px) saturate(180%)';
            item.style.maxWidth = '360px';
            item.style.pointerEvents = 'auto'; // Enable interaction

            if (noteTheme === 'light') {
                item.style.background = 'rgba(255, 255, 255, 0.95)';
                item.style.color = '#111';
                item.style.border = '1px solid #ccc';
                item.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
            } else if (noteTheme === 'yellow') {
                item.style.background = 'rgba(253, 203, 110, 0.95)';
                item.style.color = '#2d3436';
                item.style.border = '1px solid #fdcb6e';
                item.style.boxShadow = '0 5px 15px rgba(253, 203, 110, 0.2)';
            } else if (noteTheme === 'blue') {
                item.style.background = 'rgba(9, 132, 227, 0.95)';
                item.style.color = '#fff';
                item.style.border = '1px solid #74b9ff';
                item.style.boxShadow = '0 5px 15px rgba(9, 132, 227, 0.3)';
            } else if (noteTheme === 'green') {
                item.style.background = 'rgba(0, 184, 148, 0.95)';
                item.style.color = '#fff';
                item.style.border = '1px solid #55efc4';
                item.style.boxShadow = '0 5px 15px rgba(0, 184, 148, 0.3)';
            } else if (noteTheme === 'purple') {
                item.style.background = 'rgba(108, 92, 231, 0.95)';
                item.style.color = '#fff';
                item.style.border = '1px solid #a29bfe';
                item.style.boxShadow = '0 5px 15px rgba(108, 92, 231, 0.3)';
            } else if (noteTheme === 'red') {
                item.style.background = 'rgba(214, 48, 49, 0.95)';
                item.style.color = '#fff';
                item.style.border = '1px solid #ff7675';
                item.style.boxShadow = '0 5px 15px rgba(214, 48, 49, 0.3)';
            } else {
                // Dark Glass (Default)
                item.style.background = 'rgba(15, 23, 42, 0.85)';
                item.style.color = '#fff';
                item.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                item.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
            }
        });

        // Ensure container is transparent but flex
        noteOverlay.style.background = 'transparent';
        noteOverlay.style.border = 'none';
        noteOverlay.style.boxShadow = 'none';
        noteOverlay.style.backdropFilter = 'none';
        
        // Force visible in preview
        if (isInPreviewMode) {
            noteOverlay.style.display = 'flex';
        }
    }

    // 3. Transcript Settings Sync
    // Đảm bảo đơn vị rem luôn đẹp, slider từ 0.7 -> 2.5
    let transcriptFs = (document.getElementById('optTranscriptFs')?.value || '1.1') + 'rem';
    const transcriptBg = document.getElementById('optTranscriptBg')?.value || '#111827';
    
    document.documentElement.style.setProperty('--transcript-fs', transcriptFs);
    document.documentElement.style.setProperty('--transcript-bg', transcriptBg);
    
    if (isInPreviewMode) updateSubPreview();
}


async function saveLessonSettings() {
    const visualSettings = {
        sub1_size: document.getElementById('optSubSize1')?.value + '%',
        sub2_size: document.getElementById('optSubSize2')?.value + '%',
        sub3_size: document.getElementById('optSubSize3')?.value + '%',
        sub1_color: document.getElementById('optSubColor1')?.value || '#ffffff',
        sub2_color: document.getElementById('optSubColor2')?.value || '#f1c40f',
        sub3_color: document.getElementById('optSubColor3')?.value || '#00cec9',
        sub_pos: document.getElementById('optSubPos')?.value || 'bottom',
        sub_bg_color: document.getElementById('optSubBgColor')?.value || '#000000',
        sub_bg_opacity: document.getElementById('optSubBgOpacity')?.value || '0.6',
        
        note_size: document.getElementById('optNoteSize')?.value + '%',
        note_theme: document.getElementById('optNoteColor')?.value || 'dark',
        note_pos: document.getElementById('optNotePos')?.value || 'top-right',
        
        note_appear_before: document.getElementById('optNoteBefore')?.value || 2.0,
        note_duration: document.getElementById('optNoteDuration')?.value || 4.0,
        
        shadowing_extra_time: document.getElementById('optShadowExtra')?.value || 2.0,
        shadowing_hide_subs: document.getElementById('toggleShadowHideSubs')?.checked || false,
        shadowing_accuracy: document.getElementById('optShadowAccuracy')?.value || 80,
        shadow_interactive: document.getElementById('toggleShadowInteractive')?.checked || false,
        shadow_language: document.getElementById('optShadowLanguage')?.value || 'ja',

        transcript_fs: (document.getElementById('optTranscriptFs')?.value || '1.1') + 'rem',
        transcript_color_1: document.getElementById('optTranscriptColor1')?.value || '#e8ecf4',
        transcript_color_2: document.getElementById('optTranscriptColor2')?.value || '#f1c40f',
        transcript_color_3: document.getElementById('optTranscriptColor3')?.value || '#00cec9',
        transcript_bg: document.getElementById('optTranscriptBg')?.value || '#111827',
        
        show_sub: document.getElementById('toggleScriptOverlay')?.checked ?? true,
        show_note: document.getElementById('toggleNoteOverlay')?.checked ?? true,
        lookup_target: document.getElementById('optLookupTarget')?.value
    };

    try {
        const sub1 = document.getElementById('displaySub1')?.value;
        const sub2 = document.getElementById('displaySub2')?.value;
        const sub3 = document.getElementById('displaySub3')?.value;

        const noteBefore = parseFloat(document.getElementById('optNoteBefore')?.value || 2.0);
        const noteDuration = parseFloat(document.getElementById('optNoteDuration')?.value || 5.0);

        await fetch(`/api/lesson/${LESSON_ID}/set-languages`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                original_lang_code: document.getElementById('displaySub1')?.options[document.getElementById('displaySub1')?.selectedIndex]?.dataset.lang || SAVED_ORIGINAL,
                target_lang_code: document.getElementById('displaySub2')?.options[document.getElementById('displaySub2')?.selectedIndex]?.dataset.lang || SAVED_TARGET || '',
                third_lang_code: document.getElementById('displaySub3')?.options[document.getElementById('displaySub3')?.selectedIndex]?.dataset.lang || SAVED_THIRD || '',
                
                s1_track_id: sub1 || null,
                s2_track_id: sub2 || null,
                s3_track_id: sub3 || null,

                note_appear_before: noteBefore,
                note_duration: noteDuration,
                settings: visualSettings
            })
        });

        // Update global state immediately
        window.NOTE_BEFORE = noteBefore;
        window.NOTE_DURATION = noteDuration;
        Object.assign(SAVED_SETTINGS, visualSettings);

        if (sub1) window.SAVED_ORIGINAL = sub1;
        if (sub2) window.SAVED_TARGET = sub2;
        if (sub3) window.SAVED_THIRD = sub3;
        console.log("[AuraFlow] Lesson settings saved");
    } catch (err) {
        console.error('[AuraFlow] Failed to save settings:', err);
    }
}




// ── A-B Repeat Controller ─────────────────────────────────────
function setABLoop(point) {
    if (!ytPlayer || !isPlayerReady) return;
    const currentTime = ytPlayer.getCurrentTime();
    
    if (point === 'A') {
        abLoopA = currentTime;
        document.getElementById('btn-set-a').textContent = `A: ${formatTime(abLoopA)}`;
        document.getElementById('btn-set-a').classList.add('btn--accent');
    } else {
        if (abLoopA === null) {
            alert("Please set point A first.");
            return;
        }
        if (currentTime <= abLoopA) {
            alert("Point B must be after Point A.");
            return;
        }
        abLoopB = currentTime;
        document.getElementById('btn-set-b').textContent = `B: ${formatTime(abLoopB)}`;
        document.getElementById('btn-set-b').classList.add('btn--accent');
        
        // Finalize loop
        document.getElementById('ab-status').style.display = 'block';
        document.getElementById('btn-clear-ab').style.display = 'block';
        
        // Jump to A to start the loop immediately
        ytPlayer.seekTo(abLoopA, true);
    }
}

function clearABLoop() {
    abLoopA = null;
    abLoopB = null;
    
    document.getElementById('btn-set-a').textContent = 'Set A';
    document.getElementById('btn-set-a').classList.remove('btn--accent');
    document.getElementById('btn-set-b').textContent = 'Set B';
    document.getElementById('btn-set-b').classList.remove('btn--accent');
    document.getElementById('ab-status').style.display = 'none';
    document.getElementById('btn-clear-ab').style.display = 'none';
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Keyboard Shortcuts ────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input/textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
    }

    if (!ytPlayer || !isPlayerReady) return;

    switch(e.key) {
        case '[':
            setABLoop('A');
            break;
        case ']':
            setABLoop('B');
            break;
        case '\\':
            clearABLoop();
            break;
        case ' ': // Space for play/pause
            e.preventDefault();
            const state = ytPlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
            else ytPlayer.playVideo();
            break;
        case 'r':
        case 'R':
            // Repeat current sentence
            if (typeof currentActiveIndex !== 'undefined' && currentActiveIndex >= 0) {
                const line = mergedLines[currentActiveIndex];
                if (line) {
                    ytPlayer.seekTo(line.start, true);
                    ytPlayer.playVideo();
                }
            }
            break;
        case 'ArrowLeft':
            // Seek to start of current sentence, or previous if near start
            if (typeof currentActiveIndex !== 'undefined' && currentActiveIndex >= 0) {
                const line = mergedLines[currentActiveIndex];
                const cur = ytPlayer.getCurrentTime();
                if (cur - line.start < 1.0 && currentActiveIndex > 0) {
                    // Go to previous
                    const prev = mergedLines[currentActiveIndex - 1];
                    ytPlayer.seekTo(prev.start, true);
                } else {
                    // Back to start of current
                    ytPlayer.seekTo(line.start, true);
                }
                ytPlayer.playVideo();
                e.preventDefault();
            }
            break;
        case 'ArrowRight':
            // Seek to start of next sentence
            if (typeof currentActiveIndex !== 'undefined' && currentActiveIndex >= 0 && currentActiveIndex < mergedLines.length - 1) {
                const next = mergedLines[currentActiveIndex + 1];
                ytPlayer.seekTo(next.start, true);
                ytPlayer.playVideo();
                e.preventDefault();
            }
            break;
    }
});

// ── Note Interaction Shortcuts ──────────────────────────────



// ── Study Tracking ───────────────────────────────────────────
function trackActiveStudyTime() {
    const now = Date.now();
    const isIdle = (now - lastActivityTime) > IDLE_THRESHOLD_MS;
    const isFocused = document.hasFocus();

    // Only track if:
    // 1. YouTube API is ready and video is actually PLAYING
    // 2. Tab is focused
    // 3. User is NOT IDLE (has interacted in last 60s)
    if (typeof ytPlayer !== 'undefined' && ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
        const state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING && isFocused && !isIdle) {
            activeStudySeconds++;
            totalSessionSeconds++;
            updateSessionClock();
        }
    }

    // Every SYNC_INTERVAL (30s), push the data to server
    if (now - lastSyncTime >= SYNC_INTERVAL_MS) {
        if (activeStudySeconds > 0) {
            syncTimeTrack();
        } else {
            lastSyncTime = now;
        }
    }
}

function updateSessionClock() {
    const clock = document.getElementById('study-timer-clock');
    if (!clock) return;

    const hrs = Math.floor(totalSessionSeconds / 3600);
    const mins = Math.floor((totalSessionSeconds % 3600) / 60);
    const secs = totalSessionSeconds % 60;

    let display = "";
    if (hrs > 0) display += hrs + ":";
    display += (mins < 10 && hrs > 0 ? "0" : "") + mins + ":";
    display += (secs < 10 ? "0" : "") + secs;

    clock.textContent = display;
    
    // Add a pulsing effect when active
    const timerBox = document.getElementById('study-timer');
    if (timerBox) {
        timerBox.style.opacity = "1";
        timerBox.style.boxShadow = "0 0 10px rgba(108, 92, 231, 0.2)";
    }
}


async function syncTimeTrack() {
    const secondsToSend = activeStudySeconds;
    activeStudySeconds = 0;
    lastSyncTime = Date.now();

    try {
        await fetch(`/api/lesson/${LESSON_ID}/track-time`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },

            body: JSON.stringify({ seconds_added: secondsToSend })
        });
    } catch (err) {
        console.error('[AuraFlow] Study track sync error:', err);
        // Put back to retry
        activeStudySeconds += secondsToSend;
    }
}

async function toggleLessonCompletion() {
    try {
        const res = await fetch(`/api/lesson/${LESSON_ID}/toggle-complete`, { 
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() }
        });

        const data = await res.json();
        if (res.ok) {
            isMarkedCompleted = data.is_completed;
            updateCompletionUI();
        }
    } catch (err) {
        console.error('[AuraFlow] Failed to toggle completion:', err);
    }
}

function updateCompletionUI() {
    const btn = document.getElementById('btn-toggle-complete');
    if (!btn) return;
    const span = btn.querySelector('span');
    const icon = btn.querySelector('i');

    if (isMarkedCompleted) {
        if (span) span.textContent = 'Completed';
        btn.classList.add('btn--accent');
        btn.classList.remove('btn--ghost');
    } else {
        if (span) span.textContent = 'Mark Complete';
        btn.classList.remove('btn--accent');
        btn.classList.add('btn--ghost');
    }
}

/**
 * Utility to get CSRF token from meta tags (Flask-WTF compatible)
 */
function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}



