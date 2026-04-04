import sqlite3

def sanitize_db():
    db_path = 'c:/Code/Ecosystem/Storage/database/AuraFlow.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    tables_columns = {
        'sentences': ['detailed_analysis'],
        'grammar': ['formation', 'signal_words', 'examples', 'points_to_note', 'similar_patterns'],
        'vocabulary': ['collocations']
    }
    
    total_fixed = 0
    
    print("--- Starting Robust JSON Sanitization ---")
    for table, columns in tables_columns.items():
        for col in columns:
            try:
                # Target anything that is an empty string OR just whitespace
                cursor.execute(f"UPDATE {table} SET {col} = NULL WHERE trim({col}) = ''")
                conn.commit()
                total_fixed += cursor.rowcount
                if cursor.rowcount > 0:
                    print(f"Fixed {cursor.rowcount} records in {table}.{col}.")
                
                # Also target ID 8 specifically if it's still stuck
                if table == 'sentences':
                     cursor.execute("UPDATE sentences SET detailed_analysis = NULL WHERE id = 8 AND detailed_analysis = ''")
                     conn.commit()
                     if cursor.rowcount > 0:
                         print(f"FORCED fix for sentence 8.")
                         total_fixed += cursor.rowcount
            except Exception as e:
                print(f"Error sanitizing {table}.{col}: {e}")
    
    conn.close()
    print(f"\nSanitization complete. Total records repaired: {total_fixed}")

if __name__ == "__main__":
    sanitize_db()
