import os
import asyncio
import edge_tts
from gtts import gTTS
from pydub import AudioSegment
import tempfile
from flask import current_app
from abc import ABC, abstractmethod

class BaseTTSEngine(ABC):
    """
    Abstract Base Class for TTS Engines.
    """
    @abstractmethod
    def generate_audio(self, text, voice, output_path):
        pass

class EdgeTTSEngine(BaseTTSEngine):
    """
    TTS Engine using Microsoft Edge TTS (asynchronous).
    """
    def generate_audio(self, text, voice, output_path):
        async def _run():
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(output_path)
        
        asyncio.run(_run())

class GoogleTTSEngine(BaseTTSEngine):
    """
    TTS Engine using Google Translate TTS (gTTS).
    """
    def generate_audio(self, text, voice, output_path):
        # Extract language code (e.g., 'ja' from 'ja-JP-NanamiNeural')
        lang = voice.split('-')[0] if '-' in voice else voice
        tts = gTTS(text=text, lang=lang)
        tts.save(output_path)

class TTSFactory:
    """
    Factory to return the appropriate TTS engine.
    """
    @staticmethod
    def get_engine(engine_name):
        if engine_name == 'edge-tts':
            return EdgeTTSEngine()
        elif engine_name == 'google':
            return GoogleTTSEngine()
        else:
            raise ValueError(f"Unsupported TTS engine: {engine_name}")

def generate_bilingual_audio(sentence_id, original_text, translated_text, config_json=None):
    """
    Generates a bilingual MP3 file: [Original Text] + [1s Silence] + [Translated Text].
    Returns the relative URL to the generated file.
    """
    if config_json is None:
        config_json = {}

    engine_name = config_json.get('tts_engine', 'edge-tts')
    voice_orig = config_json.get('tts_voice_source', 'ja-JP-NanamiNeural')
    voice_trans = config_json.get('tts_voice_target', 'vi-VN-HoaiMyNeural')

    # Ensure output directory exists
    output_dir = os.path.join(current_app.static_folder, 'audio', 'sentences')
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    output_filename = f"sentence_{sentence_id}.mp3"
    output_path = os.path.join(output_dir, output_filename)

    # Instantiate engine using Strategy Pattern
    engine = TTSFactory.get_engine(engine_name)

    with tempfile.TemporaryDirectory() as tmpdir:
        temp_orig = os.path.join(tmpdir, "temp_orig.mp3")
        temp_trans = os.path.join(tmpdir, "temp_trans.mp3")

        # Part 1: Generate audio for both parts
        engine.generate_audio(original_text, voice_orig, temp_orig)
        engine.generate_audio(translated_text, voice_trans, temp_trans)

        # Part 2: Concatenate using pydub (Keep original logic)
        orig_audio = AudioSegment.from_file(temp_orig)
        trans_audio = AudioSegment.from_file(temp_trans)
        silence = AudioSegment.silent(duration=1000) # 1 second

        combined = orig_audio + silence + trans_audio
        combined.export(output_path, format="mp3")

    return f"/static/audio/sentences/{output_filename}"
