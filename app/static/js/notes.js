/**
 * AuraFlow — Notes System
 *
 * Manages:
 *  - Fetching, creating, deleting notes
 *  - Tracking current video time and showing note popups over the video
 *  - Rendering the notes list
 */

// ── State ────────────────────────────────────────────────────
let notesList = [];              // Array of {id, timestamp, content, created_at}
let currentNoteTimeRaw = 0;      // Precise seconds for a new note
let activeNoteDisplayedId = null; // ID of currently shown popup note

// ── Initialization ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadNotes();
    // Force hide popup on start
    const popup = document.getElementById('notePopup');
    if (popup) popup.style.display = 'none';
});

// ── UI Updates (from Player Time Polling) ────────────────────
function checkNotePopup(currentTime) {
    // Update the "Add note @ 0:00" button text continuously
    currentNoteTimeRaw = currentTime;
    const btnTimeSpan = document.getElementById('currentNoteTime');
    if (btnTimeSpan) {
        btnTimeSpan.textContent = formatNoteTime(currentTime);
    }

    if (document.body.classList.contains('dictation-active')) return;


    const popup = document.getElementById('notePopup');
    if (!popup) return;

    // Respect toggle
    const toggle = document.getElementById('toggleNoteOverlay');
    if (toggle && !toggle.checked) {
        popup.style.display = 'none';
        popup.innerHTML = '';
        activeNoteDisplayedId = null;
        return;
    }

    if (!notesList.length) {
        popup.style.display = 'none';
        return;
    }

    // REQUIREMENT: Show notes X seconds BEFORE and stay for Y seconds total
    const beforeSecs = (typeof NOTE_BEFORE !== 'undefined') ? NOTE_BEFORE : 2.0;
    const totalSecs = (typeof NOTE_DURATION !== 'undefined') ? NOTE_DURATION : 5.0;

    const activeNotes = notesList
        .filter(n => currentTime >= n.timestamp - beforeSecs && currentTime <= n.timestamp - beforeSecs + totalSecs)
        .sort((a, b) => a.timestamp - b.timestamp);


    if (activeNotes.length === 0) {
        if (activeNoteDisplayedId !== null) {
            popup.style.display = 'none';
            popup.innerHTML = '';
            activeNoteDisplayedId = null;
        }
        return;
    }

    // Identify if the stack has changed to avoid redundant re-renders
    const currentStackIds = activeNotes.map(n => n.id).join(',');
    if (activeNoteDisplayedId === currentStackIds) return;

    // Re-render the Stack
    activeNoteDisplayedId = currentStackIds;
    popup.innerHTML = '';
    
    // Reset container styles to let items shine
    popup.style.padding = '0';
    popup.style.background = 'transparent';
    popup.style.border = 'none';
    popup.style.backdropFilter = 'none';
    popup.style.boxShadow = 'none';

    activeNotes.forEach(note => {
        const item = document.createElement('div');
        item.className = 'video-note-item';
        
        // Premium Divided Look: Yellow Icon Side | Text Side
        item.style.display = 'flex';
        item.style.alignItems = 'stretch';
        item.style.background = 'rgba(15, 23, 42, 0.95)';
        item.style.border = '1px solid rgba(255, 255, 255, 0.15)';
        item.style.borderRadius = '12px';
        item.style.overflow = 'hidden';
        item.style.marginBottom = '10px';
        item.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        item.style.minWidth = '260px';
        item.style.maxWidth = '420px';
        item.style.animation = 'noteFadeIn 0.3s ease';

        const iconCol = `
            <div style="background: #FFD700; width: 48px; display:flex; justify-content:center; align-items:center; flex-shrink:0;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1c2c" stroke-width="2.5">
                    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"></path>
                </svg>
            </div>
        `;
        
        const contentCol = `
            <div style="padding: 14px 18px; flex: 1; color: #fff; font-size: 14px; font-weight: 500; line-height: 1.5; text-align: left;">
                ${note.content}
            </div>
        `;
        
        item.innerHTML = iconCol + contentCol;
        popup.appendChild(item);
    });



    popup.style.display = 'flex';
    popup.style.flexDirection = 'column';
    popup.style.gap = '8px';

    if (typeof applyVisualOptions === 'function') applyVisualOptions();
}

