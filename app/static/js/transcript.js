/**
 * AuraFlow — Transcript Engine
 *
 * Manages:
 *  - Rendering dual-subtitle lines (original + translated)
 *  - Karaoke-style highlight of the current active line
 *  - Click-to-seek on any transcript line
 *  - Auto-scroll to keep active line in view
 */

// ── State ────────────────────────────────────────────────────
let mergedLines = [];           // [{texts: [t1, t2, t3], start, end}, ...]
let currentActiveIndex = -1;    // index in mergedLines
let shadowingStats = {};        // { "start_time": { count, avg, best } }
let currentTranscriptFontSize = '14.5px'; // default

/**
 * Initialize transcript logic
 */
function initTranscript() {
    console.log("[Transcript] Initializing...");
    
    // Load historical shadowing stats for this lesson
    loadShadowingStats();

    // Set initial font size from localStorage
    const savedFs = localStorage.getItem('AuraFlow_transcript_fs') || '16px';
    updateTranscriptFontSize(savedFs);
}

/**
 * Fetch historical shadowing stats from the API
 */
async function loadShadowingStats() {
    const lessonId = typeof LESSON_ID !== 'undefined' ? LESSON_ID : null;
    if (!lessonId) return;
    
    try {
        const resp = await fetch(`/api/lesson/${lessonId}/shadowing-stats`);
        const data = await resp.json();
        if (data && data.stats) {
            shadowingStats = data.stats;
            console.log("[Transcript] Loaded Shadowing Stats:", Object.keys(shadowingStats).length, "lines");
            // Refresh stats in UI if already rendered
            updateTranscriptStatsUI();
        }
    } catch (e) {
        console.error("[Transcript] Failed to load shadowing stats:", e);
    }
}

/**
 * Refresh the UI for all transcript rows to show/update stats
 */
function updateTranscriptStatsUI() {
    Object.keys(shadowingStats).forEach(key => {
        const stat = shadowingStats[key];
        const tline = document.querySelector(`.tline[data-start="${key}"]`);
        if (tline) {
            const textCol = tline.querySelector('.tline__text-col');
            if (textCol) {
                let statsContainer = textCol.querySelector('.tline__shadow-stats');
                if (!statsContainer) {
                    statsContainer = document.createElement('div');
                    statsContainer.className = 'tline__shadow-stats';
                    textCol.appendChild(statsContainer);
                }
                statsContainer.title = `Best: ${stat.best}% | Avg: ${stat.avg}%`;
                statsContainer.textContent = `🎯 ${stat.count} attempts · ${stat.best}%`;
            }
        }
    });
}

// ── Render ───────────────────────────────────────────────────

/**
 * Build the transcript UI from fetched subtitle data.
 * Called from player.js after subtitles are loaded.
 * Accepts an array of subtitle track data arrays: [track1, track2, track3]
 */
