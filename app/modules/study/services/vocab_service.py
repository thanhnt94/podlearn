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
    """Detect all available SQLite dictionary files (.db)."""
    # Accurate path to root from app/modules/study/services/vocab_service.py
    current_dir = os.path.dirname(os.path.abspath(__file__)) 
    # Search upwards for the 'dictionaries' folder
    root_dir = current_dir
    for _ in range(5): # Go up at most 5 levels
        if os.path.exists(os.path.join(root_dir, 'dictionaries')):
            break
        root_dir = os.path.dirname(root_dir)
        
    base_dir = os.path.join(root_dir, 'dictionaries', 'database')
    
    paths = {}
    if os.path.exists(base_dir):
        for f in os.listdir(base_dir):
            if f.lower().endswith('.db'):
                name = f.replace('.db', '')
                paths[name] = os.path.join(base_dir, f)
    
    print(f"DEBUG: Found {len(paths)} dictionaries in {base_dir}: {list(paths.keys())}")
    return paths

_dict_connections = {}

def get_dict_connection(db_path):
    if db_path not in _dict_connections:
        _dict_connections[db_path] = sqlite3.connect(db_path, check_same_thread=False)
    return _dict_connections[db_path]

def query_offline_dict(db_path, term):
    """Query a SQLite dictionary for a term with high-performance indexing."""
    if not os.path.exists(db_path):
        return None
        
    try:
        conn = get_dict_connection(db_path)
        cursor = conn.cursor()
        # idx_word ensure this is lightning fast
        cursor.execute("SELECT reading, meanings_json FROM dictionary WHERE word = ? LIMIT 1", (term,))
        row = cursor.fetchone()
        
        if row:
            reading, meanings_json = row
            means_list = json.loads(meanings_json)
            meanings = [m.get('mean', '') for m in means_list]
            return {
                'reading': reading,
                'meanings': meanings,
                'source': os.path.basename(db_path).replace('.db', '')
            }
    except Exception as e:
        logger.error(f"SQLite query error for {term} in {db_path}: {e}")
    return None

def get_definitions_for_terms(terms, priority='mazii_v2_results'):
    """Bulk lookup using JSON dictionaries."""
    dict_paths = get_dict_paths()
    results = []
    
    # Establish dictionary priority order
    order = []
    if priority in dict_paths:
        order.append(priority)
    
    other_dicts = [k for k in dict_paths.keys() if k != priority]
    order.extend(other_dicts)

    for term in terms:
        found = False
        for d_name in order:
            if d_name not in dict_paths: continue
            res = query_offline_dict(dict_paths[d_name], term)
            if res:
                results.append({
                    'word': term,
                    'reading': res.get('reading', ''),
                    'meanings': res.get('meanings', []),
                    'definition': "\n".join(res.get('meanings', [])),
                    'source': res.get('source', '')
                })
                found = True
                break
        
        if not found:
            results.append({
                'word': term,
                'reading': '',
                'meanings': [],
                'definition': '',
                'source': 'none'
            })
            
    return results

