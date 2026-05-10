import os
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

# Resolve relative sqlite paths if needed (similar logic to old config.py but here)
db_url = settings.SQLALCHEMY_DATABASE_URI
if db_url.startswith("sqlite:///"):
    path = db_url.replace("sqlite:///", "")
    if not os.path.isabs(path):
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        abs_path = os.path.abspath(os.path.join(project_root, path))
        db_url = f"sqlite:///{abs_path}"

engine = create_engine(db_url, connect_args={"check_same_thread": False} if "sqlite" in db_url else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

naming_convention = {
    "ix": 'ix_%(column_0_label)s',
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

Base = declarative_base(metadata=MetaData(naming_convention=naming_convention))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
