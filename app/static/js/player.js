/**
 * PodLearn — YouTube IFrame Player Controller
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

// Tracking Logic
let activeStudySeconds = 0;
let lastSyncTime = Date.now();
const SYNC_INTERVAL_MS = 30000; // Sync every 30s

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
    console.log('[PodLearn] YouTube IFrame API loaded');
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
    console.log('[PodLearn] YouTube player ready');
    
    // Crucial: Wait for language lists to be populated from DB before restoring
    await loadAvailableLanguages();
    
    if (typeof initFromSaved === 'function') {
        try {
            initFromSaved();
        } catch (err) {
            console.error('[PodLearn] initFromSaved error:', err);
        }
    }
    
    // Start active study time tracking loop
    setInterval(trackActiveStudyTime, 1000);
}




function onPlayerError(event) {
    console.error('[PodLearn] YouTube player error:', event.data);
}

function onPlayerStateChange(event) {
    const overlay = document.getElementById('videoSubOverlay');
    if (event.data === YT.PlayerState.PLAYING) {
        startTimeUpdates();
        if (overlay) overlay.classList.remove('is-interactive');
    } else {
        stopTimeUpdates();
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
    if (typeof updateTranscriptHighlight === 'function') {
        updateTranscriptHighlight(currentTime);
    }
    if (typeof checkNotePopup === 'function') {
        checkNotePopup(currentTime);
    }

    // ── A-B Repeat Logic ─────────────────────────────────────
    if (abLoopA !== null && abLoopB !== null) {
        if (currentTime >= abLoopB) {
            ytPlayer.seekTo(abLoopA, true);
        }
    }
}

// ── Seek ─────────────────────────────────────────────────────
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
    importSelect.innerHTML = importHtml;

    // Fetch Database available list
    try {
        const res = await fetch(`/api/subtitles/available/${LESSON_ID}`);
        const data = await res.json();
        
        const buildDisplayOptions = (placeholder) => {
            let html = `<option value="">${placeholder}</option>`;
            if (data.subtitles) {
                for (const sub of data.subtitles) {
                    const label = `${sub.language_code.toUpperCase()} (by ${sub.uploader_name})`;
                    html += `<option value="${sub.language_code}">${label}</option>`;
                }
            }
            return html;
        };

        displaySub1.innerHTML = buildDisplayOptions('- Subtitle 1 -');
        displaySub2.innerHTML = buildDisplayOptions('- Subtitle 2 -');
        displaySub3.innerHTML = buildDisplayOptions('- Subtitle 3 -');

        // Restore saved selections
        if (SAVED_ORIGINAL) displaySub1.value = SAVED_ORIGINAL;
        if (SAVED_TARGET) displaySub2.value = SAVED_TARGET;
        if (SAVED_THIRD) displaySub3.value = SAVED_THIRD;

    } catch (err) {
        console.error('[PodLearn] Failed to load DB subtitles:', err);
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
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to upload subtitles');
        }

        // Refresh available subtitles list
        await loadAvailableLanguages();

        // Auto-select the newly uploaded file as Subtitle 1
        document.getElementById('displaySub1').value = langCode;

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
        console.error('[PodLearn] Subtitle upload error:', err);
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
        alert('Please select at least one subtitle track to display.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Loading...';
    status.textContent = 'Fetching subtitles...';

    const selectedLangs = [sub1, sub2, sub3].filter(Boolean);
    const tracksData = [];
    
    try {
        for (const lang of selectedLangs) {
            const res = await fetch(`/api/subtitles/fetch/${LESSON_ID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language_code: lang }),
            });
            const data = await res.json();
            
            if (res.ok) {
                tracksData.push(data.lines);
            } else {
                console.warn(`[PodLearn] Could not load ${lang} subs:`, data.error);
                tracksData.push([]);
            }
        }

    // Save choice + settings to backend (unified)
    await saveLessonSettings();

    renderTranscript(tracksData);
    if (tracksData[0]) {
        const activeNames = selectedLangs.map(l => l.toUpperCase());
        status.textContent = `Displaying: ${activeNames.join(' • ')} (${tracksData[0].length} blocks)`;
    }


    } catch (err) {
        console.error('[PodLearn] Display load error:', err);
        status.textContent = 'Error: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Show';
    }
}

// ── Initialization Override ───────────────────────────────────
function initFromSaved() {
    // 1. Restore Language Selections
    if (SAVED_ORIGINAL && document.getElementById('displaySub1')) document.getElementById('displaySub1').value = SAVED_ORIGINAL;
    if (SAVED_TARGET && document.getElementById('displaySub2')) document.getElementById('displaySub2').value = SAVED_TARGET;
    if (SAVED_THIRD && document.getElementById('displaySub3')) document.getElementById('displaySub3').value = SAVED_THIRD;

    // 2. Restore Visuals
    if (SAVED_SETTINGS && Object.keys(SAVED_SETTINGS).length > 0) {
        // Subtitles
        if (SAVED_SETTINGS.sub1_size && document.getElementById('optSubSize1')) document.getElementById('optSubSize1').value = SAVED_SETTINGS.sub1_size;
        if (SAVED_SETTINGS.sub2_size && document.getElementById('optSubSize2')) document.getElementById('optSubSize2').value = SAVED_SETTINGS.sub2_size;
        if (SAVED_SETTINGS.sub3_size && document.getElementById('optSubSize3')) document.getElementById('optSubSize3').value = SAVED_SETTINGS.sub3_size;
        if (SAVED_SETTINGS.sub1_color && document.getElementById('optSubColor1')) document.getElementById('optSubColor1').value = SAVED_SETTINGS.sub1_color;
        if (SAVED_SETTINGS.sub2_color && document.getElementById('optSubColor2')) document.getElementById('optSubColor2').value = SAVED_SETTINGS.sub2_color;
        if (SAVED_SETTINGS.sub3_color && document.getElementById('optSubColor3')) document.getElementById('optSubColor3').value = SAVED_SETTINGS.sub3_color;
        if (SAVED_SETTINGS.sub_pos && document.getElementById('optSubPos')) document.getElementById('optSubPos').value = SAVED_SETTINGS.sub_pos;
        
        // Notes
        if (SAVED_SETTINGS.note_size && document.getElementById('optNoteSize')) document.getElementById('optNoteSize').value = SAVED_SETTINGS.note_size;
        if (SAVED_SETTINGS.note_theme && document.getElementById('optNoteColor')) document.getElementById('optNoteColor').value = SAVED_SETTINGS.note_theme;
        if (SAVED_SETTINGS.note_pos && document.getElementById('optNotePos')) document.getElementById('optNotePos').value = SAVED_SETTINGS.note_pos;
        
        // Lookup
        if (SAVED_SETTINGS.lookup_target && document.getElementById('optLookupTarget')) document.getElementById('optLookupTarget').value = SAVED_SETTINGS.lookup_target;

        // Toggles
        if (SAVED_SETTINGS.show_sub !== undefined) {
            const el = document.getElementById('toggleScriptOverlay');
            if (el) el.checked = SAVED_SETTINGS.show_sub;
            toggleOverlay('script');
        }
        if (SAVED_SETTINGS.show_note !== undefined) {
            const el = document.getElementById('toggleNoteOverlay');
            if (el) el.checked = SAVED_SETTINGS.show_note;
            toggleOverlay('note');
        }
    }

    // Completion state from server
    isMarkedCompleted = (typeof IS_COMPLETED !== 'undefined' && IS_COMPLETED === 'True');
    updateCompletionUI();

    applyVisualOptions();
    
    // Auto-load if languages are selected
    if (window.SAVED_ORIGINAL || window.SAVED_TARGET || window.SAVED_THIRD) {
        console.log("[PodLearn] Auto-loading subtitles...");
        setTimeout(loadDisplaySubtitles, 500);
    }
}


// ── Tab & Overlay Toggles ─────────────────────────────────────
function switchRightTab(tabName) {
    document.querySelectorAll('.pane-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pane-content').forEach(p => {
        p.classList.remove('active-pane');
        p.style.display = 'none';
    });

    document.getElementById(`tabBtn-${tabName}`).classList.add('active');
    const pane = document.getElementById(`pane-${tabName}`);
    pane.classList.add('active-pane');
    pane.style.display = 'flex';
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
function openUploadModal() {
    document.getElementById('uploadModal').style.display = 'flex';
}

function openOptionsModal() {
    document.getElementById('optionsModal').style.display = 'flex';
}

function closeModals() {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('optionsModal').style.display = 'none';
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

// ── Visual Settings Application ───────────────────────────────
function applyVisualOptions() {
    // 1. Subtitles Overlay Override
    const subOverlay = document.getElementById('videoSubOverlay');
    if (subOverlay) {
        const subPos = document.getElementById('optSubPos')?.value || 'bottom';
        
        // Remove all old position classes
        subOverlay.classList.remove('vso--pos-top', 'vso--pos-bottom', 'vso--pos-top-left', 'vso--pos-top-right', 'vso--pos-bottom-left', 'vso--pos-bottom-right');
        
        // Add new position class
        subOverlay.classList.add(`vso--pos-${subPos}`);

        // Remove old inline overrides that block CSS hover
        subOverlay.style.removeProperty('top');
        subOverlay.style.removeProperty('bottom');
        subOverlay.style.removeProperty('left');
        subOverlay.style.removeProperty('right');
        subOverlay.style.removeProperty('transform');
        subOverlay.style.removeProperty('align-items');
        subOverlay.style.removeProperty('text-align');

    }

    // 2. Note Overlay Override
    const noteOverlay = document.getElementById('notePopup');
    if (noteOverlay) {
        const noteSize = document.getElementById('optNoteSize')?.value || '16px';
        const noteTheme = document.getElementById('optNoteColor')?.value || 'dark';
        const notePos = document.getElementById('optNotePos')?.value || 'top-right';

        noteOverlay.style.fontSize = noteSize;
        const textEl = document.getElementById('notePopupText');
        if (textEl) textEl.style.fontSize = noteSize;
        
        // Reset old positioning bounds
        noteOverlay.style.top = 'auto';
        noteOverlay.style.bottom = 'auto';
        noteOverlay.style.left = 'auto';
        noteOverlay.style.right = 'auto';
        noteOverlay.style.transform = 'none';

        if (notePos === 'top-right') {
            noteOverlay.style.top = '20px';
            noteOverlay.style.right = '20px';
        } else if (notePos === 'top-left') {
            noteOverlay.style.top = '20px';
            noteOverlay.style.left = '20px';
        } else if (notePos === 'bottom-right') {
            noteOverlay.style.bottom = '60px'; // clear youtube controls
            noteOverlay.style.right = '20px';
        } else if (notePos === 'bottom-left') {
            noteOverlay.style.bottom = '60px'; // clear youtube controls
            noteOverlay.style.left = '20px';
        }

        // Apply theme palettes
        const items = noteOverlay.querySelectorAll('.video-note-item');
        
        items.forEach(item => {
            item.style.padding = '10px 15px';
            item.style.borderRadius = '10px';
            item.style.fontSize = noteSize;
            item.style.fontWeight = '500';
            item.style.backdropFilter = 'blur(8px)';
            item.style.maxWidth = '320px';

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
    }
}


async function saveLessonSettings() {
    const visualSettings = {
        sub1_size: document.getElementById('optSubSize1')?.value || '24px',
        sub2_size: document.getElementById('optSubSize2')?.value || '20px',
        sub3_size: document.getElementById('optSubSize3')?.value || '18px',
        sub1_color: document.getElementById('optSubColor1')?.value || '#ffffff',
        sub2_color: document.getElementById('optSubColor2')?.value || '#f1c40f',
        sub3_color: document.getElementById('optSubColor3')?.value || '#00cec9',
        sub_pos: document.getElementById('optSubPos')?.value || 'bottom',
        note_size: document.getElementById('optNoteSize')?.value || '16px',
        note_theme: document.getElementById('optNoteColor')?.value || 'dark',
        note_pos: document.getElementById('optNotePos')?.value || 'top-right',
        show_sub: document.getElementById('toggleScriptOverlay').checked,
        show_note: document.getElementById('toggleNoteOverlay').checked,
        lookup_target: document.getElementById('optLookupTarget')?.value
    };

    try {
        const sub1 = document.getElementById('displaySub1')?.value;
        const sub2 = document.getElementById('displaySub2')?.value;
        const sub3 = document.getElementById('displaySub3')?.value;

        await fetch(`/api/lesson/${LESSON_ID}/set-languages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                original_lang_code: sub1 || SAVED_ORIGINAL,
                target_lang_code: sub2 || SAVED_TARGET || '',
                third_lang_code: sub3 || SAVED_THIRD || '',
                settings: visualSettings
            })
        });
        
        // Update global state immediately
        Object.assign(SAVED_SETTINGS, visualSettings);
        if (sub1) window.SAVED_ORIGINAL = sub1;
        if (sub2) window.SAVED_TARGET = sub2;
        if (sub3) window.SAVED_THIRD = sub3;
        console.log("[PodLearn] Lesson settings saved");
    } catch (err) {
        console.error('[PodLearn] Failed to save settings:', err);
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
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

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
            if (ytPlayer && isPlayerReady) {
                const state = ytPlayer.getPlayerState();
                if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
                else ytPlayer.playVideo();
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seconds_added: secondsToSend })
        });
    } catch (err) {
        console.error('[PodLearn] Study track sync error:', err);
        // Put back to retry
        activeStudySeconds += secondsToSend;
    }
}

async function toggleLessonCompletion() {
    try {
        const res = await fetch(`/api/lesson/${LESSON_ID}/toggle-complete`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            isMarkedCompleted = data.is_completed;
            updateCompletionUI();
        }
    } catch (err) {
        console.error('[PodLearn] Failed to toggle completion:', err);
    }
}

function updateCompletionUI() {
    const btn = document.getElementById('btn-toggle-complete');
    if (!btn) return;

    if (isMarkedCompleted) {
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>Completed</span>
        `;
        btn.classList.add('btn--accent');
        btn.classList.remove('btn--ghost');
    } else {
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle></svg>
            <span>Mark Complete</span>
        `;
        btn.classList.remove('btn--accent');
        btn.classList.add('btn--ghost');
    }
}


