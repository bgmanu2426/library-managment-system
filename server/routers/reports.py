from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import io
import os
import tempfile
import time
import logging
import asyncio

import logging_config

# Pydantic imports for model validation
from pydantic import BaseModel, Field, validator

# Excel and PDF imports
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch

from database import get_session
from models import User, Book, Transaction, Fine, Rack, Shelf
from auth import get_current_admin

# Get API logger from logging configuration
api_logger = logging_config.get_logger('api')

# Request size and complexity validation
MAX_DATE_RANGE_DAYS = 365  # Maximum 1 year date range
MAX_QUERY_COMPLEXITY = 1000  # Maximum records to process

def validate_request_complexity(start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, correlation_id: str = "") -> None:
    """Validate request complexity to prevent resource exhaustion"""
    try:
        if start_date and end_date:
            # Ensure dates are timezone-naive for direct comparison if needed or adjust for UTC
            _start_date = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
            _end_date = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date

            date_range = (_end_date - _start_date).days
            if date_range > MAX_DATE_RANGE_DAYS:
                api_logger.warning(f"[{correlation_id}] Date range too large: {date_range} days")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Date range too large. Maximum allowed: {MAX_DATE_RANGE_DAYS} days"
                )
        logging_config.log_api_operation(f"Request complexity validation passed", correlation_id=correlation_id)
    except HTTPException:
        raise
    except Exception as e:
        logging_config.log_error(api_logger, f"Request complexity validation error: {str(e)}", correlation_id=correlation_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request parameters"
        )

# Create router
router = APIRouter()

# Add CORS middleware for report endpoints
from fastapi.middleware.cors import CORSMiddleware

# CORS configuration for reports (if needed)
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost:3000"
]

# Enhanced Pydantic models with validation
class UserActivityReport(BaseModel):
    user_id: int
    user_name: str
    user_usn: str
    total_books_borrowed: int
    current_books: int
    overdue_books: int
    total_fines: float
    last_activity: Optional[datetime] = None

class BookCirculationReport(BaseModel):
    book_id: int
    book_title: str
    book_author: str
    book_isbn: str
    total_issues: int
    current_status: str
    last_issued: Optional[datetime] = None
    total_days_borrowed: int

class OverdueSummaryReport(BaseModel):
    total_overdue_books: int = Field(ge=0, description="Total number of overdue books")
    total_pending_fines: float = Field(ge=0, description="Total amount of pending fines")
    total_paid_fines: float = Field(ge=0, description="Total amount of paid fines")
    total_waived_fines: float = Field(ge=0, description="Total amount of waived fines")
    average_overdue_days: float = Field(ge=0, description="Average days overdue")

    @validator('*')
    def validate_non_negative(cls, v):
        if isinstance(v, (int, float)) and v < 0:
            return 0
        return v

class InventoryStatusReport(BaseModel):
    total_books: int
    available_books: int
    issued_books: int
    total_racks: int
    total_shelves: int
    shelf_utilization: Dict[str, Any]

class DateRangeValidator(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    @validator('end_date')
    def validate_date_range(cls, v, values):
        if v and values.get('start_date') and v < values['start_date']:
            raise ValueError('End date must be after start date')
        return v

    @validator('start_date', 'end_date')
    def validate_not_future(cls, v):
        if v and v.replace(tzinfo=None) > datetime.utcnow():
            raise ValueError('Date cannot be in the future')
        return v

# Cache key generator for reports
def generate_cache_key(report_type: str, **kwargs) -> str:
    """Generate cache key for reports with logging"""
    correlation_id = logging_config.get_correlation_id()
    cache_parts = [report_type]
    for key, value in sorted(kwargs.items()):
        if value is not None:
            if isinstance(value, datetime):
                cache_parts.append(f"{key}_{value.isoformat()}")
            else:
                cache_parts.append(f"{key}_{value}")

    cache_key = "_".join(cache_parts)
    logging_config.log_api_operation(f"Generated cache key: {cache_key}", correlation_id=correlation_id)
    return cache_key

def validate_admin_authentication(current_admin: User, correlation_id: str) -> None:
    """Enhanced authentication validation for report endpoints"""
    try:
        if not current_admin:
            api_logger.error(f"[{correlation_id}] Authentication failed - No admin user provided")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required. Please log in as an administrator."
            )

        if not current_admin.id or current_admin.id <= 0:
            api_logger.error(f"[{correlation_id}] Authentication failed - Invalid admin user ID")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials. Please log in again."
            )

        if not hasattr(current_admin, 'role') or current_admin.role != 'admin':
            api_logger.error(f"[{correlation_id}] Authorization failed - User {current_admin.id} is not an admin")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator privileges required to access reports."
            )

        logging_config.log_api_operation(f"Authentication validated for admin {current_admin.name} (ID: {current_admin.id})", correlation_id=correlation_id)

    except HTTPException:
        raise
    except Exception as auth_error:
        logging_config.log_error(api_logger, f"Unexpected authentication error: {str(auth_error)}", correlation_id=correlation_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication validation failed. Please log in again."
        )

def validate_database_session(session: Session, correlation_id: str) -> None:
    """Validate database session to prevent connection errors"""
    try:
        if not session:
            api_logger.error(f"[{correlation_id}] Database session is None")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database connection unavailable. Please try again later."
            )

        # Test database connectivity with a simple query
        session.exec(select(1)).first()
        logging_config.log_api_operation("Database session validated successfully", correlation_id=correlation_id)

    except HTTPException:
        raise
    except Exception as db_error:
        logging_config.log_error(api_logger, f"Database session validation failed: {str(db_error)}", correlation_id=correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection error. Please try again later."
        )

# Add timeout wrapper for report operations
async def with_timeout(coro, timeout_seconds: int = 60):
    """Wrapper to add timeout to async operations"""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Request timed out. Please try again with a smaller date range."
        )

