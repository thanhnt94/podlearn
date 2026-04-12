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
    # We check multiple common locations for reliability
    base_dirs = [
        os.path.abspath(os.path.join(current_app.root_path, '..', '..', 'Storage', 'database')),
        os.path.abspath(os.path.join(current_app.root_path, '..', 'Storage', 'database')),
    ]
    
    paths = {}
    dict_names = ['javidict', 'suge', 'mazii_offline', 'jamdict']
    
    for name in dict_names:
        for b_dir in base_dirs:
            p = os.path.join(b_dir, f"{name}.db")
            if os.path.exists(p):
                paths[name] = p
                break
    return paths

def query_offline_dict(db_path, term):
    """Query a SQLite database for a term, handling both flat and complex schemas."""
    if not os.path.exists(db_path):
        return None
        
    is_jamdict = "jamdict.db" in db_path.lower()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        if is_jamdict:
            # Specialized query for complex JAMDict schema using idseq and SenseGloss
            sql = """
                SELECT 
                    (SELECT text FROM Kana WHERE idseq = Entry.idseq LIMIT 1) as reading,
                    (SELECT group_concat(text, '\n') FROM SenseGloss WHERE sid IN (SELECT ID FROM Sense WHERE idseq = Entry.idseq)) as definition
                FROM Entry
                WHERE idseq IN (
                    SELECT idseq FROM Kanji WHERE text = ?
                    UNION
                    SELECT idseq FROM Kana WHERE text = ?
                )
                LIMIT 1
            """
            cursor.execute(sql, (term, term))
        else:
            # Standard flat schema for VN dicts (Javidict, Suge, Mazii)
            # These have ['id', 'term', 'reading', 'definition', 'sequence']
            cursor.execute("SELECT reading, definition FROM entries WHERE term = ? LIMIT 1", (term,))
            
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'reading': row[0],
                'meanings': row[1].split('\n') if row[1] else [],
                'source': os.path.basename(db_path).split('.')[0]
            }
    except Exception as e:
        logger.error(f"Error querying offline dict {db_path}: {e}")
        
    return None

def get_definitions_for_terms(terms, priority='mazii_offline', strict=False):
    """
    Enrich a list of terms with definitions ONLY from the priority source.
    If not found in that specific source, it returns a 'none' source result.
    """
    results = []
    dict_paths = get_dict_paths()
    path = dict_paths.get(priority)

    for term in terms:
        found_data = None
        
        if path and os.path.exists(path):
            data = query_offline_dict(path, term)
            if data:
                found_data = data
        
        if found_data:
            results.append({
                'term': term,
                'reading': found_data.get('reading', ''),
                'definition': ", ".join(found_data.get('meanings', [])),
                'source': priority
            })
        else:
            # If strict mode is ON, we skip terms not found in the SELECTED dictionary
            if strict:
                continue

            # Term not found in the SELECTED dictionary
            results.append({
                'term': term,
                'reading': '',
                'definition': 'No definition found offline.',
                'source': 'none'
            })
    
    return results

def analyze_japanese_text(text, priority='mazii_offline', strict=False, include_all=False):
    """Segment text using Sudachi and find definitions."""
    tk = get_tokenizer()
    if not tk: return []

    if re.match(r'^[0-9\s.,!?;:()\[\]"\'\-+*/=<>]+$', text):
        return []

    results = []
    tokens = tk.tokenize(text, _sudachi_mode)
    
    dict_paths = get_dict_paths()
    
    # STRICT FILTERING: Only use the requested dictionary if strict is True
    if strict:
        order = [priority]
    else:
        order = [priority]
        others = [k for k in dict_paths.keys() if k != priority]
        order.extend(others)

    for token in tokens:
        lemma = token.dictionary_form()
        pos_tuple = token.part_of_speech()
        pos = pos_tuple[0]
        
        # Skip filtering if include_all is requested (for segmentation editor)
        if not include_all:
            if pos in ['補助記号', '空白', '助詞', '助動詞', '記号']:
                continue
            
            if re.match(r'^\d+$', lemma):
                continue

        item_result = None
        source = 'unknown'
        
        for src in order:
            path = dict_paths.get(src)
            if path:
                data = query_offline_dict(path, lemma)
                if data:
                    item_result = data
                    source = src
                    break
        
        # If strict mode is ON, and no result found in the PRIORITY dict, we skip this token
        if not item_result and strict:
            continue

        if item_result:
            results.append({
                'original': token.surface(),
                'lemma': lemma,
                'reading': item_result.get('reading', lemma),
                'pos': pos,
                'meanings': item_result.get('meanings', []),
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
