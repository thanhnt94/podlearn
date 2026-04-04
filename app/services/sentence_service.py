import json
from ..extensions import db
from ..models.sentence import Sentence

def import_sentence_from_raw_json(json_string, user_id, set_id, source_video_id=None, track_mode='mastery_sentence'):
    """
    Parses a raw JSON string and saves it to the DB as a 'Sentence' record.
    The primary display fields (original_text, translated_text) are extracted
    differently based on the track_mode.
    """
    try:
        if isinstance(json_string, str):
            data = json.loads(json_string)
        else:
            data = json_string # Fallback if already parsed
    except json.JSONDecodeError as e:
        return {'success': False, 'error': f"Invalid JSON format: {str(e)}"}

    # Handle Case if data is a list (take first element)
    if isinstance(data, list) and len(data) > 0:
        data = data[0]

    original_text = None
    translated_text = None

    # AUTO-DETECTION FALLBACK: If track_mode says sentence but data looks like grammar/vocab
    actual_mode = track_mode
    if 'pattern' in data and track_mode == 'mastery_sentence':
        actual_mode = 'mastery_grammar'
    elif 'word' in data and track_mode == 'mastery_sentence':
        actual_mode = 'mastery_vocab'

    if actual_mode in ['mastery_grammar', 'grammar']:
        # Grammar schema uses 'pattern' and 'meaning'
        original_text = data.get('pattern')
        translated_text = data.get('meaning')
    elif actual_mode in ['mastery_vocab', 'vocab']:
        # Vocabulary schema uses 'word' and 'meaning'
        original_text = data.get('word')
        translated_text = data.get('meaning')
    else:
        # Default mastery_sentence schema
        core = data.get('core_sentence', {})
        original_text = core.get('original_text')
        translated_text = core.get('translated_text')

    if not original_text:
        error_msg = {
            'mastery_grammar': "Missing 'pattern' in Grammar JSON.",
            'mastery_vocab': "Missing 'word' in Vocabulary JSON.",
            'mastery_sentence': "Missing 'original_text' in core_sentence block."
        }.get(actual_mode, "Missing primary display text.")
        
        # Diagnostic logging for debugging
        print(f"DEBUG IMPORT: Mode={actual_mode}, DataKeys={list(data.keys())}, OrigText={original_text}")
        return {'success': False, 'error': error_msg}

    # Create Sentence object
    if not data: data = {}
    new_sentence = Sentence(
        user_id=user_id,
        set_id=set_id,
        original_text=original_text,
        translated_text=translated_text,
        detailed_analysis=data,  # Store the full JSON (never an empty string)
        source_video_id=source_video_id
    )

    db.session.add(new_sentence)
    db.session.commit()

    return {
        'success': True,
        'message': 'Sentence pattern imported successfully!',
        'sentence_id': new_sentence.id
    }