# Enhanced datetime parsing with comprehensive validation
def parse_and_validate_datetime(date_param: Optional[str], param_name: str) -> Optional[datetime]:
    """Enhanced datetime parsing with comprehensive validation"""
    if date_param is None:
        return None

    try:
        # Handle both string and datetime inputs
        if isinstance(date_param, str):
            try:
                # Attempt to parse ISO 8601 string, including those with 'Z' for UTC
                parsed_date = datetime.fromisoformat(date_param.replace('Z', '+00:00'))
            except ValueError:
                try:
                    # Fallback: try parsing as regular datetime string
                    parsed_date = datetime.strptime(date_param, '%Y-%m-%dT%H:%M:%S.%fZ')
                except ValueError:
                    try:
                        # Another fallback: basic ISO format
                        parsed_date = datetime.strptime(date_param, '%Y-%m-%dT%H:%M:%SZ')
                    except ValueError:
                        raise ValueError(f"Invalid {param_name} format. Expected ISO 8601 format (e.g., '2024-01-01T00:00:00Z').")
        elif isinstance(date_param, datetime):
            parsed_date = date_param
        else:
            raise ValueError(f"Invalid {param_name} type. Must be datetime or string.")

        # Convert timezone-aware dates to UTC, then make them naive for consistent handling
        if parsed_date.tzinfo:
            # Convert to UTC using built-in timezone handling
            utc_date = parsed_date.astimezone(timezone.utc)
            parsed_date = utc_date.replace(tzinfo=None)
        
        # Validate date is not too far in the future (allow small buffer for timezone differences)
        now_utc = datetime.utcnow()
        # Allow up to 24 hours in the future to account for timezone differences
        max_future_date = now_utc + timedelta(hours=24)
        
        if parsed_date > max_future_date:
            raise ValueError(f"{param_name} cannot be more than 24 hours in the future")

        return parsed_date

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {param_name}: {str(e)}"
        )

# Centralized error handling for report endpoints
def handle_report_error(error: Exception, operation: str, correlation_id: str) -> HTTPException:
    """Centralized error handling for report endpoints"""
    if isinstance(error, HTTPException):
        return error

    error_message = str(error)
    logging_config.log_error(api_logger, f"Error in {operation}: {error_message}", correlation_id=correlation_id)

    # Map specific errors to appropriate HTTP status codes
    if "timed out" in error_message.lower() or isinstance(error, asyncio.TimeoutError):
        return HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Request timed out. Please try again with a smaller date range."
        )
    elif "connection" in error_message.lower() or "database" in error_message.lower() or "session" in error_message.lower():
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service temporarily unavailable. Please try again later."
        )
    elif "memory" in error_message.lower() or "resource" in error_message.lower() or "exhausted" in error_message.lower():
        return HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="Insufficient resources to process request. Please try with a smaller date range."
        )
    else:
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred in {operation}. Please try again later."
        )