function renderTranscript(tracksDataArray) {
    // We expect 3 slots: [data1, data2, data3]
    // Filter out completely missing tracks but keep indices stable for merging
    mergedLines = buildMergedLines(tracksDataArray);

    const container = document.getElementById('transcriptLines');
    const empty = document.getElementById('transcriptEmpty');

    if (mergedLines.length === 0) {
        container.style.display = 'none';
        empty.style.display = 'block';
        empty.innerHTML = '<p>No subtitle lines found for these selections.</p>';
        return;
    }

    empty.style.display = 'none';
    container.style.display = 'block';

    let html = '';
    for (let i = 0; i < mergedLines.length; i++) {
        const line = mergedLines[i];
        const timeLabel = formatTime(line.start);
        
        let textsHtml = '';
        line.texts.forEach((text, idx) => {
            if (text) {
                const className = idx === 0 ? 'tline__original' : `tline__translated tline__translated--${idx}`;
                // Thêm logic ép ẩn display: none !important
                const hiddenStyle = (typeof isDictationMode !== 'undefined' && isDictationMode && idx > 0) ? 'style="display: none !important;"' : '';
                textsHtml += `<div class="${className}" ${hiddenStyle} title="Highlight text to translate" onmouseup="onTextSelected(event)">${escapeHtml(text)}</div>`;
            }
        });



        // Get shadowing stats for this line
        const stats = shadowingStats[roundTime(line.start)];
        const statsHtml = stats ? `
            <div class="tline__shadow-stats" title="Best: ${stats.best}% | Avg: ${stats.avg}%">
                🎯 ${stats.count} attempts · ${stats.best}%
            </div>
        ` : '';

        html += `
            <div class="tline" id="tline-${i}" data-index="${i}" data-start="${line.start}">
                <div class="tline__time-col">
                    <span class="tline__time" title="Double click to edit time" ondblclick="editTranscriptTime(${i}, event); event.stopPropagation();">${timeLabel}</span>
                    <button class="tline__more-btn" onclick="toggleTranscriptMenu(${i}, event)" title="More Actions">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                    </button>
                </div>

                <div class="tline__text-col" onclick="seekAndPlay(${line.start})">
                    <div class="tline__original" style="font-size: var(--transcript-fs, 16px);">
                        ${textsHtml}
                    </div>
                    ${statsHtml}
                </div>
                
                <div class="tline__popup-menu" id="tmenu-${i}">
                    <button class="tline__menu-item" onclick="quickNoteFromLine(${i}, event)" title="Quick Note">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z"/></svg>
                        <span>Quick Note</span>
                    </button>
                    <button class="tline__menu-item" onclick="translateFullLine(${i}, event)" title="Translate Row">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1m14 20-5-10-5 10m2-4h6"/></svg>
                        <span>Translate</span>
                    </button>
                    <button class="tline__menu-item" onclick="addNoteAtTime(${line.start}, event)" title="Add Detail Note">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        <span>Full Note</span>
                    </button>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;


    currentActiveIndex = -1;
}

/**
 * Merge multiple subtitle tracks.
 * Logic: Use the earliest starting tracks as the base if needed.
 */
function buildMergedLines(tracksArray) {
    // tracksArray: [[line, line], [line, line], [line, line]]
    if (!tracksArray || tracksArray.length === 0) return [];

    // Find the first track that actually has data to use as timeline base
    let baseIdx = tracksArray.findIndex(t => t && t.length > 0);
    if (baseIdx === -1) return [];

    const baseTrack = tracksArray[baseIdx];
    const merged = [];

    for (const o of baseTrack) {
        const texts = new Array(tracksArray.length).fill('');
        texts[baseIdx] = o.text;
        
        // Find overlapping lines in ALL other tracks
        for (let i = 0; i < tracksArray.length; i++) {
            if (i === baseIdx) continue;
            const track = tracksArray[i];
            if (!track || track.length === 0) continue;

            let bestMatch = '';
            // Find text that overlaps with our base line time-window
            // Use a slight tolerance (1.5s) in case sub tracks are slightly misaligned
            for (const t of track) {
                const overlap = Math.min(o.end, t.end) - Math.max(o.start, t.start);
                if (overlap > 0 || (t.start >= o.start - 1.5 && t.start <= o.start + 1.5)) {
                    bestMatch = t.text;
                    break; 
                }
            }
            texts[i] = bestMatch;

        }

        merged.push({
            texts: texts,
            start: o.start,
            end: o.end,
        });
    }
    return merged;
}


// ── Karaoke Highlight ────────────────────────────────────────

/**
 * Called ~10x/sec from player.js while video is playing.
 * Highlights the current active line and auto-scrolls.
 */
function updateTranscriptHighlight(currentTime) {
    if (mergedLines.length === 0) return;

    // Binary search for the active line
    const newIndex = findActiveLine(currentTime);

    if (newIndex === currentActiveIndex) {
        // Just update video subtitle overlay visibility based on exact time bounds
        updateVideoSubOverlay(currentTime);

        // DICTATION: If mode is active AND we are approaching the end of a line, check completion
        if (isDictationMode && currentActiveIndex >= 0) {
            const lineData = mergedLines[currentActiveIndex];
            if (currentTime >= lineData.end - 0.1) {
                const overlay = document.getElementById('videoSubOverlay');
                const lineEl = document.getElementById(`tline-${currentActiveIndex}`);
                
                // Prioritize player overlay inputs for immediate focus
                const playerInputs = overlay ? Array.from(overlay.querySelectorAll('.dictation-input:not(.correct)')) : [];
                const sidebarInputs = lineEl ? Array.from(lineEl.querySelectorAll('.dictation-input:not(.correct)')) : [];
                
                if (playerInputs.length > 0 || sidebarInputs.length > 0) {
                    if (ytPlayer && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                        ytPlayer.pauseVideo();
                    }
                    // Focus the first empty input in this line (favor player overlay)
                    if (playerInputs.length > 0) {
                        playerInputs[0].focus();
                    } else if (sidebarInputs.length > 0) {
                        sidebarInputs[0].focus();
                    }
                }
            }
        }
        return;
    }



    // Remove old highlight
    if (currentActiveIndex >= 0) {
        const oldEl = document.getElementById(`tline-${currentActiveIndex}`);
        if (oldEl) oldEl.classList.remove('active-sentence');
    }

    // Apply new highlight
    currentActiveIndex = newIndex;
    if (currentActiveIndex >= 0) {
        const newEl = document.getElementById(`tline-${currentActiveIndex}`);
        if (newEl) {
            newEl.classList.add('active-sentence');
            
            // Tự động cuộn danh sách phụ đề mượt mà ra giữa
            newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Cập nhật bộ đếm tiến độ
        updateProgressCounter(newIndex);
    }
    
    updateVideoSubOverlay(currentTime);
}

/**
 * Cập nhật bộ đếm "Tiến độ: X / Y câu"
 */
function updateProgressCounter(activeIndex) {
    const progressLabel = document.getElementById('progressLabel');
    if (progressLabel && mergedLines.length > 0) {
        progressLabel.textContent = `${activeIndex + 1} / ${mergedLines.length} blocks`;
    }
}

function updateVideoSubOverlay(currentTime) {
    const overlay = document.getElementById('videoSubOverlay');
    if (!overlay) return;

    // Nếu đang trong chế độ preview (mở Settings), không ghi đè overlay bằng subtitle thật
    if (typeof isInPreviewMode !== 'undefined' && isInPreviewMode) return;

    // Check if the user has disabled on-video subtitles
    const isShowEnabled = document.getElementById('toggleScriptOverlay')?.checked ?? true;
    if (!isShowEnabled) {
        overlay.style.visibility = 'hidden';
        overlay.style.display = 'none';
        return;
    }

    if (currentActiveIndex >= 0) {
        const line = mergedLines[currentActiveIndex];
        
        // NEW: Don't show subtitles if Shadowing HUD is visible AND 'Challenge Mode' is enabled
        const shadowingHUD = document.getElementById('shadowingHUD');
        const isHUDVisible = shadowingHUD && shadowingHUD.style.display === 'flex';
        const isChallengeMode = document.getElementById('toggleShadowHideSubs')?.checked || false;

        if (isHUDVisible && isChallengeMode) {
            overlay.style.visibility = 'hidden';
            overlay.style.display = 'none';
            return;
        }

        // Only show if we're strictly within the bounds

        if (currentTime >= line.start && currentTime <= line.end) {
            let html = '';

            
            // Get current visual configs from UI (Sliders return unitless numbers)
            const s1 = document.getElementById('optSubSize1')?.value || '3.5';
            const s2 = document.getElementById('optSubSize2')?.value || '3.0';
            const s3 = document.getElementById('optSubSize3')?.value || '2.5';
            // Convert to cqw for container-relative scaling. 
            // Handle both '%'-suffixed and unitless numbers (from sliders).
            const sizes = [s1, s2, s3].map(s => {
                let val = s.toString();
                if (val.endsWith('%')) return val.replace('%', 'cqw');
                if (val.endsWith('px')) return val; // Legacy fallback
                return val + 'cqw'; // Default for sliders
            });

            const c1 = document.getElementById('optSubColor1')?.value || '#ffffff';
            const c2 = document.getElementById('optSubColor2')?.value || '#ffffff';
            const c3 = document.getElementById('optSubColor3')?.value || '#ffffff';
            const colors = [c1, c2, c3];

            const b1 = document.getElementById('optSubBg1')?.value || 'rgba(0,0,0,0.75)';
            const b2 = document.getElementById('optSubBg2')?.value || 'rgba(0,0,0,0.75)';
            const b3 = document.getElementById('optSubBg3')?.value || 'rgba(0,0,0,0.75)';
            const backgrounds = [b1, b2, b3];

            line.texts.forEach((text, i) => {
                if (isDictationMode && i > 0) return;
                if (text) {

                    const cls = i === 0 ? 'vso-line' : `vso-line vso-line--${i}`;
                    const size = sizes[i] || '20px';
                    const color = colors[i] || '#ffffff';
                    let bg = backgrounds[i] || 'rgba(0,0,0,0.75)';
                    
                    const escaped = escapeHtml(text);
                    let displayHtml = escaped;

                    // DICTATION: If mode is active AND this is the primary track (index 0), use cached HTML
                    if (isDictationMode && i === 0) {
                        displayHtml = line.dictationHtml || generateDictationHTML(text, window.SAVED_ORIGINAL || 'ja', parseFloat(document.getElementById('dictationDifficulty')?.value) || 0.3);
                    }



                    html += `<span class="${cls}" 
                                  style="font-size: ${size}; color: ${color}; background: ${bg} !important; display: block; opacity: 1 !important; backdrop-filter: none !important;"
                                  onmouseup="onTextSelected(event)"
                                  ondblclick="quickNoteFromSub('${escaped.replace(/'/g, "\\'")}')"
                                  title="Highlight text to translate | Double click to add to notes">${displayHtml}</span>`;
                }
            });
            overlay.innerHTML = html;
            
            // If dictation mode, ensure the overlay is interactive
            overlay.style.pointerEvents = isDictationMode ? 'auto' : '';
            
            overlay.style.visibility = 'visible';

            overlay.style.display = 'flex'; // Ensure flex is on when visible
            return;
        }
    }
    overlay.style.visibility = 'hidden';
    overlay.style.display = 'none';
}


/**
 * Find the index of the line that should be active at `time`.
 * Returns -1 if no line covers the current time.
 */
function findActiveLine(time) {
    // Linear scan is fine for typical subtitle counts (<500 lines)
    for (let i = 0; i < mergedLines.length; i++) {
        const line = mergedLines[i];
        if (time >= line.start && time < line.end) {
            return i;
        }
    }
    // If between lines, highlight the most recent past line
    for (let i = mergedLines.length - 1; i >= 0; i--) {
        if (time >= mergedLines[i].start) {
            return i;
        }
    }
    return -1;
}


/**
 * Smoothly scroll the transcript pane to keep the active line visible.
 */
function scrollToLine(el) {
    const container = document.getElementById('transcriptBody');
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    // Target: line should be in the upper-third of the visible area
    const targetY = containerRect.top + containerRect.height * 0.3;
    const offset = elRect.top - targetY;

    if (Math.abs(offset) > 20) {
        container.scrollBy({ top: offset, behavior: 'smooth' });
    }
}


// ── Helpers ──────────────────────────────────────────────────

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function editTranscriptTime(lineIndex, event) {
    if (event) event.stopPropagation();
    const line = mergedLines[lineIndex];
    if (!line) return;

    // Use common logic for text and time
    editTranscriptLine(lineIndex, 0, event);
}

async function editTranscriptLine(lineIndex, trackIndex, event) {
    if (event) event.stopPropagation();
    const line = mergedLines[lineIndex];
    if (!line) return;

    const langSelectors = ['displaySub1', 'displaySub2', 'displaySub3'];
    const langCode = document.getElementById(langSelectors[trackIndex])?.value;
    if (!langCode) return;

    // Open Modal
    document.getElementById('editTransLineIndex').value = lineIndex;
    document.getElementById('editTransTrackIndex').value = trackIndex;
    document.getElementById('editTransLangCode').value = langCode;
    
    document.getElementById('editTransTime').value = line.start;
    document.getElementById('editTransContent').value = line.texts[trackIndex] || "";
    document.getElementById('editTransLabel').textContent = `Text (${langCode}):`;

    // Sync Slider
    const slider = document.getElementById('editTransSlider');
    if (typeof ytPlayer !== 'undefined' && ytPlayer.getDuration) {
        slider.max = ytPlayer.getDuration();
    }
    slider.value = line.start;

    document.getElementById('transcriptEditModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function syncTransInputFromSlider() {
    const slider = document.getElementById('editTransSlider');
    const input = document.getElementById('editTransTime');
    input.value = slider.value;
    if (typeof ytPlayer !== 'undefined') ytPlayer.seekTo(parseFloat(slider.value), true);
}

function syncTransSliderFromInput() {
    const slider = document.getElementById('editTransSlider');
    const input = document.getElementById('editTransTime');
    let val = parseFloat(input.value) || 0;
    slider.value = val;
    if (typeof ytPlayer !== 'undefined') ytPlayer.seekTo(val, true);
}

async function saveTransEdit() {
    const lineIndex = parseInt(document.getElementById('editTransLineIndex').value);
    const trackIndex = parseInt(document.getElementById('editTransTrackIndex').value);
    const langCode = document.getElementById('editTransLangCode').value;
    const newTime = parseFloat(document.getElementById('editTransTime').value);
    const newText = document.getElementById('editTransContent').value.trim();

    if (isNaN(newTime) || !newText) return;

    const line = mergedLines[lineIndex];

    try {
        // 1. Save Text
        const resText = await fetch(`/api/lesson/${LESSON_ID}/transcript/edit`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },

            body: JSON.stringify({
                language_code: langCode,
                line_index: lineIndex, 
                new_text: newText
            })
        });
        if (!resText.ok) throw new Error('Text update failed');
        line.texts[trackIndex] = newText;

        // 2. Save Time
        const resTime = await fetch(`/api/lesson/${LESSON_ID}/transcript/time-edit`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },

            body: JSON.stringify({
                line_index: lineIndex, 
                new_start: newTime
            })
        });
        if (!resTime.ok) throw new Error('Time update failed');
        line.start = newTime;

        closeTransEditModal();
        renderTranscriptFromState();
        updateVideoSubOverlay(ytPlayer.getCurrentTime());
    } catch (err) {
        alert("Failed to update transcript: " + err.message);
    }
}

function renderTranscriptFromState() {
    // Just a helper to refresh the DOM using existing mergedLines
    const container = document.getElementById('transcriptLines');
    let html = '';
    for (let i = 0; i < mergedLines.length; i++) {
        const line = mergedLines[i];
        const timeLabel = formatTime(line.start);
        let textsHtml = '';
        line.texts.forEach((text, idx) => {
            if (text) {
                const className = idx === 0 ? 'tline__original' : `tline__translated tline__translated--${idx}`;
                // Thêm logic ép ẩn display: none !important
                const hiddenStyle = (typeof isDictationMode !== 'undefined' && isDictationMode && idx > 0) ? 'style="display: none !important;"' : '';
                textsHtml += `<div class="${className}" ${hiddenStyle} title="Highlight text to translate" onmouseup="onTextSelected(event)">${escapeHtml(text)}</div>`;
            }
        });


        const activeClass = (i === currentActiveIndex) ? 'tline--active' : '';
        html += `
            <div class="tline ${activeClass}" id="tline-${i}" data-index="${i}" data-start="${line.start}" 
                 onclick="if(event.target.tagName.toLowerCase() !== 'input') seekAndPlay(${line.start})"
                 ondblclick="quickNoteFromLine(${i}, event)">

                <span class="tline__time">${timeLabel}</span>
                <div class="tline__text">${textsHtml}</div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function seekAndPlay(time) {
    if (ytPlayer && ytPlayer.seekTo) {
        ytPlayer.seekTo(time, true);
        ytPlayer.playVideo();
        // Try forcing play again after short delay for embedded stability
        setTimeout(() => {
            if (ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) ytPlayer.playVideo();
        }, 150);
    }
}

async function translateFullLine(index, event) {
    if (event) event.stopPropagation();
    const line = mergedLines[index];
    if (!line || !line.texts[0]) return;
    
    // Simulate selection of the first text for translation API
    const dummyEvent = {
        pageX: event.pageX,
        pageY: event.pageY
    };
    
    // Set a flag to show this is a full line translation
    onTextSelected(dummyEvent, line.texts[0]);
}

function addNoteAtTime(time, event) {
    if (event) event.stopPropagation();
    if (typeof handleAddNoteClick === 'function') {
        handleAddNoteClick(time);
    }
}



// ── Selection Lookup (Google Translate) ──────────────────────
async function onTextSelected(event) {
    const selection = window.getSelection().toString().trim();
    if (!selection || selection.length < 1) return;

    // Position tooltip near cursor with smart bounds checking
    const tooltip = document.getElementById('dictTooltip');
    const content = document.getElementById('dictContent');
    
    tooltip.style.display = 'block';
    
    // Initial positioning
    let top = event.pageY + 20;
    let left = event.pageX;

    // Check if it overflows the bottom of the screen (approx height 280px)
    const windowHeight = window.innerHeight;
    const tooltipExpectedHeight = 280; 
    
    if (top + tooltipExpectedHeight > windowHeight + window.scrollY) {
        // Not enough space below, show ABOVE cursor
        top = event.pageY - tooltipExpectedHeight - 20;
    }

    // Check right edge overflow
    const windowWidth = window.innerWidth;
    const tooltipWidth = 280;
    if (left + tooltipWidth > windowWidth) {
        left = windowWidth - tooltipWidth - 20;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    
    content.innerHTML = `<div class="dict-loading">Translating "${selection.substring(0, 15)}..."</div>`;

    try {
        // Use Backend Proxy API to avoid CORS/IP blocks
        const targetLang = document.getElementById('optLookupTarget')?.value || 'vi';
        
        const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },

            body: JSON.stringify({
                text: selection,
                target_lang: targetLang,
                source_lang: 'auto'
            })
        });
        
        const data = await res.json();

        if (!res.ok || !data.translated) {
            content.innerHTML = `<div class="dict-error">Translation failed: ${data.error || 'Server error'}</div>`;
            return;
        }

        const translation = data.translated;

        const sourceLang = data[2];

        content.innerHTML = `
            <div class="dict-header">
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span class="dict-word">${selection}</span>
                    <span class="dict-phonetic">${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}</span>
                </div>
                <button class="btn--close-dict" onclick="hideDictTooltip()" title="Close translation">✕</button>
            </div>
            <div class="dict-meaning">
                <div style="font-size: 14px; line-height: 1.5; color: var(--text-primary); margin-bottom: 15px;">
                    ${translation}
                </div>
            </div>
            <div class="dict-actions">
                <button class="btn btn--primary btn--sm" onclick="saveWordToNotes('${selection.replace(/'/g, "\\'")}', '${translation.replace(/'/g, "\\'")}')">Add to Editor</button>
            </div>
        `;

    } catch (err) {
        content.innerHTML = `<div class="dict-error">Error: ${err.message}</div>`;
    }
}

