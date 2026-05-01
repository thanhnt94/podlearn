import os
import json
import logging
import threading
import time
import google.generativeai as genai
from app.modules.engagement.models import AppSetting
from app.modules.study.models import AIInsightTrack, AIInsightItem
from app.modules.content.models import SubtitleTrack, Video
from app.core.extensions import db

logger = logging.getLogger(__name__)

class AIService:
    @staticmethod
    def get_gemini_config():
        """Fetches Gemini API settings from the database."""
        api_key = AppSetting.get('GEMINI_API_KEY')
        model_name = AppSetting.get('GEMINI_MODEL', 'gemini-2.0-flash')
        return api_key, model_name

    @staticmethod
    def list_available_models():
        """Lists available Gemini models using the configured API key."""
        api_key, _ = AIService.get_gemini_config()
        if not api_key: return []
        try:
            genai.configure(api_key=api_key)
            models = genai.list_models()
            return [m.name.replace('models/', '') for m in models if 'generateContent' in m.supported_generation_methods]
        except Exception as e:
            logger.error(f"Error listing Gemini models: {e}")
            return []

    @staticmethod
    def generate_video_summary(transcript_text, target_lang='vi', model_name='gemini-2.0-flash'):
        """Generates an overall summary of the video content."""
        from app.core.utils.feature_flags import get_ai_mode
        if get_ai_mode() == 'mock':
            return f"[MOCK SUMMARY] Tóm tắt nội dung video ({target_lang})."

        api_key, cfg_model = AIService.get_gemini_config()
        model_name = cfg_model or model_name
        if not api_key or not transcript_text: return None

        DEFAULT_SUMMARY_PROMPT = f"You are a language learning assistant. Summarize the video in {target_lang}."
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

    @staticmethod
    def analyze_single_line(track_id, subtitle_index, text, start_time=0, end_time=0, target_lang='vi'):
        """Analyze a single sentence on demand."""
        from app.core.utils.feature_flags import get_ai_mode
        if get_ai_mode() == 'mock':
            return {'short_explanation': f"[MOCK] {text}", 'grammar_analysis': "Mock analysis data."}

        api_key, model_name = AIService.get_gemini_config()
        if not api_key or not text: return None

        DEFAULT_SENTENCE_PROMPT = """Analyze the following sentence. Return JSON only."""
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            system_prompt = AppSetting.get('AI_SENTENCE_PROMPT') or DEFAULT_SENTENCE_PROMPT
            prompt = f"{system_prompt}\n\nTarget Language: {target_lang}\n\nSentence: {text}"
            
            response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
            raw_text = response.text.strip()
            
            try:
                analysis = json.loads(raw_text)
            except:
                import re
                match = re.search(r'\{.*\}', raw_text, re.DOTALL)
                analysis = json.loads(match.group()) if match else {}

            # Save to DB
            item = AIInsightItem.query.filter_by(track_id=track_id, subtitle_index=subtitle_index).first()
            if not item:
                item = AIInsightItem(track_id=track_id, subtitle_index=subtitle_index, start_time=start_time, end_time=end_time)
                db.session.add(item)
            
            item.short_explanation = analysis.get('short_explanation', '')
            item.grammar_analysis = analysis.get('grammar_analysis', '')
            item.data_json = analysis
            db.session.commit()
            return analysis
        except Exception as e:
            logger.error(f"Gemini single-line analysis failed: {e}")
            return None

    @staticmethod
    def generate_insights(track_id):
        """Used by Celery to process a pending track."""
        track = AIInsightTrack.query.get(track_id)
        if not track: return
        
        track.status = 'processing'
        db.session.commit()
        
        try:
            video = Video.query.get(track.video_id)
            source_sub = SubtitleTrack.query.filter_by(video_id=video.id, is_original=True).first() or \
                         SubtitleTrack.query.filter_by(video_id=video.id).first()
            
            if not source_sub or not source_sub.content_json:
                track.status = 'failed'
                db.session.commit()
                return

            transcript_lines = source_sub.content_json
            full_text = " ".join([l.get('text', '') for l in transcript_lines])
            
            # Summary
            summary = AIService.generate_video_summary(full_text, target_lang=track.language_code)
            if summary:
                track.overall_summary = summary
            
            track.total_lines = len(transcript_lines)
            track.status = 'completed'
            db.session.commit()
        except Exception as e:
            logger.error(f"Batch generation failed for track {track_id}: {e}")
            track.status = 'failed'
            db.session.commit()

# Compatibility wrappers
def generate_video_summary(*args, **kwargs): return AIService.generate_video_summary(*args, **kwargs)
def analyze_single_line(*args, **kwargs): return AIService.analyze_single_line(*args, **kwargs)
def start_background_analysis(app, video_id, transcript_lines, lang='vi'):
    # Spawns a background thread if needed
    pass

