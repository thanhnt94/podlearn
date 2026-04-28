import json
from ..extensions import db
from app.modules.study.models import Sentence

def import_sentence_from_raw_json(json_string, user_id, set_id, source_video_id=None, track_mode='mastery_sentence'):
    """
    Parses a raw JSON string (or list) and saves it to the DB as 'Sentence' record(s).
    """
    try:
        if isinstance(json_string, str):
            data = json.loads(json_string)
        else:
            data = json_string # Already parsed
    except json.JSONDecodeError as e:
        return {'success': False, 'error': f"Invalid JSON format: {str(e)}"}

    # Handle Case if data is a list (Batch Import)
    if isinstance(data, list):
        if not data:
            return {'success': False, 'error': "JSON array is empty."}
        
        success_count = 0
        sentence_ids = []
        errors = []
        
        for index, item in enumerate(data):
            res = _import_single_item(item, user_id, set_id, source_video_id, track_mode)
            if res.get('success'):
                success_count += 1
                sentence_ids.append(res.get('sentence_id'))
            else:
                errors.append(f"Item #{index+1}: {res.get('error')}")
        
        if success_count > 0:
            db.session.commit()
            return {
                'success': True, 
                'message': f"Imported {success_count} item(s) successfully!",
                'count': success_count,
                'sentence_ids': sentence_ids,
                'errors': errors
            }
        else:
            return {'success': False, 'error': "Batch import failed.", 'detailed_errors': errors}

    # Handle single item
    result = _import_single_item(data, user_id, set_id, source_video_id, track_mode)
    if result.get('success'):
        db.session.commit()
    return result

def _import_single_item(data, user_id, set_id, source_video_id, track_mode):
    """Internal helper to process a single JSON object."""
    if not data or not isinstance(data, dict):
        return {'success': False, 'error': "Item is not a valid JSON object."}

    original_text = None
    translated_text = None

    # AUTO-DETECTION FALLBACK
    actual_mode = track_mode
    if 'pattern' in data and track_mode == 'mastery_sentence':
        actual_mode = 'mastery_grammar'
    elif 'word' in data and track_mode == 'mastery_sentence':
        actual_mode = 'mastery_vocab'

    if actual_mode in ['mastery_grammar', 'grammar']:
        original_text = data.get('pattern')
        translated_text = data.get('meaning')
    elif actual_mode in ['mastery_vocab', 'vocab']:
        original_text = data.get('word')
        translated_text = data.get('meaning')
    else:
        core = data.get('core_sentence', {})
        original_text = core.get('original_text')
        translated_text = core.get('translated_text')

    if not original_text:
        return {'success': False, 'error': f"Missing primary display text for {actual_mode}."}

    # Create Sentence object
    new_sentence = Sentence(
        user_id=user_id,
        set_id=set_id,
        original_text=original_text,
        translated_text=translated_text,
        detailed_analysis=data,
        source_video_id=source_video_id
    )

    db.session.add(new_sentence)
    db.session.flush() # Get the ID without committing yet

    return {
        'success': True,
        'message': 'Sentence pattern imported successfully!',
        'sentence_id': new_sentence.id
    }
