"""AuraFlow entry point."""

from app import create_app
import os

app = create_app()

if __name__ == '__main__':
    # Ensure media directory exists even if DB logic moved to factory
    media_folder = app.config.get('MEDIA_FOLDER')
    if media_folder and not os.path.exists(media_folder):
        os.makedirs(media_folder)
        print(f"Created media directory: {media_folder}")

    # Standard run for local development
    app.run(debug=True, port=5020)
