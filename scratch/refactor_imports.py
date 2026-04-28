import os

replacements = {
    "from .services.gamification_service": "from .modules.engagement.services.gamification_service",
    "from ..services.gamification_service": "from ..modules.engagement.services.gamification_service",
    "from app.services.gamification_service": "from app.modules.engagement.services.gamification_service",
    
    "from .services.srs_service": "from .modules.study.services.srs_service",
    "from ..services.srs_service": "from ..modules.study.services.srs_service",
    "from app.services.srs_service": "from app.modules.study.services.srs_service",
    
    "from .services.vocab_service": "from .modules.study.services.vocab_service",
    "from ..services.vocab_service": "from ..modules.study.services.vocab_service",
    "from app.services.vocab_service": "from app.modules.study.services.vocab_service",
    
    "from .services.shadowing_service": "from .modules.study.services.shadowing_service",
    "from ..services.shadowing_service": "from ..modules.study.services.shadowing_service",
    "from app.services.shadowing_service": "from app.modules.study.services.shadowing_service",
    
    "from .services.ai_service": "from .modules.content.services.ai_service",
    "from ..services.ai_service": "from ..modules.content.services.ai_service",
    "from app.services.ai_service": "from app.modules.content.services.ai_service",
    
    "from .services.subtitle_service": "from .modules.content.services.subtitle_service",
    "from ..services.subtitle_service": "from ..modules.content.services.subtitle_service",
    "from app.services.subtitle_service": "from app.modules.content.services.subtitle_service",
    
    "from .services.handsfree_service": "from .modules.content.services.handsfree_service",
    "from ..services.handsfree_service": "from ..modules.content.services.handsfree_service",
    "from app.services.handsfree_service": "from app.modules.content.services.handsfree_service",
    
    "from .services.audio_service": "from .modules.content.services.audio_service",
    "from ..services.audio_service": "from ..modules.content.services.audio_service",
    "from app.services.audio_service": "from app.modules.content.services.audio_service",
    
    "from .services.tts_service": "from .modules.content.services.tts_service",
    "from ..services.tts_service": "from ..modules.content.services.tts_service",
    "from app.services.tts_service": "from app.modules.content.services.tts_service",
    
    "from .services.youtube_service": "from .modules.content.services.youtube_service",
    "from ..services.youtube_service": "from ..modules.content.services.youtube_service",
    "from app.services.youtube_service": "from app.modules.content.services.youtube_service",
    
    "from .services.lesson_service": "from .modules.content.services.lesson_service",
    "from ..services.lesson_service": "from ..modules.content.services.lesson_service",
    "from app.services.lesson_service": "from app.modules.content.services.lesson_service",
    
    "from .services.sentence_service": "from .modules.content.services.sentence_service",
    "from ..services.sentence_service": "from ..modules.content.services.sentence_service",
    "from app.services.sentence_service": "from app.modules.content.services.sentence_service",
    
    "from .services.sso_service": "from .modules.identity.services.sso_service",
    "from ..services.sso_service": "from ..modules.identity.services.sso_service",
    "from app.services.sso_service": "from app.modules.identity.services.sso_service",
    
    "from .services.central_auth_client": "from .modules.identity.services.central_auth_client",
    "from ..services.central_auth_client": "from ..modules.identity.services.central_auth_client",
    "from app.services.central_auth_client": "from app.modules.identity.services.central_auth_client",
}

def refactor_dir(target_dir):
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                new_content = content
                for old, new in replacements.items():
                    new_content = new_content.replace(old, new)
                
                if new_content != content:
                    print(f"Refactoring {path}")
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(new_content)

if __name__ == "__main__":
    refactor_dir("c:\\Code\\Ecosystem\\PodLearn\\app")
