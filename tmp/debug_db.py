import sys
import os

# Add current directory to path so we can import 'podlearn'
sys.path.append(r'c:\Code\PodLearn\podlearn')

try:
    from app import create_app
    from app.extensions import db
    from sqlalchemy import inspect

    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"DEBUG: Tables in DB: {tables}")
        
        if 'shadowing_history' in tables:
            print("DEBUG: shadowing_history table EXISTS.")
            # Check columns
            columns = [c['name'] for c in inspector.get_columns('shadowing_history')]
            print(f"DEBUG: Columns: {columns}")
        else:
            print("DEBUG: shadowing_history table MISSING.")
except Exception as e:
    print(f"DEBUG ERROR: {str(e)}")
