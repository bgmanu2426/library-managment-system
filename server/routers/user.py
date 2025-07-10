from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging_config
import time

from database import get_session
from models import User, Book, Transaction, LoginResponse, Rack, Shelf
from auth import get_current_user, authenticate_user, create_access_token
from pydantic import BaseModel

# Get API logger from logging configuration
api_logger = logging_config.get_logger('api')

# Create router
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    # Sanitize username for logging
    username_safe = form_data.username[:3] + "*" * (len(form_data.username) - 3) if form_data.username else "unknown"
    
    api_logger.info(f"[{correlation_id}] User login attempt for username: {username_safe}")
    logging_config.log_api_operation(f"User login attempt - Username: {username_safe}", correlation_id=correlation_id)
    
    try:
        auth_start = time.time()
        user = await authenticate_user(form_data.username, form_data.password, session)
        auth_duration = time.time() - auth_start
        logging_config.log_performance(api_logger, "User authentication", auth_duration, correlation_id)
        
        if not user:
            api_logger.warning(f"[{correlation_id}] User authentication failed for username: {username_safe}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        token_start = time.time()
        access_token = create_access_token(data={"sub": user.id})
        token_duration = time.time() - token_start
        logging_config.log_performance(api_logger, "Token generation", token_duration, correlation_id)
        
        api_logger.info(f"[{correlation_id}] User login successful for user: {user.email} (ID: {user.id}, Role: {user.role})")
        
        total_duration = time.time() - start_time
        logging_config.log_performance(api_logger, "User login operation", total_duration, correlation_id)
        
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
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Unexpected error during user login: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "User login operation (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication system error",
            headers={"WWW-Authenticate": "Bearer"},
        )

# User profile endpoints
@router.get("/profile", response_model=UserProfileResponse)
async def get_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) accessing profile")
    logging_config.log_api_operation(f"User profile access", correlation_id=correlation_id)
    
    total_duration = time.time() - start_time
    logging_config.log_performance(api_logger, "User profile retrieval", total_duration, correlation_id)
    
    return current_user

