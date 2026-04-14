/**
 * PodLearn — AI Insights Engine
 * 
 * Fetches and renders AI-generated linguistic analysis (grammar, nuance, context).
 */

let aiInsights = [];
let isAIInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    // Initial load will happen when tab is first clicked or if we want it eager
    // For now, let's do it eager so data is ready
    if (typeof LESSON_ID !== 'undefined') {
        initAIInsights();
    }
});

async function initAIInsights() {
    if (isAIInitialized) return;
    
    const container = document.getElementById('aiInsightsList');
    const videoId = typeof YOUTUBE_ID !== 'undefined' ? YOUTUBE_ID : null; // Wait, we need the internal video ID
    // Actually, we can get it from the lesson object or pass it from template
    // In player.html, we have LESSON_ID. Let's find the video ID.
    // The API /api/ai/insights/<video_id> needs the integer ID.
    
    // Let's use a trick: window.__VIDEO_ID__ if we add it to template, or just fetch via lesson
    // Since we don't have video_id globally in player.js (only youtube_id), 
    // let's check if we can get it. 
    // In player.html:  var YOUTUBE_ID = '{{ lesson.video.youtube_id }}';
    
    // I'll add window.VIDEO_ID to player.html.
    
    const internalVideoId = window.VIDEO_ID;
    if (!internalVideoId) {
        if (container) container.innerHTML = '<div class="error-state">Internal Video ID missing.</div>';
        return;
    }

    try {
        const resp = await fetch(`/api/ai/insights/${internalVideoId}`);
        const data = await resp.json();
        
        if (data && data.insights) {
            aiInsights = data.insights;
            renderAIInsights();
            isAIInitialized = true;
        } else {
            if (container) container.innerHTML = '<div class="empty-state">No AI insights found for this video.</div>';
        }
    } catch (e) {
        console.error("[AI Insights] Fetch failed:", e);
        if (container) container.innerHTML = '<div class="error-state">Failed to load AI Insights.</div>';
    }
}

function renderAIInsights() {
    const container = document.getElementById('aiInsightsList');
    const countEl = document.getElementById('aiInsightCount');
    
    if (!container) return;
    if (aiInsights.length === 0) {
        container.innerHTML = '<div class="empty-state">No linguistic analysis available yet.</div>';
        return;
    }

    if (countEl) countEl.textContent = `${aiInsights.length} items`;

    let html = '';
    aiInsights.forEach((insight, idx) => {
        const timeLabel = formatTime(insight.start);
        
        html += `
            <div class="insight-card glass" id="insight-${idx}" onclick="seekTo(${insight.start})">
                <div class="insight-card__header">
                    <span class="insight-card__time">${timeLabel}</span>
                    <span class="insight-card__index">#${insight.index + 1}</span>
                </div>
                
                <div class="insight-card__body">
                    ${insight.short ? `<div class="insight-section"><div class="insight-label blue">TLDR</div><p>${insight.short}</p></div>` : ''}
                    ${insight.grammar ? `<div class="insight-section"><div class="insight-label purple">Grammar</div><p>${insight.grammar}</p></div>` : ''}
                    ${insight.nuance ? `<div class="insight-section"><div class="insight-label emerald">Nuance</div><p>${insight.nuance}</p></div>` : ''}
                    ${insight.context ? `<div class="insight-section"><div class="insight-label amber">Context</div><p>${insight.context}</p></div>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Sync AI list highlight with current video time.
 */
function updateAIHighlight(currentTime) {
    if (!isAIInitialized || aiInsights.length === 0) return;

    let activeIdx = -1;
    for (let i = 0; i < aiInsights.length; i++) {
        if (currentTime >= aiInsights[i].start && currentTime < aiInsights[i].end) {
            activeIdx = i;
            break;
        }
    }

    // If not precisely in a range, find the closest previous
    if (activeIdx === -1) {
        for (let i = aiInsights.length - 1; i >= 0; i--) {
            if (currentTime >= aiInsights[i].start) {
                activeIdx = i;
                break;
            }
        }
    }

    // Highlight UI
    const cards = document.querySelectorAll('.insight-card');
    cards.forEach((card, idx) => {
        if (idx === activeIdx) {
            card.classList.add('active');
            // Optional: scroll into view if the AI tab is open
            const pane = document.getElementById('pane-ai');
            if (pane && pane.classList.contains('active-pane')) {
                // Throttled scroll
                if (!card.dataset.scrolled || Math.abs(parseFloat(card.dataset.lastTime) - currentTime) > 2) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.dataset.scrolled = "true";
                    card.dataset.lastTime = currentTime;
                }
            }
        } else {
            card.classList.remove('active');
            delete card.dataset.scrolled;
        }
    });
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
