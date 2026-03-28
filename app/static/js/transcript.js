/**
 * PodLearn — Transcript Engine
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
                // Add dblclick to edit. We need to know which track_id this is.
                // We'll store track types in a let/const so we can find them.
                textsHtml += `<div class="${className}" title="Double click to edit" ondblclick="editTranscriptLine(${i}, ${idx}, event)">${escapeHtml(text)}</div>`;
            }
        });

        html += `
            <div class="tline" id="tline-${i}" data-index="${i}" data-start="${line.start}">
                <span class="tline__time" title="Double click to edit time" ondblclick="editTranscriptTime(${i}, event)">${timeLabel}</span>
                <div class="tline__text">
                    ${textsHtml}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

    // Attach click-to-seek
    container.querySelectorAll('.tline').forEach(el => {
        el.addEventListener('click', () => {
            const start = parseFloat(el.dataset.start);
            seekTo(start);
        });
    });

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
            for (const t of track) {
                if (t.start < o.end && t.end > o.start) {
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
        return;
    }

    // Remove old highlight
    if (currentActiveIndex >= 0) {
        const oldEl = document.getElementById(`tline-${currentActiveIndex}`);
        if (oldEl) oldEl.classList.remove('tline--active');
    }

    // Apply new highlight
    currentActiveIndex = newIndex;
    if (currentActiveIndex >= 0) {
        const newEl = document.getElementById(`tline-${currentActiveIndex}`);
        if (newEl) {
            newEl.classList.add('tline--active');
            scrollToLine(newEl);
        }
    }
    
    updateVideoSubOverlay(currentTime);
}

function updateVideoSubOverlay(currentTime) {
    const overlay = document.getElementById('videoSubOverlay');
    if (!overlay) return;

    if (currentActiveIndex >= 0) {
        const line = mergedLines[currentActiveIndex];
        // Only show if we're strictly within the bounds
        if (currentTime >= line.start && currentTime <= line.end) {
            let html = '';
            
            // Get current visual configs from UI
            const s1 = document.getElementById('optSubSize1')?.value || '24px';
            const s2 = document.getElementById('optSubSize2')?.value || '20px';
            const s3 = document.getElementById('optSubSize3')?.value || '18px';
            const sizes = [s1, s2, s3];

            const c1 = document.getElementById('optSubColor1')?.value || '#ffffff';
            const c2 = document.getElementById('optSubColor2')?.value || '#ffffff';
            const c3 = document.getElementById('optSubColor3')?.value || '#ffffff';
            const colors = [c1, c2, c3];

            const b1 = document.getElementById('optSubBg1')?.value || 'rgba(0,0,0,0.75)';
            const b2 = document.getElementById('optSubBg2')?.value || 'rgba(0,0,0,0.75)';
            const b3 = document.getElementById('optSubBg3')?.value || 'rgba(0,0,0,0.75)';
            const backgrounds = [b1, b2, b3];

            line.texts.forEach((text, i) => {
                if (text) {
                    const cls = i === 0 ? 'vso-line' : `vso-line vso-line--${i}`;
                    const size = sizes[i] || '20px';
                    const color = colors[i] || '#ffffff';
                    let bg = backgrounds[i] || 'rgba(0,0,0,0.75)';
                    
                    const escaped = escapeHtml(text);
                    html += `<span class="${cls}" 
                                  style="font-size: ${size}; color: ${color}; background: ${bg} !important; display: block; opacity: 1 !important; backdrop-filter: none !important;"
                                  onclick="quickNoteFromSub('${escaped.replace(/'/g, "\\'")}')"
                                  title="Click to quickly add this to your notes">${escaped}</span>`;
                }
            });
            overlay.innerHTML = html;
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
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
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
                textsHtml += `<div class="${className}" title="Double click to edit" ondblclick="editTranscriptLine(${i}, ${idx}, event)">${escapeHtml(text)}</div>`;
            }
        });
        const activeClass = (i === currentActiveIndex) ? 'tline--active' : '';
        html += `
            <div class="tline ${activeClass}" id="tline-${i}" data-index="${i}" data-start="${line.start}">
                <span class="tline__time">${timeLabel}</span>
                <div class="tline__text">${textsHtml}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    // Re-attach listeners
    container.querySelectorAll('.tline').forEach(el => {
        el.addEventListener('click', () => {
            seekTo(parseFloat(el.dataset.start));
        });
    });
}