function hideDictTooltip() {
    document.getElementById('dictTooltip').style.display = 'none';
}

// Close tooltip when clicking outside
document.addEventListener('mousedown', (e) => {
    const tooltip = document.getElementById('dictTooltip');
    if (tooltip && !tooltip.contains(e.target) && !e.target.closest('.tline') && !e.target.closest('.vso-line')) {
        hideDictTooltip();
    }
});

async function saveWordToNotes(original, translated) {
    // Instead of direct saving, we load it into the note editor so user can refine it
    const textToFill = `🌐 [${original}] : ${translated}`;
    if (typeof quickNoteFromSub === 'function') {
        quickNoteFromSub(textToFill);
        hideDictTooltip();
    } else {
        console.error('quickNoteFromSub not found in notes.js');
    }
}

function quickNoteFromLine(lineIndex, event) {
    if (event) event.stopPropagation();
    const line = mergedLines[lineIndex];
    if (!line) return;
    
    // Combine all tracks text into one string or just the first one?
    // User probably wants the original + translation.
    const combinedText = line.texts.filter(Boolean).join('\n');
    
    if (typeof quickNoteFromSub === 'function') {
        quickNoteFromSub(combinedText);
    }
}


// ── Draggable Popup Logic ────────────────────────────────────
let isDraggingDict = false;
let dragStartX, dragStartY;
let tooltipStartX, tooltipStartY;

