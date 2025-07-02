from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
import logging

# Configure logger for admin router
logger = logging.getLogger("admin_router")

from database import get_session
from models import User, Book, Rack, Shelf, Transaction, Fine
from auth import get_current_admin, hash_password, get_current_user
from pydantic import BaseModel

# Create router
router = APIRouter()

# Pydantic models for request/response
class RecentActivityResponse(BaseModel):
    recent_activities: List[dict]

class UserCountResponse(BaseModel):
    total: int

class UserCreate(BaseModel):
    name: str
    usn: str
    email: str
    mobile: str
    address: str
    role: str = "user"
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    usn: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    role: Optional[str] = None

class BookCreate(BaseModel):
    isbn: str
    title: str
    author: str
    genre: str
    rack_id: int
    shelf_id: int

class BookUpdate(BaseModel):
    isbn: Optional[str] = None
    title: Optional[str] = None
    author: Optional[str] = None
    genre: Optional[str] = None
    rack_id: Optional[int] = None
    shelf_id: Optional[int] = None

class RackCreate(BaseModel):
    name: str
    description: str

class RackUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ShelfCreate(BaseModel):
    name: str
    rack_id: int
    capacity: int

class ShelfUpdate(BaseModel):
    name: Optional[str] = None
    rack_id: Optional[int] = None
    capacity: Optional[int] = None

class IssueBookRequest(BaseModel):
    book_id: int
    user_id: int
    due_date: datetime

class ReturnBookRequest(BaseModel):
    book_id: int
    user_id: int
    condition: Optional[str] = "good"
    notes: Optional[str] = None

@router.get("/recent-activity", response_model=RecentActivityResponse)
async def get_recent_activity(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Get recent activity including book issues, returns and user registrations"""
    logger.debug("Fetching recent activity for admin dashboard")
    
    try:
        # Get last 10 transactions
        transactions = session.exec(
            select(Transaction)
            .order_by(Transaction.created_at.desc())
            .limit(10)
        ).all()
        
        activities = []
        for transaction in transactions:
            # Get user details
            user = session.get(User, transaction.user_id)
            user_name = user.name if user else "Unknown User"
            
            # Map transaction status to activity type
            activity_type = "issue"
            if transaction.status == "returned":
                activity_type = "return"
            elif transaction.status == "overdue":
                activity_type = "overdue"
            
            # Format activity details
            if activity_type == "issue":
                details = f"{user_name} borrowed '{transaction.book_title}' by {transaction.book_author}"
            elif activity_type == "return":
                details = f"{user_name} returned '{transaction.book_title}' by {transaction.book_author}"
            else:  # overdue
                details = f"{user_name} has overdue book '{transaction.book_title}' by {transaction.book_author}"
            
            activities.append({
                "id": transaction.id,
                "type": activity_type,
                "details": details,
                "timestamp": transaction.created_at
            })
        
        logger.info(f"Retrieved {len(activities)} recent activities")
        return {"recent_activities": activities}
        
    except Exception as e:
        logger.error(f"Error fetching recent activity: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch recent activity data"
        )

@router.get("/users/count", response_model=UserCountResponse)
async def get_user_count(session: Session = Depends(get_session), current_admin: User = Depends(get_current_admin)):
    """Get total count of all users in the database"""
    logger.debug("Fetching user count for admin dashboard")
    
    try:
        # Count all users
        total_users = len(session.exec(select(User)).all())
        
        logger.info(f"Total user count: {total_users}")
        return {"total": total_users}
        
    except Exception as e:
        logger.error(f"Error fetching user count: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user count data"
        )

@router.get("/dashboard/stats")
async def get_dashboard_stats(session: Session = Depends(get_session), current_admin: User = Depends(get_current_admin)):
    """Get dashboard statistics including total books, users, overdue books, and available books counts"""
    logger.debug("Fetching dashboard statistics")
    
    try:
        # Count total books
        total_books = len(session.exec(select(Book)).all())
        
        # Count total users
        total_users = len(session.exec(select(User)).all())
        
        # Count overdue books (books that are issued and past due date)
        current_time = datetime.utcnow()
        overdue_books = len(session.exec(
            select(Book).where(
                Book.is_available == False,
                Book.return_date < current_time
            )
        ).all())
        
        # Count available books
        available_books = len(session.exec(select(Book).where(Book.is_available == True)).all())
        
        stats = {
            "totalBooks": total_books,
            "totalUsers": total_users,
            "overdueBooks": overdue_books,
            "availableBooks": available_books
        }
        
        logger.info(f"Dashboard stats retrieved: {stats}")
        return stats
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dashboard statistics"
        )

# User management endpoints
@router.post("/users")
async def create_user(user_data: UserCreate, session: Session = Depends(get_session), current_admin: User = Depends(get_current_admin)):
    """Create a new user"""
    # Check if user already exists
    existing_user = session.exec(select(User).where(User.email == user_data.email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    existing_usn = session.exec(select(User).where(User.usn == user_data.usn)).first()
    if existing_usn:
        raise HTTPException(status_code=400, detail="User with this USN already exists")
    
    # Create new user
    hashed_password = hash_password(user_data.password)
    new_user = User(
        name=user_data.name,
        usn=user_data.usn,
        email=user_data.email,
        mobile=user_data.mobile,
        address=user_data.address,
        role=user_data.role,
        hashed_password=hashed_password
    )
    
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    return {"message": "User created successfully", "user_id": new_user.id}

@router.get("/users")
async def get_users(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    role_filter: Optional[str] = None,
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Get all users with optional filtering and pagination"""
    logger.debug(f"Fetching users with pagination (skip={skip}, limit={limit}), search='{search}', role_filter='{role_filter}'")
    
    try:
        # Build base query for filtering
        base_query = select(User)
        
        if search:
            base_query = base_query.where(
                (User.name.contains(search)) |
                (User.email.contains(search)) |
                (User.usn.contains(search))
            )
        
        if role_filter and role_filter != "all":
            base_query = base_query.where(User.role == role_filter)
        
        # Get total count
        total_users = len(session.exec(base_query).all())
        
        # Apply pagination
        paginated_query = base_query.offset(skip).limit(limit)
        users = session.exec(paginated_query).all()
        
        user_list = [
            {
                "id": user.id,
                "name": user.name,
                "usn": user.usn,
                "email": user.email,
                "mobile": user.mobile,
                "address": user.address,
                "role": user.role,
                "created_at": user.created_at
            }
            for user in users
        ]
        
        logger.info(f"Retrieved {len(user_list)} users out of {total_users} total")
        return {"users": user_list, "total": total_users}
        
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch users data"
        )

