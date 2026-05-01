import re

def parse_bbcode(text):
    """
    Parses custom BBCode tags into HTML spans and strong tags.
    [hl]text[/hl] -> <span class="grammar-point">text</span>
    [b]text[/b] -> <strong>text</strong>
    """
    if text is None:
        return ""
    
    if not isinstance(text, str):
        text = str(text)

    # Replace [hl]...[/hl] with <span class="grammar-point">...</span>
    text = re.sub(r'\[hl\](.*?)\[/hl\]', r'<span class="grammar-point">\1</span>', text)
    
    # Replace [b]...[/b] with <strong>...</strong>
    text = re.sub(r'\[b\](.*?)\[/b\]', r'<strong>\1</strong>', text)
    
    # Replace [i]...[/i] with <em>...</em>
    text = re.sub(r'\[i\](.*?)\[/i\]', r'<em>\1</em>', text)
    
    return text
