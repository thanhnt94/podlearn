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

function onPlayerReady(event) {
    isPlayerReady = true;
    console.log('[PodLearn] YouTube player ready');
    loadAvailableLanguages();
    if (typeof initFromSaved === 'function') initFromSaved();
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

    // Save choice + settings to backend
    const visualSettings = {
        sub_size1: document.getElementById('optSubSize1').value,
        sub_size2: document.getElementById('optSubSize2').value,
        sub_size3: document.getElementById('optSubSize3').value,
        sub_color1: document.getElementById('optSubColor1').value,
        sub_color2: document.getElementById('optSubColor2').value,
        sub_color3: document.getElementById('optSubColor3').value,
        sub_bg1: document.getElementById('optSubBg1').value,
        sub_bg2: document.getElementById('optSubBg2').value,
        sub_bg3: document.getElementById('optSubBg3').value,
        sub_pos: document.getElementById('optSubPos').value,
        note_size: document.getElementById('optNoteSize').value,
        note_theme: document.getElementById('optNoteColor').value,
        note_pos: document.getElementById('optNotePos').value,
        show_sub: document.getElementById('toggleScriptOverlay').checked,
        show_note: document.getElementById('toggleNoteOverlay').checked
    };

    fetch(`/api/lesson/${LESSON_ID}/set-languages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            original_lang_code: sub1 || SAVED_ORIGINAL,
            target_lang_code: sub2 || SAVED_TARGET || '',
            third_lang_code: sub3 || SAVED_THIRD || '',
            settings: visualSettings
        }),
    }).then(async r => {
        if (r.ok) {
            // Update global state immediately
            Object.assign(SAVED_SETTINGS, visualSettings);
            // Crucial: Update the SAVED_XXX variables used by logic if we didn't reload yet
            if (sub1) window.SAVED_ORIGINAL = sub1;
            if (sub2) window.SAVED_TARGET = sub2;
            if (sub3) window.SAVED_THIRD = sub3;
            console.log("[PodLearn] Settings saved successfully");
        }
    });

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
    // 1. Restore Dropdowns
    if (SAVED_ORIGINAL) document.getElementById('displaySub1').value = SAVED_ORIGINAL;
    const sub2 = document.getElementById('displaySub2');
    if (sub2 && SAVED_TARGET) sub2.value = SAVED_TARGET;
    const sub3 = document.getElementById('displaySub3');
    if (sub3 && SAVED_THIRD) sub3.value = SAVED_THIRD;

    // 2. Restore Visuals
    if (SAVED_SETTINGS && Object.keys(SAVED_SETTINGS).length > 0) {
        if (SAVED_SETTINGS.sub_size1) document.getElementById('optSubSize1').value = SAVED_SETTINGS.sub_size1;
        if (SAVED_SETTINGS.sub_size2) document.getElementById('optSubSize2').value = SAVED_SETTINGS.sub_size2;
        if (SAVED_SETTINGS.sub_size3) document.getElementById('optSubSize3').value = SAVED_SETTINGS.sub_size3;
        if (SAVED_SETTINGS.sub_color1) document.getElementById('optSubColor1').value = SAVED_SETTINGS.sub_color1;
        if (SAVED_SETTINGS.sub_color2) document.getElementById('optSubColor2').value = SAVED_SETTINGS.sub_color2;
        if (SAVED_SETTINGS.sub_color3) document.getElementById('optSubColor3').value = SAVED_SETTINGS.sub_color3;
        if (SAVED_SETTINGS.sub_bg1) document.getElementById('optSubBg1').value = SAVED_SETTINGS.sub_bg1;
        if (SAVED_SETTINGS.sub_bg2) document.getElementById('optSubBg2').value = SAVED_SETTINGS.sub_bg2;
        if (SAVED_SETTINGS.sub_bg3) document.getElementById('optSubBg3').value = SAVED_SETTINGS.sub_bg3;
        if (SAVED_SETTINGS.sub_pos) document.getElementById('optSubPos').value = SAVED_SETTINGS.sub_pos;
        if (SAVED_SETTINGS.note_size) document.getElementById('optNoteSize').value = SAVED_SETTINGS.note_size;
        if (SAVED_SETTINGS.note_theme) document.getElementById('optNoteColor').value = SAVED_SETTINGS.note_theme;
        if (SAVED_SETTINGS.note_pos) document.getElementById('optNotePos').value = SAVED_SETTINGS.note_pos;
        
        if (SAVED_SETTINGS.show_sub !== undefined) {
            document.getElementById('toggleScriptOverlay').checked = SAVED_SETTINGS.show_sub;
            toggleOverlay('script');
        }
        if (SAVED_SETTINGS.show_note !== undefined) {
            document.getElementById('toggleNoteOverlay').checked = SAVED_SETTINGS.show_note;
            toggleOverlay('note');
        }
    }
    applyVisualOptions();
    
    // Auto-load if saved
    if (SAVED_ORIGINAL || SAVED_TARGET || SAVED_THIRD) {
        console.log("[PodLearn] Restoring saved subtitles:", {SAVED_ORIGINAL, SAVED_TARGET, SAVED_THIRD});
        const status = document.getElementById('transcriptStatus');
        if (status) status.textContent = 'Restoring your saved subtitle tracks...';
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

function toggleOverlay(type) {
    if (type === 'script') {
        const isChecked = document.getElementById('toggleScriptOverlay').checked;
        document.getElementById('videoSubOverlay').style.display = isChecked ? 'flex' : 'none';
    } else if (type === 'note') {
        const isChecked = document.getElementById('toggleNoteOverlay').checked;
        document.getElementById('notePopup').style.display = isChecked ? 'block' : 'none';
    }
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
        
        // Reset absolute positioning & layout
        subOverlay.style.setProperty('top', 'auto', 'important');
        subOverlay.style.setProperty('bottom', 'auto', 'important');
        subOverlay.style.setProperty('left', 'auto', 'important');
        subOverlay.style.setProperty('right', 'auto', 'important');
        subOverlay.style.setProperty('transform', 'none', 'important');
        subOverlay.style.setProperty('align-items', 'center', 'important');
        subOverlay.style.textAlign = 'center';

        if (subPos === 'top') {
            subOverlay.style.setProperty('top', '40px', 'important');
            subOverlay.style.setProperty('left', '50%', 'important');
            subOverlay.style.setProperty('transform', 'translateX(-50%)', 'important');
        } else if (subPos === 'bottom') {
            subOverlay.style.setProperty('bottom', '40px', 'important');
            subOverlay.style.setProperty('left', '50%', 'important');
            subOverlay.style.setProperty('transform', 'translateX(-50%)', 'important');
        } else if (subPos === 'top-left') {
            subOverlay.style.setProperty('top', '40px', 'important');
            subOverlay.style.setProperty('left', '40px', 'important');
            subOverlay.style.setProperty('align-items', 'flex-start', 'important');
            subOverlay.style.textAlign = 'left';
        } else if (subPos === 'top-right') {
            subOverlay.style.setProperty('top', '40px', 'important');
            subOverlay.style.setProperty('right', '40px', 'important');
            subOverlay.style.setProperty('align-items', 'flex-end', 'important');
            subOverlay.style.textAlign = 'right';
        } else if (subPos === 'bottom-left') {
            subOverlay.style.setProperty('bottom', '40px', 'important');
            subOverlay.style.setProperty('left', '40px', 'important');
            subOverlay.style.setProperty('align-items', 'flex-start', 'important');
            subOverlay.style.textAlign = 'left';
        } else if (subPos === 'bottom-right') {
            subOverlay.style.setProperty('bottom', '40px', 'important');
            subOverlay.style.setProperty('right', '40px', 'important');
            subOverlay.style.setProperty('align-items', 'flex-end', 'important');
            subOverlay.style.textAlign = 'right';
        }
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

        // PERSISTENCE: Save settings to DB
        saveLessonSettings();
    }
}

async function saveLessonSettings() {
    const settings = {
        sub1_color: document.getElementById('optSubColor1')?.value,
        sub2_color: document.getElementById('optSubColor2')?.value,
        sub3_color: document.getElementById('optSubColor3')?.value,
        sub1_bg: document.getElementById('optSubBg1')?.value,
        sub2_bg: document.getElementById('optSubBg2')?.value,
        sub3_bg: document.getElementById('optSubBg3')?.value,
        sub1_size: document.getElementById('optSubSize1')?.value,
        sub2_size: document.getElementById('optSubSize2')?.value,
        sub3_size: document.getElementById('optSubSize3')?.value,
        sub_pos: document.getElementById('optSubPos')?.value,
        note_size: document.getElementById('optNoteSize')?.value,
        note_theme: document.getElementById('optNoteTheme')?.value,
        note_pos: document.getElementById('optNotePos')?.value,
        lookup_target: document.getElementById('optLookupTarget')?.value
    };

    try {
        await fetch(`/api/lesson/${LESSON_ID}/set-languages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                original_lang_code: document.getElementById('displaySub1')?.value,
                target_lang_code: document.getElementById('displaySub2')?.value,
                third_lang_code: document.getElementById('displaySub3')?.value,
                settings: settings
            })
        });
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

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadSavedSettings();
    applyVisualOptions();
});

