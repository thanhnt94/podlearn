import sqlite3

def force_repair_db():
    db_path = 'c:/Code/Ecosystem/Storage/database/AuraFlow.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("--- Force Repairing Sentence 8 ---")
    try:
        # Direct SQL override for the problematic record
        cursor.execute("UPDATE sentences SET detailed_analysis = NULL WHERE id = 8")
        conn.commit()
        print(f"FORCED fix for sentence 8: {cursor.rowcount} row(s) updated.")
    except Exception as e:
        print(f"Error forced fixing sentence 8: {e}")

    print("\n--- Global JSON Sanitization (Direct SQLite) ---")
    tables_columns = {
        'sentences': ['detailed_analysis'],
        'grammar': ['formation', 'signal_words', 'examples', 'points_to_note', 'similar_patterns'],
        'vocabulary': ['collocations']
    }
    
    total_fixed = 0
    for table, columns in tables_columns.items():
        for col in columns:
            try:
                # Target anything with zero length that isn't already NULL
                cursor.execute(f"UPDATE {table} SET {col} = NULL WHERE {col} IS NOT NULL AND length({col}) = 0")
                conn.commit()
                total_fixed += cursor.rowcount
                if cursor.rowcount > 0:
                    print(f"Fixed {cursor.rowcount} records in {table}.{col}.")
            except Exception as e:
                print(f"Error sanitizing {table}.{col}: {e}")
    
    conn.close()
    print(f"\nForce repair complete. Total records repaired: {total_fixed}")

if __name__ == "__main__":
    force_repair_db()
