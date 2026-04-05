# PodLearn - Technology Stack

PodLearn is built using a modern, efficient stack focused on rapid development and a premium user experience.

## Backend (Python)
- **Framework**: [Flask](https://flask.palletsprojects.com/) - A lightweight WSGI web application framework.
- **ORM**: [SQLAlchemy](https://www.sqlalchemy.org/) - SQL toolkit and Object-Relational Mapper.
- **Migrations**: [Flask-Migrate](https://flask-migrate.readthedocs.io/) - Alembic migrations for Flask.
- **Authentication**: [Flask-Login](https://flask-login.readthedocs.io/) - User session management.
- **JSON Handling**: Custom sanitization and parsing for complex linguistic analysis objects.

## Frontend (Standard Web)
- **Templating**: [Jinja2](https://jinja.palletsprojects.com/) - Server-side HTML templating.
- **Styling**: Vanilla CSS for maximum flexibility, with some elements inspired by modern "glassmorphism" and premium UI aesthetics.
- **Dynamics**: Vanilla JavaScript (ES6+) for interactive components (the video player, practice sessions).
- **Icons**: [FontAwesome](https://fontawesome.com/) or similar icon libraries.

## Database
- **Development**: [SQLite](https://www.sqlite.org/) - Serverless, zero-configuration database.
- **Production-Ready**: PostgreSQL or MySQL support via standard SQLAlchemy drivers.

## Integrations
- **YouTube DATA API**: For fetching video metadata and thumbnails.
- **yt-dlp**: For retrieving YouTube subtitle tracks and video information.
- **SRS (Spaced Repetition System)**: Custom logic for scheduling reviews in mastery modes.
- **CentralAuth SSO**: Integrated with a centralized authentication system for ecosystem-wide single sign-on.
