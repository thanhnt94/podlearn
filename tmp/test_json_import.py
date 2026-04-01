import json
import sys
import os

# Mock the database and models for testing the logic in isolation if possible
# Or just test the JSON string part of the service

def test_json_parsing():
    sample_json = {
        "core_sentence": {
            "original_text": "こんにちは",
            "translated_text": "Hello"
        },
        "grammar_formula": "Greeting",
        "color_mapped_tokens": []
    }
    
    json_string = json.dumps(sample_json)
    data = json.loads(json_string)
    
    core = data.get('core_sentence', {})
    original = core.get('original_text')
    translated = core.get('translated_text')
    
    print(f"Original: {original}")
    print(f"Translated: {translated}")
    
    assert original == "こんにちは"
    assert translated == "Hello"
    print("Test Passed: JSON parsing works as expected.")

if __name__ == "__main__":
    test_json_parsing()
