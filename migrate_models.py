import os

study_models = ['vocabulary.py', 'sentence.py', 'grammar.py', 'ai_insight.py', 'glossary.py', 'sentence_token.py', 'lesson.py', 'note.py']
engagement_models = ['activity_log.py', 'badge.py', 'notification.py', 'shadowing.py', 'comment.py', 'share.py', 'setting.py']

def concat_models(module_name, model_files):
    out_path = f"app/modules/{module_name}/models.py"
    with open(out_path, 'a', encoding='utf-8') as out_f:
        for m in model_files:
            in_path = f"app/models/{m}"
            if os.path.exists(in_path):
                with open(in_path, 'r', encoding='utf-8') as in_f:
                    content = in_f.read()
                    # Strip out imports to avoid duplication, or just append everything
                    # It's better to just append. We'll fix imports later.
                    out_f.write(f'\n# --- From {m} ---\n')
                    out_f.write(content)
                os.remove(in_path)

concat_models('study', study_models)
concat_models('engagement', engagement_models)
print("Migration done")