function loadSavedSettings() {
    if (typeof SAVED_SETTINGS === 'undefined' || !SAVED_SETTINGS) return;
    
    // Subtitle Visuals
    if (SAVED_SETTINGS.sub1_color) document.getElementById('optSubColor1').value = SAVED_SETTINGS.sub1_color;
    if (SAVED_SETTINGS.sub2_color) document.getElementById('optSubColor2').value = SAVED_SETTINGS.sub2_color;
    if (SAVED_SETTINGS.sub3_color) document.getElementById('optSubColor3').value = SAVED_SETTINGS.sub3_color;
    
    if (SAVED_SETTINGS.sub1_bg) document.getElementById('optSubBg1').value = SAVED_SETTINGS.sub1_bg;
    if (SAVED_SETTINGS.sub2_bg) document.getElementById('optSubBg2').value = SAVED_SETTINGS.sub2_bg;
    if (SAVED_SETTINGS.sub3_bg) document.getElementById('optSubBg3').value = SAVED_SETTINGS.sub3_bg;
    
    if (SAVED_SETTINGS.sub1_size) document.getElementById('optSubSize1').value = SAVED_SETTINGS.sub1_size;
    if (SAVED_SETTINGS.sub2_size) document.getElementById('optSubSize2').value = SAVED_SETTINGS.sub2_size;
    if (SAVED_SETTINGS.sub3_size) document.getElementById('optSubSize3').value = SAVED_SETTINGS.sub3_size;
    
    if (SAVED_SETTINGS.sub_pos) document.getElementById('optSubPos').value = SAVED_SETTINGS.sub_pos;

    // Notes Visuals
    if (SAVED_SETTINGS.note_size) document.getElementById('optNoteSize').value = SAVED_SETTINGS.note_size;
    if (SAVED_SETTINGS.note_theme) document.getElementById('optNoteTheme').value = SAVED_SETTINGS.note_theme;
    if (SAVED_SETTINGS.note_pos) document.getElementById('optNotePos').value = SAVED_SETTINGS.note_pos;

    // Lookup
    if (SAVED_SETTINGS.lookup_target) document.getElementById('optLookupTarget').value = SAVED_SETTINGS.lookup_target;
}

