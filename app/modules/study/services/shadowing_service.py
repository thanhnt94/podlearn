import re
import difflib
import pykakasi
from app.core.extensions import db
from app.modules.study.models import Lesson, Sentence
from app.modules.study.signals import shadowing_completed

# Initialize pykakasi
kks = pykakasi.kakasi()

def clean_jp_text(text):
    """Remove all whitespace, tabs, newlines, and common punctuation."""
    return re.sub(r'[ \s\t\n.,!?。、！？「」『』（）()\[\]\-]', '', text)

def get_japanese_segments(text):
    """
    Step 1: Remove punctuation but KEEP English/Numbers
    Returns (hira_only, all_segments)
    """
    text = re.sub(r'[\s.,!?。、！？！]', ' ', text)
    result = kks.convert(text)
    
    hira_only = []
    all_segments = []
    
    for item in result:
        h = item['hira'].strip()
        o = item['orig'].strip()
        if not o: continue
        
        # If the origin has English/Numbers, treat as English segment
        if re.search(r'[a-zA-Z0-9]', o):
            all_segments.append(o)
        else:
            # It's Japanese (Kanji/Kana)
            all_segments.append(h)
            hira_only.append(h)
    
    return hira_only, all_segments

def evaluate_pronunciation(user_id, lesson_id, original_text, spoken_text, lang, start_time=None, end_time=None, sentence_id=None):
    """
    Logic for scoring pronunciation and emitting shadowing-completed signal.
    """
    raw_score = 0
    hira_score = 0
    
    if lang == 'ja':
        # Japanese specific scoring
        def clean_jp_only(text):
            return re.sub(r'[^\u3040-\u30FF\u4E00-\u9FFF]', '', text)

        orig_clean = clean_jp_only(original_text)
        spoken_clean = clean_jp_only(spoken_text)

        # If original text has no Japanese characters (e.g. all English) -> Auto Pass
        if len(orig_clean) == 0:
            final_score = 100
        else:
            raw_matcher = difflib.SequenceMatcher(None, orig_clean, spoken_clean)
            raw_matches = sum(block.size for block in raw_matcher.get_matching_blocks())
            raw_score = raw_matches / len(orig_clean)

            orig_hira = "".join([item['hira'] for item in kks.convert(orig_clean)])
            spoken_hira = "".join([item['hira'] for item in kks.convert(spoken_clean)])

            hira_matcher = difflib.SequenceMatcher(None, orig_hira, spoken_hira)
            hira_matches = sum(block.size for block in hira_matcher.get_matching_blocks())
            hira_score = hira_matches / len(orig_hira) if len(orig_hira) > 0 else 1.0
            
            final_score = min(100, int(max(raw_score, hira_score) * 100))
    else:
        orig_words = re.findall(r'\w+', original_text.lower())
        spoken_words = re.findall(r'\w+', spoken_text.lower())
        if not orig_words:
            final_score = 100
        else:
            match_count = sum(1 for w in spoken_words if w in orig_words)
            final_score = min(100, int((match_count / len(orig_words)) * 100))

    # EMIT SIGNAL FOR HISTORY
    try:
        video_id = None
        s_id = None
        l_id = None
        
        if sentence_id:
            sentence = Sentence.query.get(int(sentence_id))
            if sentence:
                s_id = sentence.id
                video_id = getattr(sentence, 'source_video_id', None)
        elif lesson_id:
            lesson = Lesson.query.get(int(lesson_id))
            if lesson and lesson.user_id == user_id:
                l_id = lesson.id
                video_id = lesson.video_id
        
        shadowing_completed.send('shadowing_service',
            user_id=user_id,
            video_id=video_id,
            lesson_id=l_id,
            sentence_id=s_id,
            start_time=float(start_time) if start_time is not None else 0.0,
            end_time=float(end_time) if end_time is not None else (float(start_time) + 2.0 if start_time else 0.0),
            original_text=original_text,
            spoken_text=spoken_text,
            accuracy_score=final_score
        )
            
    except Exception as e:
        import traceback
        print(f"[Shadowing Signal ERROR] Failed to emit!")
        traceback.print_exc()

    # ── GENERATE DIFF HTML ────────────────────────────────
    diff_html = ""
    if lang == 'ja':
        s1 = "".join([item['hira'] for item in kks.convert(orig_clean)])
        s2 = "".join([item['hira'] for item in kks.convert(spoken_clean)])
    else:
        s1 = original_text.lower()
        s2 = spoken_text.lower()

    matcher = difflib.SequenceMatcher(None, s1, s2)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            diff_html += f'<span class="text-emerald-400">{s2[j1:j2]}</span>'
        elif tag == 'replace':
            diff_html += f'<span class="text-rose-500 underline decoration-rose-500/30">{s2[j1:j2]}</span>'
        elif tag == 'insert':
            diff_html += f'<span class="text-rose-400 opacity-70 italic">{s2[j1:j2]}</span>'
        elif tag == 'delete':
            diff_html += f'<span class="text-rose-600/50 line-through decoration-rose-600/30">{s1[i1:i2]}</span>'

    result = {
        "score": final_score,
        "original_text": original_text,
        "spoken_text": spoken_text,
        "diff_html": diff_html
    }

    if lang == 'ja':
        _, orig_full = get_japanese_segments(original_text)
        _, spoken_full = get_japanese_segments(spoken_text)
        result.update({
            "original_hira": " ".join(orig_full),
            "spoken_hira": " ".join(spoken_full),
            "debug": {"raw_score": int(raw_score*100), "hira_score": int(hira_score*100)}
        })
    
    return result