function initDraggablePopup() {
    const tooltip = document.getElementById('dictTooltip');
    if (!tooltip) return;

    // We can use the header area as the handle
    tooltip.addEventListener('mousedown', (e) => {
        const header = e.target.closest('.dict-header');
        if (!header || e.target.closest('button')) return;

        isDraggingDict = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        tooltipStartX = parseInt(tooltip.style.left) || 0;
        tooltipStartY = parseInt(tooltip.style.top) || 0;
        
        document.addEventListener('mousemove', onDragDict);
        document.addEventListener('mouseup', stopDragDict);
        
        // Prevent selection while dragging
        e.preventDefault();
    });
}

function onDragDict(e) {
    if (!isDraggingDict) return;
    const tooltip = document.getElementById('dictTooltip');
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    
    tooltip.style.left = `${tooltipStartX + dx}px`;
    tooltip.style.top = `${tooltipStartY + dy}px`;
}

function stopDragDict() {
    isDraggingDict = false;
    document.removeEventListener('mousemove', onDragDict);
    document.removeEventListener('mouseup', stopDragDict);
}

// ── Dictation Mode Implementation ───────────────────────────
let isDictationMode = false;

function toggleDictationMode() {
    if (isDictationMode) {
        disableDictationMode();
    } else {
        enableDictationMode();
    }
}

