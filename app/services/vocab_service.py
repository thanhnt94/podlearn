import os
import sqlite3
import json
import logging
import re
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
    """Detect all available JSON dictionary files."""
    base_dirs = [
        os.path.abspath(os.path.join(current_app.root_path, '..', 'dictionaries', 'database')),
    ]
    
    paths = {}
    # Scan for any JSON file in the database directory
    for b_dir in base_dirs:
        if not os.path.exists(b_dir): continue
        for f in os.listdir(b_dir):
            if f.lower().endswith('.json'):
                name = f.split('.')[0]
                paths[name] = os.path.join(b_dir, f)
    return paths

from functools import lru_cache

@lru_cache(maxsize=4) # Cache up to 4 large JSON dictionaries in memory
def load_json_dict(path):
    """Load and cache a JSON dictionary."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Create a localized index for O(1) term lookup
            index = {}
            if 'data' in data:
                for entry in data['data']:
                    word = entry.get('word')
                    if word:
                        index[word] = entry
            return index
    except Exception as e:
        logger.error(f"Failed to load JSON dict {path}: {e}")
        return None

def query_offline_dict(json_path, term):
    """Query a JSON dictionary for a term."""
    index = load_json_dict(json_path)
    if not index or term not in index:
        return None
        
    entry = index[term]
    means = [m.get('mean', '') for m in entry.get('means', [])]
    return {
        'reading': entry.get('phonetic', ''),
        'meanings': means,
        'source': os.path.basename(json_path).split('.')[0]
    }

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

def analyze_japanese_text(text, priority='mazii_v2_results', strict=False, include_all=False):
    """Segment text using Sudachi and lookup definitions in JSON dicts."""
    tk = get_tokenizer()
    if not tk: return []

    if re.match(r'^[0-9\s.,!?;:()\[\]"\'\-+*/=<>]+$', text):
        return []

    results = []
    tokens = tk.tokenize(text, _sudachi_mode)
    dict_paths = get_dict_paths()
    
    # Priority order
    order = []
    if priority in dict_paths:
        order.append(priority)
    other_dicts = [k for k in dict_paths.keys() if k != priority]
    order.extend(other_dicts)

    for token in tokens:
        lemma = token.dictionary_form()
        pos_tuple = token.part_of_speech()
        pos = pos_tuple[0]
        
        if not include_all:
            if pos in ['補助記号', '空白', '助詞', '助動詞', '記号']:
                continue
            if re.match(r'^\d+$', lemma):
                continue

        item_result = None
        source = 'unknown'
        
        for d_name in order:
            res = query_offline_dict(dict_paths[d_name], lemma)
            if res:
                item_result = res
                source = d_name
                break
        
        if not item_result:
            if strict: continue
            item_result = {'reading': '', 'meanings': []}
            source = 'none'

        results.append({
            'original': token.surface(),
            'lemma': lemma,
            'word': lemma,
            'reading': item_result.get('reading', ''),
            'pos': pos,
            'meanings': item_result.get('meanings', []),
            'definition': "\n".join(item_result.get('meanings', [])),
            'source': source
        })
            
    return results

def analyze_batch_japanese(texts, priority='mazii_offline'):
    """Segment a batch of texts and return unique lemmas using Sudachi."""
    unique_lemmas = set()
    tk = get_tokenizer()
    
    if not tk: return []

    for text in texts:
        if not text or len(text.strip()) == 0: continue
        if any(char.isdigit() for char in text):
            if all(not char.isalpha() for char in text):
                continue

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
                
            unique_lemmas.add(lemma)
    
    return [{'lemma': lemma, 'reading': '', 'meanings': [], 'source': 'offline'} for lemma in unique_lemmas]