// ── API Operations ───────────────────────────────────────────
async function loadNotes() {
    try {
        const res = await fetch(`/api/lesson/${LESSON_ID}/notes`);
        if (!res.ok) throw new Error('Failed to load notes');
        const data = await res.json();
        notesList = data.notes || [];
        renderNotesList();
    } catch (err) {
        console.error('[AuraFlow] Error loading notes:', err);
    }
}

async function saveNote() {
    const input = document.getElementById('noteInput');
    const content = input.value.trim();
    
    if (!content) {
        alert('Please enter a note.');
        return;
    }

    try {
        const timestamp = currentNoteTimeRaw;
        
        const res = await fetch(`/api/lesson/${LESSON_ID}/notes`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                timestamp: timestamp,
                content: content
            })
        });

        if (!res.ok) throw new Error('Failed to save note');
        
        const data = await res.json();
        notesList.push(data.note);
        notesList.sort((a, b) => a.timestamp - b.timestamp);
        
        // Reset UI
        input.value = '';
        cancelNote();
        renderNotesList();

        // Seek back slightly and play to see the note trigger immediately
        if (typeof ytPlayer !== 'undefined' && ytPlayer && typeof isPlayerReady !== 'undefined' && isPlayerReady) {
            ytPlayer.seekTo(timestamp - 0.5, true);
            ytPlayer.playVideo();
        }
    } catch (err) {
        console.error('[AuraFlow] Error saving note:', err);
        alert('Error saving note.');
    }
}

async function deleteNote(noteId, event) {
    event.stopPropagation(); // prevent clicking the note row (which seeks)
    
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
        const res = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCsrfToken() }
        });


        if (!res.ok) throw new Error('Failed to delete note');
        
        notesList = notesList.filter(n => n.id !== noteId);
        
        // Clear popup if the deleted note is currently showing
        if (activeNoteDisplayedId === noteId) {
            document.getElementById('notePopup').style.display = 'none';
            activeNoteDisplayedId = null;
        }

        renderNotesList();
    } catch (err) {
        console.error('[AuraFlow] Error deleting note:', err);
        alert('Error deleting note.');
    }
}

// ── UI Actions ───────────────────────────────────────────────
function handleAddNoteClick() {
    if (typeof ytPlayer !== 'undefined' && ytPlayer && typeof isPlayerReady !== 'undefined' && isPlayerReady) {
        ytPlayer.pauseVideo();
    }
    
    document.getElementById('addNoteBtn').style.display = 'none';
    const group = document.getElementById('noteInputGroup');
    group.style.display = 'block';
    
    setTimeout(() => {
        document.getElementById('noteInput').focus();
    }, 100);
}

function cancelNote() {
    document.getElementById('noteInputGroup').style.display = 'none';
    document.getElementById('addNoteBtn').style.display = 'flex';
    document.getElementById('noteInput').value = '';
    
    if (typeof ytPlayer !== 'undefined' && ytPlayer && typeof isPlayerReady !== 'undefined' && isPlayerReady) {
        ytPlayer.playVideo();
    }
}