@router.put("/profile")
async def update_user_profile(
    profile_update: UserProfileUpdate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update user profile"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) updating profile")
    
    try:
        user = session.get(User, current_user.id)
        
        # Track changes for audit logging
        changes = []
        
        if profile_update.name is not None and profile_update.name != user.name:
            changes.append(f"name: '{user.name}' -> '{profile_update.name}'")
            user.name = profile_update.name
        if profile_update.mobile is not None and profile_update.mobile != user.mobile:
            changes.append(f"mobile: '{user.mobile}' -> '{profile_update.mobile}'")
            user.mobile = profile_update.mobile
        if profile_update.address is not None and profile_update.address != user.address:
            changes.append(f"address: '{user.address}' -> '{profile_update.address}'")
            user.address = profile_update.address
        
        if not changes:
            api_logger.info(f"[{correlation_id}] No changes made to user profile {current_user.id}")
        else:
            logging_config.log_api_operation(f"Profile update changes: {', '.join(changes)}", correlation_id=correlation_id)
        
        session.add(user)
        session.commit()
        session.refresh(user)
        
        total_duration = time.time() - start_time
        
        # Audit log for profile update
        api_logger.info(f"[{correlation_id}] User profile updated successfully - ID: {user.id}, Name: {user.name}")
        if changes:
            api_logger.info(f"[{correlation_id}] User profile audit - User {user.name} (ID: {user.id}) updated: {', '.join(changes)}")
        logging_config.log_performance(api_logger, "User profile update", total_duration, correlation_id)
        
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
        
    except Exception as e:
        session.rollback()
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Error updating user profile: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "User profile update (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) browsing available books")
    logging_config.log_api_operation(f"Book browsing - skip={skip}, limit={limit}", correlation_id=correlation_id)
    
    try:
        query_start = time.time()
        query = select(Book).where(Book.is_available == True).offset(skip).limit(limit)
        books = session.exec(query).all()
        
        total_count = session.exec(select(Book).where(Book.is_available == True)).all()
        query_duration = time.time() - query_start
        logging_config.log_performance(api_logger, "Available books query", query_duration, correlation_id)
        
        total_duration = time.time() - start_time
        api_logger.info(f"[{correlation_id}] User {current_user.name} browsed {len(books)} available books out of {len(total_count)} total")
        logging_config.log_performance(api_logger, "Book browsing endpoint", total_duration, correlation_id)
        
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
        
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Error fetching available books: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Book browsing endpoint (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) searching books")
    logging_config.log_api_operation(f"Book search - query: '{query_text}', skip={skip}, limit={limit}", correlation_id=correlation_id)
    
    try:
        if not query_text.strip():
            api_logger.warning(f"[{correlation_id}] Empty search query provided by user {current_user.id}")
            return {"books": [], "total": 0, "skip": skip, "limit": limit}
        
        query_start = time.time()
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
        
        query_duration = time.time() - query_start
        logging_config.log_performance(api_logger, f"Book search query: '{query_text}'", query_duration, correlation_id)
        
        total_duration = time.time() - start_time
        api_logger.info(f"[{correlation_id}] User {current_user.name} search completed - Found {len(books)} books out of {len(total_count)} total for query '{query_text}'")
        logging_config.log_performance(api_logger, "Book search endpoint", total_duration, correlation_id)
        
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
        
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Error searching books with query '{query_text}': {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Book search endpoint (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) accessing books by category")
    logging_config.log_api_operation("Book category access with statistics", correlation_id=correlation_id)
    
    try:
        query_start = time.time()
        # Get all racks
        racks = session.exec(select(Rack)).all()
        if not racks:
            api_logger.info(f"[{correlation_id}] No racks found for category browsing")
            return {"categories": []}
            
        result = []
        
        # For each rack, get associated books and calculate statistics
        for rack in racks:
            # Get all books for this rack
            rack_books = session.exec(select(Book).where(Book.rack_id == rack.id)).all()
            
            # Calculate statistics
            total_books = len(rack_books)
            available_books = sum(1 for book in rack_books if book.is_available)
            issued_books = total_books - available_books
            
            # Format books with required fields
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
            
            # Create category entry
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
        
        query_duration = time.time() - query_start
        total_duration = time.time() - start_time
        
        # Log category access patterns
        total_books_across_categories = sum(cat["statistics"]["total"] for cat in result)
        api_logger.info(f"[{correlation_id}] User {current_user.name} accessed {len(result)} book categories with {total_books_across_categories} total books")
        logging_config.log_performance(api_logger, "Books by category query", query_duration, correlation_id)
        logging_config.log_performance(api_logger, "Books by category endpoint", total_duration, correlation_id)
        
        return {"categories": result}
        
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Error fetching books by category: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Books by category endpoint (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) accessing book history")
    logging_config.log_api_operation(f"Book history access - status_filter: '{status_filter}', skip={skip}, limit={limit}", correlation_id=correlation_id)
    
    try:
        query_start = time.time()
        query = select(Transaction).where(Transaction.user_id == current_user.id)
        
        if status_filter and status_filter != "all":
            logging_config.log_api_operation(f"Applying status filter: '{status_filter}'", correlation_id=correlation_id)
            query = query.where(Transaction.status == status_filter)
        
        query = query.order_by(Transaction.issued_date.desc()).offset(skip).limit(limit)
        history = session.exec(query).all()
        
        total_query = select(Transaction).where(Transaction.user_id == current_user.id)
        if status_filter and status_filter != "all":
            total_query = total_query.where(Transaction.status == status_filter)
        
        total_count = session.exec(total_query).all()
        
        query_duration = time.time() - query_start
        total_duration = time.time() - start_time
        
        api_logger.info(f"[{correlation_id}] User {current_user.name} retrieved {len(history)} history records out of {len(total_count)} total")
        logging_config.log_performance(api_logger, "Book history query", query_duration, correlation_id)
        logging_config.log_performance(api_logger, "Book history endpoint", total_duration, correlation_id)
        
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
        
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Error fetching book history: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Book history endpoint (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) accessing current books")
    logging_config.log_api_operation("Current books retrieval", correlation_id=correlation_id)
    
    try:
        query_start = time.time()
        query = select(Book).where(Book.issued_to == current_user.id)
        current_books = session.exec(query).all()
        
        # Get transaction details for each book
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
        
        query_duration = time.time() - query_start
        total_duration = time.time() - start_time
        
        api_logger.info(f"[{correlation_id}] User {current_user.name} has {len(result)} currently borrowed books")
        logging_config.log_performance(api_logger, "Current books query", query_duration, correlation_id)
        logging_config.log_performance(api_logger, "Current books endpoint", total_duration, correlation_id)
        
        # Return books array directly instead of nesting under current_books
        return {"books": result}
        
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Error fetching current books: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "Current books endpoint (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) accessing dashboard statistics")
    logging_config.log_api_operation("User dashboard statistics generation", correlation_id=correlation_id)
    
    try:
        stats_start = time.time()
        
        # Get currently borrowed books count
        logging_config.log_api_operation("Calculating current borrowed books count", correlation_id=correlation_id)
        current_books_query = select(Transaction).where(
            Transaction.user_id == current_user.id,
            Transaction.status.in_(["current", "overdue"])
        )
        current_transactions = session.exec(current_books_query).all()
        borrowed_books_count = len(current_transactions)
        
        # Get overdue books count and details
        logging_config.log_api_operation("Calculating overdue books statistics", correlation_id=correlation_id)
        overdue_transactions = [t for t in current_transactions if t.status == "overdue"]
        overdue_books_count = len(overdue_transactions)
        
        # Calculate total fine amount for overdue books
        total_fine = sum(t.fine_amount or 0 for t in overdue_transactions)
        
        # Get total available books in library
        logging_config.log_api_operation("Calculating available books count", correlation_id=correlation_id)
        available_books_count = session.exec(select(Book).where(Book.is_available == True)).all()
        total_available_books = len(available_books_count)
        
        # Get recent activity (last 10 transactions)
        logging_config.log_api_operation("Retrieving recent activity", correlation_id=correlation_id)
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
        
        # Get overdue book details for dashboard warning
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
        
        stats_duration = time.time() - stats_start
        total_duration = time.time() - start_time
        
        api_logger.info(f"[{correlation_id}] Dashboard stats generated for user {current_user.name}: {borrowed_books_count} borrowed, {overdue_books_count} overdue, {total_fine} fine amount")
        logging_config.log_performance(api_logger, "Dashboard statistics calculation", stats_duration, correlation_id)
        logging_config.log_performance(api_logger, "User dashboard stats endpoint", total_duration, correlation_id)
        
        return stats
        
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Error fetching dashboard statistics for user {current_user.id}: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "User dashboard stats endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dashboard statistics"
        )

