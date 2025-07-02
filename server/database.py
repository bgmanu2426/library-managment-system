from sqlmodel import SQLModel, create_engine, Session
from contextlib import contextmanager
from fastapi import Depends
from typing import Generator
import os

# Database URL configuration
DATABASE_URL = "sqlite:///./library.db"

# Create SQLite engine
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    echo=True
)

# Create database and tables
def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

# Session context manager
@contextmanager
def get_session_context():
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
    with get_session_context() as session:
        yield session
