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

Use **Markdown formatting** in your analysis (bold for key terms, bullet points for lists, numbered lists for steps, etc.)

Respond ONLY with a valid JSON object using this exact schema:
{
  "short_explanation": "A brief 1-line summary of the sentence meaning",
  "grammar_analysis": "Detailed grammatical breakdown using markdown:\n- Sentence structure\n- Key grammar points with **bold** highlights\n- Verb forms, particles, conjugations explained",
  "nuance_style": "Is this formal/informal/spoken/written? Cultural nuance. Use markdown for clarity.",
  "context_notes": "When and how would a native speaker use this? Situational context with markdown.",
  "similar_sentences": "Provide 3-4 **similar sentences** a learner can practice with. Format as a numbered markdown list:\n1. [sentence] — [brief meaning]\n2. [sentence] — [brief meaning]\n..."
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
        logger.info(f"Gemini raw response for line {subtitle_index}: {raw_text[:200]}")
        
        # Try parsing JSON, with fallback for markdown-wrapped responses
        try:
            analysis = json.loads(raw_text)
        except json.JSONDecodeError:
            # Gemini sometimes wraps JSON in ```json ... ```
            import re
            match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if match:
                analysis = json.loads(match.group())
            else:
                # Last resort: treat entire response as a plain explanation
                logger.warning(f"Could not parse JSON from Gemini. Using raw text as explanation.")
                analysis = {
                    'short_explanation': raw_text[:200],
                    'grammar_analysis': raw_text,
                    'nuance_style': '',
                    'context_notes': ''
                }
        
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
            
        item.short_explanation = analysis.get('short_explanation', '')
        item.grammar_analysis = analysis.get('grammar_analysis', '')
        item.nuance_style = analysis.get('nuance_style', '')
        item.context_notes = analysis.get('context_notes', '')
        item.data_json = {'similar_sentences': analysis.get('similar_sentences', '')}
        
        db.session.commit()
        return analysis
    except Exception as e:
        logger.error(f"Gemini single-line analysis failed: {e}")
        return None

