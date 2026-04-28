from .services.srs_service import get_due_sentences
from .services.vocab_service import analyze_sentence_tokens

def get_due_reviews(set_id):
    return get_due_sentences(set_id)

def tokenize_text(text, lang='ja'):
    return analyze_sentence_tokens(text, lang)