function enableDictationMode() {
    // Mutual exclusion: Turn off Shadowing if it's on
    if (typeof isShadowingMode !== 'undefined' && isShadowingMode) {
        toggleShadowingMode(); 
    }
    
    isDictationMode = true;

    document.body.classList.add('dictation-active');

    const btn = document.getElementById('btn-dictation');

    if (btn) btn.classList.add('btn--accent');
    const dBar = document.getElementById('dictationBar');
    if (dBar) dBar.style.display = 'flex';
    
    // Rerender all transcript lines with blanks
    const diff = parseFloat(document.getElementById('dictationDifficulty')?.value) || 0.3;
    const lang = window.SAVED_ORIGINAL || 'ja';
    const lines = document.querySelectorAll('.tline');
    
    lines.forEach(el => {
        const idx = parseInt(el.dataset.index);
        const line = mergedLines[idx];
        if (!line) return;
        
        // We only dictation the PRIMARY track (idx 0)
        const primaryText = line.texts[0] || "";
        const dictationHtml = generateDictationHTML(primaryText, lang, diff);
        
        const textContainer = el.querySelector('.tline__original');
        if (textContainer) {
            if (!textContainer.dataset.original) {
                textContainer.dataset.original = textContainer.innerText;
            }
            textContainer.innerHTML = dictationHtml;
        }

        // PERSIST the HTML so it doesn't flicker in overlay
        line.dictationHtml = dictationHtml; 
    });

    updateDictationProgress();

    // Hard hide all translations in sidebar
    document.querySelectorAll('.tline__translated').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
    });
}




