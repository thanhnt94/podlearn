import os
import sqlite3
import json
import logging
import re
from collections import Counter
from flask import current_app
from sudachipy import dictionary, tokenizer

logger = logging.getLogger(__name__)

# Global dictionary instance (Thread-safe)
_sudachi_dict = None
_sudachi_mode = None

def get_tokenizer():
    global _sudachi_dict, _sudachi_mode
    if _sudachi_dict is None:
        try:
            from sudachipy import dictionary, tokenizer
            _sudachi_dict = dictionary.Dictionary()
            # Safer split mode detection
            try:
                _sudachi_mode = tokenizer.Tokenizer.SplitMode.C
            except AttributeError:
                try:
                    from sudachipy import SplitMode
                    _sudachi_mode = SplitMode.C
                except ImportError:
                    _sudachi_mode = None
            logger.info("Sudachi dictionary initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize Sudachi: {e}")
    
    if _sudachi_dict:
        return _sudachi_dict.create()
    return None

def get_dict_paths():
    """Detect all available SQLite dictionary files (.db) and parse [src-target] metadata."""
    current_dir = os.path.dirname(os.path.abspath(__file__)) 
    root_dir = current_dir
    for _ in range(5):
        if os.path.exists(os.path.join(root_dir, 'dictionaries')):
            break
        root_dir = os.path.dirname(root_dir)
        
    # Editable dicts (Highest priority)
    editable_dir = os.path.join(root_dir, 'dictionaries', 'editable')
    # Legacy offline dicts (Secondary)
    base_dir = os.path.join(root_dir, 'dictionaries', 'database')
    
    dicts = []
    
    def scan_dir(d_path, is_editable=False):
        if not os.path.exists(d_path): return
        for f in os.listdir(d_path):
            if f.lower().endswith('.db'):
                name = f.replace('.db', '')
                path = os.path.join(d_path, f)
                match = re.search(r'\[([a-z]{2,3})-([a-z]{2,3})\]', f)
                src = match.group(1) if match else 'ja'
                target = match.group(2) if match else 'vi'
                dicts.append({
                    'name': name,
                    'path': path,
                    'src': src,
                    'target': target,
                    'editable': is_editable
                })

    scan_dir(editable_dir, is_editable=True)
    scan_dir(base_dir, is_editable=False)
    
    # Sort: editable first, then by name
    dicts.sort(key=lambda x: (not x['editable'], x['name']))
    
    legacy_paths = {d['name']: d['path'] for d in dicts}
    return dicts, legacy_paths

_dict_connections = {}

def get_dict_connection(db_path):
    if db_path not in _dict_connections:
        _dict_connections[db_path] = sqlite3.connect(db_path, check_same_thread=False)
    return _dict_connections[db_path]

