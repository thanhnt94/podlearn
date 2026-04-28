import os
import hashlib
import asyncio
import logging
import edge_tts
from flask import current_app

logger = logging.getLogger(__name__)

class TTSService:
    # Mapping for common languages to high-quality female neural voices
    VOICE_MAPPING = {
        'vi': 'vi-VN-HoaiMyNeural',
        'en': 'en-US-JennyNeural',
        'ja': 'ja-JP-NanamiNeural',
        'ko': 'ko-KR-SunHiNeural',
        'zh': 'zh-CN-XiaoxiaoNeural',
        'fr': 'fr-FR-DeniseNeural',
        'de': 'de-DE-KatjaNeural',
        'es': 'es-ES-ElviraNeural',
        'ru': 'ru-RU-SvetlanaNeural',
        'it': 'it-IT-ElsaNeural',
        'pt': 'pt-PT-RaquelNeural',
        'th': 'th-TH-PremwadeeNeural',
        'id': 'id-ID-GiselaNeural',
        'hi': 'hi-IN-SwaraNeural',
    }

    def __init__(self):
        self.output_folder = current_app.config.get('TTS_AUDIO_FOLDER')
        if not os.path.exists(self.output_folder):
            os.makedirs(self.output_folder, exist_ok=True)

    def _get_voice(self, lang_code):
        """Map language code to an edge-tts voice."""
        base_lang = lang_code.split('-')[0].lower()
        return self.VOICE_MAPPING.get(base_lang, 'en-US-JennyNeural')

    def _get_cache_path(self, text, lang_code):
        """Generate a SHA256 hash for the text and lang to used as filename."""
        clean_text = text.strip().lower()
        voice = self._get_voice(lang_code)
        
        # We create a unique hash for text + voice combination
        content_id = hashlib.sha256(f"{clean_text}|{voice}".encode()).hexdigest()
        
        # Organize by language subfolders
        lang_dir = os.path.join(self.output_folder, lang_code)
        if not os.path.exists(lang_dir):
            os.makedirs(lang_dir, exist_ok=True)
            
        filename = f"{content_id}.mp3"
        return os.path.join(lang_dir, filename), filename

    async def generate_audio(self, text, lang_code):
        """Generate audio for a single line using Edge TTS (with caching)."""
        full_path, filename = self._get_cache_path(text, lang_code)
        
        # Check if already cached
        if os.path.exists(full_path):
            logger.info(f"TTS Cache Hit: {filename}")
            return f"/tts-audio/{lang_code}/{filename}"

        # Generate new audio
        voice = self._get_voice(lang_code)
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(full_path)
            logger.info(f"TTS Generated: {filename} ({lang_code})")
            return f"/tts-audio/{lang_code}/{filename}"
        except Exception as e:
            logger.error(f"TTS Generation Error: {e}")
            return None

    def generate_sync(self, text, lang_code):
        """Synchronous wrapper for generating audio."""
        return asyncio.run(self.generate_audio(text, lang_code))

    async def batch_generate(self, lines, lang_code, task_id=None):
        """Generate audio for a list of lines in background."""
        results = {}
        total = len(lines)
        done = 0
        
        # Store progress in a simple global or cache if needed
        # For now, we'll just log and return results
        for line in lines:
            idx = line.get('index')
            text = line.get('text')
            if not text: continue
            
            url = await self.generate_audio(text, lang_code)
            if url:
                results[idx] = url
            
            done += 1
            # You could update a global state here for polling
            
        return results

# Global task storage for batch status polling
tts_tasks = {}

async def run_batch_task(task_id, lines, lang_code):
    service = TTSService()
    tts_tasks[task_id] = {'status': 'processing', 'done': 0, 'total': len(lines), 'results': {}}
    
    for line in lines:
        idx = line.get('index')
        text = line.get('text')
        url = await service.generate_audio(text, lang_code)
        
        tts_tasks[task_id]['done'] += 1
        if url:
            tts_tasks[task_id]['results'][idx] = url
            
    tts_tasks[task_id]['status'] = 'completed'
