from sqlmodel import SQLModel, create_engine, Session
from contextlib import contextmanager
from typing import Generator
import os
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Database URL configuration (read from environment)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./library.db")

# Create SQLite engine
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    echo=False
)

SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()

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