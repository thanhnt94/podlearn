from app import create_app
from app.models.setting import AppSetting

app = create_app()
new_prompt = """You are a language learning assistant. Analyze the following sentence for a learner.

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

with app.app_context():
    print("Updating AI_SENTENCE_PROMPT in database...")
    AppSetting.set(
        'AI_SENTENCE_PROMPT', 
        new_prompt, 
        category='ai', 
        description='Prompt for per-sentence AI analysis (8-card format)'
    )
    print("Successfully updated to 8-card prompt.")
