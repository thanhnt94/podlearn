import os
import json
import logging
import threading
import time
import google.generativeai as genai
from ..models.setting import AppSetting
from ..models.ai_insight import AIInsightTrack, AIInsightItem
from ..extensions import db

logger = logging.getLogger(__name__)

def get_gemini_config():
    """Fetches Gemini API settings from the database."""
    api_key = AppSetting.get('GEMINI_API_KEY')
    model_name = AppSetting.get('GEMINI_MODEL', 'gemini-2.0-flash')
    return api_key, model_name

def list_available_models():
    """Lists available Gemini models using the configured API key."""
    api_key, _ = get_gemini_config()
    if not api_key:
        return []
    
    try:
        genai.configure(api_key=api_key)
        models = genai.list_models()
        return [m.name.replace('models/', '') for m in models if 'generateContent' in m.supported_generation_methods]
    except Exception as e:
        logger.error(f"Error listing Gemini models: {e}")
        return []

def generate_video_summary(transcript_text, target_lang='vi', model_name='gemini-2.0-flash'):
    """Generates an overall summary of the video content."""
    api_key, cfg_model = get_gemini_config()
    model_name = cfg_model or model_name
    if not api_key or not transcript_text:
        return None

    DEFAULT_SUMMARY_PROMPT = f"""You are a language learning assistant. Based on the transcript below, write a comprehensive summary of the video content in {target_lang}.

Include:
1. Main topic and themes
2. Key vocabulary or expressions used
3. Overall difficulty level assessment
4. A brief outline of the content flow

Write in a clear, helpful style for language learners. Respond in {target_lang}."""
        
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        
        system_prompt = AppSetting.get('AI_SUMMARY_PROMPT') or DEFAULT_SUMMARY_PROMPT
        prompt = f"{system_prompt}\n\nTranscript:\n{transcript_text[:15000]}"
        
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini summary generation failed: {e}")
        return None

def analyze_sentences_batch(sentences_list, target_lang='vi', model_name='gemini-1.5-flash'):
    """Analyze a batch of sentences using Gemini for efficiency."""
    api_key, _ = get_gemini_config()
    if not api_key or not sentences_list:
        return []
        
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        
        system_prompt = AppSetting.get('AI_SENTENCE_PROMPT', 'Analyze sentences...')
        
        # Prepare batch text
        batch_text = ""
        for i, text in enumerate(sentences_list):
            batch_text += f"Line {i}: {text}\n"

        prompt = f"{system_prompt}\n\nTarget Language: {target_lang}\n\nSentences:\n{batch_text}"
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        
        results = json.loads(response.text)
        # Ensure it's a list
        if isinstance(results, dict) and 'results' in results:
            return results['results']
        return results if isinstance(results, list) else []
    except Exception as e:
        if "429" in str(e):
             raise e # Re-raise to let the retry loop handle it
        logger.error(f"Gemini batch analysis failed: {e}")
        return []

def analyze_sentences_batch_retry(sentences_list, target_lang='vi', model_name='gemini-2.0-flash', retries=3):
    """Wrapper with retry logic for 429 errors."""
    for attempt in range(retries):
        try:
            return analyze_sentences_batch(sentences_list, target_lang, model_name)
        except Exception as e:
            if "429" in str(e) and attempt < retries - 1:
                wait_time = (attempt + 1) * 15 # Wait progressively longer
                logger.warning(f"Quota exceeded. Retrying in {wait_time}s... (Attempt {attempt + 1}/{retries})")
                time.sleep(wait_time)
            else:
                logger.error(f"Gemini batch analysis failed after {attempt + 1} attempts: {e}")
                return []
    return []


def start_background_analysis(app, video_id, transcript_lines, lang='vi'):
    """Spawns a background thread to process video insights."""
    thread = threading.Thread(target=_run_analysis_context, args=(app, video_id, transcript_lines, lang))
    thread.daemon = True
    thread.start()

def _run_analysis_context(app, video_id, transcript_lines, lang):
    """Entry point for the thread with app context."""
    with app.app_context():
        _run_analysis_logic(video_id, transcript_lines, lang)

def _run_analysis_logic(video_id, transcript_lines, lang):
    """The actual analysis logic loop."""
    _, model_name = get_gemini_config()
    
    # 1. Initialize or find track
    track = AIInsightTrack.query.filter_by(video_id=video_id, language_code=lang).first()
    if not track:
        track = AIInsightTrack(video_id=video_id, language_code=lang)
        db.session.add(track)
    
    track.status = 'processing'
    track.total_lines = len(transcript_lines)
    track.processed_lines = 0
    track.model_name = model_name
    db.session.commit()

    try:
        # 2. Generate Summary First
        full_text = " ".join([l.get('text', '') for l in transcript_lines])
        summary = generate_video_summary(full_text, target_lang=lang, model_name=model_name)
        if summary:
            track.overall_summary = summary
            db.session.commit()

        # Final status update
        track.status = 'completed'
        db.session.commit()
    except Exception as e:
        logger.error(f"Background analysis failed for video {video_id}: {e}")
        track.status = 'failed'
        db.session.commit()

