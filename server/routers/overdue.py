from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
from pydantic import BaseModel, Field, validator
from math import ceil

from database import get_session
from models import Book, Transaction, Fine, User
from auth import get_current_admin, get_current_user

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        allowed_methods = ['cash', 'card', 'online', 'upi']
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
    """Get all overdue books with comprehensive error handling"""
    try:
        current_time = datetime.utcnow()
        logger.info(f"Getting overdue books at {current_time}")
        
        # Get all current transactions that are overdue
        query = select(Transaction).where(
            Transaction.status.in_(["current", "overdue"]),
            Transaction.due_date < current_time
        )
        
        try:
            overdue_transactions = session.exec(query).all()
            logger.info(f"Found {len(overdue_transactions)} overdue transactions")
        except Exception as db_error:
            logger.error(f"Database error when fetching overdue transactions: {str(db_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve overdue books from database"
            )
        
        result = []
        for transaction in overdue_transactions:
            try:
                # Get user details with error handling
                user = None
                if transaction.user_id:
                    user = session.get(User, transaction.user_id)
                
                # Calculate days overdue safely
                days_overdue = max(0, (current_time - transaction.due_date).days)
                fine_amount = days_overdue * FINE_PER_DAY
                
                # Update transaction status to overdue
                transaction.status = "overdue"
                transaction.days_overdue = days_overdue
                transaction.fine_amount = fine_amount
                session.add(transaction)
                
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
                logger.error(f"Error processing transaction {transaction.id}: {str(e)}")
                # Continue processing other transactions
                continue
        
        try:
            session.commit()
            logger.info("Successfully updated overdue transactions")
        except Exception as commit_error:
            logger.error(f"Failed to commit transaction updates: {str(commit_error)}")
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update overdue books status"
            )
        
        return {"overdue_books": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_overdue_books: {str(e)}")
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
    """Get all fines with optional status filter and pagination"""
    try:
        logger.info(f"Getting fines with status filter: {status_filter}, page: {page}, per_page: {per_page}")
        
        # Validate sort parameters
        valid_sort_fields = ["created_at", "fine_amount", "days_overdue", "due_date"]
        valid_sort_orders = ["asc", "desc"]
        
        if sort_by not in valid_sort_fields:
            sort_by = "created_at"
        if sort_order not in valid_sort_orders:
            sort_order = "desc"
        
        # Build query
        query = select(Fine)
        
        # Apply status filter if provided and valid
        if status_filter and status_filter != "all":
            valid_statuses = ["pending", "paid", "waived"]
            if status_filter.lower() not in valid_statuses:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter. Must be one of: {', '.join(valid_statuses)}"
                )
            query = query.where(Fine.status == status_filter.lower())
        
        # Get total count for pagination
        try:
            total_count = len(session.exec(query).all())
            total_pages = ceil(total_count / per_page)
        except Exception as count_error:
            logger.error(f"Error counting fines: {str(count_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to count fines"
            )
        
        # Apply sorting
        sort_column = getattr(Fine, sort_by)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column)
            
        # Apply pagination
        query = query.offset((page - 1) * per_page).limit(per_page)
        
        # Execute query with error handling
        try:
            fines = session.exec(query).all()
            logger.info(f"Retrieved {len(fines)} fines")
        except Exception as db_error:
            logger.error(f"Database error when fetching fines: {str(db_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve fines from database"
            )
        
        # Process results
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
                logger.error(f"Error processing fine {fine.id}: {str(item_error)}")
                continue
        
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
        logger.error(f"Unexpected error in get_fines: {str(e)}")
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
    """Calculate and create fine records for all overdue books"""
    try:
        fine_per_day = params.fine_per_day
        if fine_per_day <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fine per day must be greater than 0"
            )
            
        logger.info(f"Calculating fines with rate of ₹{fine_per_day} per day")
        current_time = datetime.utcnow()
        
        # Get all overdue transactions without existing fines
        try:
            overdue_transactions = session.exec(
                select(Transaction).where(
                    Transaction.status.in_(["overdue", "current"]),
                    Transaction.due_date < current_time
                )
            ).all()
            logger.info(f"Found {len(overdue_transactions)} potentially overdue transactions")
        except Exception as db_error:
            logger.error(f"Database error when fetching overdue transactions: {str(db_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve overdue transactions from database"
            )
        
        created_fines = []
        updated_transactions = 0
        skipped_transactions = 0
        
        for transaction in overdue_transactions:
            try:
                # Check if fine already exists for this transaction
                existing_fine = session.exec(
                    select(Fine).where(Fine.book_history_id == transaction.id)
                ).first()
                
                if existing_fine:
                    skipped_transactions += 1
                    continue
                
                # Get user details
                user = session.get(User, transaction.user_id)
                if not user:
                    logger.warning(f"User not found for transaction {transaction.id}, skipping")
                    skipped_transactions += 1
                    continue
                
                # Calculate days overdue and fine amount
                days_overdue = max(0, (current_time - transaction.due_date).days)
                fine_amount = days_overoverdue * fine_per_day
                
                if days_overdue <= 0:
                    logger.info(f"Transaction {transaction.id} is not overdue, skipping")
                    skipped_transactions += 1
                    continue
                
                # Update transaction
                transaction.status = "overdue"
                transaction.days_overdue = days_overdue
                transaction.fine_amount = fine_amount
                session.add(transaction)
                updated_transactions += 1
                
                # Create fine record
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
            except Exception as item_error:
                logger.error(f"Error processing transaction {transaction.id}: {str(item_error)}")
                continue
        
        try:
            session.commit()
            logger.info(f"Successfully created {len(created_fines)} fines")
        except Exception as commit_error:
            logger.error(f"Failed to commit fine calculations: {str(commit_error)}")
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save calculated fines"
            )
        
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
        logger.error(f"Unexpected error in calculate_fines: {str(e)}")
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
    """Mark fine as paid with proper validation"""
    try:
        logger.info(f"Processing payment for fine ID {fine_id}")
        
        # Get fine with error handling
        try:
            fine = session.get(Fine, fine_id)
        except Exception as db_error:
            logger.error(f"Database error when fetching fine {fine_id}: {str(db_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve fine information"
            )
            
        if not fine:
            logger.warning(f"Fine with ID {fine_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fine not found"
            )
        
        if fine.status != "pending":
            logger.warning(f"Fine {fine_id} has status '{fine.status}', not 'pending'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fine is not in pending status (current status: {fine.status})"
            )
        
        # Update fine status
        try:
            fine.status = "paid"
            fine.paid_at = datetime.utcnow()
            
            # Format notes with timestamp and admin name
            notes = f"Paid on {fine.paid_at.strftime('%Y-%m-%d %H:%M:%S')} by {current_admin.name} ({current_admin.usn})"
            notes += f" via {payment_data.payment_method}"
            
            if payment_data.notes:
                notes += f". Notes: {payment_data.notes}"
                
            fine.notes = notes
            
            session.add(fine)
            session.commit()
            logger.info(f"Fine {fine_id} successfully marked as paid")
        except Exception as update_error:
            logger.error(f"Error updating fine {fine_id}: {str(update_error)}")
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update fine payment status"
            )
        
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
        logger.error(f"Unexpected error in pay_fine: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing fine payment"
        )

