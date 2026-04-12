import logging
from sudachipy import dictionary
from jamdict import Jamdict
import re

import time
import random
import json
import sqlite3
import requests
import logging

logger = logging.getLogger(__name__)

# Initialize Sudachi and Jamdict (Lazy loading)
_tokenizer = None
_jamdict = None

# Constants
ALLOWED_POS = ['名詞', '動詞', '形容詞', '副詞']

def get_mazii_db_path():
    from flask import current_app
    import os
    db_dir = os.path.abspath(os.path.join(current_app.root_path, '..', 'Storage', 'database'))
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, 'mazii.db')

def init_mazii_db():
    db_path = get_mazii_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mazii_cache (
            lemma TEXT PRIMARY KEY,
            reading TEXT,
            definition TEXT,
            examples TEXT,
            jlpt TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def fetch_mazii_from_api(lemma):
    """
    Calls Mazii API with a randomized delay to avoid blocking.
    """
    # Randomized delay between 1.0 and 2.5 seconds
    delay = random.uniform(1.0, 2.5)
    logger.info(f"Mazii API: Sleeping for {delay:.2f}s before fetching '{lemma}'...")
    time.sleep(delay)

    url = "https://mazii.net/api/search"
    payload = {"dict": "javi", "query": lemma, "type": "word"}
    headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and data.get('data'):
                # Safely get the first entry
                entries = data['data']
                if not isinstance(entries, list) or len(entries) == 0:
                    return None
                    
                entry = entries[0]
                
                # Robust extraction with fallbacks
                means = entry.get('means') or []
                level_list = entry.get('level') or ['']
                
                return {
                    'lemma': lemma,
                    'reading': entry.get('phonetic') or entry.get('word') or lemma,
                    'definition': entry.get('short_mean') or '',
                    'examples': json.dumps(means[:2]) if isinstance(means, list) else "[]",
                    'jlpt': str(level_list[0]) if isinstance(level_list, list) and len(level_list) > 0 else ""
                }
    except Exception as e:
        logger.error(f"Mazii API error for '{lemma}': {e}")
    return None

def get_mazii_definition(lemma):
    """
    Core Hybrid Logic: Local Cache -> Online API -> Fallback to None
    """
    init_mazii_db()
    db_path = get_mazii_db_path()
    
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM mazii_cache WHERE lemma = ?", (lemma,))
            row = cursor.fetchone()
            
            if row:
                return {
                    'lemma': row['lemma'],
                    'reading': row['reading'],
                    'meanings': [row['definition']],
                    'source': 'mazii'
                }
            
            # Not in cache, fetch from API
            result = fetch_mazii_from_api(lemma)
            if result:
                cursor.execute('''
                    INSERT INTO mazii_cache (lemma, reading, definition, examples, jlpt)
                    VALUES (?, ?, ?, ?, ?)
                ''', (result['lemma'], result['reading'], result['definition'], result['examples'], result['jlpt']))
                conn.commit()
                return {
                    'lemma': result['lemma'],
                    'reading': result['reading'],
                    'meanings': [result['definition']],
                    'source': 'mazii'
                }
    except Exception as e:
        logger.error(f"Mazii cache error: {e}")
        
    return None

# Keep Jamdict logic for fallback
def get_tokenizer():
    global _tokenizer
    if _tokenizer is None:
        try:
            logger.info("Initializing Sudachi tokenizer...")
            _tokenizer = dictionary.Dictionary().create()
        except Exception as e:
            logger.error(f"Failed to initialize Sudachi: {e}")
            raise RuntimeError(f"Sudachi initialization failed: {e}")
    return _tokenizer

def get_jamdict():
    """
    Returns a fresh Jamdict instance for thread safety on each call.
    """
    from jamdict import Jamdict
    import os
    from flask import current_app
    
    # Centralized path in Storage
    storage_db_path = os.path.abspath(os.path.join(current_app.root_path, '..', 'Storage', 'database', 'jamdict.db'))
    
    if os.path.exists(storage_db_path):
        # We create a new Jamdict object per call to ensure SQLite thread safety on Windows
        return Jamdict(db_file=storage_db_path, check_same_thread=False)
    return Jamdict()

def analyze_japanese_text(text: str, priority: str = 'jamdict'):
    """
    Tokenizes Japanese text and performs dictionary lookup with priority.
    """
    tokenizer = get_tokenizer()
    jam = get_jamdict() # Static jamdict for fallback
    
    from sudachipy import tokenizer as sudachi_tokenizer
    mode = sudachi_tokenizer.Tokenizer.SplitMode.C
    
    tokens = tokenizer.tokenize(text, mode)
    results = []
    seen_lemmas = set()

    for token in tokens:
        pos = token.part_of_speech()
        main_pos = pos[0]
        
        if main_pos not in ALLOWED_POS:
            continue
            
        lemma = token.dictionary_form()
        
        # Filter out numbers, single characters that are just digits, and punctuation
        if main_pos in ['数', '数詞'] or lemma.isdigit() or re.match(r'^[0-9]+$', lemma):
            continue

        if lemma in seen_lemmas:
            continue
        seen_lemmas.add(lemma)
        
        item_result = None
        source = 'unknown'

        # Priority Check
        if priority == 'mazii':
            item_result = get_mazii_definition(lemma)
            if item_result:
                source = 'mazii'
        
        # Fallback to Jamdict if no result yet
        if not item_result:
            jm_result = jam.lookup(lemma)
            if jm_result.entries:
                entry = jm_result.entries[0]
                reading = entry.kana_forms[0].text if entry.kana_forms else (entry.kanji_forms[0].text if entry.kanji_forms else lemma)
                meanings = []
                for sense in entry.senses:
                    for gloss in sense.gloss:
                        meanings.append(gloss.text)
                        if len(meanings) >= 3: break
                    if len(meanings) >= 3: break
                
                item_result = {
                    'lemma': lemma,
                    'reading': reading,
                    'meanings': meanings,
                }
                source = 'jamdict'

        if item_result:
            results.append({
                'original': token.surface(),
                'lemma': item_result['lemma'],
                'reading': item_result['reading'],
                'pos': main_pos,
                'meanings': item_result['meanings'],
                'source': source
            })
        
    return results

def analyze_batch_japanese(texts: list[str], priority: str = 'jamdict'):
    """
    Analyzes multiple sentences at once with dictionary priority and deduplication.
    """
    tokenizer = get_tokenizer()
    jam = get_jamdict()
    
    from sudachipy import tokenizer as sudachi_tokenizer
    mode = sudachi_tokenizer.Tokenizer.SplitMode.C
    
    all_lemmas_map = {} 
    
    for text in texts:
        if not text: continue
        tokens = tokenizer.tokenize(text, mode)
        for token in tokens:
            pos = token.part_of_speech()
            if pos[0] in ALLOWED_POS:
                lemma = token.dictionary_form()
                if lemma not in all_lemmas_map:
                    all_lemmas_map[lemma] = {
                        'pos': pos[0],
                        'original': token.surface()
                    }
    
    results = []
    for lemma, info in all_lemmas_map.items():
        item_result = None
        source = 'unknown'

        if priority == 'mazii':
            item_result = get_mazii_definition(lemma)
            if item_result:
                source = 'mazii'
        
        if not item_result:
            jm_result = jam.lookup(lemma)
            if jm_result.entries:
                entry = jm_result.entries[0]
                reading = entry.kana_forms[0].text if entry.kana_forms else (entry.kanji_forms[0].text if entry.kanji_forms else lemma)
                meanings = []
                for sense in entry.senses:
                    for gloss in sense.gloss:
                        meanings.append(gloss.text)
                        if len(meanings) >= 3: break
                    if len(meanings) >= 3: break
                
                item_result = {
                    'lemma': lemma,
                    'reading': reading,
                    'meanings': meanings
                }
                source = 'jamdict'

        if item_result:
            results.append({
                'original': info['original'],
                'lemma': item_result['lemma'],
                'reading': item_result['reading'],
                'pos': info['pos'],
                'meanings': item_result['meanings'],
                'source': source
            })
        
    return results
