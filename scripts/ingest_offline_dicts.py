import os
import json
import sqlite3
import sys
import re

def clean_definition(text, term):
    """
    Cleans up the long definition string to only keep core meanings.
    - Removes lines that look like examples (contain ':')
    - Removes tags like 〘n〙, 〘v〙, etc.
    - Removes 'Ghi chú' parts.
    - Removes Sino-Vietnamese (Hán Việt) headings if requested (simple heuristic).
    """
    lines = text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        line = line.strip()
        if not line: continue
        
        # 1. Skip lines that are clearly examples (contain ':' and not just at the end)
        if ':' in line and not line.endswith(':'):
            continue
            
        # 2. Skip 'Ghi chú' or metadata indicators
        if line.startswith('Ghi chú:') or line.startswith('〘') or line.startswith('iK'):
            continue
            
        # 3. Handle Mazii specific 'Hán Việt:' lines or simple tags
        if line.startswith('Hán Việt:') or line.startswith('Từ điển'):
            continue
            
        # 4. Remove common Yomichan tags like (adj-pn), (n), etc.
        # This regex looks for tags in brackets or parentheses at the start
        line = re.sub(r'^(〘[^〙]+〙|\([^)]+\))\s*', '', line)
        
        # 5. Skip lines that are just the reading repeat like 「かんすうじ」
        if line.startswith('「') and line.endswith('」'):
            continue

        if line:
            cleaned_lines.append(line)
            
    # Keep only the first 3 meaningful lines to ensure brevity
    return "\n".join(cleaned_lines[:3])

def ingest_dictionary(source_dir, db_path):
    print(f"[*] Processing dictionary from: {source_dir}")
    print(f"[*] Target database: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("DROP TABLE IF EXISTS entries")
    cursor.execute("""
        CREATE TABLE entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term TEXT NOT NULL,
            reading TEXT,
            definition TEXT NOT NULL,
            sequence INTEGER
        )
    """)
    cursor.execute("CREATE INDEX idx_term ON entries(term)")

    term_banks = [f for f in os.listdir(source_dir) if f.startswith('term_bank_') and f.endswith('.json')]
    term_banks.sort()

    count = 0
    for bank_file in term_banks:
        bank_path = os.path.join(source_dir, bank_file)
        print(f"  [+] Reading {bank_file}...")
        
        with open(bank_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            for entry in data:
                term = entry[0]
                reading = entry[1]
                definitions = entry[5]
                sequence = entry[6]
                
                # Combine raw defs
                raw_def = "\n".join(definitions) if isinstance(definitions, list) else str(definitions)
                
                # CLEANING MAGIC HERE
                cleaned_def = clean_definition(raw_def, term)
                
                if not cleaned_def: # Fallback to original if we over-cleaned everything (rare)
                    cleaned_def = raw_def.split('\n')[0]

                # Specialized reading extraction
                if not reading and "「" in raw_def and "」" in raw_def:
                    match = re.search(r"「([^」]+)」", raw_def)
                    if match:
                        reading = match.group(1)
                
                cursor.execute(
                    "INSERT INTO entries (term, reading, definition, sequence) VALUES (?, ?, ?, ?)",
                    (term, reading, cleaned_def, sequence)
                )
                count += 1
                
                if count % 2000 == 0:
                    conn.commit()

    conn.commit()
    conn.close()
    print(f"[*] Successfully ingested {count} CLEANED entries into {db_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python ingest_offline_dicts.py <source_dir> <db_path>")
        sys.exit(1)
    
    ingest_dictionary(sys.argv[1], sys.argv[2])
