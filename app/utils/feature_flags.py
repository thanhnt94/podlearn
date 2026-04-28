from ..modules.engagement.models import AppSetting

def is_enabled(feature_key, default=False):
    """
    Checks if a feature is enabled via AppSetting.
    Expected feature_key format: 'feature_ai_analysis', 'feature_shadowing_eval', etc.
    """
    return AppSetting.get(feature_key, default)

def get_ai_mode():
    """
    Returns the AI processing mode: 'real', 'mock', or 'disabled'.
    """
    return AppSetting.get('ai_processing_mode', 'mock')