@router.get("/user-activity")
async def get_user_activity_report(
    start_date: Optional[str] = Query(None, description="Start date for filtering (ISO 8601 format)"),
    end_date: Optional[str] = Query(None, description="End date for filtering (ISO 8601 format)"),
    user_id: Optional[int] = Query(None, description="Specific user ID"),
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Generate user activity report with enhanced error handling"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log report generation request with parameters and user context
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) requesting user activity report")
    logging_config.log_api_operation(f"User activity report request - start_date: {start_date}, end_date: {end_date}, user_id: {user_id}", correlation_id=correlation_id)

    # Enhanced authentication validation
    validate_admin_authentication(current_admin, correlation_id)
    # Enhanced database session validation
    validate_database_session(session, correlation_id)

    try:
        # Enhanced parameter validation
        _start_date = parse_and_validate_datetime(start_date, "start_date")
        _end_date = parse_and_validate_datetime(end_date, "end_date")

        # Validate date range
        if _start_date and _end_date and _start_date > _end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date must be before or equal to end date"
            )

        # Validate request complexity
        validate_request_complexity(_start_date, _end_date, correlation_id)

        # Validate user_id parameter
        if user_id is not None:
            if not isinstance(user_id, int) or user_id <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User ID must be a positive integer"
                )
            # Verify user exists
            user_exists = session.exec(select(User).where(User.id == user_id)).first()
            if not user_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User with ID {user_id} not found"
                )

        logging_config.log_api_operation("Parameter validation completed successfully", correlation_id=correlation_id)

        # Wrap the main logic in an async function for timeout
        async def generate_report_data():
            # Build query with comprehensive error handling
            query_start = time.time()
            logging_config.log_api_operation("Building user query for activity report", correlation_id=correlation_id)

            query = select(User)

            if user_id:
                query = query.where(User.id == user_id)
                logging_config.log_api_operation(f"Applied user ID filter: {user_id}", correlation_id=correlation_id)

            users = session.exec(query).all()

            # Validate query results
            if users is None:
                api_logger.warning(f"[{correlation_id}] User query returned None result")
                users = []

            query_duration = time.time() - query_start
            logging_config.log_performance(api_logger, "User activity report query", query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Found {len(users)} users for activity report")

            report_data = []
            processing_start = time.time()

            for user in users:
                try:
                    # Get user transactions with safe handling
                    logging_config.log_api_operation(f"Processing user {user.id} ({user.name}) for activity report", correlation_id=correlation_id)
                    transaction_query = select(Transaction).where(Transaction.user_id == user.id)

                    if _start_date:
                        transaction_query = transaction_query.where(Transaction.issued_date >= _start_date)
                    if _end_date:
                        transaction_query = transaction_query.where(Transaction.issued_date <= _end_date)

                    transactions = session.exec(transaction_query).all()

                    # Calculate statistics with null checks
                    total_books_borrowed = len(transactions) if transactions else 0
                    current_books = len([t for t in transactions if t and t.status == "current"]) if transactions else 0
                    overdue_books = len([t for t in transactions if t and t.status == "overdue"]) if transactions else 0

                    logging_config.log_api_operation(f"User {user.id} statistics - Total: {total_books_borrowed}, Current: {current_books}, Overdue: {overdue_books}", correlation_id=correlation_id)

                    # Get fines with error handling
                    try:
                        fines = session.exec(select(Fine).where(Fine.user_id == user.id)).all()
                        total_fines = sum(fine.fine_amount or 0 for fine in fines if fine and fine.status == "pending")
                        logging_config.log_api_operation(f"User {user.id} total pending fines: ₹{total_fines}", correlation_id=correlation_id)
                    except Exception as fine_error:
                        logging_config.log_error(api_logger, f"Error fetching fines for user {user.id}: {str(fine_error)}", correlation_id=correlation_id)
                        total_fines = 0.0

                    # Calculate last activity safely
                    last_activity = None
                    if transactions:
                        try:
                            valid_dates = [t.issued_date for t in transactions if t and t.issued_date]
                            last_activity = max(valid_dates) if valid_dates else None
                            if last_activity:
                                logging_config.log_api_operation(f"User {user.id} last activity: {last_activity}", correlation_id=correlation_id)
                        except Exception as date_error:
                            logging_config.log_error(api_logger, f"Error calculating last activity for user {user.id}: {str(date_error)}", correlation_id=correlation_id)

                    report_data.append({
                        "user_id": user.id or 0,
                        "user_name": user.name or "Unknown",
                        "user_usn": user.usn or "N/A",
                        "total_books_borrowed": total_books_borrowed,
                        "current_books": current_books,
                        "overdue_books": overdue_books,
                        "total_fines": round(total_fines, 2),
                        "last_activity": last_activity
                    })
                except Exception as user_error:
                    logging_config.log_error(api_logger, f"Error processing user {user.id}: {str(user_error)}", correlation_id=correlation_id)
                    continue

            processing_duration = time.time() - processing_start
            logging_config.log_performance(api_logger, "User activity report processing", processing_duration, correlation_id)
            return report_data
        
        # Execute the report generation with a timeout
        report_data = await with_timeout(generate_report_data(), timeout_seconds=120) # Increased timeout for data processing

        total_duration = time.time() - start_time

        # Log report generation completion with audit trail
        api_logger.info(f"[{correlation_id}] User activity report generated successfully - {len(report_data)} entries")
        api_logger.info(f"[{correlation_id}] Report access audit - Admin {current_admin.name} generated user activity report with {len(report_data)} users")
        logging_config.log_performance(api_logger, "User activity report endpoint", total_duration, correlation_id)

        return {"user_activity_report": report_data}

    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        # Use centralized error handler
        raise handle_report_error(e, "user activity report generation", correlation_id)

@router.get("/book-circulation")
async def get_book_circulation_report(
    start_date: Optional[str] = Query(None, description="Start date for filtering (ISO 8601 format)"),
    end_date: Optional[str] = Query(None, description="End date for filtering (ISO 8601 format)"),
    genre: Optional[str] = Query(None, description="Book genre filter"),
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Generate book circulation report with enhanced error handling"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log report generation request with parameters and user context
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) requesting book circulation report")
    logging_config.log_api_operation(f"Book circulation report request - start_date: {start_date}, end_date: {end_date}, genre: {genre}", correlation_id=correlation_id)

    # Enhanced authentication validation
    validate_admin_authentication(current_admin, correlation_id)
    # Enhanced database session validation
    validate_database_session(session, correlation_id)

    try:
        # Enhanced parameter validation
        _start_date = parse_and_validate_datetime(start_date, "start_date")
        _end_date = parse_and_validate_datetime(end_date, "end_date")

        # Validate date range
        if _start_date and _end_date and _start_date > _end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date must be before or equal to end date"
            )

        # Validate request complexity
        validate_request_complexity(_start_date, _end_date, correlation_id)

        # Validate genre parameter
        if genre is not None:
            if not isinstance(genre, str) or len(genre.strip()) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Genre filter cannot be empty"
                )
            # Sanitize genre input
            genre = genre.strip()
            if len(genre) > 100:  # Reasonable limit
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Genre name too long (maximum 100 characters)"
                )

        logging_config.log_api_operation("Parameter validation completed successfully", correlation_id=correlation_id)

        # Wrap the main logic in an async function for timeout
        async def generate_report_data():
            # Build query with comprehensive error handling
            query_start = time.time()
            logging_config.log_api_operation("Building book query for circulation report", correlation_id=correlation_id)

            query = select(Book)

            if genre:
                query = query.where(Book.genre == genre) # Use the validated/sanitized genre
                logging_config.log_api_operation(f"Applied genre filter: {genre}", correlation_id=correlation_id)

            books = session.exec(query).all()

            if books is None:
                api_logger.warning(f"[{correlation_id}] Book query returned None result")
                books = []

            query_duration = time.time() - query_start
            logging_config.log_performance(api_logger, "Book circulation report query", query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Found {len(books)} books for circulation report")

            report_data = []
            processing_start = time.time()

            for book in books:
                try:
                    # Get book transactions with safe handling
                    logging_config.log_api_operation(f"Processing book {book.id} ('{book.title}') for circulation report", correlation_id=correlation_id)
                    transaction_query = select(Transaction).where(Transaction.book_id == book.id)

                    if _start_date:
                        transaction_query = transaction_query.where(Transaction.issued_date >= _start_date)
                    if _end_date:
                        transaction_query = transaction_query.where(Transaction.issued_date <= _end_date)

                    transactions = session.exec(transaction_query).all()

                    # Calculate statistics with null checks
                    total_issues = len(transactions) if transactions else 0
                    current_status = "Available" # Default to available
                    # Check if there's any active transaction for this book
                    if transactions:
                        active_transaction = next((t for t in transactions if t and t.status == "current"), None)
                        if active_transaction:
                            current_status = "Issued"
                        else:
                            # If no current transactions, check if the book has ever been issued
                            if total_issues > 0:
                                # This means it has been issued and returned, or not issued at all.
                                # Assuming if there are transactions but none are 'current', it's available.
                                current_status = "Available"
                    # If no transactions at all, it's definitely available
                    elif not transactions:
                        current_status = "Available"


                    logging_config.log_api_operation(f"Book {book.id} statistics - Total issues: {total_issues}, Status: {current_status}", correlation_id=correlation_id)

                    # Calculate last issued date safely
                    last_issued = None
                    if transactions:
                        try:
                            valid_dates = [t.issued_date for t in transactions if t and t.issued_date]
                            last_issued = max(valid_dates) if valid_dates else None
                            if last_issued:
                                logging_config.log_api_operation(f"Book {book.id} last issued: {last_issued}", correlation_id=correlation_id)
                        except Exception as date_error:
                            logging_config.log_error(api_logger, f"Error calculating last issued for book {book.id}: {str(date_error)}", correlation_id=correlation_id)

                    # Calculate total days borrowed with error handling
                    total_days_borrowed = 0
                    for transaction in transactions:
                        try:
                            if not transaction:
                                continue

                            if transaction.return_date and transaction.issued_date:
                                days = (transaction.return_date.replace(tzinfo=None) - transaction.issued_date.replace(tzinfo=None)).days
                                total_days_borrowed += max(0, days)
                            elif transaction.status == "current" and transaction.issued_date:
                                days = (datetime.utcnow().replace(tzinfo=None) - transaction.issued_date.replace(tzinfo=None)).days
                                total_days_borrowed += max(0, days)
                        except Exception as calc_error:
                            logging_config.log_error(api_logger, f"Error calculating days for transaction {transaction.id}: {str(calc_error)}", correlation_id=correlation_id)
                            continue

                    logging_config.log_api_operation(f"Book {book.id} total days borrowed: {total_days_borrowed}", correlation_id=correlation_id)

                    report_data.append({
                        "book_id": book.id or 0,
                        "book_title": book.title or "Unknown Title",
                        "book_author": book.author or "Unknown Author",
                        "book_isbn": book.isbn or "N/A",
                        "total_issues": total_issues,
                        "current_status": current_status,
                        "last_issued": last_issued,
                        "total_days_borrowed": total_days_borrowed
                    })
                except Exception as book_error:
                    logging_config.log_error(api_logger, f"Error processing book {book.id}: {str(book_error)}", correlation_id=correlation_id)
                    continue

            processing_duration = time.time() - processing_start
            logging_config.log_performance(api_logger, "Book circulation report processing", processing_duration, correlation_id)
            return report_data
            
        # Execute the report generation with a timeout
        report_data = await with_timeout(generate_report_data(), timeout_seconds=120) # Increased timeout for data processing

        total_duration = time.time() - start_time

        # Log report generation completion with audit trail
        api_logger.info(f"[{correlation_id}] Book circulation report generated successfully - {len(report_data)} entries")
        api_logger.info(f"[{correlation_id}] Report access audit - Admin {current_admin.name} generated book circulation report with {len(report_data)} books")
        logging_config.log_performance(api_logger, "Book circulation report endpoint", total_duration, correlation_id)

        return {"book_circulation_report": report_data}

    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        # Use centralized error handler
        raise handle_report_error(e, "book circulation report generation", correlation_id)

@router.get("/overdue-summary")
async def get_overdue_summary_report(
    start_date: Optional[str] = Query(None, description="Start date for filtering (ISO 8601 format)"),
    end_date: Optional[str] = Query(None, description="End date for filtering (ISO 8601 format)"),
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Generate overdue books and fines summary report with comprehensive error handling"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log report generation request with parameters and user context
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) requesting overdue summary report")
    logging_config.log_api_operation(f"Overdue summary report request - start_date: {start_date}, end_date: {end_date}", correlation_id=correlation_id)

    # Enhanced authentication validation
    validate_admin_authentication(current_admin, correlation_id)
    # Enhanced database session validation
    validate_database_session(session, correlation_id)

    try:
        # Enhanced parameter validation
        _start_date = parse_and_validate_datetime(start_date, "start_date")
        _end_date = parse_and_validate_datetime(end_date, "end_date")

        # Validate date range
        if _start_date and _end_date and _start_date > _end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date must be before or equal to end date"
            )

        # Validate request complexity
        validate_request_complexity(_start_date, _end_date, correlation_id)

        logging_config.log_api_operation("Parameter validation completed successfully", correlation_id=correlation_id)

        # Wrap the main logic in an async function for timeout
        async def calculate_summary_data():
            # Initialize default values to prevent null errors
            total_overdue_books = 0
            total_pending_fines = 0.0
            total_paid_fines = 0.0
            total_waived_fines = 0.0
            average_overdue_days = 0.0

            # Get overdue transactions with comprehensive error handling
            query_start = time.time()
            logging_config.log_api_operation("Fetching overdue transactions for summary report", correlation_id=correlation_id)

            overdue_query = select(Transaction).where(Transaction.status == "overdue")

            if _start_date:
                overdue_query = overdue_query.where(Transaction.issued_date >= _start_date)
                logging_config.log_api_operation(f"Applied start date filter: {_start_date}", correlation_id=correlation_id)
            if _end_date:
                overdue_query = overdue_query.where(Transaction.issued_date <= _end_date)
                logging_config.log_api_operation(f"Applied end date filter: {_end_date}", correlation_id=correlation_id)

            overdue_transactions = session.exec(overdue_query).all()

            if overdue_transactions is None:
                api_logger.warning(f"[{correlation_id}] Overdue transactions query returned None result")
                overdue_transactions = []

            query_duration = time.time() - query_start
            logging_config.log_performance(api_logger, "Overdue transactions query for summary", query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Found {len(overdue_transactions)} overdue transactions for summary")

            # Calculate total overdue books safely
            total_overdue_books = len(overdue_transactions) if overdue_transactions else 0
            logging_config.log_api_operation(f"Total overdue books calculated: {total_overdue_books}", correlation_id=correlation_id)

            # Get fines with error handling
            fine_query_start = time.time()
            logging_config.log_api_operation("Fetching fines for summary report", correlation_id=correlation_id)

            fine_query = select(Fine)

            if _start_date:
                fine_query = fine_query.where(Fine.created_at >= _start_date)
            if _end_date:
                fine_query = fine_query.where(Fine.created_at <= _end_date)

            fines = session.exec(fine_query).all()

            if fines is None:
                api_logger.warning(f"[{correlation_id}] Fines query returned None result")
                fines = []
            
            # If no fines exist but we have overdue transactions, calculate implied fines
            if not fines and overdue_transactions:
                logging_config.log_api_operation("No fines found, calculating implied fines from overdue transactions", correlation_id=correlation_id)
                for transaction in overdue_transactions:
                    if transaction and transaction.due_date:
                        # Calculate implied fine based on days overdue
                        days_overdue = (datetime.utcnow().replace(tzinfo=None) - transaction.due_date.replace(tzinfo=None)).days
                        if days_overdue > 0:
                            implied_fine_amount = days_overdue * 5.0  # ₹5 per day default
                            total_pending_fines += implied_fine_amount
                            logging_config.log_api_operation(f"Implied fine for transaction {transaction.id}: ₹{implied_fine_amount} ({days_overdue} days overdue)", correlation_id=correlation_id)

            fine_query_duration = time.time() - fine_query_start
            logging_config.log_performance(api_logger, "Fines query for summary", fine_query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Found {len(fines)} fines for summary")

            # Calculate fine statistics with null checks and defensive programming
            if fines:
                processing_start = time.time()
                pending_fines = []
                paid_fines = []
                waived_fines = []

                for fine in fines:
                    try:
                        if not fine:
                            continue

                        fine_amount = fine.fine_amount or 0.0
                        fine_status = fine.status or "unknown"

                        if fine_status == "pending":
                            pending_fines.append(fine_amount)
                        elif fine_status == "paid":
                            paid_fines.append(fine_amount)
                        elif fine_status == "waived":
                            waived_fines.append(fine_amount)
                    except Exception as fine_calc_error:
                        logging_config.log_error(api_logger, f"Error processing fine {fine.id}: {str(fine_calc_error)}", correlation_id=correlation_id)
                        continue

                total_pending_fines = sum(pending_fines) if pending_fines else 0.0
                total_paid_fines = sum(paid_fines) if paid_fines else 0.0
                total_waived_fines = sum(waived_fines) if waived_fines else 0.0

                processing_duration = time.time() - processing_start
                logging_config.log_performance(api_logger, "Fine statistics calculation", processing_duration, correlation_id)
                api_logger.info(f"[{correlation_id}] Fine totals - Pending: ₹{total_pending_fines}, Paid: ₹{total_paid_fines}, Waived: ₹{total_waived_fines}")

            # Calculate average overdue days with division by zero protection
            try:
                if overdue_transactions and len(overdue_transactions) > 0:
                    logging_config.log_api_operation("Calculating average overdue days", correlation_id=correlation_id)
                    valid_overdue_days = []

                    for transaction in overdue_transactions:
                        try:
                            # Calculate days overdue if not explicitly available on transaction model
                            if transaction and transaction.issued_date and transaction.due_date:
                                # Compare with current date if not returned, else with return_date
                                compare_date = transaction.return_date.replace(tzinfo=None) if transaction.return_date else datetime.utcnow()
                                expected_return = transaction.due_date.replace(tzinfo=None)

                                days = (compare_date - expected_return).days
                                if days > 0: # Only count if actually overdue
                                    valid_overdue_days.append(days)
                        except Exception as days_error:
                            logging_config.log_error(api_logger, f"Error processing overdue days for transaction {transaction.id}: {str(days_error)}", correlation_id=correlation_id)
                            continue

                    if valid_overdue_days:
                        total_overdue_days = sum(valid_overdue_days)
                        average_overdue_days = total_overdue_days / len(valid_overdue_days)
                        logging_config.log_api_operation(f"Average overdue days calculated: {average_overdue_days} from {len(valid_overdue_days)} valid transactions", correlation_id=correlation_id)
                    else:
                        api_logger.warning(f"[{correlation_id}] No valid overdue days found in transactions")
                        average_overdue_days = 0.0
                else:
                    average_overdue_days = 0.0

            except Exception as avg_error:
                logging_config.log_error(api_logger, f"Error calculating average overdue days: {str(avg_error)}", correlation_id=correlation_id)
                average_overdue_days = 0.0

            # Ensure all values are non-negative and properly formatted
            result_data = {
                "total_overdue_books": max(0, total_overdue_books),
                "total_pending_fines": max(0.0, round(total_pending_fines, 2)),
                "total_paid_fines": max(0.0, round(total_paid_fines, 2)),
                "total_waived_fines": max(0.0, round(total_waived_fines, 2)),
                "average_overdue_days": max(0.0, round(average_overdue_days, 2))
            }
            return result_data
        
        # Execute the report generation with a timeout
        result_data = await with_timeout(calculate_summary_data(), timeout_seconds=90) # Moderate timeout

        total_duration = time.time() - start_time

        # Log report generation completion with audit trail
        api_logger.info(f"[{correlation_id}] Overdue summary report generated successfully: {result_data}")
        api_logger.info(f"[{correlation_id}] Report access audit - Admin {current_admin.name} generated overdue summary report")
        logging_config.log_performance(api_logger, "Overdue summary report endpoint", total_duration, correlation_id)

        return {"overdue_summary": result_data}

    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        # Use centralized error handler
        raise handle_report_error(e, "overdue summary report generation", correlation_id)

@router.get("/inventory-status")
async def get_inventory_status_report(
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Generate current inventory status report with enhanced error handling"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log report generation request with user context
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) requesting inventory status report")
    logging_config.log_api_operation("Inventory status report request", correlation_id=correlation_id)

    # Enhanced authentication validation
    validate_admin_authentication(current_admin, correlation_id)
    # Enhanced database session validation
    validate_database_session(session, correlation_id)

    try:
        # Wrap the main logic in an async function for timeout
        async def calculate_inventory_data():
            # Initialize default values
            total_books = 0
            available_books = 0
            issued_books = 0
            total_racks = 0
            total_shelves = 0
            shelf_utilization = []

            # Get book statistics with error handling
            book_query_start = time.time()
            logging_config.log_api_operation("Fetching book statistics for inventory report", correlation_id=correlation_id)

            all_books = session.exec(select(Book)).all()

            if all_books is None:
                api_logger.warning(f"[{correlation_id}] All books query returned None result")
                all_books = []

            total_books = len(all_books) if all_books else 0

            # Calculate available and issued based on transactions
            issued_book_ids = set()
            try:
                current_transactions = session.exec(select(Transaction.book_id).where(Transaction.status == "current")).all()
                issued_book_ids = set(current_transactions)
                api_logger.info(f"[{correlation_id}] Found {len(issued_book_ids)} currently issued books.")
                logging_config.log_api_operation(f"Current transactions book IDs: {list(issued_book_ids)}", correlation_id=correlation_id)
            except Exception as e:
                logging_config.log_error(api_logger, f"Error fetching current transactions for inventory: {str(e)}", correlation_id=correlation_id)
                # Continue with issued_book_ids as empty set

            # Also check overdue transactions
            try:
                overdue_transactions = session.exec(select(Transaction.book_id).where(Transaction.status == "overdue")).all()
                overdue_book_ids = set(overdue_transactions)
                issued_book_ids.update(overdue_book_ids)  # Add overdue books to issued count
                api_logger.info(f"[{correlation_id}] Found {len(overdue_book_ids)} overdue books.")
                logging_config.log_api_operation(f"Total issued (current + overdue) book IDs: {list(issued_book_ids)}", correlation_id=correlation_id)
            except Exception as e:
                logging_config.log_error(api_logger, f"Error fetching overdue transactions for inventory: {str(e)}", correlation_id=correlation_id)

            available_books = 0
            if all_books:
                # Count books that are not in the issued_book_ids set
                available_books = len([book for book in all_books if book and book.id not in issued_book_ids])
                issued_books = total_books - available_books # This is safer than counting from transaction status directly
            else:
                available_books = 0
                issued_books = 0

            book_query_duration = time.time() - book_query_start
            logging_config.log_performance(api_logger, "Book statistics query", book_query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Book statistics - total={total_books}, available={available_books}, issued={issued_books}")

            # Get rack and shelf statistics with error handling
            storage_query_start = time.time()
            logging_config.log_api_operation("Fetching storage statistics for inventory report", correlation_id=correlation_id)

            racks = session.exec(select(Rack)).all()
            shelves = session.exec(select(Shelf)).all()

            if racks is None:
                api_logger.warning(f"[{correlation_id}] Racks query returned None result")
                racks = []
            if shelves is None:
                api_logger.warning(f"[{correlation_id}] Shelves query returned None result")
                shelves = []

            total_racks = len(racks) if racks else 0
            total_shelves = len(shelves) if shelves else 0

            storage_query_duration = time.time() - storage_query_start
            logging_config.log_performance(api_logger, "Storage statistics query", storage_query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Storage statistics - racks={total_racks}, shelves={total_shelves}")

            # Calculate shelf utilization with comprehensive error handling
            if shelves:
                utilization_start = time.time()
                logging_config.log_api_operation("Calculating shelf utilization for inventory report", correlation_id=correlation_id)

                for shelf in shelves:
                    try:
                        if not shelf:
                            continue

                        shelf_id = shelf.id or 0
                        shelf_name = shelf.name or f"Shelf {shelf_id}"
                        capacity = shelf.capacity or 0
                        
                        # Use the current_books field from the shelf table
                        current_books = shelf.current_books or 0

                        # Prevent division by zero
                        if capacity > 0:
                            utilization_percentage = (current_books / capacity) * 100
                        else:
                            utilization_percentage = 0.0

                        shelf_utilization.append({
                            "shelf_id": shelf_id,
                            "shelf_name": shelf_name,
                            "capacity": max(0, capacity),
                            "current_books": max(0, current_books),
                            "utilization_percentage": max(0.0, round(utilization_percentage, 2))
                        })

                        logging_config.log_api_operation(f"Shelf {shelf_id} utilization: {current_books}/{capacity} ({utilization_percentage:.1f}%)", correlation_id=correlation_id)

                    except Exception as shelf_calc_error:
                        logging_config.log_error(api_logger, f"Error calculating utilization for shelf {shelf.id}: {str(shelf_calc_error)}", correlation_id=correlation_id)
                        continue

                utilization_duration = time.time() - utilization_start
                logging_config.log_performance(api_logger, "Shelf utilization calculation", utilization_duration, correlation_id)

            result_data = {
                "total_books": max(0, total_books),
                "available_books": max(0, available_books),
                "issued_books": max(0, issued_books),
                "total_racks": max(0, total_racks),
                "total_shelves": max(0, total_shelves),
                "shelf_utilization": shelf_utilization
            }
            return result_data
        
        # Execute the report generation with a timeout
        result_data = await with_timeout(calculate_inventory_data(), timeout_seconds=90) # Moderate timeout

        total_duration = time.time() - start_time

        # Log report generation completion with audit trail
        api_logger.info(f"[{correlation_id}] Inventory status report generated successfully")
        api_logger.info(f"[{correlation_id}] Report access audit - Admin {current_admin.name} generated inventory status report")
        logging_config.log_performance(api_logger, "Inventory status report endpoint", total_duration, correlation_id)

        return {"inventory_status": result_data}

    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        # Use centralized error handler
        raise handle_report_error(e, "inventory status report generation", correlation_id)

@router.get("/export/excel/{report_type}")
async def export_excel_report(
    report_type: str,
    start_date: Optional[str] = Query(None, description="Start date (ISO 8601 format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO 8601 format)"),
    user_id: Optional[int] = Query(None),
    genre: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Export report as Excel file with enhanced error handling"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log export operation request with parameters and user context
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) requesting Excel export")
    logging_config.log_api_operation(f"Excel export request - type: {report_type}, start_date: {start_date}, end_date: {end_date}, user_id: {user_id}, genre: {genre}", correlation_id=correlation_id)

    # Enhanced authentication validation
    validate_admin_authentication(current_admin, correlation_id)
    # Enhanced database session validation
    validate_database_session(session, correlation_id)

    try:
        # Validate report type
        valid_report_types = ["user-activity", "book-circulation", "overdue-summary", "inventory-status"]
        if report_type not in valid_report_types:
            api_logger.warning(f"[{correlation_id}] Invalid report type for Excel export: {report_type}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid report type. Must be one of: {', '.join(valid_report_types)}"
            )

        logging_config.log_api_operation(f"Report type validation passed: {report_type}", correlation_id=correlation_id)

        # Validate date parameters if present for complexity check
        _start_date = parse_and_validate_datetime(start_date, "start_date")
        _end_date = parse_and_validate_datetime(end_date, "end_date")
        validate_request_complexity(_start_date, _end_date, correlation_id)

        # Create workbook and worksheet with error handling
        try:
            workbook_start = time.time()
            logging_config.log_api_operation("Creating Excel workbook", correlation_id=correlation_id)
            wb = Workbook()
            ws = wb.active
            workbook_duration = time.time() - workbook_start
            logging_config.log_performance(api_logger, "Excel workbook creation", workbook_duration, correlation_id)
        except Exception as wb_error:
            # Use centralized error handler
            raise handle_report_error(wb_error, "Excel workbook creation", correlation_id)

        # Set headers and data based on report type with comprehensive error handling
        try:
            data_processing_start = time.time()

            if report_type == "user-activity":
                logging_config.log_api_operation("Processing user activity data for Excel export", correlation_id=correlation_id)
                ws.title = "User Activity Report"
                headers = ["User ID", "Name", "USN", "Total Books", "Current Books", "Overdue Books", "Total Fines", "Last Activity"]
                ws.append(headers)
                
                # Call the main report generation endpoint (which now includes timeout handling)
                response = await get_user_activity_report(start_date, end_date, user_id, session, current_admin)
                user_data = response.get("user_activity_report", [])
                api_logger.info(f"[{correlation_id}] Processing {len(user_data)} user records for Excel export")
                
                for user in user_data:
                    try:
                        ws.append([
                            user.get("user_id", 0),
                            user.get("user_name", "Unknown"),
                            user.get("user_usn", "N/A"),
                            user.get("total_books_borrowed", 0),
                            user.get("current_books", 0),
                            user.get("overdue_books", 0),
                            user.get("total_fines", 0.0),
                            user.get("last_activity").strftime("%Y-%m-%d %H:%M:%S") if user.get("last_activity") else "N/A"
                        ])
                    except Exception as row_error:
                        logging_config.log_error(api_logger, f"Error adding user row to Excel: {str(row_error)}", correlation_id=correlation_id)
                        continue
            
            elif report_type == "book-circulation":
                logging_config.log_api_operation("Processing book circulation data for Excel export", correlation_id=correlation_id)
                ws.title = "Book Circulation Report"
                headers = ["Book ID", "Title", "Author", "ISBN", "Total Issues", "Status", "Last Issued", "Days Borrowed"]
                ws.append(headers)
                
                # Call the main report generation endpoint (which now includes timeout handling)
                response = await get_book_circulation_report(start_date, end_date, genre, session, current_admin)
                book_data = response.get("book_circulation_report", [])
                api_logger.info(f"[{correlation_id}] Processing {len(book_data)} book records for Excel export")
                
                for book in book_data:
                    try:
                        ws.append([
                            book.get("book_id", 0),
                            book.get("book_title", "Unknown"),
                            book.get("book_author", "Unknown"),
                            book.get("book_isbn", "N/A"),
                            book.get("total_issues", 0),
                            book.get("current_status", "Unknown"),
                            book.get("last_issued").strftime("%Y-%m-%d %H:%M:%S") if book.get("last_issued") else "N/A",
                            book.get("total_days_borrowed", 0)
                        ])
                    except Exception as row_error:
                        logging_config.log_error(api_logger, f"Error adding book row to Excel: {str(row_error)}", correlation_id=correlation_id)
                        continue
            
            elif report_type == "overdue-summary":
                logging_config.log_api_operation("Processing overdue summary data for Excel export", correlation_id=correlation_id)
                ws.title = "Overdue Summary Report"
                headers = ["Metric", "Value"]
                ws.append(headers)
                
                # Call the main report generation endpoint (which now includes timeout handling)
                response = await get_overdue_summary_report(start_date, end_date, session, current_admin)
                summary = response.get("overdue_summary", {})
                
                try:
                    ws.append(["Total Overdue Books", summary.get("total_overdue_books", 0)])
                    ws.append(["Total Pending Fines", f"₹{summary.get('total_pending_fines', 0.0):.2f}"])
                    ws.append(["Total Paid Fines", f"₹{summary.get('total_paid_fines', 0.0):.2f}"])
                    ws.append(["Total Waived Fines", f"₹{summary.get('total_waived_fines', 0.0):.2f}"])
                    ws.append(["Average Overdue Days", f"{summary.get('average_overdue_days', 0.0):.2f}"])
                    api_logger.info(f"[{correlation_id}] Added 5 summary metrics to Excel export")
                except Exception as summary_error:
                    logging_config.log_error(api_logger, f"Error adding summary data to Excel: {str(summary_error)}", correlation_id=correlation_id)
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to process overdue summary data"
                    )
            
            elif report_type == "inventory-status":
                logging_config.log_api_operation("Processing inventory status data for Excel export", correlation_id=correlation_id)
                ws.title = "Inventory Status Report"
                headers = ["Metric", "Value"]
                ws.append(headers)
                
                # Call the main report generation endpoint (which now includes timeout handling)
                response = await get_inventory_status_report(session, current_admin)
                inventory = response.get("inventory_status", {})
                
                try:
                    ws.append(["Total Books", inventory.get("total_books", 0)])
                    ws.append(["Available Books", inventory.get("available_books", 0)])
                    ws.append(["Issued Books", inventory.get("issued_books", 0)])
                    ws.append(["Total Racks", inventory.get("total_racks", 0)])
                    ws.append(["Total Shelves", inventory.get("total_shelves", 0)])
                    api_logger.info(f"[{correlation_id}] Added 5 inventory metrics to Excel export")

                    # Add shelf utilization as a separate table/section if present
                    shelf_util_data = inventory.get("shelf_utilization", [])
                    if shelf_util_data:
                        ws.append([]) # Add empty row for separation
                        ws.append(["Shelf Utilization Details", ""]) # Section header
                        ws.append(["Shelf ID", "Shelf Name", "Capacity", "Current Books", "Utilization (%)"])
                        for shelf_item in shelf_util_data:
                            ws.append([
                                shelf_item.get("shelf_id", 0),
                                shelf_item.get("shelf_name", "N/A"),
                                shelf_item.get("capacity", 0),
                                shelf_item.get("current_books", 0),
                                shelf_item.get("utilization_percentage", 0.0)
                            ])
                        api_logger.info(f"[{correlation_id}] Added {len(shelf_util_data)} shelf utilization records to Excel export")
                except Exception as inventory_error:
                    logging_config.log_error(api_logger, f"Error adding inventory data to Excel: {str(inventory_error)}", correlation_id=correlation_id)
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to process inventory status data"
                    )
            
            data_processing_duration = time.time() - data_processing_start
            logging_config.log_performance(api_logger, f"Excel data processing for {report_type}", data_processing_duration, correlation_id)
        
        except HTTPException:
            raise
        except Exception as data_error:
            # Use centralized error handler
            raise handle_report_error(data_error, "report data processing for Excel", correlation_id)
        
        try:
            # Style the header row
            styling_start = time.time()
            logging_config.log_api_operation("Applying Excel formatting", correlation_id=correlation_id)
            # Find the actual header row to style based on content, typically first row after title
            header_row_index = 1 # Assuming the first data row is always the header for these reports
            
            for cell in ws[header_row_index]: # Apply to the first header row
                cell.font = Font(bold=True)
                cell.alignment = Alignment(horizontal="center")
            
            # Auto-fit columns
            for column in ws.columns:
                max_length = 0
                column_name = column[0].column_letter # Get the column name
                for cell in column:
                    try: # Necessary to avoid error on empty cells
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = (max_length + 2)
                ws.column_dimensions[column_name].width = adjusted_width

            styling_duration = time.time() - styling_start
            logging_config.log_performance(api_logger, "Excel styling", styling_duration, correlation_id)
        except Exception as style_error:
            api_logger.warning(f"[{correlation_id}] Error styling Excel header or autofitting columns: {str(style_error)}")
            # Continue without styling
        
        try:
            # Save to temporary file
            file_save_start = time.time()
            logging_config.log_api_operation("Creating temporary Excel file", correlation_id=correlation_id)
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp_file:
                wb.save(tmp_file.name)
                tmp_file_path = tmp_file.name
                
            file_save_duration = time.time() - file_save_start
            file_size = os.path.getsize(tmp_file_path) if os.path.exists(tmp_file_path) else 0
            
            api_logger.info(f"[{correlation_id}] Excel file created successfully - Path: {tmp_file_path}, Size: {file_size} bytes")
            logging_config.log_performance(api_logger, "Excel file creation", file_save_duration, correlation_id)
            
        except Exception as save_error:
            # Use centralized error handler
            raise handle_report_error(save_error, "Excel file saving", correlation_id)
        
        # Generate filename with timestamp
        filename = f"{report_type}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        total_duration = time.time() - start_time
        
        # Log export operation completion with audit trail
        api_logger.info(f"[{correlation_id}] Excel export completed successfully - Type: {report_type}, File: {filename}")
        api_logger.info(f"[{correlation_id}] Export audit - Admin {current_admin.name} exported {report_type} report as Excel")
        logging_config.log_performance(api_logger, "Excel export operation total", total_duration, correlation_id)
        
        # Return file response
        return FileResponse(
            tmp_file_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        # Use centralized error handler
        raise handle_report_error(e, "Excel export operation", correlation_id)

@router.get("/export/pdf/{report_type}")
async def export_pdf_report(
    report_type: str,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """PDF export is handled client-side only - this endpoint returns proper error with instructions"""
    correlation_id = logging_config.get_correlation_id()
    
    # Enhanced authentication validation for audit purposes
    validate_admin_authentication(current_admin, correlation_id)
    
    # Log the request for audit purposes with more details
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempted server-side PDF export")
    logging_config.log_api_operation(f"PDF export attempt blocked - type: {report_type}, redirecting to client-side", correlation_id=correlation_id)
    
    # Validate report type for better error message
    valid_report_types = ["user-activity", "book-circulation", "overdue-summary", "inventory-status"]
    if report_type not in valid_report_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid report type '{report_type}'. Valid types: {', '.join(valid_report_types)}"
        )
    
    raise HTTPException(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        detail={
            "message": "PDF export is handled client-side for better performance and user experience.",
            "instructions": "Please use the 'Generate PDF' button in the web interface to download your report.",
            "report_type": report_type,
            "alternative": f"You can also use the Excel export option available at /api/reports/export/excel/{report_type}"
        }
    )