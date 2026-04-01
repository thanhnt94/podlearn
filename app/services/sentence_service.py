import json
from ..extensions import db
from ..models.sentence import Sentence

def import_sentence_from_raw_json(json_string, user_id, source_video_id=None):
    """
    Parses a raw JSON string containing sentence analysis and saves it to the DB.
    Expects blocks: core_sentence, grammar_formula, color_mapped_tokens.
    """
    try:
        data = json.loads(json_string)
    except json.JSONDecodeError as e:
        return {'success': False, 'error': f"Invalid JSON format: {str(e)}"}

    # Extract core info
    core = data.get('core_sentence', {})
    original_text = core.get('original_text')
    translated_text = core.get('translated_text')

    if not original_text:
        return {'success': False, 'error': "Missing 'original_text' in core_sentence block."}

    # Create Sentence object
    new_sentence = Sentence(
        user_id=user_id,
        original_text=original_text,
        translated_text=translated_text,
        detailed_analysis=data,  # Store the full JSON
        source_video_id=source_video_id
    )

    db.session.add(new_sentence)
    db.session.commit()

    return {
        'success': True,
        'message': 'Sentence pattern imported successfully!',
        'sentence_id': new_sentence.id
    }
