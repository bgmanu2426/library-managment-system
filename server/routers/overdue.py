from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from math import ceil
from database import get_session
from models import Transaction, Fine, User
from auth import get_current_admin, get_current_user
from dotenv import load_dotenv
import os

load_dotenv()  # Load environment variables from .env file

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
    payment_method: Optional[str] = Field(
        "cash", description="Method of payment (cash, card, etc.)")
    notes: Optional[str] = Field(
        None, description="Optional notes about the payment")

    @field_validator('payment_method')
    def validate_payment_method(cls, v):
        allowed_methods = ['cash', 'card', 'upi']
        if v and v.lower() not in allowed_methods:
            raise ValueError(
                f"Payment method must be one of {', '.join(allowed_methods)}")
        return v.lower() if v else "cash"


class WaiveFineRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500,
                        description="Reason for waiving the fine")
    notes: Optional[str] = Field(
        None, max_length=1000, description="Additional notes")

    @field_validator('reason')
    def validate_reason(cls, v):
        if not v or not v.strip():
            raise ValueError("Reason cannot be empty")
        return v.strip()


class CalculateFinesPayload(BaseModel):
    fine_per_day: float = Field(..., gt=0, le=1000,
                                description="Fine amount per day")


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
    pagination: PaginationInfo = Field(...,
                                       description="Pagination information")


fine_per_day = float(os.getenv("FINE_PER_DAY", 5.0))  # Default fine per day


@router.get("/books", response_model=Dict[str, List[OverdueBookResponse]],
            summary="Get all overdue books",
            description="Returns a list of all books that are currently overdue")
async def get_overdue_books(
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Get all overdue books"""
    try:
        current_time = datetime.now()

        query = select(Transaction).where(
            Transaction.status.in_(["current", "overdue"]),
            Transaction.due_date < current_time
        ).outerjoin(Fine, Transaction.id == Fine.book_history_id).where(
            (Fine.id.is_(None)) | (Fine.status != "paid")
        )

        try:
            overdue_transactions = session.exec(query).all()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve overdue books from database"
            )

        result = []

        for transaction in overdue_transactions:
            try:
                user = None
                if transaction.user_id:
                    user = session.get(User, transaction.user_id)

                days_overdue = max(
                    0, (current_time - transaction.due_date).days)
                fine_amount = days_overdue * fine_per_day

                has_paid_fine = session.exec(
                    select(Fine).where(
                        Fine.book_history_id == transaction.id,
                        Fine.status == "paid"
                    )
                ).first()

                if not has_paid_fine:
                    transaction.status = "overdue"
                    transaction.days_overdue = days_overdue
                    transaction.fine_amount = fine_amount
                    session.add(transaction)
                else:
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
            except Exception:
                continue

        try:
            session.commit()
        except Exception:
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update overdue books status"
            )

        return {"overdue_books": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while processing overdue books: {str(e)}"
        )


@router.get("/fines", response_model=PaginatedFinesResponse,
            summary="Get all fines",
            description="Returns a list of all fines with optional status filtering and pagination")
async def get_fines(
    status_filter: Optional[str] = Query(
        None, description="Filter fines by status (pending, paid, waived, all)"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=5, le=100, description="Items per page"),
    sort_by: Optional[str] = Query(
        "created_at", description="Field to sort by"),
    sort_order: Optional[str] = Query(
        "desc", description="Sort order (asc, desc)"),
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Get all fines with optional status filter and pagination"""
    try:
        valid_sort_fields = ["created_at",
                             "fine_amount", "days_overdue", "due_date"]
        valid_sort_orders = ["asc", "desc"]

        if sort_by not in valid_sort_fields:
            sort_by = "created_at"
        if sort_order not in valid_sort_orders:
            sort_order = "desc"

        query = select(Fine)

        if status_filter and status_filter != "all":
            valid_statuses = ["pending", "paid", "waived"]
            if status_filter.lower() not in valid_statuses:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter. Must be one of: {', '.join(valid_statuses)}"
                )
            query = query.where(Fine.status == status_filter.lower())

        try:
            total_count = len(session.exec(query).all())
            total_pages = ceil(total_count / per_page)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to count fines"
            )

        sort_column = getattr(Fine, sort_by)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column)

        query = query.offset((page - 1) * per_page).limit(per_page)

        try:
            fines = session.exec(query).all()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve fines from database"
            )

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
            except Exception:
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while processing fines: {str(e)}"
        )


@router.post("/calculate-fines", response_model=Dict[str, Any],
             summary="Calculate fines for overdue books",
             description="Calculates and creates fine records for all overdue books")
