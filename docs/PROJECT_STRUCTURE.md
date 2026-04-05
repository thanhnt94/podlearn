# PodLearn Project Structure

PodLearn is a Modular Flask-based web application designed for language learners focusing on video-based learning (YouTube).

## Directory Layout

```text
PodLearn/
├── app/                        # Main Application Code
│   ├── models/                 # SQLAlchemy Models (Database Entities)
│   ├── routes/                 # Flask Blueprints (Controllers)
│   ├── services/               # Business Logic & External Integrations
│   ├── static/                 # Frontend Assets
│   ├── templates/              # Jinja2 HTML Templates
│   ├── utils/                  # Helper functions (time, formatting)
│   ├── __init__.py             # App Factory & configuration
│   ├── config.py               # Environment configuration
│   └── extensions.py           # Flask Extension initialization
├── migrations/                 # Database Migration Files (Alembic)
├── docs/                       # Project Documentation
├── run_podlearn.py             # Main entry point (standardized port 5020)
├── requirements.txt            # Python Dependency list
├── app.db                      # Local SQLite Database (Development)
└── .env                        # Environment Secrets (DB URI, API Keys)
```

## Key Components

- **App Factory**: Located in `app/__init__.py`, creates the Flask instance and registers blueprints.
- **Database**: Handled by SQLAlchemy. Migrations are managed via Flask-Migrate.
- **Routing**: Split into modular blueprints for better maintainability.
- **Frontend**: Primarily Server-Side Rendering (SSR) with Jinja2, with dynamic interaction handled by Vanilla JavaScript components.
