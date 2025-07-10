from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import io
import os
import tempfile
import time

import logging_config # New import

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

# Create router
router = APIRouter()

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

@router.get("/user-activity")
async def get_user_activity_report(
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
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
    
    try:
        # Validate date parameters
        if start_date or end_date:
            logging_config.log_api_operation("Validating date range parameters", correlation_id=correlation_id)
            date_validator = DateRangeValidator(start_date=start_date, end_date=end_date)
            api_logger.info(f"[{correlation_id}] Date validation passed for user activity report")
        
        # Build query with error handling
        try:
            query_start = time.time()
            logging_config.log_api_operation("Building user query for activity report", correlation_id=correlation_id)
            query = select(User)
            
            if user_id:
                if user_id <= 0:
                    api_logger.warning(f"[{correlation_id}] Invalid user ID provided: {user_id}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="User ID must be a positive integer"
                    )
                query = query.where(User.id == user_id)
                logging_config.log_api_operation(f"Applied user ID filter: {user_id}", correlation_id=correlation_id)
            
            users = session.exec(query).all()
            query_duration = time.time() - query_start
            logging_config.log_performance(api_logger, "User activity report query", query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Found {len(users)} users for activity report")
        except Exception as db_error:
            logging_config.log_error(api_logger, f"Database error when fetching users: {str(db_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve user data from database"
            )
        
        report_data = []
        processing_start = time.time()
        
        for user in users:
            try:
                # Get user transactions with safe handling
                logging_config.log_api_operation(f"Processing user {user.id} ({user.name}) for activity report", correlation_id=correlation_id)
                transaction_query = select(Transaction).where(Transaction.user_id == user.id)
                
                if start_date:
                    transaction_query = transaction_query.where(Transaction.issued_date >= start_date)
                if end_date:
                    transaction_query = transaction_query.where(Transaction.issued_date <= end_date)
                
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
        total_duration = time.time() - start_time
        
        # Log report generation completion with audit trail
        api_logger.info(f"[{correlation_id}] User activity report generated successfully - {len(report_data)} entries")
        api_logger.info(f"[{correlation_id}] Report access audit - Admin {current_admin.name} generated user activity report with {len(report_data)} users")
        logging_config.log_performance(api_logger, "User activity report processing", processing_duration, correlation_id)
        logging_config.log_performance(api_logger, "User activity report endpoint", total_duration, correlation_id)
        
        return {"user_activity_report": report_data}
        
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error in user activity report: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "User activity report endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating the user activity report"
        )

@router.get("/book-circulation")
async def get_book_circulation_report(
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
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
    
    try:
        # Validate date parameters
        if start_date or end_date:
            logging_config.log_api_operation("Validating date range parameters for circulation report", correlation_id=correlation_id)
            date_validator = DateRangeValidator(start_date=start_date, end_date=end_date)
            api_logger.info(f"[{correlation_id}] Date validation passed for book circulation report")
        
        # Build query with error handling
        try:
            query_start = time.time()
            logging_config.log_api_operation("Building book query for circulation report", correlation_id=correlation_id)
            query = select(Book)
            
            if genre:
                if len(genre.strip()) == 0:
                    api_logger.warning(f"[{correlation_id}] Empty genre filter provided")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Genre filter cannot be empty"
                    )
                query = query.where(Book.genre == genre.strip())
                logging_config.log_api_operation(f"Applied genre filter: {genre}", correlation_id=correlation_id)
            
            books = session.exec(query).all()
            query_duration = time.time() - query_start
            logging_config.log_performance(api_logger, "Book circulation report query", query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Found {len(books)} books for circulation report")
        except Exception as db_error:
            logging_config.log_error(api_logger, f"Database error when fetching books: {str(db_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve book data from database"
            )
        
        report_data = []
        processing_start = time.time()
        
        for book in books:
            try:
                # Get book transactions with safe handling
                logging_config.log_api_operation(f"Processing book {book.id} ('{book.title}') for circulation report", correlation_id=correlation_id)
                transaction_query = select(Transaction).where(Transaction.book_id == book.id)
                
                if start_date:
                    transaction_query = transaction_query.where(Transaction.issued_date >= start_date)
                if end_date:
                    transaction_query = transaction_query.where(Transaction.issued_date <= end_date)
                
                transactions = session.exec(transaction_query).all()
                
                # Calculate statistics with null checks
                total_issues = len(transactions) if transactions else 0
                current_status = "Available" if getattr(book, 'is_available', True) else "Issued"
                
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
                            days = (transaction.return_date - transaction.issued_date).days
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
        total_duration = time.time() - start_time
        
        # Log report generation completion with audit trail
        api_logger.info(f"[{correlation_id}] Book circulation report generated successfully - {len(report_data)} entries")
        api_logger.info(f"[{correlation_id}] Report access audit - Admin {current_admin.name} generated book circulation report with {len(report_data)} books")
        logging_config.log_performance(api_logger, "Book circulation report processing", processing_duration, correlation_id)
        logging_config.log_performance(api_logger, "Book circulation report endpoint", total_duration, correlation_id)
        
        return {"book_circulation_report": report_data}
        
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error in book circulation report: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Book circulation report endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating the book circulation report"
        )

@router.get("/overdue-summary")
async def get_overdue_summary_report(
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Generate overdue books and fines summary report with comprehensive error handling"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Log report generation request with parameters and user context
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) requesting overdue summary report")
    logging_config.log_api_operation(f"Overdue summary report request - start_date: {start_date}, end_date: {end_date}", correlation_id=correlation_id)
    
    try:
        # Validate date parameters
        if start_date or end_date:
            try:
                logging_config.log_api_operation("Validating date range parameters for overdue summary", correlation_id=correlation_id)
                date_validator = DateRangeValidator(start_date=start_date, end_date=end_date)
                api_logger.info(f"[{correlation_id}] Date validation passed for overdue summary report")
            except ValueError as ve:
                api_logger.warning(f"[{correlation_id}] Invalid date parameters: {str(ve)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid date parameters: {str(ve)}"
                )
        
        # Initialize default values to prevent null errors
        total_overdue_books = 0
        total_pending_fines = 0.0
        total_paid_fines = 0.0
        total_waived_fines = 0.0
        average_overdue_days = 0.0
        
        try:
            # Get overdue transactions with comprehensive error handling
            query_start = time.time()
            logging_config.log_api_operation("Fetching overdue transactions for summary report", correlation_id=correlation_id)
            overdue_query = select(Transaction).where(Transaction.status == "overdue")
            
            if start_date:
                overdue_query = overdue_query.where(Transaction.issued_date >= start_date)
                logging_config.log_api_operation(f"Applied start date filter: {start_date}", correlation_id=correlation_id)
            if end_date:
                overdue_query = overdue_query.where(Transaction.issued_date <= end_date)
                logging_config.log_api_operation(f"Applied end date filter: {end_date}", correlation_id=correlation_id)
            
            overdue_transactions = session.exec(overdue_query).all()
            query_duration = time.time() - query_start
            logging_config.log_performance(api_logger, "Overdue transactions query for summary", query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Found {len(overdue_transactions)} overdue transactions for summary")
            
            # Calculate total overdue books safely
            total_overdue_books = len(overdue_transactions) if overdue_transactions else 0
            logging_config.log_api_operation(f"Total overdue books calculated: {total_overdue_books}", correlation_id=correlation_id)
            
        except Exception as overdue_error:
            logging_config.log_error(api_logger, f"Database error when fetching overdue transactions: {str(overdue_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve overdue transactions from database"
            )
        
        try:
            # Get fines with error handling
            fine_query_start = time.time()
            logging_config.log_api_operation("Fetching fines for summary report", correlation_id=correlation_id)
            fine_query = select(Fine)
            
            if start_date:
                fine_query = fine_query.where(Fine.created_at >= start_date)
            if end_date:
                fine_query = fine_query.where(Fine.created_at <= end_date)
            
            fines = session.exec(fine_query).all()
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
                
        except Exception as fine_error:
            logging_config.log_error(api_logger, f"Database error when fetching fines: {str(fine_error)}", correlation_id=correlation_id)
            # Continue with default values instead of failing
            api_logger.warning(f"[{correlation_id}] Continuing with default fine values due to database error")
        
        # Calculate average overdue days with division by zero protection
        try:
            if overdue_transactions and len(overdue_transactions) > 0:
                logging_config.log_api_operation("Calculating average overdue days", correlation_id=correlation_id)
                valid_overdue_days = []
                
                for transaction in overdue_transactions:
                    try:
                        if transaction and hasattr(transaction, 'days_overdue'):
                            days = transaction.days_overdue or 0
                            if isinstance(days, (int, float)) and days >= 0:
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
        logging_config.log_error(api_logger, f"Unexpected error in overdue summary report: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Overdue summary report endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating the overdue summary report"
        )

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
    
    try:
        # Initialize default values
        total_books = 0
        available_books = 0
        issued_books = 0
        total_racks = 0
        total_shelves = 0
        shelf_utilization = []
        
        try:
            # Get book statistics with error handling
            book_query_start = time.time()
            logging_config.log_api_operation("Fetching book statistics for inventory report", correlation_id=correlation_id)
            all_books = session.exec(select(Book)).all()
            total_books = len(all_books) if all_books else 0
            
            if all_books:
                available_books = len([book for book in all_books if book and getattr(book, 'is_available', True)])
                issued_books = max(0, total_books - available_books)
            
            book_query_duration = time.time() - book_query_start
            logging_config.log_performance(api_logger, "Book statistics query", book_query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Book statistics - total={total_books}, available={available_books}, issued={issued_books}")
            
        except Exception as book_error:
            logging_config.log_error(api_logger, f"Error fetching book statistics: {str(book_error)}", correlation_id=correlation_id)
            # Continue with default values
        
        try:
            # Get rack and shelf statistics with error handling
            storage_query_start = time.time()
            logging_config.log_api_operation("Fetching storage statistics for inventory report", correlation_id=correlation_id)
            racks = session.exec(select(Rack)).all()
            shelves = session.exec(select(Shelf)).all()
            
            total_racks = len(racks) if racks else 0
            total_shelves = len(shelves) if shelves else 0
            
            storage_query_duration = time.time() - storage_query_start
            logging_config.log_performance(api_logger, "Storage statistics query", storage_query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Storage statistics - racks={total_racks}, shelves={total_shelves}")
            
        except Exception as storage_error:
            logging_config.log_error(api_logger, f"Error fetching storage statistics: {str(storage_error)}", correlation_id=correlation_id)
            # Continue with default values
        
        try:
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
        except Exception as utilization_error:
            logging_config.log_error(api_logger, f"Error calculating shelf utilization: {str(utilization_error)}", correlation_id=correlation_id)
            shelf_utilization = []
        
        result_data = {
            "total_books": max(0, total_books),
            "available_books": max(0, available_books),
            "issued_books": max(0, issued_books),
            "total_racks": max(0, total_racks),
            "total_shelves": max(0, total_shelves),
            "shelf_utilization": shelf_utilization
        }
        
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
        logging_config.log_error(api_logger, f"Unexpected error in inventory status report: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Inventory status report endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating the inventory status report"
        )

@router.get("/export/excel/{report_type}")
async def export_excel_report(
    report_type: str,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
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
        
        # Create workbook and worksheet with error handling
        try:
            workbook_start = time.time()
            logging_config.log_api_operation("Creating Excel workbook", correlation_id=correlation_id)
            wb = Workbook()
            ws = wb.active
            workbook_duration = time.time() - workbook_start
            logging_config.log_performance(api_logger, "Excel workbook creation", workbook_duration, correlation_id)
        except Exception as wb_error:
            logging_config.log_error(api_logger, f"Error creating workbook: {str(wb_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create Excel workbook"
            )
        
        # Set headers and data based on report type with comprehensive error handling
        try:
            data_processing_start = time.time()
            
            if report_type == "user-activity":
                logging_config.log_api_operation("Processing user activity data for Excel export", correlation_id=correlation_id)
                ws.title = "User Activity Report"
                headers = ["User ID", "Name", "USN", "Total Books", "Current Books", "Overdue Books", "Total Fines", "Last Activity"]
                ws.append(headers)
                
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
                            user.get("last_activity").strftime("%Y-%m-%d") if user.get("last_activity") else "N/A"
                        ])
                    except Exception as row_error:
                        logging_config.log_error(api_logger, f"Error adding user row to Excel: {str(row_error)}", correlation_id=correlation_id)
                        continue
            
            elif report_type == "book-circulation":
                logging_config.log_api_operation("Processing book circulation data for Excel export", correlation_id=correlation_id)
                ws.title = "Book Circulation Report"
                headers = ["Book ID", "Title", "Author", "ISBN", "Total Issues", "Status", "Last Issued", "Days Borrowed"]
                ws.append(headers)
                
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
                            book.get("last_issued").strftime("%Y-%m-%d") if book.get("last_issued") else "N/A",
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
                
                response = await get_inventory_status_report(session, current_admin)
                inventory = response.get("inventory_status", {})
                
                try:
                    ws.append(["Total Books", inventory.get("total_books", 0)])
                    ws.append(["Available Books", inventory.get("available_books", 0)])
                    ws.append(["Issued Books", inventory.get("issued_books", 0)])
                    ws.append(["Total Racks", inventory.get("total_racks", 0)])
                    ws.append(["Total Shelves", inventory.get("total_shelves", 0)])
                    api_logger.info(f"[{correlation_id}] Added 5 inventory metrics to Excel export")
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
            logging_config.log_error(api_logger, f"Error processing report data for Excel: {str(data_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process report data for Excel export"
            )
        
        try:
            # Style the header row
            styling_start = time.time()
            logging_config.log_api_operation("Applying Excel formatting", correlation_id=correlation_id)
            for cell in ws[1]:
                cell.font = Font(bold=True)
                cell.alignment = Alignment(horizontal="center")
            styling_duration = time.time() - styling_start
            logging_config.log_performance(api_logger, "Excel styling", styling_duration, correlation_id)
        except Exception as style_error:
            api_logger.warning(f"[{correlation_id}] Error styling Excel header: {str(style_error)}")
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
            logging_config.log_error(api_logger, f"Error saving Excel file: {str(save_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save Excel report file"
            )
        
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
        logging_config.log_error(api_logger, f"Unexpected error in Excel export: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Excel export operation (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while exporting Excel report"
        )

@router.get("/export/pdf/{report_type}")
async def export_pdf_report(
    report_type: str,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    user_id: Optional[int] = Query(None),
    genre: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Export report as PDF file with enhanced error handling"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Log PDF export operation request with parameters and user context
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) requesting PDF export")
    logging_config.log_api_operation(f"PDF export request - type: {report_type}, start_date: {start_date}, end_date: {end_date}, user_id: {user_id}, genre: {genre}", correlation_id=correlation_id)
    
    try:
        # Validate report type
        valid_report_types = ["user-activity", "book-circulation", "overdue-summary", "inventory-status"]
        if report_type not in valid_report_types:
            api_logger.warning(f"[{correlation_id}] Invalid report type for PDF export: {report_type}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid report type. Must be one of: {', '.join(valid_report_types)}"
            )
        
        logging_config.log_api_operation(f"Report type validation passed: {report_type}", correlation_id=correlation_id)
        
        try:
            # Create PDF buffer
            pdf_init_start = time.time()
            logging_config.log_api_operation("Initializing PDF document", correlation_id=correlation_id)
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4)
            elements = []
            
            # Get styles
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(name='CustomTitle', parent=styles['Heading1'], alignment=1)
            
            pdf_init_duration = time.time() - pdf_init_start
            logging_config.log_performance(api_logger, "PDF document initialization", pdf_init_duration, correlation_id)
        except Exception as pdf_init_error:
            logging_config.log_error(api_logger, f"Error initializing PDF: {str(pdf_init_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize PDF document"
            )
        
        # Generate content based on report type with comprehensive error handling
        try:
            content_generation_start = time.time()
            
            if report_type == "user-activity":
                logging_config.log_api_operation("Generating PDF content for user activity report", correlation_id=correlation_id)
                elements.append(Paragraph("User Activity Report", title_style))
                elements.append(Spacer(1, 12))
                
                response = await get_user_activity_report(start_date, end_date, user_id, session, current_admin)
                user_data = response.get("user_activity_report", [])
                
                table_data = [["User ID", "Name", "USN", "Total Books", "Current", "Overdue", "Fines"]]
                api_logger.info(f"[{correlation_id}] Processing {len(user_data)} user records for PDF")
                
                for user in user_data:
                    try:
                        table_data.append([
                            str(user.get("user_id", 0)),
                            user.get("user_name", "Unknown"),
                            user.get("user_usn", "N/A"),
                            str(user.get("total_books_borrowed", 0)),
                            str(user.get("current_books", 0)),
                            str(user.get("overdue_books", 0)),
                            f"₹{user.get('total_fines', 0.0):.2f}"
                        ])
                    except Exception as row_error:
                        logging_config.log_error(api_logger, f"Error processing user row for PDF: {str(row_error)}", correlation_id=correlation_id)
                        continue
            
            elif report_type == "book-circulation":
                logging_config.log_api_operation("Generating PDF content for book circulation report", correlation_id=correlation_id)
                elements.append(Paragraph("Book Circulation Report", title_style))
                elements.append(Spacer(1, 12))
                
                response = await get_book_circulation_report(start_date, end_date, genre, session, current_admin)
                book_data = response.get("book_circulation_report", [])
                
                table_data = [["Book ID", "Title", "Author", "Issues", "Status", "Days Borrowed"]]
                api_logger.info(f"[{correlation_id}] Processing {len(book_data)} book records for PDF")
                
                for book in book_data:
                    try:
                        book_title = book.get("book_title", "Unknown")
                        book_author = book.get("book_author", "Unknown")
                        
                        # Truncate long titles/authors for PDF layout
                        if len(book_title) > 30:
                            book_title = book_title[:30] + "..."
                            logging_config.log_api_operation(f"Truncated book title for PDF layout", correlation_id=correlation_id)
                        if len(book_author) > 20:
                            book_author = book_author[:20] + "..."
                            logging_config.log_api_operation(f"Truncated book author for PDF layout", correlation_id=correlation_id)
                            
                        table_data.append([
                            str(book.get("book_id", 0)),
                            book_title,
                            book_author,
                            str(book.get("total_issues", 0)),
                            book.get("current_status", "Unknown"),
                            str(book.get("total_days_borrowed", 0))
                        ])
                    except Exception as row_error:
                        logging_config.log_error(api_logger, f"Error processing book row for PDF: {str(row_error)}", correlation_id=correlation_id)
                        continue
            
            elif report_type == "overdue-summary":
                logging_config.log_api_operation("Generating PDF content for overdue summary report", correlation_id=correlation_id)
                elements.append(Paragraph("Overdue Summary Report", title_style))
                elements.append(Spacer(1, 12))
                
                response = await get_overdue_summary_report(start_date, end_date, session, current_admin)
                summary = response.get("overdue_summary", {})
                
                table_data = [["Metric", "Value"]]
                try:
                    table_data.append(["Total Overdue Books", str(summary.get("total_overdue_books", 0))])
                    table_data.append(["Total Pending Fines", f"₹{summary.get('total_pending_fines', 0.0):.2f}"])
                    table_data.append(["Total Paid Fines", f"₹{summary.get('total_paid_fines', 0.0):.2f}"])
                    table_data.append(["Total Waived Fines", f"₹{summary.get('total_waived_fines', 0.0):.2f}"])
                    table_data.append(["Average Overdue Days", f"{summary.get('average_overdue_days', 0.0):.2f}"])
                    api_logger.info(f"[{correlation_id}] Added 5 summary metrics to PDF")
                except Exception as summary_pdf_error:
                    logging_config.log_error(api_logger, f"Error processing overdue summary for PDF: {str(summary_pdf_error)}", correlation_id=correlation_id)
                    table_data.append(["Error", "Data processing failed"])
            
            elif report_type == "inventory-status":
                logging_config.log_api_operation("Generating PDF content for inventory status report", correlation_id=correlation_id)
                elements.append(Paragraph("Inventory Status Report", title_style))
                elements.append(Spacer(1, 12))
                
                response = await get_inventory_status_report(session, current_admin)
                inventory = response.get("inventory_status", {})
                
                table_data = [["Metric", "Value"]]
                try:
                    table_data.append(["Total Books", str(inventory.get("total_books", 0))])
                    table_data.append(["Available Books", str(inventory.get("available_books", 0))])
                    table_data.append(["Issued Books", str(inventory.get("issued_books", 0))])
                    table_data.append(["Total Racks", str(inventory.get("total_racks", 0))])
                    table_data.append(["Total Shelves", str(inventory.get("total_shelves", 0))])
                    api_logger.info(f"[{correlation_id}] Added 5 inventory metrics to PDF")
                except Exception as inventory_pdf_error:
                    logging_config.log_error(api_logger, f"Error processing inventory data for PDF: {str(inventory_pdf_error)}", correlation_id=correlation_id)
                    table_data.append(["Error", "Data processing failed"])
            
            content_generation_duration = time.time() - content_generation_start
            logging_config.log_performance(api_logger, f"PDF content generation for {report_type}", content_generation_duration, correlation_id)
        
        except HTTPException:
            raise
        except Exception as content_error:
            logging_config.log_error(api_logger, f"Error generating PDF content: {str(content_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate PDF report content"
            )
        
        try:
            # Create and style table
            table_creation_start = time.time()
            logging_config.log_api_operation("Creating and styling PDF table", correlation_id=correlation_id)
            
            table = Table(table_data)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 14),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            elements.append(table)
            
            # Add generation timestamp
            elements.append(Spacer(1, 20))
            elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
            
            # Build PDF
            logging_config.log_api_operation("Building PDF document", correlation_id=correlation_id)
            doc.build(elements)
            buffer.seek(0)
            
            table_creation_duration = time.time() - table_creation_start
            logging_config.log_performance(api_logger, "PDF table creation and build", table_creation_duration, correlation_id)
            
            buffer_size = len(buffer.getvalue())
            api_logger.info(f"[{correlation_id}] PDF document created successfully - Size: {buffer_size} bytes")
            
        except Exception as pdf_build_error:
            logging_config.log_error(api_logger, f"Error building PDF: {str(pdf_build_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to build PDF document"
            )
        
        # Generate filename with timestamp
        filename = f"{report_type}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        total_duration = time.time() - start_time
        
        # Log export operation completion with audit trail
        api_logger.info(f"[{correlation_id}] PDF export completed successfully - Type: {report_type}, File: {filename}")
        api_logger.info(f"[{correlation_id}] Export audit - Admin {current_admin.name} exported {report_type} report as PDF")
        logging_config.log_performance(api_logger, "PDF export operation total", total_duration, correlation_id)
        
        return StreamingResponse(
            io.BytesIO(buffer.getvalue()),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error in PDF export: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "PDF export operation (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while exporting PDF report"
        )