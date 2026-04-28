# PodLearn Module Architecture

This document describes the Domain-Driven Design (DDD) modular structure implemented in PodLearn.

## Core Principles
1. **Encapsulation**: Each module contains its own models, services, and routes.
2. **Gatekeeper Pattern**: Cross-module communication must happen through `interface.py`.
3. **Decoupling**: Modules should communicate via Signals/Events when possible to avoid direct dependencies.

## Module List

### 1. Identity Module (`app/modules/identity`)
- **Purpose**: User management, Authentication, SSO.
- **Key Interface**:
    - `get_user(user_id)`: Retrieve user object.
    - `login_user(email, password)`: Verify credentials.

### 2. Content Module (`app/modules/content`)
- **Purpose**: Video ingestion, Subtitle management, AI Insights, TTS.
- **Key Interface**:
    - `get_video_info(url)`: Fetch YT metadata.
    - `get_ai_insight(track_id, index, text)`: Get deep analysis for a line.

### 3. Engagement Module (`app/modules/engagement`)
- **Purpose**: Streaks, Gamification (Badges/XP), Notifications, Comments.
- **Key Interface**:
    - `extend_user_streak(user_id)`: Update daily streak.
    - `sync_scores()`: Global leaderboard sync.

### 4. Study Module (`app/modules/study`)
- **Purpose**: SRS (Spaced Repetition), Vocabulary Analysis, Shadowing evaluations.
- **Key Interface**:
    - `get_due_reviews(set_id)`: Fetch cards for review.
    - `tokenize_text(text)`: NLP segmentation.

## Dependency Graph
- `Content` depends on `Identity` (for ownership).
- `Study` depends on `Content` (for source sentences).
- `Engagement` depends on `Identity` (for user stats).
- `Identity` has NO dependencies on other domain modules.
