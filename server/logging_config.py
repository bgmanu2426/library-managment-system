import logging
import logging.handlers
import os
import sys
from typing import Optional
import uuid


# Create logs directory if it doesn't exist
LOGS_DIR = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOGS_DIR, exist_ok=True)

# Log file paths
DATABASE_LOG_FILE = os.path.join(LOGS_DIR, 'database.log')
BACKEND_LOG_FILE = os.path.join(LOGS_DIR, 'backend.log')

# Log format with timestamps, levels, module names, and detailed messages
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(module)s:%(funcName)s:%(lineno)d - %(message)s'
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# Console format for critical errors only
CONSOLE_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'

# Global loggers
database_logger = None
api_logger = None


def setup_logging():
    """Initialize the logging configuration with file handlers and console output."""
    global database_logger, api_logger
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    
    # Clear any existing handlers
    root_logger.handlers.clear()
    
    # Create formatters
    detailed_formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)
    console_formatter = logging.Formatter(CONSOLE_FORMAT, DATE_FORMAT)
    
    # Database logger setup
    database_logger = logging.getLogger('database')
    database_logger.setLevel(logging.DEBUG)
    database_logger.propagate = False
    
    # Database file handler with rotation
    db_file_handler = logging.handlers.RotatingFileHandler(
        DATABASE_LOG_FILE,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    db_file_handler.setLevel(logging.DEBUG)
    db_file_handler.setFormatter(detailed_formatter)
    database_logger.addHandler(db_file_handler)
    
    # API logger setup
    api_logger = logging.getLogger('api')
    api_logger.setLevel(logging.DEBUG)
    api_logger.propagate = False
    
    # API file handler with rotation
    api_file_handler = logging.handlers.RotatingFileHandler(
        BACKEND_LOG_FILE,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    api_file_handler.setLevel(logging.DEBUG)
    api_file_handler.setFormatter(detailed_formatter)
    api_logger.addHandler(api_file_handler)
    
    # Console handler for critical errors only
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.ERROR)
    console_handler.setFormatter(console_formatter)
    
    # Add console handler to both loggers
    database_logger.addHandler(console_handler)
    api_logger.addHandler(console_handler)
    
    # Set up request correlation ID context
    setup_correlation_context()


def setup_correlation_context():
    """Set up request correlation ID context for better traceability."""
    # This will be enhanced when request middleware is implemented
    pass


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger by name for easy access throughout the application.
    
    Args:
        name (str): Logger name ('database' or 'api' for main loggers, or custom name)
        
    Returns:
        logging.Logger: Configured logger instance
    """
    if name == 'database':
        return database_logger or logging.getLogger('database')
    elif name == 'api':
        return api_logger or logging.getLogger('api')
    else:
        # Create custom logger with default configuration
        logger = logging.getLogger(name)
        if not logger.handlers:
            # Use API logger configuration as default
            formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)
            file_handler = logging.handlers.RotatingFileHandler(
                os.path.join(LOGS_DIR, f'{name}.log'),
                maxBytes=10*1024*1024,
                backupCount=5,
                encoding='utf-8'
            )
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
            logger.setLevel(logging.DEBUG)
        return logger


def get_correlation_id() -> str:
    """
    Generate or retrieve correlation ID for request tracing.
    
    Returns:
        str: Unique correlation ID for the current context
    """
    # Generate a new correlation ID (will be enhanced with request context)
    return str(uuid.uuid4())[:8]


def log_with_correlation(logger: logging.Logger, level: int, message: str, correlation_id: Optional[str] = None):
    """
    Log message with correlation ID for better traceability.
    
    Args:
        logger: Logger instance to use
        level: Logging level (logging.INFO, logging.ERROR, etc.)
        message: Log message
        correlation_id: Optional correlation ID, generates one if not provided
    """
    if correlation_id is None:
        correlation_id = get_correlation_id()
    
    enhanced_message = f"[{correlation_id}] {message}"
    logger.log(level, enhanced_message)


# Convenience functions for structured logging
def log_database_operation(message: str, level: int = logging.INFO, correlation_id: Optional[str] = None):
    """Log database operation with correlation ID."""
    if database_logger:
        log_with_correlation(database_logger, level, message, correlation_id)


def log_api_operation(message: str, level: int = logging.INFO, correlation_id: Optional[str] = None):
    """Log API operation with correlation ID."""
    if api_logger:
        log_with_correlation(api_logger, level, message, correlation_id)


def log_error(logger: logging.Logger, message: str, exc_info: bool = True, correlation_id: Optional[str] = None):
    """Log error with exception information and correlation ID."""
    log_with_correlation(logger, logging.ERROR, message, correlation_id)
    if exc_info:
        logger.error("Exception details:", exc_info=True)


def log_performance(logger: logging.Logger, operation: str, duration: float, correlation_id: Optional[str] = None):
    """Log performance metrics with correlation ID."""
    message = f"Performance: {operation} completed in {duration:.3f}s"
    log_with_correlation(logger, logging.INFO, message, correlation_id)


# Initialize logging when module is imported
if database_logger is None or api_logger is None:
    setup_logging()
