from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging_config
import time
from pydantic import BaseModel, Field, validator
from math import ceil

from database import get_session
from models import Book, Transaction, Fine, User
from auth import get_current_admin, get_current_user

# Get API logger from logging configuration
api_logger = logging_config.get_logger('api')

# Create router
router = APIRouter()

# Pydantic models for request/response
class OverdueBookResponse(BaseModel):
    id: int
    book_id: int
    user_id: int
    user_name: str
    user_usn: str
    book_title: str
    book_author: str
    book_isbn: str
    issued_date: datetime
    due_date: datetime
    days_overdue: int
    fine_amount: float

class FineResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_usn: str
    book_history_id: int
    book_title: str
    book_author: str
    book_isbn: str
    days_overdue: int
    fine_amount: float
    fine_per_day: float
    issued_date: datetime
    due_date: datetime
    return_date: Optional[datetime] = None
    status: str
    created_at: datetime
    paid_at: Optional[datetime] = None
    waived_at: Optional[datetime] = None
    waived_by: Optional[int] = None
    notes: Optional[str] = None

class PayFineRequest(BaseModel):
    payment_method: Optional[str] = Field("cash", description="Method of payment (cash, card, etc.)")
    notes: Optional[str] = Field(None, description="Optional notes about the payment")
    
    @validator('payment_method')
    def validate_payment_method(cls, v):
        allowed_methods = ['cash', 'card', 'upi']
        if v and v.lower() not in allowed_methods:
            raise ValueError(f"Payment method must be one of {', '.join(allowed_methods)}")
        return v.lower() if v else "cash"

class WaiveFineRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500, description="Reason for waiving the fine")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    
    @validator('reason')
    def validate_reason(cls, v):
        if not v or not v.strip():
            raise ValueError("Reason cannot be empty")
        return v.strip()

class CalculateFinesPayload(BaseModel):
    fine_per_day: float = Field(..., gt=0, le=1000, description="Fine amount per day")

class PaginationParams(BaseModel):
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(20, ge=5, le=100, description="Items per page")

class PaginationInfo(BaseModel):
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_prev: bool = Field(..., description="Whether there is a previous page")

class PaginatedFinesResponse(BaseModel):
    fines: List[FineResponse] = Field(..., description="List of fines")
    pagination: PaginationInfo = Field(..., description="Pagination information")

# Default fine per day
FINE_PER_DAY = 5.0

@router.get("/books", response_model=Dict[str, List[OverdueBookResponse]], 
           summary="Get all overdue books",
           description="Returns a list of all books that are currently overdue")