async def calculate_fines(
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Calculate and create fine records for all overdue books"""
    try:
        if fine_per_day <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fine per day must be greater than 0"
            )

        current_time = datetime.now()

        try:
            overdue_transactions = session.exec(
                select(Transaction).where(
                    Transaction.status.in_(["overdue", "current"]),
                    Transaction.due_date < current_time
                )
            ).all()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve overdue transactions from database: {str(e)}"
            )

        created_fines = []
        updated_transactions = 0
        skipped_transactions = 0

        for transaction in overdue_transactions:
            try:
                existing_fine = session.exec(
                    select(Fine).where(Fine.book_history_id == transaction.id)
                ).first()

                if existing_fine:
                    skipped_transactions += 1
                    continue

                user = session.get(User, transaction.user_id)
                if not user or user.id is None:
                    skipped_transactions += 1
                    continue

                days_overdue = max(
                    0, (current_time - transaction.due_date).days)
                fine_amount = days_overdue * fine_per_day

                if days_overdue <= 0:
                    skipped_transactions += 1
                    continue

                if transaction.id is None:
                    skipped_transactions += 1
                    continue

                transaction.status = "overdue"
                transaction.days_overdue = days_overdue
                transaction.fine_amount = fine_amount
                session.add(transaction)
                updated_transactions += 1

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

            except Exception:
                continue

        try:
            session.commit()
        except Exception:
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while calculating fines: {str(e)}"
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
    """Mark fine as paid"""
    try:
        try:
            fine = session.get(Fine, fine_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve fine information"
            )

        if not fine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fine not found"
            )

        if fine.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fine is not in pending status (current status: {fine.status})"
            )

        try:
            fine.status = "paid"
            fine.paid_at = datetime.now()

            notes = f"Paid on {fine.paid_at.strftime('%Y-%m-%d %H:%M:%S')} by {current_admin.name} ({current_admin.usn})"
            notes += f" via {payment_data.payment_method}"

            if payment_data.notes:
                notes += f". Notes: {payment_data.notes}"

            fine.notes = notes

            try:
                transaction = session.get(Transaction, fine.book_history_id)
                if transaction and transaction.status == "overdue":
                    transaction.status = "current"
                    session.add(transaction)
            except Exception:
                pass

            session.add(fine)
            session.commit()

        except Exception:
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while processing fine payment - {str(e)}"
        )


@router.put("/fines/{fine_id}/waive", response_model=Dict[str, str],
            summary="Waive a fine",
            description="Update a fine record to mark it as waived with a required reason")
async def waive_fine(
    fine_id: int, waive_data: WaiveFineRequest,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Waive fines"""
    try:
        if not waive_data.reason or len(waive_data.reason.strip()) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid reason with at least 5 characters is required to waive a fine"
            )

        try:
            fine = session.get(Fine, fine_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve fine information"
            )

        if not fine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fine not found"
            )

        if fine.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fine is not in pending status (current status: {fine.status})"
            )

        try:
            fine.status = "waived"
            fine.waived_at = datetime.now()
            fine.waived_by = current_admin.id

            waive_reason = waive_data.reason.strip()
            notes = f"Waived on {fine.waived_at.strftime('%Y-%m-%d %H:%M:%S')} by {current_admin.name} ({current_admin.usn})"
            notes += f". Reason: {waive_reason}"

            if waive_data.notes:
                notes += f". Additional notes: {waive_data.notes}"

            fine.notes = notes

            session.add(fine)
            session.commit()

        except Exception:
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing fine waiver"
        )


@router.get("/user/{user_id}/fines", response_model=Dict[str, List[FineResponse]],
            summary="Get user fines",
            description="Returns a list of all fines for a specific user")
async def get_user_fines(
    user_id: int,
    status_filter: Optional[str] = Query(
        None, description="Filter fines by status"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all fines for a specific user"""
    try:
        try:
            user = session.get(User, user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to verify user information"
            )

        query = select(Fine).where(Fine.user_id == user_id)

        if status_filter and status_filter != "all":
            valid_statuses = ["pending", "paid", "waived"]
            if status_filter.lower() not in valid_statuses:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter. Must be one of: {', '.join(valid_statuses)}"
                )
            query = query.where(Fine.status == status_filter.lower())

        try:
            fines = session.exec(query.order_by(Fine.created_at.desc())).all()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve user fines from database"
            )

        result = []
        for fine in fines:
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

        return {"user_fines": result}
    except Exception:
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
    """Get overdue summary statistics"""
    try:
        current_time = datetime.now()

        overdue_query = select(Transaction).where(
            Transaction.status.in_(["current", "overdue"]),
            Transaction.due_date < current_time
        ).outerjoin(Fine, Transaction.id == Fine.book_history_id).where(
            (Fine.id.is_(None)) | (Fine.status != "paid")
        )

        overdue_transactions = session.exec(overdue_query).all()
        overdue_count = len(overdue_transactions)

        paid_fines_query = select(Transaction).where(
            Transaction.status.in_(["current", "overdue"]),
            Transaction.due_date < current_time
        ).join(Fine, Transaction.id == Fine.book_history_id).where(
            Fine.status == "paid"
        )
        excluded_count = len(session.exec(paid_fines_query).all())

        total_pending_fines = 0.0
        for transaction in overdue_transactions:
            days_overdue = max(0, (current_time - transaction.due_date).days)
            fine_amount = days_overdue * fine_per_day
            total_pending_fines += fine_amount

        total_fines = len(session.exec(select(Fine)).all())
        pending_fines = len(session.exec(
            select(Fine).where(Fine.status == "pending")).all())
        paid_fines = len(session.exec(
            select(Fine).where(Fine.status == "paid")).all())
        waived_fines = len(session.exec(
            select(Fine).where(Fine.status == "waived")).all())

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
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating overdue summary"
        )
