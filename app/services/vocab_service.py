import os
import sqlite3
import json
import logging
import re
from collections import Counter
from flask import current_app
from sudachipy import dictionary, tokenizer

logger = logging.getLogger(__name__)

# Global tokenizer instance
_tokenizer_obj = None
_sudachi_mode = tokenizer.Tokenizer.SplitMode.C

def get_tokenizer():
    global _tokenizer_obj
    if _tokenizer_obj is None:
        try:
            sudachi_dict = dictionary.Dictionary()
            _tokenizer_obj = sudachi_dict.create()
            logger.info("Sudachi tokenizer initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize Sudachi: {e}")
    return _tokenizer_obj

def get_dict_paths():
    """Detect all available SQLite dictionary files (.db)."""
    # Fix: Use dynamic relative path instead of hardcoded Windows path
    current_dir = os.path.dirname(__file__) # app/services
    root_dir = os.path.dirname(os.path.dirname(current_dir)) # PodLearn root
    base_dir = os.path.join(root_dir, 'dictionaries', 'database')
    
    paths = {}
    if os.path.exists(base_dir):
        for f in os.listdir(base_dir):
            if f.lower().endswith('.db'):
                name = f.replace('.db', '')
                paths[name] = os.path.join(base_dir, f)
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
    """Segment text using Sudachi and lookup definitions in JSON dicts.
    If custom_vocab (set of strings) is provided, prioritize segmenting these compounds."""
    tk = get_tokenizer()
    if not tk: return []

    if re.match(r'^[0-9\s.,!?;:()\[\]"\'\-+*/=<>]+$', text):
        return []

    results = []
    sudachi_tokens = tk.tokenize(text, _sudachi_mode)
    tokens = []
    for m in sudachi_tokens:
        tokens.append({
            'surface': m.surface(),
            'dictionary_form': m.dictionary_form(),
            'part_of_speech': m.part_of_speech(),
            'reading_form': m.reading_form()
        })
        
    dict_paths = get_dict_paths()
    
    # Explicit Priority Order
    dict_order = ['mazii_offline', 'javidict', 'suge', 'jamdict']
    order = []
    
    # 1. Start with requested priority if it's in our known list
    if priority in dict_order:
        order.append(priority)
    
    # 2. Add remaining standard dicts in order
    for d in dict_order:
        if d not in order and d in dict_paths:
            order.append(d)
            
    # 3. Add any other unknown dicts found in folder
    for d in dict_paths:
        if d not in order:
            order.append(d)

    i = 0
    while i < len(tokens):
        # --- Handle meaningless tokens (Particles, Auxiliary Verbs, Symbols) ---
        current_pos = tokens[i]['part_of_speech'][0]
        if current_pos in ['補助記号', '空白', '助詞', '助動詞', '記号']:
            j = i + 1
            while j < len(tokens) and tokens[j]['part_of_speech'][0] in ['補助記号', '空白', '助詞', '助動詞', '記号']:
                j += 1
            
            if include_all:
                window_tokens = tokens[i:j]
                combined_surface = "".join([t['surface'] for t in window_tokens])
                combined_lemma = "".join([t['dictionary_form'] for t in window_tokens])
                combined_reading_katakana = "".join([t['reading_form'] or '' for t in window_tokens])
                combined_reading = katakana_to_hiragana(combined_reading_katakana)
                
                furigana = None
                if combined_reading and combined_reading != combined_surface:
                    furigana = combined_reading
                    
                results.append({
                    'surface': combined_surface,
                    'original': combined_surface,
                    'lemma': 'skip',
                    'word': 'skip',
                    'reading': combined_reading,
                    'furigana': furigana,
                    'pos': '助詞', # Force mark as particle so frontend dims it
                    'meanings': [],
                    'definition': "",
                    'source': 'none'
                })
            
            i = j
            continue

        # --- Maximal Matching Sliding Window ---
        # Look ahead up to 4 tokens
        matched_compound = False
        max_window = min(4, len(tokens) - i)
        
        for window_size in range(max_window, 1, -1): # Try 4, 3, 2
            window_tokens = tokens[i:i+window_size]
            
            # Combine the surface forms
            combined_surface = "".join([t['surface'] for t in window_tokens])
            combined_lemma = "".join([t['dictionary_form'] for t in window_tokens])
            
            # 1. Custom Vocabulary Priority Check
            if custom_vocab and (combined_surface in custom_vocab or combined_lemma in custom_vocab):
                matched_compound = True
                
                combined_reading_katakana = "".join([t['reading_form'] or '' for t in window_tokens])
                combined_reading = katakana_to_hiragana(combined_reading_katakana)
                
                furigana = None
                if combined_reading and combined_reading != combined_surface:
                    furigana = combined_reading
                    
                # Try to get offline definition if it exists, otherwise empty
                res = None
                for d_name in order:
                    res = query_offline_dict(dict_paths[d_name], combined_lemma)
                    if not res:
                        res = query_offline_dict(dict_paths[d_name], combined_surface)
                    if res: break
                
                results.append({
                    'surface': combined_surface,
                    'original': combined_surface,
                    'lemma': combined_lemma,
                    'word': combined_lemma,
                    'reading': res.get('reading', combined_reading) if res else combined_reading,
                    'furigana': furigana,
                    'pos': window_tokens[0]['part_of_speech'][0],
                    'meanings': res.get('meanings', ['[User Custom Vocabulary]']) if res else ['[User Custom Vocabulary]'],
                    'definition': "\n".join(res.get('meanings', ['[User Custom Vocabulary]'])) if res else '[User Custom Vocabulary]',
                    'source': res.get('source', 'custom') if res else 'custom'
                })
                i += window_size
                break # Break out of window size loop

            # 2. Dictionary Fallback Check
            for d_name in order:
                res = query_offline_dict(dict_paths[d_name], combined_lemma)
                if not res:
                    res = query_offline_dict(dict_paths[d_name], combined_surface)
                    
                if res:
                    # We found a valid compound!
                    matched_compound = True
                    
                    combined_reading_katakana = "".join([t['reading_form'] or '' for t in window_tokens])
                    combined_reading = katakana_to_hiragana(combined_reading_katakana)
                    
                    furigana = None
                    if combined_reading and combined_reading != combined_surface:
                        furigana = combined_reading
                        
                    results.append({
                        'surface': combined_surface,
                        'original': combined_surface,
                        'lemma': combined_lemma,
                        'word': combined_lemma,
                        'reading': res.get('reading', combined_reading) or combined_reading,
                        'furigana': furigana,
                        'pos': window_tokens[0]['part_of_speech'][0], # Just use the POS of the first token
                        'meanings': res.get('meanings', []),
                        'definition': "\n".join(res.get('meanings', [])),
                        'source': d_name
                    })
                    
                    # Advance the index by the window size
                    i += window_size
                    break # Break out of dictionary loop
                    
            if matched_compound:
                break # Break out of window size loop
                
        if matched_compound:
            continue
            
        # --- Single Token Fallback ---
        token = tokens[i]
        lemma = token['dictionary_form']
        pos_tuple = token['part_of_speech']
        pos = pos_tuple[0]
        surface = token['surface']
        
        # Tagger reading (usually Katakana)
        tagger_reading_katakana = token['reading_form']
        tagger_reading = katakana_to_hiragana(tagger_reading_katakana) if tagger_reading_katakana else ''
        
        if not include_all:
            if pos in ['補助記号', '空白', '助詞', '助動詞', '記号']:
                i += 1
                continue
            if re.match(r'^\d+$', lemma):
                i += 1
                continue

        item_result = None
        source = 'unknown'
        
        for d_name in order:
            res = query_offline_dict(dict_paths[d_name], lemma)
            if not res:
                # Try querying with surface if lemma fails (for some inflected forms)
                res = query_offline_dict(dict_paths[d_name], surface)
            
            if res:
                item_result = res
                source = d_name
                break
        
        if not item_result:
            if strict: 
                i += 1
                continue
            item_result = {'reading': tagger_reading, 'meanings': []}
            source = 'none'

        # Determine best reading for Furigana
        # If tagger reading is different from surface, it's likely Kanji
        furigana = None
        if tagger_reading and tagger_reading != surface:
            furigana = tagger_reading

        results.append({
            'surface': surface,
            'original': surface,
            'lemma': lemma,
            'word': lemma,
            'reading': item_result.get('reading', tagger_reading) or tagger_reading,
            'furigana': furigana,
            'pos': pos,
            'meanings': item_result.get('meanings', []),
            'definition': "\n".join(item_result.get('meanings', [])),
            'source': source
        })
        
        i += 1
            
    return results

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