async def get_overdue_books(
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Get all overdue books with comprehensive error handling and detailed logging"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Log admin access and operation start
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) accessing overdue books")
    logging_config.log_api_operation("Overdue books calculation started", correlation_id=correlation_id)
    
    try:
        current_time = datetime.utcnow()
        logging_config.log_api_operation(f"Overdue calculation timestamp: {current_time}", correlation_id=correlation_id)
        
        # Log business logic decision - fine calculation algorithm
        api_logger.info(f"[{correlation_id}] Using fine calculation algorithm: ₹{FINE_PER_DAY} per day overdue")
        
        # Get all current transactions that are overdue and don't have paid fines
        query_start = time.time()
        logging_config.log_api_operation("Building overdue books query excluding paid fines", correlation_id=correlation_id)
        
        query = select(Transaction).where(
            Transaction.status.in_(["current", "overdue"]),
            Transaction.due_date < current_time
        ).outerjoin(Fine, Transaction.id == Fine.book_history_id).where(
            (Fine.id.is_(None)) | (Fine.status != "paid")
        )
        
        try:
            overdue_transactions = session.exec(query).all()
            query_duration = time.time() - query_start
            logging_config.log_performance(api_logger, "Overdue transactions query", query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Found {len(overdue_transactions)} overdue transactions")
            
            # Log exclusion of paid fines with detailed tracking
            paid_fines_query = select(Transaction).where(
                Transaction.status.in_(["current", "overdue"]),
                Transaction.due_date < current_time
            ).join(Fine, Transaction.id == Fine.book_history_id).where(
                Fine.status == "paid"
            )
            excluded_transactions = session.exec(paid_fines_query).all()
            if excluded_transactions:
                api_logger.info(f"[{correlation_id}] Excluded {len(excluded_transactions)} transactions with paid fines from overdue list")
                for excluded in excluded_transactions:
                    logging_config.log_api_operation(f"Excluded transaction {excluded.id} for book '{excluded.book_title}' - fine already paid", correlation_id=correlation_id)
            else:
                logging_config.log_api_operation("No transactions with paid fines found to exclude", correlation_id=correlation_id)
        except Exception as db_error:
            logging_config.log_error(api_logger, f"Database error when fetching overdue transactions: {str(db_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve overdue books from database"
            )
        
        result = []
        processing_start = time.time()
        
        for transaction in overdue_transactions:
            try:
                # Get user details with error handling
                user = None
                if transaction.user_id:
                    user = session.get(User, transaction.user_id)
                
                # Calculate days overdue safely with business logic logging
                days_overdue = max(0, (current_time - transaction.due_date).days)
                fine_amount = days_overdue * FINE_PER_DAY
                
                logging_config.log_api_operation(f"Fine calculation for transaction {transaction.id}: {days_overdue} days × ₹{FINE_PER_DAY} = ₹{fine_amount}", correlation_id=correlation_id)
                
                # Only update status to overdue for transactions without paid fines
                # Check if this transaction has a paid fine
                has_paid_fine = session.exec(
                    select(Fine).where(
                        Fine.book_history_id == transaction.id,
                        Fine.status == "paid"
                    )
                ).first()

                if not has_paid_fine:
                    # Update transaction status to overdue with logging
                    old_status = transaction.status
                    transaction.status = "overdue"
                    transaction.days_overdue = days_overdue
                    transaction.fine_amount = fine_amount
                    session.add(transaction)
                    
                    # Log status transition
                    api_logger.info(f"[{correlation_id}] Transaction {transaction.id} status transition: '{old_status}' -> 'overdue' (Book: '{transaction.book_title}')")
                    logging_config.log_api_operation(f"Overdue status update - Transaction {transaction.id}, Days: {days_overdue}, Fine: ₹{fine_amount}", correlation_id=correlation_id)
                else:
                    # Keep transaction as 'issued' since fine is paid, exclude from overdue count
                    api_logger.info(f"[{correlation_id}] Transaction {transaction.id} fine is paid, excluding from overdue count")
                    continue
                
                result.append({
                    "id": transaction.id,
                    "book_id": transaction.book_id,
                    "user_id": transaction.user_id,
                    "user_name": user.name if user else "Unknown",
                    "user_usn": user.usn if user else "Unknown",
                    "book_title": transaction.book_title or "Unknown Title",
                    "book_author": transaction.book_author or "Unknown Author",
                    "book_isbn": transaction.book_isbn or "N/A",
                    "issued_date": transaction.issued_date,
                    "due_date": transaction.due_date,
                    "days_overdue": days_overdue,
                    "fine_amount": fine_amount
                })
            except Exception as e:
                logging_config.log_error(api_logger, f"Error processing transaction {transaction.id}: {str(e)}", correlation_id=correlation_id)
                # Continue processing other transactions
                continue
        
        processing_duration = time.time() - processing_start
        logging_config.log_performance(api_logger, "Overdue transactions processing", processing_duration, correlation_id)
        
        try:
            commit_start = time.time()
            session.commit()
            commit_duration = time.time() - commit_start
            logging_config.log_performance(api_logger, "Overdue transactions commit", commit_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Successfully updated {len(result)} overdue transactions")
        except Exception as commit_error:
            logging_config.log_error(api_logger, f"Failed to commit transaction updates: {str(commit_error)}", correlation_id=correlation_id)
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update overdue books status"
            )
        
        total_duration = time.time() - start_time
        api_logger.info(f"[{correlation_id}] Overdue books operation completed - {len(result)} books processed")
        logging_config.log_performance(api_logger, "Get overdue books endpoint", total_duration, correlation_id)
        
        return {"overdue_books": result}
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error in get_overdue_books: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Get overdue books endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing overdue books"
        )

@router.get("/fines", response_model=PaginatedFinesResponse,
           summary="Get all fines",
           description="Returns a list of all fines with optional status filtering and pagination")
