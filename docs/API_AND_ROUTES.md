# PodLearn - API and Routes

PodLearn leverages a modular routing system via Flask Blueprints to handle requests for the dashboard, player, and background API services.

## Core Blueprints

| Blueprint | Path Prefix | Purpose |
| :--- | :--- | :--- |
| `auth` | `/auth` | Handles registration, login, and profile management. |
| `dashboard` | `/` | Home page, library overview, and set management. |
| `player` | `/player` | Core interactive video player environment. |
| `practice` | `/practice` | Study sessions for sentences, grammar, and vocab. |
| `api` | `/api` | JSON endpoints for XHR/Fetch communication. |
| `admin` | `/admin` | Administrative dashboard for system management. |

## Notable Endpoints

### Dashboard (`/`)
- `GET /`: The main dashboard for librarians and study sets.
- `GET /import`: UI for importing new videos or study materials.

### Player (`/player`)
- `GET /player/lesson/<int:lesson_id>`: Opens the interactive player for a saved lesson.
- `GET /player/lesson_by_video/<int:video_id>`: Finds or creates a lesson record for a specific video before playing.

### Practice (`/practice`)
- `GET /practice/sentence/<int:sentence_id>`: Direct study link for a sentence pattern.
- `GET /practice/grammar/<int:sentence_id>`: Practice mode focused on grammar points within a sentence.
- `GET /practice/vocab/<int:sentence_id>`: Practice mode focused on vocabulary.

### API (`/api`)
- `POST /api/note/add`: Save a timestamped note from the player.
- `POST /api/note/edit`: Edit an existing note.
- `GET /api/subtitles/<int:video_id>`: Fetch transcript data for the player.
- `POST /api/set/create`: Create a new Sentence Set.
- `POST /api/sentence/add`: Add a new sentence record from the transcript.
- `POST /api/import/json`: Endpoint for batch-importing JSON data.

## Backend Services
Logical operations are handled by services under `app/services/`:
- `yt_service`: Handles communication with YouTube APIs and `yt-dlp`.
- `auth_service`: Management of user accounts and permissions.
- `analysis_service`: Parsing and structuring linguistic analysis of sentences.
