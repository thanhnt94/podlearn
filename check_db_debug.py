import sqlite3
import json

def check_db():
    db_path = 'c:/Code/Ecosystem/Storage/database/AuraFlow.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("--- Sentence 8 ---")
    try:
        cursor.execute("SELECT id, original_text, detailed_analysis FROM sentences WHERE id = 8")
        row = cursor.fetchone()
        if row:
            print(f"ID: {row[0]}")
            print(f"Text: {row[1]}")
            print(f"Detailed Analysis (raw): {repr(row[2])}")
        else:
            print("Sentence 8 not found.")
    except Exception as e:
        print(f"Error querying sentences: {e}")

    print("\n--- Linked Grammars for Sentence 8 ---")
    try:
        cursor.execute("""
            SELECT g.id, g.pattern, g.examples, g.signal_words, g.formation, g.nuance, g.points_to_note, g.similar_patterns
            FROM grammar g
            JOIN sentence_grammar_association sga ON g.id = sga.grammar_id
            WHERE sga.sentence_id = 8
        """)
        rows = cursor.fetchall()
        for r in rows:
            print(f"Grammar ID: {r[0]}, Pattern: {r[1]}")
            print(f"  Examples (raw): {repr(r[2])}")
            print(f"  Signal Words (raw): {repr(r[3])}")
            print(f"  Formation (raw): {repr(r[4])}")
            print(f"  Nuance (raw): {repr(r[5])}")
            print(f"  Points (raw): {repr(r[6])}")
            print(f"  Similar (raw): {repr(r[7])}")
    except Exception as e:
        print(f"Error querying grammar: {e}")

    conn.close()

if __name__ == "__main__":
    check_db()