def analyze_single_line(track_id, subtitle_index, text, start_time=0, end_time=0, target_lang='vi'):
    """Analyze a single sentence on demand."""
    api_key, model_name = get_gemini_config()
    if not api_key or not text:
        return None

    DEFAULT_SENTENCE_PROMPT = """You are a language learning assistant. Analyze the following sentence for a learner.

Use **Markdown formatting** in your analysis (bold for key terms, bullet points for lists, numbered lists for steps, etc.).

Respond ONLY with a valid JSON object using this exact schema:
{
  "short_explanation": "A clear, natural translation and brief summary of the sentence meaning in [TARGET_LANG].",
  "grammar_analysis": "Detailed grammatical breakdown using markdown. Explain structure, parts of speech, and key patterns.",
  "key_vocabulary": "List 3-5 key words/phrases with: [Word] — [Meaning] — [Usage note]. Use markdown lists.",
  "nuance_style": "Explain the tone (formal/casual), level of politeness, and style (spoken/written).",
  "similar_sentences": "Provide 3-4 similar sentences with their translations in [TARGET_LANG] to help the learner expand.",
  "cultural_context": "Any cultural background, etiquette, or specific situations where this is used (or avoided).",
  "memory_hack": "A creative mnemonic or tip to remember this sentence or its main parts.",
  "common_mistakes": "Highlight common errors learners make with this structure or vocabulary and how to avoid them."
}

Do NOT include any text outside the JSON. Do NOT wrap it in markdown code blocks."""
        
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        
        system_prompt = AppSetting.get('AI_SENTENCE_PROMPT') or DEFAULT_SENTENCE_PROMPT
        prompt = f"{system_prompt}\n\nTarget Language: {target_lang}\n\nSentence: {text}"
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        
        raw_text = response.text.strip()
        # Helper to find keys case-insensitively or with variations
        def get_v(d, keys, default=''):
            if not isinstance(d, dict): return default
            for k in keys:
                # Check case-insensitive
                for dk in d.keys():
                    if dk.lower() == k.lower():
                        return d[dk]
            return default

        # Try parsing JSON, with fallback for markdown-wrapped responses
        try:
            analysis = json.loads(raw_text)
        except json.JSONDecodeError:
            import re
            match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if match:
                try:
                    analysis = json.loads(match.group())
                except:
                    analysis = {}
            else:
                analysis = {}
        
        # Robustly extract fields
        final_analysis = {
            'short_explanation': get_v(analysis, ['short_explanation', 'translation', 'meaning', 'summary']),
            'grammar_analysis': get_v(analysis, ['grammar_analysis', 'grammar', 'structure']),
            'key_vocabulary': get_v(analysis, ['key_vocabulary', 'vocabulary', 'words', 'vocab']),
            'nuance_style': get_v(analysis, ['nuance_style', 'nuance', 'style', 'tone']),
            'similar_sentences': get_v(analysis, ['similar_sentences', 'similar', 'examples']),
            'cultural_context': get_v(analysis, ['cultural_context', 'culture', 'etiquette', 'context']),
            'memory_hack': get_v(analysis, ['memory_hack', 'hack', 'mnemonic', 'tip']),
            'common_mistakes': get_v(analysis, ['common_mistakes', 'mistakes', 'errors'])
        }

        # If it's completely empty but we have raw text, put raw text in explanation/grammar
        if not final_analysis['short_explanation'] and raw_text:
            final_analysis['short_explanation'] = raw_text[:200]
            final_analysis['grammar_analysis'] = raw_text

        # Save to DB
        item = AIInsightItem.query.filter_by(track_id=track_id, subtitle_index=subtitle_index).first()
        if not item:
            item = AIInsightItem(
                track_id=track_id,
                subtitle_index=subtitle_index,
                start_time=start_time,
                end_time=end_time
            )
            db.session.add(item)
            
        item.short_explanation = final_analysis['short_explanation']
        item.grammar_analysis = final_analysis['grammar_analysis']
        item.nuance_style = final_analysis['nuance_style']
        item.context_notes = final_analysis['cultural_context']
        
        item.data_json = {
            'key_vocabulary': final_analysis['key_vocabulary'],
            'similar_sentences': final_analysis['similar_sentences'],
            'cultural_context': final_analysis['cultural_context'],
            'memory_hack': final_analysis['memory_hack'],
            'common_mistakes': final_analysis['common_mistakes']
        }
        
        db.session.commit()
        return final_analysis
    except Exception as e:
        logger.error(f"Gemini single-line analysis failed: {e}")
        return None

