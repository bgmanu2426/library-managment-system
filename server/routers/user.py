from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from database import get_session
from models import User, Book, Transaction, LoginResponse, Rack, Shelf
from auth import get_current_user, authenticate_user, create_access_token

router = APIRouter()

# Pydantic models for request/response
class UserProfileResponse(BaseModel):
    id: int
    name: str
    usn: str
    email: str
    mobile: str
    address: str
    role: str
    created_at: datetime

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None

class BookResponse(BaseModel):
    id: int
    isbn: str
    title: str
    author: str
    genre: str
    created_at: datetime

class BookHistoryResponse(BaseModel):
    id: int
    book_id: int
    user_id: int
    book_title: str
    book_author: str
    book_isbn: str
    issued_date: datetime
    due_date: datetime
    return_date: Optional[datetime] = None
    status: str
    days_overdue: Optional[int] = None
    fine_amount: Optional[float] = None
    created_at: datetime

class CategoryStatistics(BaseModel):
    total: int
    available: int
    issued: int

class CategoryBooksResponse(BaseModel):
    category: str
    rack_id: int
    statistics: CategoryStatistics
    books: List[Dict[str, Any]]

@router.post("/login", response_model=LoginResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    """User login endpoint that works for both regular users and admins"""
    try:
        user = await authenticate_user(form_data.username, form_data.password, session)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token = create_access_token(data={"sub": user.id})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication system error",
            headers={"WWW-Authenticate": "Bearer"},
        )

# User profile endpoints
@router.get("/profile", response_model=UserProfileResponse)
async def get_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return current_user

@router.put("/profile")
async def update_user_profile(
    profile_update: UserProfileUpdate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update user profile"""
    try:
        user = session.get(User, current_user.id)
        
        if profile_update.name is not None:
            user.name = profile_update.name
        if profile_update.mobile is not None:
            user.mobile = profile_update.mobile
        if profile_update.address is not None:
            user.address = profile_update.address
        
        session.add(user)
        session.commit()
        session.refresh(user)
        
        return {
            "message": "Profile updated successfully",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "mobile": user.mobile,
                "address": user.address
            }
        }
        
    except Exception:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )

# Book browsing endpoints
@router.get("/books")
async def get_available_books(
    skip: int = 0, 
    limit: int = 10,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all available books with pagination"""
    try:
        query = select(Book).where(Book.is_available).offset(skip).limit(limit)
        books = session.exec(query).all()
        
        total_count = session.exec(select(Book).where(Book.is_available)).all()
        
        return {
            "books": [
                {
                    "id": book.id,
                    "isbn": book.isbn,
                    "title": book.title,
                    "author": book.author,
                    "genre": book.genre,
                    "created_at": book.created_at
                }
                for book in books
            ],
            "total": len(total_count),
            "skip": skip,
            "limit": limit
        }
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch available books"
        )

@router.get("/books/search")
async def search_books(
    query_text: str,
    skip: int = 0, 
    limit: int = 10,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Search books by title, author, or genre"""
    try:
        if not query_text.strip():
            return {"books": [], "total": 0, "skip": skip, "limit": limit}
        
        search_query = select(Book).where(
            (Book.title.contains(query_text)) |
            (Book.author.contains(query_text)) |
            (Book.genre.contains(query_text)) |
            (Book.isbn.contains(query_text))
        ).offset(skip).limit(limit)
        
        books = session.exec(search_query).all()
        
        total_count = session.exec(select(Book).where(
            (Book.title.contains(query_text)) |
            (Book.author.contains(query_text)) |
            (Book.genre.contains(query_text)) |
            (Book.isbn.contains(query_text))
        )).all()
        
        return {
            "books": [
                {
                    "id": book.id,
                    "isbn": book.isbn,
                    "title": book.title,
                    "author": book.author,
                    "genre": book.genre,
                    "is_available": book.is_available,
                    "created_at": book.created_at
                }
                for book in books
            ],
            "total": len(total_count),
            "skip": skip,
            "limit": limit
        }
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search books"
        )

@router.get("/books/by-category")
async def get_books_by_category(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get books grouped by rack categories with statistics"""
    try:
        racks = session.exec(select(Rack)).all()
        if not racks:
            return {"categories": []}
            
        result = []
        
        for rack in racks:
            rack_books = session.exec(select(Book).where(Book.rack_id == rack.id)).all()
            
            total_books = len(rack_books)
            available_books = sum(1 for book in rack_books if book.is_available)
            issued_books = total_books - available_books
            
            books_data = [
                {
                    "id": book.id,
                    "isbn": book.isbn,
                    "title": book.title,
                    "author": book.author,
                    "genre": book.genre,
                    "rack_id": book.rack_id,
                    "shelf_id": book.shelf_id,
                    "is_available": book.is_available,
                    "created_at": book.created_at
                }
                for book in rack_books
            ]
            
            category_entry = {
                "category": rack.name,
                "rack_id": rack.id,
                "description": rack.description,
                "statistics": {
                    "total": total_books,
                    "available": available_books,
                    "issued": issued_books
                },
                "books": books_data
            }
            
            result.append(category_entry)
        
        return {"categories": result}
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch books by category"
        )

