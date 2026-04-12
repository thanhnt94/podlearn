import logging
from sudachipy import dictionary
from jamdict import Jamdict

logger = logging.getLogger(__name__)

# Initialize Sudachi and Jamdict
# We use a lazy-loading approach to avoid slow startup
_tokenizer = None
_jamdict = None

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

def analyze_japanese_text(text: str):
    """
    Tokenizes Japanese text, filters by POS (Noun, Verb, Adjective),
    and performs JMDict lookup for meanings.
    """
    tokenizer = get_tokenizer()
    jam = get_jamdict()
    
    # Split mode: A (Smallest), B (Middle), C (Longest/Compound)
    # Mode.C is often better for learning content as it keeps compounds like "図書館" together
    from sudachipy import tokenizer as sudachi_tokenizer
    mode = sudachi_tokenizer.Tokenizer.SplitMode.C
    
    tokens = tokenizer.tokenize(text, mode)
    results = []
    seen_lemmas = set()

    # POS whitelist (First part of Sudachi POS tag)
    # 名詞: Noun, 動詞: Verb, 形容詞: Adjective, 副詞: Adverb
    ALLOWED_POS = ['名詞', '動詞', '形容詞', '副詞']

    for token in tokens:
        pos = token.part_of_speech()
        main_pos = pos[0]
        
        if main_pos not in ALLOWED_POS:
            continue
            
        lemma = token.dictionary_form()
        
        # Deduplication
        if lemma in seen_lemmas:
            continue
        seen_lemmas.add(lemma)
        
        # Dictionary Lookup
        jm_result = jam.lookup(lemma)
        meanings = []
        reading = lemma # Default
        
        if jm_result.entries:
            entry = jm_result.entries[0]
            if entry.kana_forms:
                reading = entry.kana_forms[0].text
            elif entry.kanji_forms:
                reading = entry.kanji_forms[0].text
                
            for sense in entry.senses:
                for gloss in sense.gloss:
                    meanings.append(gloss.text)
                    if len(meanings) >= 3: break
                if len(meanings) >= 3: break
        
        results.append({
            'original': token.surface(),
            'lemma': lemma,
            'reading': reading,
            'pos': main_pos,
            'meanings': meanings[:3]
        })
        
    return results

def analyze_batch_japanese(texts: list[str]):
    """
    Analyzes multiple sentences at once efficiently by deduplicating 
    lemmas before fetching meanings from JMDict.
    """
    tokenizer = get_tokenizer()
    jam = get_jamdict()
    
    from sudachipy import tokenizer as sudachi_tokenizer
    mode = sudachi_tokenizer.Tokenizer.SplitMode.C
    
    # 1. Collect all valid lemmas from all texts
    all_lemmas_map = {} # lemma -> {pos, original_sample, reading (temp)}
    ALLOWED_POS = ['名詞', '動詞', '形容詞', '副詞']
    
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
    
    # 2. Bulk fetch meanings (Jamdict.lookup is already quite efficient)
    results = []
    for lemma, info in all_lemmas_map.items():
        jm_result = jam.lookup(lemma)
        meanings = []
        reading = lemma
        
        if jm_result.entries:
            entry = jm_result.entries[0]
            reading = entry.kana_forms[0].text if entry.kana_forms else (entry.kanji_forms[0].text if entry.kanji_forms else lemma)
            
            for sense in entry.senses:
                for gloss in sense.gloss:
                    meanings.append(gloss.text)
                    if len(meanings) >= 3: break
                if len(meanings) >= 3: break
        
        results.append({
            'original': info['original'],
            'lemma': lemma,
            'reading': reading,
            'pos': info['pos'],
            'meanings': meanings[:3]
        })
        
    return results