function disableDictationMode() {
    isDictationMode = false;
    document.body.classList.remove('dictation-active');
    
    const btn = document.getElementById('btn-dictation');
    if (btn) btn.classList.remove('btn--accent');
    const dBar = document.getElementById('dictationBar');
    if (dBar) dBar.style.display = 'none';
    
    // Restore all transcript lines
    const lines = document.querySelectorAll('.tline');
    lines.forEach(el => {
        const textContainer = el.querySelector('.tline__original');
        if (textContainer && textContainer.dataset.original) {
            textContainer.innerHTML = escapeHtml(textContainer.dataset.original);
            delete textContainer.dataset.original;
        }
    });

    // Restore all translations in sidebar
    document.querySelectorAll('.tline__translated').forEach(el => {
        el.style.removeProperty('display');
    });
}




/**
 * Tối ưu hóa Dictation bằng Intl.Segmenter và giới hạn 1-2 ô trống mỗi câu
 * @param {string} text - Nội dung câu sub
 * @param {string} langCode - Mã ngôn ngữ (ví dụ 'ja', 'en')
 * @param {number} difficulty - Tỉ lệ ẩn (không còn dùng chính, thay bằng limit 1-2)
 */
function generateDictationHTML(text, langCode = 'ja', difficulty = 0.3) {
    if (!text) return "";
    
    // Fallback nếu browser quá cũ không có Intl.Segmenter
    if (typeof Intl === 'undefined' || !Intl.Segmenter) {
        return escapeHtml(text);
    }

    try {
        const segmenter = new Intl.Segmenter(langCode, { granularity: 'word' });
        const segments = Array.from(segmenter.segment(text));
        
        const candidates = [];
        segments.forEach((seg, idx) => {
            if (seg.isWordLike && seg.segment.length > 0) {
                candidates.push({ segment: seg.segment, index: idx });
            }
        });

        // Tính số lượng từ cần ẩn dựa trên tỷ lệ difficulty (vd: 0.15, 0.3, 0.5)
        let numToHide = Math.ceil(candidates.length * difficulty);
        
        // Đảm bảo luôn có ít nhất 1 từ bị đục lỗ (nếu câu có chữ), và không vượt quá tổng số từ của câu.
        if (candidates.length > 0) {
            numToHide = Math.max(1, Math.min(numToHide, candidates.length));
        } else {
            numToHide = 0;
        }


        // Chọn ngẫu nhiên hoặc chọn các từ dài nhất?
        // Ở đây tôi sẽ chọn các từ dài nhất để thử thách người dùng
        candidates.sort((a, b) => b.segment.length - a.segment.length);
        const selected = candidates.slice(0, numToHide).map(c => c.index);

        return segments.map((seg, idx) => {
            if (selected.includes(idx)) {
                const width = Math.max(seg.segment.length * 1.2, 2.5);
                return `<input type="text" 
                               class="dictation-input" 
                               data-answer="${escapeHtml(seg.segment.toLowerCase())}" 
                               style="width: ${width}em;" 
                               oninput="checkDictationWord(this)"
                               ondblclick="revealDictationWord(event, this)"
                               onkeydown="handleDictationKey(event, this)">`;

            }
            return escapeHtml(seg.segment);
        }).join("");


    } catch (e) {
        console.error("Intl.Segmenter error:", e);
        return escapeHtml(text);
    }
}





