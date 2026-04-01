import os
import asyncio
import edge_tts
from gtts import gTTS
from pydub import AudioSegment
import tempfile
from flask import current_app

def generate_bilingual_audio(sentence_id, original_text, translated_text, config_json=None):
    """
    Generates a bilingual MP3 file: [Original Text] + [1s Silence] + [Translated Text].
    Returns the relative URL to the generated file.
    """
    if config_json is None:
        config_json = {}

    engine = config_json.get('tts_engine', 'edge-tts')
    voice_orig = config_json.get('tts_voice_source', 'ja-JP-NanamiNeural')
    voice_trans = config_json.get('tts_voice_target', 'vi-VN-HoaiMyNeural')

    # Ensure output directory exists
    output_dir = os.path.join(current_app.static_folder, 'audio', 'sentences')
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    output_filename = f"sentence_{sentence_id}.mp3"
    output_path = os.path.join(output_dir, output_filename)

    with tempfile.TemporaryDirectory() as tmpdir:
        temp_orig = os.path.join(tmpdir, "temp_orig.mp3")
        temp_trans = os.path.join(tmpdir, "temp_trans.mp3")

        if engine == 'edge-tts':
            async def _run_edge_tts():
                # Original Text
                communicate_orig = edge_tts.Communicate(original_text, voice_orig)
                await communicate_orig.save(temp_orig)
                # Translated Text
                communicate_trans = edge_tts.Communicate(translated_text, voice_trans)
                await communicate_trans.save(temp_trans)

            asyncio.run(_run_edge_tts())

        elif engine == 'google':
            # Original (Assuming language code is prefix of voice_orig or default to 'ja')
            lang_orig = voice_orig.split('-')[0] if '-' in voice_orig else 'ja'
            tts_orig = gTTS(text=original_text, lang=lang_orig)
            tts_orig.save(temp_orig)
            
            # Translated (Assuming Vietnamese)
            tts_trans = gTTS(text=translated_text, lang='vi')
            tts_trans.save(temp_trans)
        
        else:
            raise ValueError(f"Unsupported TTS engine: {engine}")

        # Concatenate using pydub
        orig_audio = AudioSegment.from_file(temp_orig)
        trans_audio = AudioSegment.from_file(temp_trans)
        silence = AudioSegment.silent(duration=1000) # 1 second

        combined = orig_audio + silence + trans_audio
        combined.export(output_path, format="mp3")

    return f"/static/audio/sentences/{output_filename}"