@router.put("/users/{user_id}")
async def update_user(
    user_id: int, 
    user_data: UserUpdate, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Update a user"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields if provided
    if user_data.name is not None:
        user.name = user_data.name
    if user_data.usn is not None:
        user.usn = user_data.usn
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.mobile is not None:
        user.mobile = user_data.mobile
    if user_data.address is not None:
        user.address = user_data.address
    if user_data.role is not None:
        user.role = user_data.role
    
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return {"message": "User updated successfully"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Delete a user"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has active books
    active_books = session.exec(select(Book).where(Book.issued_to == user_id)).all()
    if active_books:
        raise HTTPException(status_code=400, detail="Cannot delete user with active book loans")
    
    session.delete(user)
    session.commit()
    
    return {"message": "User deleted successfully"}

# Book management endpoints
@router.post("/books")
async def create_book(
    book_data: BookCreate, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Add a new book"""
    # Check if book with same ISBN exists
    existing_book = session.exec(select(Book).where(Book.isbn == book_data.isbn)).first()
    if existing_book:
        raise HTTPException(status_code=400, detail="Book with this ISBN already exists")
    
    # Check if rack and shelf exist
    rack = session.get(Rack, book_data.rack_id)
    if not rack:
        raise HTTPException(status_code=400, detail="Rack not found")
    
    shelf = session.get(Shelf, book_data.shelf_id)
    if not shelf:
        raise HTTPException(status_code=400, detail="Shelf not found")
    
    # Check shelf capacity
    if shelf.current_books >= shelf.capacity:
        raise HTTPException(status_code=400, detail="Shelf is at full capacity")
    
    # Create new book
    new_book = Book(
        isbn=book_data.isbn,
        title=book_data.title,
        author=book_data.author,
        genre=book_data.genre,
        rack_id=book_data.rack_id,
        shelf_id=book_data.shelf_id
    )
    
    session.add(new_book)
    
    # Update shelf capacity
    shelf.current_books += 1
    session.add(shelf)
    
    session.commit()
    session.refresh(new_book)
    
    return {"message": "Book added successfully", "book_id": new_book.id}

@router.get("/books")
async def get_books(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Get all books with optional filtering and pagination"""
    logger.debug(f"Fetching books with pagination (skip={skip}, limit={limit}), search='{search}', status_filter='{status_filter}'")
    
    try:
        # Build base query for filtering
        base_query = select(Book)
        
        if search:
            base_query = base_query.where(
                (Book.title.contains(search)) |
                (Book.author.contains(search)) |
                (Book.isbn.contains(search))
            )
        
        if status_filter == "available":
            base_query = base_query.where(Book.is_available == True)
        elif status_filter == "issued":
            base_query = base_query.where(Book.is_available == False)
        
        # Get total count
        total_books = len(session.exec(base_query).all())
        
        # Apply pagination
        paginated_query = base_query.offset(skip).limit(limit)
        books = session.exec(paginated_query).all()
        
        book_list = [
            {
                "id": book.id,
                "isbn": book.isbn,
                "title": book.title,
                "author": book.author,
                "genre": book.genre,
                "rack_id": book.rack_id,
                "shelf_id": book.shelf_id,
                "is_available": book.is_available,
                "issued_to": book.issued_to,
                "issued_date": book.issued_date,
                "return_date": book.return_date,
                "created_at": book.created_at
            }
            for book in books
        ]
        
        logger.info(f"Retrieved {len(book_list)} books out of {total_books} total")
        return {"books": book_list, "total": total_books}
        
    except Exception as e:
        logger.error(f"Error fetching books: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch books data"
        )

@router.put("/books/{book_id}")
async def update_book(
    book_id: int, 
    book_data: BookUpdate, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Update a book"""
    book = session.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Update fields if provided
    if book_data.isbn is not None:
        book.isbn = book_data.isbn
    if book_data.title is not None:
        book.title = book_data.title
    if book_data.author is not None:
        book.author = book_data.author
    if book_data.genre is not None:
        book.genre = book_data.genre
    if book_data.rack_id is not None:
        book.rack_id = book_data.rack_id
    if book_data.shelf_id is not None:
        book.shelf_id = book_data.shelf_id
    
    session.add(book)
    session.commit()
    session.refresh(book)
    
    return {"message": "Book updated successfully"}

@router.delete("/books/{book_id}")
async def delete_book(
    book_id: int, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Delete a book"""
    book = session.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if not book.is_available:
        raise HTTPException(status_code=400, detail="Cannot delete book that is currently issued")
    
    # Update shelf capacity
    shelf = session.get(Shelf, book.shelf_id)
    if shelf:
        shelf.current_books -= 1
        session.add(shelf)
    
    session.delete(book)
    session.commit()
    
    return {"message": "Book deleted successfully"}

@router.get("/books/search")
async def search_books(
    query: str,
    skip: int = 0, 
    limit: int = 100,
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Search books by title, author, or ISBN"""
    logger.debug(f"Searching books with query='{query}', pagination (skip={skip}, limit={limit})")
    
    try:
        if not query.strip():
            logger.warning("Empty search query provided")
            return {"books": [], "total": 0}
        
        # Build search query
        search_query = select(Book).where(
            (Book.title.contains(query)) |
            (Book.author.contains(query)) |
            (Book.isbn.contains(query))
        )
        
        # Get total count
        total_books = len(session.exec(search_query).all())
        
        # Apply pagination
        paginated_query = search_query.offset(skip).limit(limit)
        books = session.exec(paginated_query).all()
        
        book_list = [
            {
                "id": book.id,
                "isbn": book.isbn,
                "title": book.title,
                "author": book.author,
                "genre": book.genre,
                "rack_id": book.rack_id,
                "shelf_id": book.shelf_id,
                "is_available": book.is_available,
                "issued_to": book.issued_to,
                "issued_date": book.issued_date,
                "return_date": book.return_date,
                "created_at": book.created_at
            }
            for book in books
        ]
        
        logger.info(f"Found {len(book_list)} books out of {total_books} total for query '{query}'")
        return {"books": book_list, "total": total_books}
        
    except Exception as e:
        logger.error(f"Error searching books with query '{query}': {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search books"
        )

# Rack and shelf management endpoints
@router.get("/racks")
async def get_racks(session: Session = Depends(get_session), current_admin: User = Depends(get_current_admin)):
    """Get all racks with their shelves"""
    logger.debug("Fetching all racks with shelves")
    
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
        
        logger.info(f"Retrieved {len(result)} racks with shelves")
        return {"racks": result, "total": len(result)}
        
    except Exception as e:
        logger.error(f"Error fetching racks: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch racks data"
        )

@router.post("/racks")
async def create_rack(
    rack_data: RackCreate, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Create a new rack"""
    new_rack = Rack(
        name=rack_data.name,
        description=rack_data.description
    )
    
    session.add(new_rack)
    session.commit()
    session.refresh(new_rack)
    
    return {"message": "Rack created successfully", "rack_id": new_rack.id}

@router.put("/racks/{rack_id}")
async def update_rack(
    rack_id: int, 
    rack_data: RackUpdate, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Update a rack"""
    rack = session.get(Rack, rack_id)
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    
    if rack_data.name is not None:
        rack.name = rack_data.name
    if rack_data.description is not None:
        rack.description = rack_data.description
    
    session.add(rack)
    session.commit()
    
    return {"message": "Rack updated successfully"}

@router.delete("/racks/{rack_id}")
async def delete_rack(
    rack_id: int, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Delete a rack"""
    rack = session.get(Rack, rack_id)
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    
    # Check if rack has any books
    books_in_rack = session.exec(select(Book).where(Book.rack_id == rack_id)).all()
    if books_in_rack:
        raise HTTPException(status_code=400, detail="Cannot delete rack with books")
    
    # Delete associated shelves
    shelves = session.exec(select(Shelf).where(Shelf.rack_id == rack_id)).all()
    for shelf in shelves:
        session.delete(shelf)
    
    session.delete(rack)
    session.commit()
    
    return {"message": "Rack deleted successfully"}

@router.post("/shelves")
async def create_shelf(
    shelf_data: ShelfCreate, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Create a new shelf"""
    # Check if rack exists
    rack = session.get(Rack, shelf_data.rack_id)
    if not rack:
        raise HTTPException(status_code=400, detail="Rack not found")
    
    new_shelf = Shelf(
        name=shelf_data.name,
        rack_id=shelf_data.rack_id,
        capacity=shelf_data.capacity
    )
    
    session.add(new_shelf)
    session.commit()
    session.refresh(new_shelf)
    
    return {"message": "Shelf created successfully", "shelf_id": new_shelf.id}

@router.put("/shelves/{shelf_id}")
async def update_shelf(
    shelf_id: int, 
    shelf_data: ShelfUpdate, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Update a shelf"""
    shelf = session.get(Shelf, shelf_id)
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    
    if shelf_data.name is not None:
        shelf.name = shelf_data.name
    if shelf_data.rack_id is not None:
        shelf.rack_id = shelf_data.rack_id
    if shelf_data.capacity is not None:
        if shelf_data.capacity < shelf.current_books:
            raise HTTPException(status_code=400, detail="Cannot reduce capacity below current book count")
        shelf.capacity = shelf_data.capacity
    
    session.add(shelf)
    session.commit()
    
    return {"message": "Shelf updated successfully"}

@router.delete("/shelves/{shelf_id}")
async def delete_shelf(
    shelf_id: int, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Delete a shelf"""
    shelf = session.get(Shelf, shelf_id)
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    
    # Check if shelf has any books
    books_in_shelf = session.exec(select(Book).where(Book.shelf_id == shelf_id)).all()
    if books_in_shelf:
        raise HTTPException(status_code=400, detail="Cannot delete shelf with books")
    
    session.delete(shelf)
    session.commit()
    
    return {"message": "Shelf deleted successfully"}

@router.get("/shelves")
async def get_shelves(
    rack_id: Optional[int] = None,
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Get all shelves with optional rack_id filter"""
    logger.debug(f"Fetching shelves with rack_id filter: {rack_id}")
    
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
        
        logger.info(f"Retrieved {len(result)} shelves with rack_id filter: {rack_id}")
        return {"shelves": result, "total": len(result)}
        
    except Exception as e:
        logger.error(f"Error fetching shelves: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch shelves data"
        )

# Transaction management endpoints
@router.post("/issue-book")
async def issue_book(
    issue_data: IssueBookRequest, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Issue a book to a user"""
    # Check if book exists and is available
    book = session.get(Book, issue_data.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if not book.is_available:
        raise HTTPException(status_code=400, detail="Book is not available")
    
    # Check if user exists
    user = session.get(User, issue_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update book status
    book.is_available = False
    book.issued_to = issue_data.user_id
    book.issued_date = datetime.utcnow()
    book.return_date = issue_data.due_date
    
    # Create transaction record
    transaction = Transaction(
        book_id=book.id,
        user_id=user.id,
        book_title=book.title,
        book_author=book.author,
        book_isbn=book.isbn,
        issued_date=datetime.utcnow(),
        due_date=issue_data.due_date,
        status="current"
    )
    
    session.add(book)
    session.add(transaction)
    session.commit()
    
    return {"message": "Book issued successfully"}

@router.post("/return-book")
async def return_book(
    return_data: ReturnBookRequest, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Return a book from a user"""
    # Check if book exists and is issued
    book = session.get(Book, return_data.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if book.is_available:
        raise HTTPException(status_code=400, detail="Book is not currently issued")
    
    if book.issued_to != return_data.user_id:
        raise HTTPException(status_code=400, detail="Book is not issued to this user")
    
    # Calculate if overdue and fine
    return_date = datetime.utcnow()
    is_overdue = return_date > book.return_date if book.return_date else False
    fine_amount = 0
    days_overdue = 0
    
    if is_overdue and book.return_date:
        days_overdue = (return_date - book.return_date).days
        fine_amount = days_overdue * 5  # 5 rupees per day
    
    # Update book status
    book.is_available = True
    book.issued_to = None
    book.issued_date = None
    book.return_date = None
    
    # Update transaction record
    transaction = session.exec(
        select(Transaction).where(
            Transaction.book_id == book.id,
            Transaction.user_id == return_data.user_id,
            Transaction.status == "current"
        )
    ).first()
    
    if transaction:
        transaction.return_date = return_date
        transaction.status = "overdue" if is_overdue else "returned"
        transaction.days_overdue = days_overdue if is_overdue else None
        transaction.fine_amount = fine_amount if is_overdue else None
        session.add(transaction)
    
    # Create fine record if overdue
    if is_overdue and fine_amount > 0:
        user = session.get(User, return_data.user_id)
        fine = Fine(
            user_id=return_data.user_id,
            user_name=user.name,
            user_usn=user.usn,
            book_history_id=transaction.id,
            book_title=book.title,
            book_author=book.author,
            book_isbn=book.isbn,
            days_overdue=days_overdue,
            fine_amount=fine_amount,
            issued_date=transaction.issued_date,
            due_date=transaction.due_date,
            return_date=return_date
        )
        session.add(fine)
    
    session.add(book)
    session.commit()
    
    response = {"message": "Book returned successfully"}
    if is_overdue:
        response["fine_amount"] = fine_amount
        response["days_overdue"] = days_overdue
    
    return response

@router.get("/transactions")
async def get_transactions(
    skip: int = 0, 
    limit: int = 100,
    status_filter: Optional[str] = None,
    session: Session = Depends(get_session), 
    current_admin: User = Depends(get_current_admin)
):
    """Get all transactions"""
    query = select(Transaction)
    
    if status_filter and status_filter != "all":
        query = query.where(Transaction.status == status_filter)
    
    query = query.offset(skip).limit(limit).order_by(Transaction.created_at.desc())
    transactions = session.exec(query).all()
    
    return [
        {
            "id": transaction.id,
            "book_id": transaction.book_id,
            "user_id": transaction.user_id,
            "book_title": transaction.book_title,
            "book_author": transaction.book_author,
            "book_isbn": transaction.book_isbn,
            "issued_date": transaction.issued_date,
            "due_date": transaction.due_date,
            "return_date": transaction.return_date,
            "status": transaction.status,
            "days_overdue": transaction.days_overdue,
            "fine_amount": transaction.fine_amount,
            "created_at": transaction.created_at
        }
        for transaction in transactions
    ]