function checkDictationWord(input) {
    const val = input.value.trim().toLowerCase();
    const ans = input.dataset.answer.toLowerCase();
    
    if (val === ans) {
        input.classList.remove('incorrect');
        input.classList.add('correct');
        input.disabled = true;
        updateDictationProgress();
        
        // SYNC: If this input is in the Overlay, find the one in the transcript and mark it correct too
        // and vice versa.
        syncDictationInput(input);

        // Focus NEXT input in the SAME container
        const container = input.closest('.tline') || input.closest('.vso-line');
        if (container) {
            const allInContainer = Array.from(container.querySelectorAll('.dictation-input:not(.correct)'));
            if (allInContainer.length > 0) {
                allInContainer[0].focus();
            } else {
                // container complete!
                if (ytPlayer && ytPlayer.getPlayerState() === YT.PlayerState.PAUSED) {
                    ytPlayer.playVideo();
                }
            }
        }
    } else if (val.length >= ans.length) {

        input.classList.add('incorrect');
    } else {
        input.classList.remove('incorrect');
    }
}

function updateDictationProgress() {
    const total = document.querySelectorAll('.tline .dictation-input').length;
    const correct = document.querySelectorAll('.tline .dictation-input.correct, .tline .dictation-input.revealed').length;
    const scoreEl = document.getElementById('dictationScore');
    if (scoreEl) scoreEl.textContent = `${correct} / ${total}`;
}

function handleDictationKey(event, input) {
    if (event.key === '?' || (event.ctrlKey && event.code === 'Space')) {
        event.preventDefault();
        event.stopPropagation();
        revealDictationWord(event, input);
    }
}

function revealDictationWord(event, input) {
    if (event) event.stopPropagation();
    const ans = input.dataset.answer;

    if (!ans) return;
    
    input.value = ans;
    input.classList.remove('incorrect');
    input.classList.add('revealed');
    input.disabled = true;
    
    // Check if line complete
    const container = input.closest('.tline') || input.closest('.vso-line');
    if (container) {
        const incomplete = container.querySelectorAll('.dictation-input:not(.correct):not(.revealed)');
        if (incomplete.length === 0) {
            if (ytPlayer && ytPlayer.getPlayerState() === YT.PlayerState.PAUSED) {
                ytPlayer.playVideo();
            }
        }
    }
    updateDictationProgress();
}

function syncDictationInput(input) {
    const isOverlay = input.closest('.vso-line') !== null;
    const ans = input.dataset.answer;
    
    // Simple sync by answer text for now (might be ambiguous if same word appears twice, but okay for MVP)
    const otherInputs = document.querySelectorAll(isOverlay ? '.tline .dictation-input' : '.vso-line .dictation-input');
    otherInputs.forEach(other => {
        if (other.dataset.answer === ans && !other.classList.contains('correct')) {
            other.value = input.value;
            other.classList.add('correct');
            other.disabled = true;
        }
    });
}



// Call init since the script is loaded
// Cập nhật sự kiện khi đổi độ khó
document.addEventListener('DOMContentLoaded', () => {
    initDraggablePopup();
    
    const difficultySelect = document.getElementById('dictationDifficulty');
    if (difficultySelect) {
        difficultySelect.addEventListener('change', () => {
            if (typeof isDictationMode !== 'undefined' && isDictationMode) {
                enableDictationMode(); 
            }
        });
    }
});