def query_offline_dict(db_path, term):
    """Query a SQLite dictionary for a term."""
    if not term or term.lower() == 'skip':
        return None
    if not os.path.exists(db_path):
        return None
        
    try:
        conn = get_dict_connection(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT reading, meanings_json FROM dictionary WHERE word = ? LIMIT 1", (term,))
        row = cursor.fetchone()
        
        if row:
            reading, meanings_json = row
            try:
                means_list = json.loads(meanings_json) if meanings_json else []
                meanings = [m.get('mean', '') for m in means_list] if isinstance(means_list, list) else []
                return {
                    'reading': reading,
                    'meanings': meanings,
                    'source': os.path.basename(db_path).replace('.db', '')
                }
            except:
                return {'reading': reading, 'meanings': [], 'source': os.path.basename(db_path).replace('.db', '')}
    except Exception as e:
        logger.error(f"SQLite query error for {term} in {db_path}: {e}")
    return None

def get_all_available_dicts(src_lang='ja', target_lang='vi', lesson_id=None):
    """Returns a sorted list of all available dictionaries (DB + Offline)."""
    from app.modules.study.models import VideoDictionary
    
    # 1. Fetch DB-based dictionaries
    db_dicts = VideoDictionary.query.filter(
        VideoDictionary.language_code == src_lang,
        ((VideoDictionary.lesson_id == None) | (VideoDictionary.lesson_id == lesson_id))
    ).order_by(VideoDictionary.name.asc()).all()

    primary_db = [d for d in db_dicts if d.target_language_code == target_lang]
    secondary_db = [d for d in db_dicts if d.target_language_code != target_lang]
    
    db_list = []
    for d in primary_db + secondary_db:
        db_list.append({
            'type': 'db', 'id': d.id, 'name': d.name, 'src': d.language_code, 'target': d.target_language_code
        })

    # 2. Fetch Offline File-based dictionaries
    dicts_meta, _ = get_dict_paths()
    offline_order = [d for d in dicts_meta if d['src'] == src_lang]
    primary_off = [d for d in offline_order if d['target'] == target_lang]
    others_off = [d for d in offline_order if d['target'] != target_lang]
    
    off_list = []
    for d in primary_off + others_off:
        off_list.append({
            'type': 'file', 'path': d['path'], 'name': os.path.basename(d['path']).replace('.db', ''),
            'src': d['src'], 'target': d['target']
        })

    return db_list + off_list

def analyze_japanese_text(text, src_lang='ja', target_lang='vi', lesson_id=None, include_all=False, custom_vocab=None):
    """Segment text and lookup definitions in all available dicts."""
    tk = get_tokenizer()
    if not tk: return []

    if re.match(r'^[0-9\s.,!?;:()\[\]"\'\-+*/=<>]+$', text):
        return []

    all_dicts = get_all_available_dicts(src_lang, target_lang, lesson_id)

    i = 0
    char_matches = []
    while i < len(text):
        found_match = False
        for length in range(min(15, len(text) - i), 1, -1):
            chunk = text[i:i+length]
            if chunk.strip() == "": continue
            for d in all_dicts:
                res = None
                if d['type'] == 'db':
                    from app.modules.study.models import VideoGlossary
                    g = VideoGlossary.query.filter_by(dictionary_id=d['id'], term=chunk).first()
                    if g:
                        res = {'reading': g.reading, 'meanings': [g.definition] if g.definition else []}
                else:
                    res = query_offline_dict(d['path'], chunk)
                
                if res:
                    char_matches.append((i, i + length, res, d['name']))
                    i += length
                    found_match = True
                    break
            if found_match: break
        if not found_match: i += 1

    try:
        sudachi_tokens = tk.tokenize(text, _sudachi_mode) if _sudachi_mode is not None else tk.tokenize(text)
    except:
        sudachi_tokens = []

    token_pos_map = []
    curr_ptr = 0
    for m in sudachi_tokens:
        s = m.surface()
        start = text.find(s, curr_ptr)
        if start != -1:
            token_pos_map.append({
                'start': start, 'end': start + len(s), 'surface': s, 'lemma': m.dictionary_form(),
                'pos': m.part_of_speech()[0], 'reading': katakana_to_hiragana(m.reading_form())
            })
            curr_ptr = start + len(s)

    SKIP_POS = ['補助記号', '空白', '助詞', '助動詞', '記号']
    SKIP_WORDS = ['です', 'ます', 'でした', 'ました', 'でしょう', 'ましょう', 'だ', 'である', 'た', 'て', 'に', 'を', 'は', 'が', 'も', '。']

    final_results = []
    curr_idx = 0
    match_ptr = 0
    while curr_idx < len(text):
        current_match = None
        if match_ptr < len(char_matches) and char_matches[match_ptr][0] == curr_idx:
            current_match = char_matches[match_ptr]
            match_ptr += 1
        
        if current_match:
            start, end, res, dict_name = current_match
            surface = text[start:end]
            best_pos, best_reading, best_lemma = "名詞", res.get('reading', ''), surface
            for t in token_pos_map:
                if t['start'] >= start and t['end'] <= end:
                    best_pos = t['pos']
                    if not best_reading: best_reading = t['reading']
                    if t['start'] == start: best_lemma = t['lemma']
            
            is_polite = surface in SKIP_WORDS or best_pos in SKIP_POS
            final_results.append({
                'surface': surface, 'original': surface, 'lemma': 'skip' if is_polite else best_lemma,
                'word': 'skip' if is_polite else best_lemma, 'reading': best_reading,
                'furigana': best_reading if best_reading and best_reading != surface else None,
                'pos': '助詞' if is_polite else best_pos, 'meanings': [] if is_polite else res.get('meanings', []),
                'definition': "" if is_polite else "\n".join(res.get('meanings', [])),
                'source': 'none' if is_polite else dict_name
            })
            curr_idx = end
        else:
            token_found = False
            for t in token_pos_map:
                if t['start'] == curr_idx:
                    is_meaningless = t['pos'] in SKIP_POS or t['surface'] in SKIP_WORDS or t['lemma'] in SKIP_WORDS
                    if include_all or not is_meaningless:
                        final_results.append({
                            'surface': t['surface'], 'original': t['surface'], 
                            'lemma': 'skip' if is_meaningless else t['lemma'],
                            'word': 'skip' if is_meaningless else t['lemma'], 'reading': t['reading'],
                            'furigana': t['reading'] if t['reading'] and t['reading'] != t['surface'] else None,
                            'pos': '助詞' if is_meaningless else t['pos'], 'meanings': [], 'definition': "", 'source': 'none'
                        })
                    curr_idx = t['end']
                    token_found = True
                    break
            if not token_found:
                char = text[curr_idx]
                if char.strip():
                    final_results.append({
                        'surface': char, 'original': char, 'lemma': char, 'word': char,
                        'reading': '', 'furigana': None, 'pos': '記号', 'meanings': [], 'definition': '', 'source': 'none'
                    })
                curr_idx += 1
    return final_results

def katakana_to_hiragana(text: str) -> str:
    if not text: return ''
    return "".join(chr(ord(c) - 96) if "\u30a1" <= c <= "\u30f6" else c for c in text)

def get_definitions_for_terms(terms, src_lang='ja', target_lang='vi', lesson_id=None):
    """Batch query definitions for a list of terms."""
    from app.modules.study.models import VideoDictionary, VideoGlossary
    all_dicts = get_all_available_dicts(src_lang, target_lang, lesson_id)
    
    results = []
    for term in terms:
        if not term: continue
        item_res, source = None, 'none'
        for d in all_dicts:
            if d['type'] == 'db':
                g = VideoGlossary.query.filter_by(dictionary_id=d['id'], term=term).first()
                if g:
                    item_res = {'reading': g.reading, 'meanings': [g.definition] if g.definition else []}
                    source = d['name']
                    break
            else:
                item_res = query_offline_dict(d['path'], term)
                if item_res:
                    source = d['name']
                    break
        
        if item_res:
            means = item_res.get('meanings', [])
            results.append({
                'word': term, 'reading': item_res.get('reading', ''), 'meanings': means,
                'definition': ', '.join(means) if means else 'No definition found.', 'source': source
            })
        else:
            results.append({'word': term, 'reading': '', 'meanings': [], 'definition': 'No definition found.', 'source': 'none'})
    return results

def analyze_batch_japanese(texts):
    """Process multiple lines and return unique non-skipped tokens."""
    all_tokens = []
    seen = set()
    
    for text in texts:
        if not text: continue
        # Use simple segmentation for batch sync
        words = analyze_japanese_text(text, include_all=False)
        for w in words:
            lemma = w.get('lemma')
            if lemma and lemma != 'skip' and lemma not in seen:
                all_tokens.append(w)
                seen.add(lemma)
                
    return all_tokens
