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

def query_offline_dict(db_path, term):
    """Query a SQLite dictionary for a term with high-performance indexing."""
    if not os.path.exists(db_path):
        return None
        
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # idx_word ensure this is lightning fast
        cursor.execute("SELECT reading, meanings_json FROM dictionary WHERE word = ? LIMIT 1", (term,))
        row = cursor.fetchone()
        conn.close()
        
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