async function loadShadowingStats() {
    try {
        const res = await fetch(`/api/lesson/${LESSON_ID}/shadowing-stats`);
        const data = await res.json();
        if (data.stats) {
            shadowingStats = data.stats;
        }
    } catch (err) {
        console.error("[ShadowingStats] Load error:", err);
    }
}

function updateLineShadowStats(startTime, score) {
    const key = roundTime(startTime);
    if (!shadowingStats[key]) {
        shadowingStats[key] = { count: 0, avg: 0, best: 0 };
    }
    
    const s = shadowingStats[key];
    const totalScore = (s.avg * s.count) + score;
    s.count++;
    s.avg = Math.round(totalScore / s.count);
    s.best = Math.round(Math.max(s.best, score));

    // Update the HTML content of the specific line's stat div
    const tline = document.querySelector(`.tline[data-start="${startTime}"]`);
    if (tline) {
        const textEl = tline.querySelector('.tline__text');
        let statsContainer = textEl.querySelector('.tline__shadow-stats');
        if (!statsContainer) {
            statsContainer = document.createElement('div');
            statsContainer.className = 'tline__shadow-stats';
            textEl.appendChild(statsContainer);
        }
        statsContainer.title = `Best: ${s.best}% | Avg: ${s.avg}%`;
        statsContainer.textContent = `🎯 ${s.count} attempts · ${s.best}%`;
    }
}

function roundTime(t) {
    return String(Number(Math.round(parseFloat(t) + 'e3') + 'e-3'));
}

/**
 * Toggle the visibility of the action popup menu for a specific line.
 */
function toggleTranscriptMenu(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    const menu = document.getElementById(`tmenu-${index}`);
    const btn = event.currentTarget;
    if (!menu) return;

    const isAlreadyActive = menu.classList.contains('active');

    // Close all other menus first
    document.querySelectorAll('.tline__popup-menu.active').forEach(m => {
        if (m.id !== `tmenu-${index}`) m.classList.remove('active');
    });
    document.querySelectorAll('.tline__more-btn.active').forEach(b => {
        if (b !== btn) b.classList.remove('active');
    });

    // Toggle current
    menu.classList.toggle('active');
    if (btn.classList.contains('tline__more-btn')) {
        btn.classList.toggle('active');
    }
}

/**
 * Update the global transcript font size using a CSS variable.
 */
function updateTranscriptFontSize(size) {
    currentTranscriptFontSize = size;
    document.documentElement.style.setProperty('--transcript-fs', size);
    
    // Also save to localStorage for persistence if possible
    localStorage.setItem('AuraFlow_transcript_fs', size);
}

// Global click listener to close transcript menus when clicking elsewhere
document.addEventListener('click', (e) => {
    if (!e.target.closest('.tline__more-btn') && !e.target.closest('.tline__popup-menu')) {
        document.querySelectorAll('.tline__popup-menu.active').forEach(menu => {
            menu.classList.remove('active');
        });
        document.querySelectorAll('.tline__more-btn.active').forEach(btn => {
            btn.classList.remove('active');
        });
    }
});

// Initialize font size from storage if available
document.addEventListener('DOMContentLoaded', () => {
    const savedFs = localStorage.getItem('AuraFlow_transcript_fs') || '16px';
    const savedColor1 = localStorage.getItem('AuraFlow_transcript_color_1') || '#e8ecf4';
    const savedColor2 = localStorage.getItem('AuraFlow_transcript_color_2') || '#f1c40f';
    const savedColor3 = localStorage.getItem('AuraFlow_transcript_color_3') || '#00cec9';
    const savedBg = localStorage.getItem('AuraFlow_transcript_bg') || '#111827';

    document.documentElement.style.setProperty('--transcript-fs', savedFs);
    document.documentElement.style.setProperty('--transcript-color-1', savedColor1);
    document.documentElement.style.setProperty('--transcript-color-2', savedColor2);
    document.documentElement.style.setProperty('--transcript-color-3', savedColor3);
    document.documentElement.style.setProperty('--transcript-bg', savedBg);
    
    // Sync slider if it exists
    const slider = document.getElementById('optTranscriptFs');
    if (slider) slider.value = savedFs;

    const colorPicker1 = document.getElementById('optTranscriptColor1');
    if (colorPicker1) colorPicker1.value = savedColor1;
    const colorPicker2 = document.getElementById('optTranscriptColor2');
    if (colorPicker2) colorPicker2.value = savedColor2;
    const colorPicker3 = document.getElementById('optTranscriptColor3');
    if (colorPicker3) colorPicker3.value = savedColor3;

    const bgPicker = document.getElementById('optTranscriptBg');
    if (bgPicker) bgPicker.value = savedBg;
});