@router.get("/racks")
async def get_user_racks(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Get all racks with their shelves (user-accessible version)"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) accessing racks inventory")
    logging_config.log_api_operation("User rack inventory access", correlation_id=correlation_id)
    
    try:
        query_start = time.time()
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
        
        query_duration = time.time() - query_start
        total_duration = time.time() - start_time
        
        # Log inventory access patterns
        total_shelves = sum(len(rack["shelves"]) for rack in result)
        api_logger.info(f"[{correlation_id}] User {current_user.name} accessed rack inventory - {len(result)} racks with {total_shelves} shelves")
        logging_config.log_performance(api_logger, "User racks query", query_duration, correlation_id)
        logging_config.log_performance(api_logger, "User racks endpoint", total_duration, correlation_id)
        
        return {"racks": result, "total": len(result)}
        
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Error fetching racks for user: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "User racks endpoint (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()
    
    api_logger.info(f"[{correlation_id}] User {current_user.name} (ID: {current_user.id}) accessing shelves inventory")
    logging_config.log_api_operation(f"User shelf inventory access - rack_id filter: {rack_id}", correlation_id=correlation_id)
    
    try:
        query_start = time.time()
        query = select(Shelf)
        
        if rack_id is not None:
            logging_config.log_api_operation(f"Applying rack_id filter: {rack_id}", correlation_id=correlation_id)
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
        
        query_duration = time.time() - query_start
        total_duration = time.time() - start_time
        
        api_logger.info(f"[{correlation_id}] User {current_user.name} accessed shelf inventory - {len(result)} shelves with rack_id filter: {rack_id}")
        logging_config.log_performance(api_logger, "User shelves query", query_duration, correlation_id)
        logging_config.log_performance(api_logger, "User shelves endpoint", total_duration, correlation_id)
        
        return {"shelves": result, "total": len(result)}
        
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(api_logger, f"Error fetching shelves for user: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(api_logger, "User shelves endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch shelves data"
        )