@router.put("/fines/{fine_id}/waive", response_model=Dict[str, str],
           summary="Waive a fine",
           description="Update a fine record to mark it as waived with a required reason")
async def waive_fine(
    fine_id: int,
    waive_data: WaiveFineRequest,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Waive fine (admin only) with enhanced validation"""
    try:
        logger.info(f"Processing waive request for fine ID {fine_id}")
        
        if not waive_data.reason or len(waive_data.reason.strip()) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid reason with at least 5 characters is required to waive a fine"
            )
            
        # Get fine with error handling
        try:
            fine = session.get(Fine, fine_id)
        except Exception as db_error:
            logger.error(f"Database error when fetching fine {fine_id}: {str(db_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve fine information"
            )
            
        if not fine:
            logger.warning(f"Fine with ID {fine_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fine not found"
            )
        
        if fine.status != "pending":
            logger.warning(f"Fine {fine_id} has status '{fine.status}', not 'pending'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fine is not in pending status (current status: {fine.status})"
            )
        
        # Update fine status
        try:
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
            
            session.add(fine)
            session.commit()
            logger.info(f"Fine {fine_id} successfully waived with reason: {waive_reason[:50]}...")
        except Exception as update_error:
            logger.error(f"Error waiving fine {fine_id}: {str(update_error)}")
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update fine waive status"
            )
        
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
        logger.error(f"Unexpected error in waive_fine: {str(e)}")
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
    """Get all fines for a specific user with permission checks"""
    try:
        logger.info(f"Getting fines for user {user_id}")
        
        # Permission check - admin or self only
        if not current_user.is_admin and current_user.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own fines"
            )
            
        # Verify user exists
        try:
            user = session.get(User, user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
        except Exception as db_error:
            logger.error(f"Database error when fetching user {user_id}: {str(db_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to verify user information"
            )
            
        # Build query
        query = select(Fine).where(Fine.user_id == user_id)
        
        # Apply status filter if provided
        if status_filter and status_filter != "all":
            valid_statuses = ["pending", "paid", "waived"]
            if status_filter.lower() not in valid_statuses:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter. Must be one of: {', '.join(valid_statuses)}"
                )
            query = query.where(Fine.status == status_filter.lower())
            
        # Execute query
        try:
            fines = session.exec(query.order_by(Fine.created_at.desc())).all()
            logger.info(f"Retrieved {len(fines)} fines for user {user_id}")
        except Exception as db_error:
            logger.error(f"Database error when fetching fines for user {user_id}: {str(db_error)}")
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
                logger.error(f"Error processing fine {fine.id}: {str(item_error)}")
                continue
                
        return {"user_fines": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_user_fines: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving user fines"
        )