async def get_fines(
    status_filter: Optional[str] = Query(None, description="Filter fines by status (pending, paid, waived, all)"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=5, le=100, description="Items per page"),
    sort_by: Optional[str] = Query("created_at", description="Field to sort by"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc, desc)"),
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Get all fines with optional status filter and pagination with comprehensive logging"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Log admin access and request parameters
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) accessing fines list")
    logging_config.log_api_operation(f"Fines list request - status_filter: {status_filter}, page: {page}, per_page: {per_page}, sort: {sort_by} {sort_order}", correlation_id=correlation_id)
    
    try:
        # Validate sort parameters with logging
        valid_sort_fields = ["created_at", "fine_amount", "days_overdue", "due_date"]
        valid_sort_orders = ["asc", "desc"]
        
        if sort_by not in valid_sort_fields:
            logging_config.log_api_operation(f"Invalid sort field '{sort_by}', defaulting to 'created_at'", correlation_id=correlation_id)
            sort_by = "created_at"
        if sort_order not in valid_sort_orders:
            logging_config.log_api_operation(f"Invalid sort order '{sort_order}', defaulting to 'desc'", correlation_id=correlation_id)
            sort_order = "desc"
        
        # Build query with detailed logging
        logging_config.log_api_operation("Building fines query with filters", correlation_id=correlation_id)
        query = select(Fine)
        
        # Apply status filter if provided and valid
        if status_filter and status_filter != "all":
            valid_statuses = ["pending", "paid", "waived"]
            if status_filter.lower() not in valid_statuses:
                api_logger.warning(f"[{correlation_id}] Invalid status filter provided: {status_filter}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter. Must be one of: {', '.join(valid_statuses)}"
                )
            query = query.where(Fine.status == status_filter.lower())
            logging_config.log_api_operation(f"Applied status filter: {status_filter.lower()}", correlation_id=correlation_id)
        
        # Get total count for pagination with performance logging
        try:
            count_start = time.time()
            total_count = len(session.exec(query).all())
            total_pages = ceil(total_count / per_page)
            count_duration = time.time() - count_start
            logging_config.log_performance(api_logger, "Fines count query", count_duration, correlation_id)
            logging_config.log_api_operation(f"Fines pagination - total: {total_count}, pages: {total_pages}", correlation_id=correlation_id)
        except Exception as count_error:
            logging_config.log_error(api_logger, f"Error counting fines: {str(count_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to count fines"
            )
        
        # Apply sorting with logging
        logging_config.log_api_operation(f"Applying sort: {sort_by} {sort_order}", correlation_id=correlation_id)
        sort_column = getattr(Fine, sort_by)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column)
            
        # Apply pagination
        query = query.offset((page - 1) * per_page).limit(per_page)
        
        # Execute query with error handling and performance logging
        try:
            query_start = time.time()
            fines = session.exec(query).all()
            query_duration = time.time() - query_start
            logging_config.log_performance(api_logger, "Paginated fines query", query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Retrieved {len(fines)} fines for page {page}")
        except Exception as db_error:
            logging_config.log_error(api_logger, f"Database error when fetching fines: {str(db_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve fines from database"
            )
        
        # Process results with error handling
        result = []
        for fine in fines:
            try:
                result.append({
                    "id": fine.id,
                    "user_id": fine.user_id,
                    "user_name": fine.user_name or "Unknown",
                    "user_usn": fine.user_usn or "N/A",
                    "book_history_id": fine.book_history_id,
                    "book_title": fine.book_title or "Unknown Title",
                    "book_author": fine.book_author or "Unknown Author",
                    "book_isbn": fine.book_isbn or "N/A",
                    "days_overdue": fine.days_overdue or 0,
                    "fine_amount": fine.fine_amount or 0.0,
                    "fine_per_day": fine.fine_per_day or 0.0,
                    "issued_date": fine.issued_date,
                    "due_date": fine.due_date,
                    "return_date": fine.return_date,
                    "status": fine.status or "unknown",
                    "created_at": fine.created_at,
                    "paid_at": fine.paid_at,
                    "waived_at": fine.waived_at,
                    "waived_by": fine.waived_by,
                    "notes": fine.notes
                })
            except Exception as item_error:
                logging_config.log_error(api_logger, f"Error processing fine {fine.id}: {str(item_error)}", correlation_id=correlation_id)
                continue
        
        total_duration = time.time() - start_time
        api_logger.info(f"[{correlation_id}] Fines list completed - {len(result)} fines retrieved")
        logging_config.log_performance(api_logger, "Get fines endpoint", total_duration, correlation_id)
        
        return PaginatedFinesResponse(
            fines=result,
            pagination=PaginationInfo(
                total=total_count,
                page=page,
                per_page=per_page,
                total_pages=total_pages,
                has_next=page < total_pages,
                has_prev=page > 1
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error in get_fines: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Get fines endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing fines"
        )

@router.post("/calculate-fines", response_model=Dict[str, Any],
           summary="Calculate fines for overdue books",
           description="Calculates and creates fine records for all overdue books")
async def calculate_fines(
    params: CalculateFinesPayload,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Calculate and create fine records for all overdue books with detailed algorithm logging"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Log admin action and business parameters
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) initiating fine calculation")
    logging_config.log_api_operation(f"Fine calculation initiated with rate: ₹{params.fine_per_day} per day", correlation_id=correlation_id)
    
    try:
        fine_per_day = params.fine_per_day
        if fine_per_day <= 0:
            api_logger.warning(f"[{correlation_id}] Invalid fine per day rate: {fine_per_day}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fine per day must be greater than 0"
            )
            
        # Log business logic decision
        api_logger.info(f"[{correlation_id}] Fine calculation algorithm: ₹{fine_per_day} per day overdue")
        current_time = datetime.utcnow()
        logging_config.log_api_operation(f"Fine calculation timestamp: {current_time}", correlation_id=correlation_id)
        
        # Get all overdue transactions without existing fines
        try:
            query_start = time.time()
            overdue_transactions = session.exec(
                select(Transaction).where(
                    Transaction.status.in_(["overdue", "current"]),
                    Transaction.due_date < current_time
                )
            ).all()
            query_duration = time.time() - query_start
            logging_config.log_performance(api_logger, "Overdue transactions query for fine calculation", query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Found {len(overdue_transactions)} potentially overdue transactions for fine calculation")
        except Exception as db_error:
            logging_config.log_error(api_logger, f"Database error when fetching overdue transactions: {str(db_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve overdue transactions from database"
            )
        
        created_fines = []
        updated_transactions = 0
        skipped_transactions = 0
        
        processing_start = time.time()
        
        for transaction in overdue_transactions:
            try:
                # Check if fine already exists for this transaction
                existing_fine = session.exec(
                    select(Fine).where(Fine.book_history_id == transaction.id)
                ).first()
                
                if existing_fine:
                    logging_config.log_api_operation(f"Skipping transaction {transaction.id} - fine already exists (ID: {existing_fine.id})", correlation_id=correlation_id)
                    skipped_transactions += 1
                    continue
                
                # Get user details
                user = session.get(User, transaction.user_id)
                if not user:
                    api_logger.warning(f"[{correlation_id}] User not found for transaction {transaction.id}, skipping")
                    skipped_transactions += 1
                    continue
                
                # Calculate days overdue and fine amount with algorithm logging
                days_overdue = max(0, (current_time - transaction.due_date).days)
                fine_amount = days_overdue * fine_per_day
                
                logging_config.log_api_operation(f"Fine calculation for transaction {transaction.id}: {days_overdue} days × ₹{fine_per_day} = ₹{fine_amount}", correlation_id=correlation_id)
                
                if days_overdue <= 0:
                    logging_config.log_api_operation(f"Transaction {transaction.id} is not overdue ({days_overdue} days), skipping", correlation_id=correlation_id)
                    skipped_transactions += 1
                    continue
                
                # Update transaction with status logging
                old_status = transaction.status
                transaction.status = "overdue"
                transaction.days_overdue = days_overdue
                transaction.fine_amount = fine_amount
                session.add(transaction)
                updated_transactions += 1
                
                # Log status transition
                api_logger.info(f"[{correlation_id}] Transaction {transaction.id} status transition: '{old_status}' -> 'overdue' for user {user.name}")
                
                # Create fine record with detailed logging
                fine = Fine(
                    user_id=user.id,
                    user_name=user.name,
                    user_usn=user.usn,
                    book_history_id=transaction.id,
                    book_title=transaction.book_title or "Unknown Title",
                    book_author=transaction.book_author or "Unknown Author",
                    book_isbn=transaction.book_isbn or "N/A",
                    days_overdue=days_overdue,
                    fine_amount=fine_amount,
                    fine_per_day=fine_per_day,
                    issued_date=transaction.issued_date,
                    due_date=transaction.due_date,
                    return_date=transaction.return_date,
                    status="pending"
                )
                
                session.add(fine)
                created_fines.append({
                    "user_name": user.name,
                    "book_title": transaction.book_title,
                    "days_overdue": days_overdue,
                    "fine_amount": fine_amount
                })
                
                api_logger.info(f"[{correlation_id}] Fine created for user {user.name} - Book: '{transaction.book_title}', Amount: ₹{fine_amount}")
                
            except Exception as item_error:
                logging_config.log_error(api_logger, f"Error processing transaction {transaction.id}: {str(item_error)}", correlation_id=correlation_id)
                continue
        
        processing_duration = time.time() - processing_start
        logging_config.log_performance(api_logger, "Fine calculations processing", processing_duration, correlation_id)
        
        try:
            commit_start = time.time()
            session.commit()
            commit_duration = time.time() - commit_start
            logging_config.log_performance(api_logger, "Fine calculations commit", commit_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Successfully created {len(created_fines)} fines and updated {updated_transactions} transactions")
            
            # Audit log for administrative action
            total_fine_amount = sum(fine["fine_amount"] for fine in created_fines)
            api_logger.info(f"[{correlation_id}] Fine calculation audit - Admin {current_admin.name} created {len(created_fines)} fines totaling ₹{total_fine_amount}")
            
        except Exception as commit_error:
            logging_config.log_error(api_logger, f"Failed to commit fine calculations: {str(commit_error)}", correlation_id=correlation_id)
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save calculated fines"
            )
        
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Calculate fines endpoint", total_duration, correlation_id)
        
        return {
            "message": f"Calculated fines for {len(created_fines)} overdue books",
            "fines_created": created_fines,
            "statistics": {
                "total_processed": len(overdue_transactions),
                "fines_created": len(created_fines),
                "transactions_updated": updated_transactions,
                "skipped": skipped_transactions
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error in calculate_fines: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Calculate fines endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while calculating fines"
        )

@router.put("/fines/{fine_id}/pay", response_model=Dict[str, str],
           summary="Mark fine as paid",
           description="Update a fine record to mark it as paid")
async def pay_fine(
    fine_id: int,
    payment_data: PayFineRequest,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Mark fine as paid with comprehensive logging and audit trail"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Log admin fine payment action
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) processing payment for fine ID {fine_id}")
    logging_config.log_api_operation(f"Fine payment processing - Fine ID: {fine_id}, Payment method: {payment_data.payment_method}", correlation_id=correlation_id)
    
    try:
        # Get fine with error handling and logging
        try:
            fine = session.get(Fine, fine_id)
        except Exception as db_error:
            logging_config.log_error(api_logger, f"Database error when fetching fine {fine_id}: {str(db_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve fine information"
            )
            
        if not fine:
            api_logger.warning(f"[{correlation_id}] Fine with ID {fine_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fine not found"
            )
        
        # Log fine details before processing
        api_logger.info(f"[{correlation_id}] Processing fine payment - User: {fine.user_name}, Book: '{fine.book_title}', Amount: ₹{fine.fine_amount}")
        
        if fine.status != "pending":
            api_logger.warning(f"[{correlation_id}] Fine {fine_id} has status '{fine.status}', not 'pending'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fine is not in pending status (current status: {fine.status})"
            )
        
        # Update fine status with detailed logging
        try:
            old_status = fine.status
            fine.status = "paid"
            fine.paid_at = datetime.utcnow()
            
            # Format notes with timestamp and admin name
            notes = f"Paid on {fine.paid_at.strftime('%Y-%m-%d %H:%M:%S')} by {current_admin.name} ({current_admin.usn})"
            notes += f" via {payment_data.payment_method}"
            
            if payment_data.notes:
                notes += f". Notes: {payment_data.notes}"
                
            fine.notes = notes
            
            # Log fine status transition with timestamps and responsible party
            api_logger.info(f"[{correlation_id}] Fine status transition - Fine {fine_id}: '{old_status}' -> 'paid' at {fine.paid_at} by {current_admin.name}")
            logging_config.log_api_operation(f"Fine payment processed - ₹{fine.fine_amount} paid via {payment_data.payment_method}", correlation_id=correlation_id)
            
            # Automatically update transaction status to 'current' when fine is paid
            try:
                transaction = session.get(Transaction, fine.book_history_id)
                if transaction and transaction.status == "overdue":
                    old_tx_status = transaction.status
                    transaction.status = "current"
                    session.add(transaction)
                    api_logger.info(f"[{correlation_id}] Transaction {transaction.id} status updated from '{old_tx_status}' to 'current' after fine payment")
                    logging_config.log_api_operation(f"Transaction status updated after fine payment - Transaction {transaction.id}", correlation_id=correlation_id)
            except Exception as tx_error:
                api_logger.warning(f"[{correlation_id}] Could not update transaction status for fine {fine_id}: {str(tx_error)}")
            
            session.add(fine)
            session.commit()
            
            # Audit logging for fine payment administrative action
            api_logger.info(f"[{correlation_id}] Fine payment audit - Admin {current_admin.name} processed payment of ₹{fine.fine_amount} for user {fine.user_name} (Book: '{fine.book_title}')")
            api_logger.info(f"[{correlation_id}] Fine {fine_id} successfully marked as paid via {payment_data.payment_method}")
            
        except Exception as update_error:
            logging_config.log_error(api_logger, f"Error updating fine {fine_id}: {str(update_error)}", correlation_id=correlation_id)
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update fine payment status"
            )
        
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Fine payment operation", total_duration, correlation_id)
        
        return {
            "message": "Fine marked as paid successfully",
            "fine_id": str(fine_id),
            "payment_method": payment_data.payment_method,
            "paid_at": fine.paid_at.isoformat(),
            "paid_by_admin": current_admin.name
        }
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error in pay_fine: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Fine payment operation (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing fine payment"
        )

@router.put("/fines/{fine_id}/waive", response_model=Dict[str, str],
           summary="Waive a fine",
           description="Update a fine record to mark it as waived with a required reason")
async def waive_fine(
    fine_id: int,waive_data: WaiveFineRequest,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Waive fine (admin only) with comprehensive logging and audit trail"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Log admin fine waiver action with reason
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) processing waiver for fine ID {fine_id}")
    logging_config.log_api_operation(f"Fine waiver processing - Fine ID: {fine_id}, Reason: '{waive_data.reason[:50]}...'", correlation_id=correlation_id)
    
    try:
        if not waive_data.reason or len(waive_data.reason.strip()) < 5:
            api_logger.warning(f"[{correlation_id}] Invalid waiver reason provided: '{waive_data.reason}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid reason with at least 5 characters is required to waive a fine"
            )
            
        # Get fine with error handling and logging
        try:
            fine = session.get(Fine, fine_id)
        except Exception as db_error:
            logging_config.log_error(api_logger, f"Database error when fetching fine {fine_id}: {str(db_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve fine information"
            )
            
        if not fine:
            api_logger.warning(f"[{correlation_id}] Fine with ID {fine_id} not found for waiver")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fine not found"
            )
        
        # Log fine details before processing waiver
        api_logger.info(f"[{correlation_id}] Processing fine waiver - User: {fine.user_name}, Book: '{fine.book_title}', Amount: ₹{fine.fine_amount}")
        
        if fine.status != "pending":
            api_logger.warning(f"[{correlation_id}] Fine {fine_id} has status '{fine.status}', not 'pending'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fine is not in pending status (current status: {fine.status})"
            )
        
        # Update fine status with detailed logging
        try:
            old_status = fine.status
            fine.status = "waived"
            fine.waived_at = datetime.utcnow()
            fine.waived_by = current_admin.id
            
            # Format notes with timestamp and reason
            waive_reason = waive_data.reason.strip()
            notes = f"Waived on {fine.waived_at.strftime('%Y-%m-%d %H:%M:%S')} by {current_admin.name} ({current_admin.usn})"
            notes += f". Reason: {waive_reason}"
            
            if waive_data.notes:
                notes += f". Additional notes: {waive_data.notes}"
                
            fine.notes = notes
            
            # Log fine status transition with timestamps and responsible party
            api_logger.info(f"[{correlation_id}] Fine status transition - Fine {fine_id}: '{old_status}' -> 'waived' at {fine.waived_at} by {current_admin.name}")
            logging_config.log_api_operation(f"Fine waiver processed - ₹{fine.fine_amount} waived for reason: '{waive_reason[:100]}'", correlation_id=correlation_id)
            
            session.add(fine)
            session.commit()
            
            # Audit logging for fine waiver administrative action
            api_logger.info(f"[{correlation_id}] Fine waiver audit - Admin {current_admin.name} waived ₹{fine.fine_amount} for user {fine.user_name} (Book: '{fine.book_title}')")
            api_logger.info(f"[{correlation_id}] Waiver reason: {waive_reason}")
            api_logger.info(f"[{correlation_id}] Fine {fine_id} successfully waived")
            
        except Exception as update_error:
            logging_config.log_error(api_logger, f"Error waiving fine {fine_id}: {str(update_error)}", correlation_id=correlation_id)
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update fine waive status"
            )
        
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "Fine waiver operation", total_duration, correlation_id)
        
        return {
            "message": "Fine waived successfully",
            "fine_id": str(fine_id),
            "waived_at": fine.waived_at.isoformat(),
            "waived_by_admin": current_admin.name,
            "reason": waive_reason
        }
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error in waive_fine: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Fine waiver operation (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing fine waiver"
        )