# Book history endpoints
@router.get("/history")
async def get_book_history(
    skip: int = 0, 
    limit: int = 10,
    status_filter: Optional[str] = Query(None, regex="^(current|returned|overdue|all)$"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get user's book borrowing history with optional status filter"""
    try:
        query = select(Transaction).where(Transaction.user_id == current_user.id)
        
        if status_filter and status_filter != "all":
            query = query.where(Transaction.status == status_filter)
        
        query = query.order_by(Transaction.issued_date.desc()).offset(skip).limit(limit)
        history = session.exec(query).all()
        
        total_query = select(Transaction).where(Transaction.user_id == current_user.id)
        if status_filter and status_filter != "all":
            total_query = total_query.where(Transaction.status == status_filter)
        
        total_count = session.exec(total_query).all()
        
        return {
            "history": [
                {
                    "id": item.id,
                    "book_id": item.book_id,
                    "book_title": item.book_title,
                    "book_author": item.book_author,
                    "book_isbn": item.book_isbn,
                    "issued_date": item.issued_date,
                    "due_date": item.due_date,
                    "return_date": item.return_date,
                    "status": item.status,
                    "days_overdue": item.days_overdue,
                    "fine_amount": item.fine_amount,
                    "created_at": item.created_at
                }
                for item in history
            ],
            "total": len(total_count),
            "skip": skip,
            "limit": limit
        }
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch book history"
        )

@router.get("/current-books")
async def get_current_books(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get currently borrowed books by the user"""
    try:
        query = select(Book).where(Book.issued_to == current_user.id)
        current_books = session.exec(query).all()
        
        result = []
        for book in current_books:
            transaction = session.exec(
                select(Transaction)
                .where(Transaction.book_id == book.id, 
                       Transaction.user_id == current_user.id,
                       Transaction.status.in_(["current", "overdue"]))
                .order_by(Transaction.issued_date.desc())
            ).first()
            
            book_data = {
                "id": book.id,
                "isbn": book.isbn,
                "title": book.title,
                "author": book.author,
                "genre": book.genre,
                "issued_date": book.issued_date,
                "due_date": book.return_date
            }
            
            if transaction:
                book_data.update({
                    "transaction_id": transaction.id,
                    "status": transaction.status,
                    "days_overdue": transaction.days_overdue,
                    "fine_amount": transaction.fine_amount
                })
            
            result.append(book_data)
        
        return {"books": result}
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch current books"
        )

@router.get("/dashboard/stats")
async def get_user_dashboard_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get user dashboard statistics including borrowed books count, available books, and recent activity"""
    try:
        current_books_query = select(Transaction).where(
            Transaction.user_id == current_user.id,
            Transaction.status.in_(["current", "overdue"])
        )
        current_transactions = session.exec(current_books_query).all()
        borrowed_books_count = len(current_transactions)
        
        overdue_transactions = [t for t in current_transactions if t.status == "overdue"]
        overdue_books_count = len(overdue_transactions)
        
        total_fine = sum(t.fine_amount or 0 for t in overdue_transactions)
        
        available_books_count = session.exec(select(Book).where(Book.is_available)).all()
        total_available_books = len(available_books_count)
        
        recent_activity_query = select(Transaction).where(
            Transaction.user_id == current_user.id
        ).order_by(Transaction.created_at.desc()).limit(10)
        recent_transactions = session.exec(recent_activity_query).all()
        
        recent_activity = [
            {
                "id": transaction.id,
                "book_title": transaction.book_title,
                "book_author": transaction.book_author,
                "action": "borrowed" if transaction.status in ["current", "overdue"] else "returned",
                "date": transaction.issued_date if transaction.status in ["current", "overdue"] else transaction.return_date,
                "status": transaction.status,
                "days_overdue": transaction.days_overdue,
                "fine_amount": transaction.fine_amount
            }
            for transaction in recent_transactions
        ]
        
        overdue_books = []
        for transaction in overdue_transactions:
            book = session.get(Book, transaction.book_id)
            if book:
                overdue_books.append({
                    "id": book.id,
                    "title": transaction.book_title,
                    "author": transaction.book_author,
                    "isbn": transaction.book_isbn,
                    "due_date": transaction.due_date,
                    "days_overdue": transaction.days_overdue,
                    "fine_amount": transaction.fine_amount
                })
        
        stats = {
            "borrowed_books_count": borrowed_books_count,
            "available_books_count": total_available_books,
            "overdue_books_count": overdue_books_count,
            "total_fine_amount": total_fine,
            "recent_activity": recent_activity,
            "overdue_books": overdue_books,
            "user_info": {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email
            }
        }
        
        return stats
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dashboard statistics"
        )

@router.get("/racks")
async def get_user_racks(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Get all racks with their shelves (user-accessible version)"""
    try:
        racks = session.exec(select(Rack)).all()
        
        result = []
        for rack in racks:
            shelves = session.exec(select(Shelf).where(Shelf.rack_id == rack.id)).all()
            result.append({
                "id": rack.id,
                "name": rack.name,
                "description": rack.description,
                "created_at": rack.created_at,
                "shelves": [
                    {
                        "id": shelf.id,
                        "name": shelf.name,
                        "capacity": shelf.capacity,
                        "current_books": shelf.current_books,
                        "created_at": shelf.created_at
                    }
                    for shelf in shelves
                ]
            })
        
        return {"racks": result, "total": len(result)}
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch racks data"
        )

@router.get("/shelves")
async def get_user_shelves(
    rack_id: Optional[int] = None,
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    """Get all shelves with optional rack_id filter (user-accessible version)"""
    try:
        query = select(Shelf)
        
        if rack_id is not None:
            query = query.where(Shelf.rack_id == rack_id)
        
        shelves = session.exec(query).all()
        
        result = []
        for shelf in shelves:
            result.append({
                "id": shelf.id,
                "name": shelf.name,
                "rack_id": shelf.rack_id,
                "capacity": shelf.capacity,
                "current_books": shelf.current_books,
                "created_at": shelf.created_at
            })
        
        return {"shelves": result, "total": len(result)}
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch shelves data"
        )