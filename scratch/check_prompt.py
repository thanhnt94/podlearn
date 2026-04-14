import os
from app import create_app
from app.models.setting import AppSetting

app = create_app()
with app.app_context():
    prompt = AppSetting.get('AI_SENTENCE_PROMPT')
    with open('scratch/prompt_output.txt', 'w', encoding='utf-8') as f:
        if prompt:
            f.write("DEBUG_PROMPT_START\n")
            f.write(prompt)
            f.write("\nDEBUG_PROMPT_END\n")
        else:
            f.write("DEBUG_PROMPT_NONE\n")