@router.get("/user/{user_id}/fines", response_model=Dict[str, List[FineResponse]],
            summary="Get user fines",
            description="Returns a list of all fines for a specific user")
async def get_user_fines(
    user_id: int,
    status_filter: Optional[str] = Query(None, description="Filter fines by status"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all fines for a specific user with permission checks and comprehensive logging"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Log user fine access attempt
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) requesting fines for user {user_id}")
    logging_config.log_api_operation(f"User fines access - Target user: {user_id}, Status filter: {status_filter}", correlation_id=correlation_id)
    
    try:
        # Permission check - admin or self only with detailed logging
        if not current_user.is_admin and current_user.id != user_id:
            api_logger.warning(f"[{correlation_id}] Access denied - User {current_user.id} attempted to access fines for user {user_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own fines"
            )
        
        if current_user.is_admin:
            logging_config.log_api_operation(f"Admin access granted for user {user_id} fines", correlation_id=correlation_id)
        else:
            logging_config.log_api_operation(f"Self-access granted - user viewing own fines", correlation_id=correlation_id)
            
        # Verify user exists
        try:
            user = session.get(User, user_id)
            if not user:
                api_logger.warning(f"[{correlation_id}] Target user {user_id} not found")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            logging_config.log_api_operation(f"Target user verified - {user.name} (USN: {user.usn})", correlation_id=correlation_id)
        except Exception as db_error:
            logging_config.log_error(api_logger, f"Database error when fetching user {user_id}: {str(db_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to verify user information"
            )
            
        # Build query with logging
        logging_config.log_api_operation(f"Building user fines query for user {user_id}", correlation_id=correlation_id)
        query = select(Fine).where(Fine.user_id == user_id)
        
        # Apply status filter if provided
        if status_filter and status_filter != "all":
            valid_statuses = ["pending", "paid", "waived"]
            if status_filter.lower() not in valid_statuses:
                api_logger.warning(f"[{correlation_id}] Invalid status filter provided: {status_filter}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter. Must be one of: {', '.join(valid_statuses)}"
                )
            query = query.where(Fine.status == status_filter.lower())
            logging_config.log_api_operation(f"Applied status filter: {status_filter.lower()}", correlation_id=correlation_id)
            
        # Execute query with performance logging
        try:
            query_start = time.time()
            fines = session.exec(query.order_by(Fine.created_at.desc())).all()
            query_duration = time.time() - query_start
            logging_config.log_performance(api_logger, f"User {user_id} fines query", query_duration, correlation_id)
            api_logger.info(f"[{correlation_id}] Retrieved {len(fines)} fines for user {user.name}")
        except Exception as db_error:
            logging_config.log_error(api_logger, f"Database error when fetching fines for user {user_id}: {str(db_error)}", correlation_id=correlation_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve user fines from database"
            )
            
        # Process results with defensive coding
        result = []
        for fine in fines:
            try:
                result.append({
                    "id": fine.id,
                    "user_id": fine.user_id,
                    "user_name": fine.user_name or user.name or "Unknown",
                    "user_usn": fine.user_usn or user.usn or "Unknown",
                    "book_history_id": fine.book_history_id,
                    "book_title": fine.book_title or "Unknown Title",
                    "book_author": fine.book_author or "Unknown Author",
                    "book_isbn": fine.book_isbn or "N/A",
                    "days_overdue": fine.days_overdue or 0,
                    "fine_amount": fine.fine_amount or 0.0,
                    "fine_per_day": fine.fine_per_day or 0.0,
                    "issued_date": fine.issued_date,
                    "due_date": fine.due_date,
                    "return_date": fine.return_date,
                    "status": fine.status or "unknown",
                    "created_at": fine.created_at,
                    "paid_at": fine.paid_at,
                    "waived_at": fine.waived_at,
                    "waived_by": fine.waived_by,
                    "notes": fine.notes
                })
            except Exception as item_error:
                logging_config.log_error(api_logger, f"Error processing fine {fine.id}: {str(item_error)}", correlation_id=correlation_id)
                continue
        
        total_duration = time.time() - start_time
        api_logger.info(f"[{correlation_id}] User fines access completed - {len(result)} fines for user {user.name}")
        logging_config.log_performance(api_logger, "Get user fines endpoint", total_duration, correlation_id)
                
        return {"user_fines": result}
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error in get_user_fines: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Get user fines endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving user fines"
        )

