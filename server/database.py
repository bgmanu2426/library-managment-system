from sqlmodel import SQLModel, create_engine, Session
from contextlib import contextmanager
from typing import Generator, Optional
import os
import time
import logging_config

# Get database logger
database_logger = logging_config.get_logger('database')

# Database URL configuration (read from environment, fallback to local sqlite)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./library.db")

# Log database configuration
database_logger.info(f"Database configuration - URL: {DATABASE_URL}")
database_logger.info("Database engine type: SQLite")

# Create SQLite engine
correlation_id = logging_config.get_correlation_id()
database_logger.info(f"[{correlation_id}] Creating database engine with SQLite configuration")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    echo=False  # Disable SQLAlchemy echo to use our custom SQL logging
)

database_logger.info(f"[{correlation_id}] Database engine created successfully")
database_logger.debug(f"[{correlation_id}] Engine configuration - check_same_thread: False, echo: False")

# Create database and tables
def create_db_and_tables():
    """Create database tables with comprehensive logging."""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    database_logger.info(f"[{correlation_id}] Starting database table creation")
    
    try:
        # Log table creation operation
        database_logger.debug(f"[{correlation_id}] Executing SQLModel.metadata.create_all()")
        
        SQLModel.metadata.create_all(engine)
        
        duration = time.time() - start_time
        database_logger.info(f"[{correlation_id}] Database tables created successfully")
        logging_config.log_performance(database_logger, "Database table creation", duration, correlation_id)
        
        # Log table information if available
        try:
            from sqlalchemy import inspect
            inspector = inspect(engine)
            table_names = inspector.get_table_names()
            database_logger.info(f"[{correlation_id}] Created tables: {table_names}")
        except Exception as e:
            database_logger.warning(f"[{correlation_id}] Could not retrieve table information: {str(e)}")
            
    except Exception as e:
        duration = time.time() - start_time
        logging_config.log_error(database_logger, f"Failed to create database tables: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(database_logger, "Database table creation (failed)", duration, correlation_id)
        raise

# Session context manager
@contextmanager
def get_session_context():
    """Database session context manager with comprehensive logging."""
    correlation_id = logging_config.get_correlation_id()
    session_start_time = time.time()
    
    database_logger.debug(f"[{correlation_id}] Creating new database session")
    
    session = Session(engine)
    session_created = True
    
    try:
        database_logger.debug(f"[{correlation_id}] Database session created successfully")
        
        # Log transaction begin
        database_logger.debug(f"[{correlation_id}] Transaction lifecycle: BEGIN")
        
        yield session
        
        # Log transaction commit
        commit_start_time = time.time()
        database_logger.debug(f"[{correlation_id}] Transaction lifecycle: COMMIT")
        
        session.commit()
        
        commit_duration = time.time() - commit_start_time
        database_logger.debug(f"[{correlation_id}] Transaction committed successfully")
        logging_config.log_performance(database_logger, "Database commit", commit_duration, correlation_id)
        
    except Exception as e:
        # Log transaction rollback
        rollback_start_time = time.time()
        database_logger.warning(f"[{correlation_id}] Transaction lifecycle: ROLLBACK due to error: {str(e)}")
        
        try:
            session.rollback()
            rollback_duration = time.time() - rollback_start_time
            database_logger.warning(f"[{correlation_id}] Transaction rolled back successfully")
            logging_config.log_performance(database_logger, "Database rollback", rollback_duration, correlation_id)
        except Exception as rollback_error:
            database_logger.error(f"[{correlation_id}] Failed to rollback transaction: {str(rollback_error)}")
        
        # Log the original error with full stack trace
        logging_config.log_error(database_logger, f"Database operation failed: {str(e)}", correlation_id=correlation_id)
        raise
        
    finally:
        if session_created:
            close_start_time = time.time()
            database_logger.debug(f"[{correlation_id}] Closing database session")
            
            try:
                session.close()
                close_duration = time.time() - close_start_time
                database_logger.debug(f"[{correlation_id}] Database session closed successfully")
                logging_config.log_performance(database_logger, "Database session close", close_duration, correlation_id)
            except Exception as close_error:
                database_logger.error(f"[{correlation_id}] Failed to close database session: {str(close_error)}")
        
        # Log total session duration
        total_duration = time.time() - session_start_time
        logging_config.log_performance(database_logger, "Database session total", total_duration, correlation_id)

# FastAPI dependency for database session
def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency for database session with logging."""
    correlation_id = logging_config.get_correlation_id()
    
    database_logger.debug(f"[{correlation_id}] FastAPI database session dependency called")
    
    with get_session_context() as session:
        database_logger.debug(f"[{correlation_id}] FastAPI database session yielded")
        yield session
        database_logger.debug(f"[{correlation_id}] FastAPI database session dependency completed")

# SQL Query logging function (for use with manual queries)
def log_sql_query(query: str, params: Optional[dict] = None, correlation_id: Optional[str] = None):
    """Log SQL queries for debugging (configurable via log level)."""
    if correlation_id is None:
        correlation_id = logging_config.get_correlation_id()
    
    if database_logger.isEnabledFor(logging_config.logging.DEBUG):
        database_logger.debug(f"[{correlation_id}] SQL Query: {query}")
        if params:
            database_logger.debug(f"[{correlation_id}] SQL Params: {params}")

# Connection pool status logging (for future enhancement with connection pooling)
def log_connection_pool_status(correlation_id: Optional[str] = None):
    """Log connection pool status if applicable."""
    if correlation_id is None:
        correlation_id = logging_config.get_correlation_id()
    
    try:
        # SQLite doesn't use connection pooling, but we can log engine status
        database_logger.debug(f"[{correlation_id}] Database engine status: Active")
        database_logger.debug(f"[{correlation_id}] Connection pool: Not applicable (SQLite)")
    except Exception as e:
        database_logger.warning(f"[{correlation_id}] Could not retrieve connection pool status: {str(e)}")

# Performance monitoring for database operations
def monitor_db_operation(operation_name: str):
    """Decorator for monitoring database operation performance."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            correlation_id = logging_config.get_correlation_id()
            start_time = time.time()
            
            database_logger.debug(f"[{correlation_id}] Starting database operation: {operation_name}")
            
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                logging_config.log_performance(database_logger, f"Database operation: {operation_name}", duration, correlation_id)
                return result
            except Exception as e:
                duration = time.time() - start_time
                logging_config.log_error(database_logger, f"Database operation {operation_name} failed: {str(e)}", correlation_id=correlation_id)
                logging_config.log_performance(database_logger, f"Database operation: {operation_name} (failed)", duration, correlation_id)
                raise
        return wrapper
    return decorator

# Log database initialization completion
database_logger.info("Database module initialized successfully")