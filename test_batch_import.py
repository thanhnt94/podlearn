import json
from app import create_app
from app.services.sentence_service import import_sentence_from_raw_json

def test_batch_import():
    app = create_app()
    with app.app_context():
        # Prepare a batch of 2 items
        batch_data = [
            {
                "pattern": "Test Batch 1",
                "meaning": "Meaning 1",
                "formation": ["Formation 1"]
            },
            {
                "pattern": "Test Batch 2",
                "meaning": "Meaning 2",
                "formation": ["Formation 2"]
            }
        ]
        
        # Test with a dummy user/set (assuming ID 1/7 exists based on previous history)
        # We use a real set from the DB to avoid model mismatches
        from app.models.sentence import SentenceSet
        s_set = SentenceSet.query.first()
        if not s_set:
            print("No sets found to test with.")
            return

        print(f"Testing batch import into set: {s_set.title} (ID: {s_set.id})")
        result = import_sentence_from_raw_json(
            json_string=json.dumps(batch_data),
            user_id=s_set.user_id,
            set_id=s_set.id,
            track_mode='mastery_grammar'
        )
        
        print(f"Result: {result}")
        if result['success'] and result['count'] == 2:
            print("SUCCESS: Batch import verified.")
        else:
            print("FAILURE: Batch import failed.")

if __name__ == "__main__":
    test_batch_import()
