from sqlmodel import SQLModel, create_engine, Session
from contextlib import contextmanager
from typing import Generator
import os

# Database URL configuration (read from environment, or from local)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./library.db")

# Ensure database file path exists for SQLite
if DATABASE_URL.startswith("sqlite"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
    os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)

# Create SQLite engine
engine = create_engine(
    DATABASE_URL, 
    echo=False
)

# Create database and tables
def create_db_and_tables():
    """Create database tables."""
    SQLModel.metadata.create_all(engine)

# Session context manager
@contextmanager
def get_session_context():
    """Database session context manager."""
    session = Session(engine)
    
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

# FastAPI dependency for database session
def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency for database session."""
    with get_session_context() as session:
        yield session