function renderNotesList() {
    const listEl = document.getElementById('notesList');
    const emptyEl = document.getElementById('notesEmpty');
    const countEl = document.getElementById('notesCount');
    
    countEl.textContent = `${notesList.length} note${notesList.length !== 1 ? 's' : ''}`;

    if (notesList.length === 0) {
        emptyEl.style.display = 'block';
        // Clear all existing notes items
        const items = listEl.querySelectorAll('.note-item');
        items.forEach(i => i.remove());
        return;
    }

    emptyEl.style.display = 'none';
    
    let html = '';
    notesList.forEach(note => {
        const timeStr = formatNoteTime(note.timestamp);
        html += `
            <div class="note-item" onclick="if(typeof seekTo !== 'undefined') seekTo(${note.timestamp})">
                <div class="note-item__time" title="Double click to edit time" ondblclick="editNoteTime(${note.id}, ${note.timestamp}, event)">${timeStr}</div>
                <div class="note-item__content" title="Double click to edit text" ondblclick="editNoteText(${note.id}, event)">${escapeHtmlNotes(note.content)}</div>
                <div class="note-item__actions">
                    <button class="btn btn--secondary btn--sm note-item__edit" onclick="editNoteText(${note.id}, event)" title="Edit note">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn btn--danger btn--sm note-item__delete" onclick="deleteNote(${note.id}, event)" title="Delete note">✕</button>
                </div>
            </div>
        `;
    });
    
    // Remove existing notes items
    const items = listEl.querySelectorAll('.note-item');
    items.forEach(i => i.remove());
    
    // Add new ones
    listEl.insertAdjacentHTML('beforeend', html);
}

async function editNoteText(noteId, event) {
    if (event) event.stopPropagation();
    const note = notesList.find(n => n.id === noteId);
    if (!note) return;

    // Open Modal
    document.getElementById('editNoteId').value = noteId;
    document.getElementById('editNoteTime').value = note.timestamp;
    document.getElementById('editNoteContent').value = note.content;
    
    // Sync Slider Range
    const slider = document.getElementById('editNoteSlider');
    if (typeof ytPlayer !== 'undefined' && ytPlayer.getDuration) {
        const duration = ytPlayer.getDuration();
        slider.max = duration;
        const durText = document.getElementById('editNoteDurationText');
        if (durText) durText.textContent = Math.floor(duration) + 's';
    }
    slider.value = note.timestamp;

    document.getElementById('noteEditModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function syncEditInputFromSlider() {
    const slider = document.getElementById('editNoteSlider');
    const input = document.getElementById('editNoteTime');
    input.value = slider.value;
    
    // Sync video seek too!
    if (typeof ytPlayer !== 'undefined') {
        ytPlayer.seekTo(parseFloat(slider.value), true);
    }
}

function syncEditSliderFromInput() {
    const slider = document.getElementById('editNoteSlider');
    const input = document.getElementById('editNoteTime');
    let val = parseFloat(input.value) || 0;
    if (val > slider.max) val = slider.max;
    slider.value = val;

    // Sync video seek
    if (typeof ytPlayer !== 'undefined') {
        ytPlayer.seekTo(val, true);
    }
}

async function saveNoteEdit() {
    const noteId = parseInt(document.getElementById('editNoteId').value);
    const newTime = parseFloat(document.getElementById('editNoteTime').value);
    const newContent = document.getElementById('editNoteContent').value.trim();

    if (isNaN(newTime) || !newContent) {
        alert("Please fill both time and content.");
        return;
    }

    const note = notesList.find(n => n.id === noteId);
    if (!note) return;

    try {
        const res = await fetch(`/api/notes/${noteId}`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ 
                content: newContent,
                timestamp: newTime
            })
        });

        if (!res.ok) throw new Error('Update failed');
        
        note.content = newContent;
        note.timestamp = newTime;
        notesList.sort((a, b) => a.timestamp - b.timestamp);
        
        closeNoteEditModal();
        renderNotesList();
    } catch (err) {
        alert("Failed to update note: " + err.message);
    }
}

async function editNoteTime(noteId, oldTime, event) {
    // Re-route to the same modal
    editNoteText(noteId, event);
}

// ── Helpers ──────────────────────────────────────────────────
function formatNoteTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtmlNotes(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function quickNoteFromSub(text) {
    // Only works if paused (handled by CSS pointer-events too)
    if (typeof ytPlayer === 'undefined' || !ytPlayer) return;
    
    // Switch to notes tab
    if (typeof switchRightTab === 'function') switchRightTab('notes');
    
    // Open add form
    handleAddNoteClick();
    
    // Fill text
    const input = document.getElementById('noteInput');
    if (input) {
        input.value = text;
        input.focus();
    }
}