@router.get("/summary", response_model=Dict[str, Any],
           summary="Get overdue summary statistics",
           description="Returns summary statistics for overdue books excluding books with paid fines")
async def get_overdue_summary(
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Get overdue summary statistics with comprehensive logging and data validation"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Log admin access to summary statistics
    api_logger.info(f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) requesting overdue summary statistics")
    logging_config.log_api_operation("Overdue summary statistics generation started", correlation_id=correlation_id)
    
    try:
        current_time = datetime.utcnow()
        logging_config.log_api_operation(f"Summary calculation timestamp: {current_time}", correlation_id=correlation_id)
        
        # Get all overdue transactions excluding those with paid fines with performance logging
        summary_start = time.time()
        logging_config.log_api_operation("Calculating overdue transactions excluding paid fines", correlation_id=correlation_id)
        
        overdue_query = select(Transaction).where(
            Transaction.status.in_(["current", "overdue"]),
            Transaction.due_date < current_time
        ).outerjoin(Fine, Transaction.id == Fine.book_history_id).where(
            (Fine.id.is_(None)) | (Fine.status != "paid")
        )
        
        overdue_transactions = session.exec(overdue_query).all()
        overdue_count = len(overdue_transactions)
        
        # Count excluded transactions with paid fines for data validation logging
        paid_fines_query = select(Transaction).where(
            Transaction.status.in_(["current", "overdue"]),
            Transaction.due_date < current_time
        ).join(Fine, Transaction.id == Fine.book_history_id).where(
            Fine.status == "paid"
        )
        excluded_count = len(session.exec(paid_fines_query).all())
        
        # Log data validation and business logic
        api_logger.info(f"[{correlation_id}] Overdue summary calculation: {overdue_count} books overdue, {excluded_count} excluded due to paid fines")
        logging_config.log_api_operation(f"Data validation - Total overdue before exclusion: {overdue_count + excluded_count}, After exclusion: {overdue_count}", correlation_id=correlation_id)
        
        # Calculate total pending fine amount with algorithm logging
        logging_config.log_api_operation(f"Calculating pending fines using rate: ₹{FINE_PER_DAY} per day", correlation_id=correlation_id)
        total_pending_fines = 0.0
        for transaction in overdue_transactions:
            days_overdue = max(0, (current_time - transaction.due_date).days)
            fine_amount = days_overdue * FINE_PER_DAY
            total_pending_fines += fine_amount
        
        logging_config.log_api_operation(f"Total pending fine amount calculated: ₹{total_pending_fines}", correlation_id=correlation_id)
        
        # Get fine statistics with detailed logging
        logging_config.log_api_operation("Calculating fine statistics breakdown", correlation_id=correlation_id)
        stats_queries_start = time.time()
        
        total_fines = len(session.exec(select(Fine)).all())
        pending_fines = len(session.exec(select(Fine).where(Fine.status == "pending")).all())
        paid_fines = len(session.exec(select(Fine).where(Fine.status == "paid")).all())
        waived_fines = len(session.exec(select(Fine).where(Fine.status == "waived")).all())
        
        stats_queries_duration = time.time() - stats_queries_start
        logging_config.log_performance(api_logger, "Fine statistics queries", stats_queries_duration, correlation_id)
        
        # Data validation logging
        calculated_total = pending_fines + paid_fines + waived_fines
        if calculated_total != total_fines:
            api_logger.warning(f"[{correlation_id}] Data validation warning - Fine counts mismatch: calculated {calculated_total} vs actual {total_fines}")
        else:
            logging_config.log_api_operation(f"Data validation passed - Fine counts match: {total_fines} total", correlation_id=correlation_id)
        
        # Log detailed statistics
        api_logger.info(f"[{correlation_id}] Fine statistics - Total: {total_fines}, Pending: {pending_fines}, Paid: {paid_fines}, Waived: {waived_fines}")
        
        summary_duration = time.time() - summary_start
        total_duration = time.time() - start_time
        
        # Log summary generation completion
        logging_config.log_performance(api_logger, "Overdue summary calculation", summary_duration, correlation_id)
        logging_config.log_performance(api_logger, "Get overdue summary endpoint", total_duration, correlation_id)
        
        api_logger.info(f"[{correlation_id}] Overdue summary completed - {overdue_count} overdue books, ₹{total_pending_fines} pending fines")
        
        return {
            "total_overdue_books": overdue_count,
            "excluded_books_with_paid_fines": excluded_count,
            "total_pending_fine_amount": total_pending_fines,
            "fine_statistics": {
                "total_fines": total_fines,
                "pending_fines": pending_fines,
                "paid_fines": paid_fines,
                "waived_fines": waived_fines
            },
            "generated_at": current_time.isoformat()
        }
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error in get_overdue_summary: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Get overdue summary endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating overdue summary"
        )