import json
from flask import Blueprint, request, jsonify, flash, render_template, redirect, url_for
from flask_jwt_extended import jwt_required, current_user
from app.core.extensions import db
from app.modules.study.models import Sentence, SentenceSet
from app.modules.study.models import Grammar
from app.modules.study.models import Vocabulary
from app.modules.content.models import Video
from app.core.utils.auth_decorators import admin_required

import_bp = Blueprint('import', __name__, 
                    url_prefix='/admin/import',
                    template_folder='../templates',
                    static_folder='../static')

@import_bp.route('/')
@jwt_required()
@admin_required
def index():
    """Render the import management page."""
    return render_template('admin/import.html')

@import_bp.route('/execute', methods=['POST'])
@jwt_required()
@admin_required
def execute_import():
    """
    Handle generic JSON imports for various Deep Analysis categories.
    """
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file uploaded'}), 400
    
    file = request.files['file']
    import_type = request.form.get('import_type')
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No file selected'}), 400
    
    try:
        data = json.load(file)
        if not isinstance(data, list):
            return jsonify({'success': False, 'message': 'JSON must be an array of objects'}), 400
            
        count = 0
        match import_type:
            case 'mastery_vocabulary':
                count = import_vocabulary(data)
            case 'mastery_grammar':
                count = import_grammar(data)
            case 'mastery_sentence':
                count = import_sentences(data, current_user.id)
            case _:
                return jsonify({'success': False, 'message': f'Unsupported import type: {import_type}'}), 400
        
        db.session.commit()
        return jsonify({'success': True, 'message': f'Successfully imported {count} items.'})
        
    except json.JSONDecodeError:
        return jsonify({'success': False, 'message': 'Invalid JSON file'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Internal Error: {str(e)}'}), 500

def import_vocabulary(data):
    count = 0
    for item in data:
        word = item.get('word')
        if not word: continue
        
        # Check for existing
        vocab = Vocabulary.query.filter_by(word=word).first()
        if not vocab:
            vocab = Vocabulary(word=word)
            db.session.add(vocab)
        
        vocab.reading = item.get('reading', vocab.reading)
        vocab.meaning = item.get('meaning', vocab.meaning)
        vocab.kanji_breakdown = item.get('kanji_breakdown', vocab.kanji_breakdown)
        vocab.mnemonic = item.get('mnemonic', vocab.mnemonic)
        vocab.collocations = item.get('collocations', vocab.collocations)
        vocab.jlpt_level = item.get('jlpt_level', vocab.jlpt_level)
        count += 1
    return count

def import_grammar(data):
    count = 0
    for item in data:
        pattern = item.get('pattern')
        if not pattern: continue
        
        # Check for existing
        grammar = Grammar.query.filter_by(pattern=pattern).first()
        if not grammar:
            grammar = Grammar(pattern=pattern)
            db.session.add(grammar)
            
        grammar.formation = item.get('formation', grammar.formation)
        grammar.meaning = item.get('meaning', grammar.meaning)
        grammar.nuance = item.get('nuance', grammar.nuance)
        grammar.jlpt_level = item.get('jlpt_level', grammar.jlpt_level)
        
        # New Deep Analysis fields (JSON)
        grammar.signal_words = item.get('signal_words', []) # List of {"word": "...", "meaning": "..."}
        grammar.examples = item.get('examples', [])        # List of {"japanese": "...", "vietnamese": "..."}
        grammar.points_to_note = item.get('points_to_note', [])    # List of Strings
        grammar.similar_patterns = item.get('similar_patterns', []) # List of Objects
        grammar.tags = item.get('tags', grammar.tags)
        
        count += 1
    return count

def import_sentences(data, user_id):
    count = 0
    # Sentences need a target set. If none provided in JSON, use a default global one.
    default_set = SentenceSet.query.filter_by(user_id=user_id, title="Deep Analysis Default").first()
    if not default_set:
        default_set = SentenceSet(user_id=user_id, title="Deep Analysis Default", description="Auto-generated for imports")
        db.session.add(default_set)
        db.session.flush()

    for item in data:
        original = item.get('original_text')
        if not original: continue
        
        sentence = Sentence(
            user_id=user_id,
            set_id=default_set.id,
            original_text=original,
            translated_text=item.get('translated_text'),
            audio_url=item.get('audio_url'),
            analysis_note=item.get('analysis_note')
        )
        db.session.add(sentence)
        
        # Link Grammars
        linked_grammars = item.get('linked_grammars', [])
        for pattern in linked_grammars:
            g = Grammar.query.filter_by(pattern=pattern).first()
            if g:
                sentence.grammars.append(g)
                
        # Link Vocabulary
        linked_vocabs = item.get('linked_vocabularies', [])
        for word in linked_vocabs:
            v = Vocabulary.query.filter_by(word=word).first()
            if v:
                sentence.vocabularies.append(v)
        
        count += 1
    return count