def analyze_japanese_text(text, priority='mazii_v2_results', strict=False, include_all=False, custom_vocab=None):
    """Segment text using Sudachi and lookup definitions in JSON dicts."""
    tk = get_tokenizer()
    if not tk: return []

    if re.match(r'^[0-9\s.,!?;:()\[\]"\'\-+*/=<>]+$', text):
        return []

    dict_paths = get_dict_paths()
    dict_order = ['mazii_offline', 'javidict', 'suge', 'jamdict']
    order = []
    if priority in dict_order:
        order.append(priority)
    for d in dict_order:
        if d not in order and d in dict_paths:
            order.append(d)
    for d in dict_paths:
        if d not in order:
            order.append(d)

    # 1. First, perform character-based maximal matching against dictionaries
    i = 0
    char_matches = [] # List of (start, end, entry)
    
    while i < len(text):
        found_match = False
        # Try matching window of up to 15 characters
        for length in range(min(15, len(text) - i), 1, -1):
            chunk = text[i:i+length]
            if chunk.strip() == "": continue
            
            # Check dictionaries in priority order
            for d_name in order:
                if d_name not in dict_paths: continue
                res = query_offline_dict(dict_paths[d_name], chunk)
                if res:
                    char_matches.append((i, i + length, res))
                    i += length
                    found_match = True
                    break
            if found_match: break
        
        if not found_match:
            i += 1

    # 2. Use Sudachi to fill the gaps and provide POS/Reading for non-dict parts
    try:
        sudachi_tokens = tk.tokenize(text, _sudachi_mode) if _sudachi_mode is not None else tk.tokenize(text)
    except Exception as e:
        logger.error(f"Sudachi error: {e}")
        sudachi_tokens = []

    token_pos_map = []
    curr_ptr = 0
    for m in sudachi_tokens:
        s = m.surface()
        start = text.find(s, curr_ptr)
        if start != -1:
            end = start + len(s)
            token_pos_map.append({
                'start': start,
                'end': end,
                'surface': s,
                'lemma': m.dictionary_form(),
                'pos': m.part_of_speech()[0],
                'reading': katakana_to_hiragana(m.reading_form())
            })
            curr_ptr = end

    # Meaningless / Helper words to dim (Particles, Auxiliary Verbs, Symbols, Polite Endings)
    SKIP_POS = ['補助記号', '空白', '助詞', '助動詞', '記号']
    SKIP_WORDS = [
        'です', 'ます', 'でした', 'ました', 'でしょう', 'ましょう', 
        'だ', 'である', 'た', 'て', 'に', 'を', 'は', 'が', 'も', 'です。', 'ます。',
        'します', 'しました', 'し', 'しま', 'す'
    ]

    final_results = []
    curr_idx = 0
    match_ptr = 0

    while curr_idx < len(text):
        # Check if current index is start of a dictionary match
        current_match = None
        if match_ptr < len(char_matches) and char_matches[match_ptr][0] == curr_idx:
            current_match = char_matches[match_ptr]
            match_ptr += 1
        
        if current_match:
            start, end, res = current_match
            surface = text[start:end]
            
            best_pos = "名詞"
            best_reading = res.get('reading', '')
            
            for t in token_pos_map:
                if t['start'] >= start and t['end'] <= end:
                    best_pos = t['pos']
                    if not best_reading: best_reading = t['reading']
            
            # Check if this dictionary match should be dimmed
            is_polite_ending = surface in SKIP_WORDS or best_pos in SKIP_POS
            
            furigana = None
            if best_reading and best_reading != surface:
                furigana = best_reading

            final_results.append({
                'surface': surface,
                'original': surface,
                'lemma': 'skip' if is_polite_ending else surface,
                'word': 'skip' if is_polite_ending else surface,
                'reading': best_reading,
                'furigana': furigana,
                'pos': '助詞' if is_polite_ending else best_pos,
                'meanings': [] if is_polite_ending else res.get('meanings', []),
                'definition': "" if is_polite_ending else "\n".join(res.get('meanings', [])),
                'source': res.get('source', 'offline')
            })
            curr_idx = end
        else:
            # Not a dict match, find the Sudachi token at this position
            token_found = False
            for t in token_pos_map:
                if t['start'] == curr_idx:
                    is_meaningless = t['pos'] in SKIP_POS or t['surface'] in SKIP_WORDS or t['lemma'] in SKIP_WORDS
                    
                    if not include_all and is_meaningless:
                        pass
                    else:
                        furigana = None
                        if t['reading'] and t['reading'] != t['surface']:
                            furigana = t['reading']

                        final_results.append({
                            'surface': t['surface'],
                            'original': t['surface'],
                            'lemma': 'skip' if is_meaningless else t['lemma'],
                            'word': 'skip' if is_meaningless else t['lemma'],
                            'reading': t['reading'],
                            'furigana': furigana,
                            'pos': '助詞' if is_meaningless else t['pos'],
                            'meanings': [],
                            'definition': "",
                            'source': 'none'
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
    """Helper to convert Katakana to Hiragana."""
    if not text: return ''
    return "".join(chr(ord(c) - 96) if "\u30a1" <= c <= "\u30f6" else c for c in text)

def analyze_batch_japanese(texts, priority='mazii_offline'):
    """Segment a batch of texts and count lemma frequencies using Sudachi."""
    counts = Counter()
    tk = get_tokenizer()
    
    if not tk: return []

    for text in texts:
        if not text or len(text.strip()) == 0: continue
        tokens = tk.tokenize(text, _sudachi_mode)
        for token in tokens:
            lemma = token.dictionary_form()
            pos = token.part_of_speech()[0]
            
            if pos in ['補助記号', '空白', '助詞', '助動詞', '記号']:
                continue
            if any(char.isdigit() for char in lemma):
                continue
            if len(lemma) < 1:
                continue
                
            counts[lemma] += 1
    
    # Return as list of dicts with count
    return [{'lemma': lemma, 'count': count, 'reading': '', 'meanings': [], 'source': 'offline'} 
            for lemma, count in counts.items()]
def get_definitions_for_terms(terms, priority=None):
    """Batch query definitions for a list of terms (strings)."""
    dict_paths = get_dict_paths()
    
    # Explicit Priority Order
    dict_order = ['mazii_offline', 'javidict', 'suge', 'jamdict']
    order = []
    if priority in dict_order:
        order.append(priority)
    for d in dict_order:
        if d not in order and d in dict_paths:
            order.append(d)
    for d in dict_paths:
        if d not in order:
            order.append(d)
            
    results = []
    for term in terms:
        item_result = None
        source = 'none'
        
        for d_name in order:
            if d_name not in dict_paths: continue
            res = query_offline_dict(dict_paths[d_name], term)
            if res:
                item_result = res
                source = d_name
                break
        
        if item_result:
            meanings = item_result.get('meanings', [])
            results.append({
                'word': term,
                'reading': item_result.get('reading', ''),
                'meanings': meanings,
                'definition': ', '.join(meanings) if meanings else 'No definition found offline.',
                'source': source
            })
        else:
            results.append({
                'word': term,
                'reading': '',
                'meanings': [],
                'definition': 'No definition found offline.',
                'source': 'none'
            })
    return results
