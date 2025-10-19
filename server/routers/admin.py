from pydantic import BaseModel
from auth import get_current_admin, hash_password, get_current_user
from models import User, Book, Rack, Shelf, Transaction, Fine
from database import get_session
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
import logging_config
import time

# Get API logger from logging configuration
api_logger = logging_config.get_logger('api')


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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    logging_config.log_api_operation(
        f"Fetching recent activity for admin dashboard - User: {current_user.name} (ID: {current_user.id})", correlation_id=correlation_id)

    try:
        # Log database query operation
        logging_config.log_api_operation(
            "Executing recent transactions query", correlation_id=correlation_id)

        # Get last 10 transactions
        transactions = session.exec(
            select(Transaction)
            .order_by(Transaction.created_at.desc())
            .limit(10)
        ).all()

        # Log query performance
        query_duration = time.time() - start_time
        logging_config.log_performance(
            api_logger, "Recent transactions query", query_duration, correlation_id)

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

        total_duration = time.time() - start_time
        api_logger.info(
            f"[{correlation_id}] Retrieved {len(activities)} recent activities for user {current_user.name}")
        logging_config.log_performance(
            api_logger, "Get recent activity endpoint", total_duration, correlation_id)

        return {"recent_activities": activities}

    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Error fetching recent activity: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Get recent activity endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch recent activity data"
        )


@router.get("/users/count", response_model=UserCountResponse)
async def get_user_count(session: Session = Depends(get_session), current_admin: User = Depends(get_current_admin)):
    """Get total count of all users in the database"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log authentication and authorization
    api_logger.info(
        f"[{correlation_id}] Admin user {current_admin.name} (ID: {current_admin.id}) requesting user count")
    logging_config.log_api_operation(
        "Admin authorization verified for user count endpoint", correlation_id=correlation_id)

    try:
        logging_config.log_api_operation(
            "Executing user count query", correlation_id=correlation_id)

        # Count all users
        total_users = len(session.exec(select(User)).all())

        duration = time.time() - start_time
        api_logger.info(
            f"[{correlation_id}] User count retrieved: {total_users} total users")
        logging_config.log_performance(
            api_logger, "User count query", duration, correlation_id)

        return {"total": total_users}

    except Exception as e:
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Error fetching user count: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "User count endpoint (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user count data"
        )


@router.get("/dashboard/stats")
async def get_dashboard_stats(session: Session = Depends(get_session), current_admin: User = Depends(get_current_admin)):
    """Get dashboard statistics including total books, users, overdue books, and available books counts"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin access to dashboard statistics
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) accessing dashboard statistics")
    logging_config.log_api_operation(
        "Dashboard statistics endpoint accessed", correlation_id=correlation_id)

    try:
        stats_start_time = time.time()

        # Count total books
        logging_config.log_api_operation(
            "Calculating total books count", correlation_id=correlation_id)
        total_books = len(session.exec(select(Book)).all())

        # Count total users
        logging_config.log_api_operation(
            "Calculating total users count", correlation_id=correlation_id)
        total_users = len(session.exec(select(User)).all())

        # Count overdue books (books that are issued and past due date)
        logging_config.log_api_operation(
            "Calculating overdue books count", correlation_id=correlation_id)
        current_time = datetime.now()
        overdue_books = len(session.exec(
            select(Book).where(
                Book.is_available == False,
                Book.return_date < current_time
            )
        ).all())

        # Count available books
        logging_config.log_api_operation(
            "Calculating available books count", correlation_id=correlation_id)
        available_books = len(session.exec(
            select(Book).where(Book.is_available == True)).all())

        stats = {
            "totalBooks": total_books,
            "totalUsers": total_users,
            "overdueBooks": overdue_books,
            "availableBooks": available_books
        }

        stats_duration = time.time() - stats_start_time
        total_duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Dashboard stats calculated: {stats}")
        logging_config.log_performance(
            api_logger, "Dashboard statistics calculation", stats_duration, correlation_id)
        logging_config.log_performance(
            api_logger, "Dashboard stats endpoint", total_duration, correlation_id)

        return stats

    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Error fetching dashboard stats: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Dashboard stats endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dashboard statistics"
        )

# User management endpoints


@router.post("/users")
async def create_user(user_data: UserCreate, session: Session = Depends(get_session), current_admin: User = Depends(get_current_admin)):
    """Create a new user"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin user creation attempt with sanitized data
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to create user")
    logging_config.log_api_operation(
        f"User creation attempt - Name: {user_data.name}, USN: {user_data.usn}, Email: {user_data.email}, Role: {user_data.role}", correlation_id=correlation_id)

    try:
        # Check if user already exists
        logging_config.log_api_operation(
            "Validating user uniqueness - checking email", correlation_id=correlation_id)
        existing_user = session.exec(select(User).where(
            User.email == user_data.email)).first()
        if existing_user:
            api_logger.warning(
                f"[{correlation_id}] User creation failed - email already exists: {user_data.email}")
            raise HTTPException(
                status_code=400, detail="User with this email already exists")

        logging_config.log_api_operation(
            "Validating user uniqueness - checking USN", correlation_id=correlation_id)
        existing_usn = session.exec(select(User).where(
            User.usn == user_data.usn)).first()
        if existing_usn:
            api_logger.warning(
                f"[{correlation_id}] User creation failed - USN already exists: {user_data.usn}")
            raise HTTPException(
                status_code=400, detail="User with this USN already exists")

        # Create new user
        logging_config.log_api_operation(
            "Creating new user record", correlation_id=correlation_id)
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

        duration = time.time() - start_time

        # Audit log for user creation
        api_logger.info(
            f"[{correlation_id}] User created successfully - ID: {new_user.id}, Name: {new_user.name}, USN: {new_user.usn}, Role: {new_user.role}")
        api_logger.info(
            f"[{correlation_id}] User management audit - Admin {current_admin.name} created user {new_user.name} (ID: {new_user.id})")
        logging_config.log_performance(
            api_logger, "User creation operation", duration, correlation_id)

        return {"message": "User created successfully", "user_id": new_user.id}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during user creation: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "User creation operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )


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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin access with parameters
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) fetching users list")
    logging_config.log_api_operation(
        f"Users list request - skip={skip}, limit={limit}, search='{search}', role_filter='{role_filter}'", correlation_id=correlation_id)

    try:
        # Build base query for filtering
        logging_config.log_api_operation(
            "Building user query with filters", correlation_id=correlation_id)
        base_query = select(User)

        if search:
            logging_config.log_api_operation(
                f"Applying search filter: '{search}'", correlation_id=correlation_id)
            base_query = base_query.where(
                (User.name.contains(search)) |
                (User.email.contains(search)) |
                (User.usn.contains(search))
            )

        if role_filter and role_filter != "all":
            logging_config.log_api_operation(
                f"Applying role filter: '{role_filter}'", correlation_id=correlation_id)
            base_query = base_query.where(User.role == role_filter)

        # Get total count
        query_start_time = time.time()
        total_users = len(session.exec(base_query).all())

        # Apply pagination
        paginated_query = base_query.offset(skip).limit(limit)
        users = session.exec(paginated_query).all()

        query_duration = time.time() - query_start_time
        logging_config.log_performance(
            api_logger, "Users database query", query_duration, correlation_id)

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

        total_duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Users list retrieved - {len(user_list)} users out of {total_users} total")
        logging_config.log_performance(
            api_logger, "Get users endpoint", total_duration, correlation_id)

        return {"users": user_list, "total": total_users}

    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Error fetching users: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Get users endpoint (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin user update attempt
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to update user ID: {user_id}")

    try:
        user = session.get(User, user_id)
        if not user:
            api_logger.warning(
                f"[{correlation_id}] User update failed - user not found: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")

        # Log original user data for audit
        original_data = {
            "name": user.name,
            "usn": user.usn,
            "email": user.email,
            "mobile": user.mobile,
            "address": user.address,
            "role": user.role
        }

        # Track changes for audit logging
        changes = []

        # Update fields if provided
        if user_data.name is not None and user_data.name != user.name:
            changes.append(f"name: '{user.name}' -> '{user_data.name}'")
            user.name = user_data.name
        if user_data.usn is not None and user_data.usn != user.usn:
            changes.append(f"usn: '{user.usn}' -> '{user_data.usn}'")
            user.usn = user_data.usn
        if user_data.email is not None and user_data.email != user.email:
            changes.append(f"email: '{user.email}' -> '{user_data.email}'")
            user.email = user_data.email
        if user_data.mobile is not None and user_data.mobile != user.mobile:
            changes.append(f"mobile: '{user.mobile}' -> '{user_data.mobile}'")
            user.mobile = user_data.mobile
        if user_data.address is not None and user_data.address != user.address:
            changes.append(
                f"address: '{user.address}' -> '{user_data.address}'")
            user.address = user_data.address
        if user_data.role is not None and user_data.role != user.role:
            changes.append(f"role: '{user.role}' -> '{user_data.role}'")
            user.role = user_data.role

        if not changes:
            api_logger.info(
                f"[{correlation_id}] No changes made to user {user_id} - all fields identical")
        else:
            logging_config.log_api_operation(
                f"User update changes: {', '.join(changes)}", correlation_id=correlation_id)

        session.add(user)
        session.commit()
        session.refresh(user)

        duration = time.time() - start_time

        # Audit log for user update
        api_logger.info(
            f"[{correlation_id}] User updated successfully - ID: {user_id}, Name: {user.name}")
        if changes:
            api_logger.info(
                f"[{correlation_id}] User management audit - Admin {current_admin.name} updated user {user.name} (ID: {user_id}): {', '.join(changes)}")

        logging_config.log_performance(
            api_logger, "User update operation", duration, correlation_id)

        return {"message": "User updated successfully"}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during user update: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "User update operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Delete a user"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin user deletion attempt
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to delete user ID: {user_id}")

    try:
        user = session.get(User, user_id)
        if not user:
            api_logger.warning(
                f"[{correlation_id}] User deletion failed - user not found: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")

        # Log user details before deletion for audit
        user_details = f"Name: {user.name}, USN: {user.usn}, Email: {user.email}, Role: {user.role}"
        logging_config.log_api_operation(
            f"Attempting to delete user - {user_details}", correlation_id=correlation_id)

        # Check if user has active books
        logging_config.log_api_operation(
            "Checking for active book loans", correlation_id=correlation_id)
        active_books = session.exec(
            select(Book).where(Book.issued_to == user_id)).all()
        if active_books:
            active_book_titles = [book.title for book in active_books]
            api_logger.warning(
                f"[{correlation_id}] User deletion blocked - user has active loans: {active_book_titles}")
            raise HTTPException(
                status_code=400, detail="Cannot delete user with active book loans")

        session.delete(user)
        session.commit()

        duration = time.time() - start_time

        # Audit log for user deletion
        api_logger.info(
            f"[{correlation_id}] User deleted successfully - {user_details}")
        api_logger.info(
            f"[{correlation_id}] User management audit - Admin {current_admin.name} deleted user {user.name} (ID: {user.id})")
        logging_config.log_performance(
            api_logger, "User deletion operation", duration, correlation_id)

        return {"message": "User deleted successfully"}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during user deletion: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "User deletion operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )

# Book management endpoints


@router.post("/books")
async def create_book(
    book_data: BookCreate,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Add a new book"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin book creation attempt
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to add book")
    logging_config.log_api_operation(
        f"Book creation attempt - Title: '{book_data.title}', Author: {book_data.author}, ISBN: {book_data.isbn}", correlation_id=correlation_id)

    try:
        # Check if book with same ISBN exists
        logging_config.log_api_operation(
            "Validating book uniqueness - checking ISBN", correlation_id=correlation_id)
        existing_book = session.exec(select(Book).where(
            Book.isbn == book_data.isbn)).first()
        if existing_book:
            api_logger.warning(
                f"[{correlation_id}] Book creation failed - ISBN already exists: {book_data.isbn}")
            raise HTTPException(
                status_code=400, detail="Book with this ISBN already exists")

        # Check if rack and shelf exist
        logging_config.log_api_operation(
            f"Validating rack and shelf - Rack ID: {book_data.rack_id}, Shelf ID: {book_data.shelf_id}", correlation_id=correlation_id)
        rack = session.get(Rack, book_data.rack_id)
        if not rack:
            api_logger.warning(
                f"[{correlation_id}] Book creation failed - rack not found: {book_data.rack_id}")
            raise HTTPException(status_code=400, detail="Rack not found")

        shelf = session.get(Shelf, book_data.shelf_id)
        if not shelf:
            api_logger.warning(
                f"[{correlation_id}] Book creation failed - shelf not found: {book_data.shelf_id}")
            raise HTTPException(status_code=400, detail="Shelf not found")

        # Check shelf capacity
        if shelf.current_books >= shelf.capacity:
            api_logger.warning(
                f"[{correlation_id}] Book creation failed - shelf at capacity: {shelf.current_books}/{shelf.capacity}")
            raise HTTPException(
                status_code=400, detail="Shelf is at full capacity")

        # Create new book
        logging_config.log_api_operation(
            "Creating new book record", correlation_id=correlation_id)
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
        logging_config.log_api_operation(
            f"Updating shelf capacity - {shelf.current_books} -> {shelf.current_books + 1}", correlation_id=correlation_id)
        shelf.current_books += 1
        session.add(shelf)

        session.commit()
        session.refresh(new_book)

        duration = time.time() - start_time

        # Inventory audit log
        api_logger.info(
            f"[{correlation_id}] Book added successfully - ID: {new_book.id}, Title: '{new_book.title}', Author: {new_book.author}")
        api_logger.info(
            f"[{correlation_id}] Inventory management audit - Admin {current_admin.name} added book '{new_book.title}' (ID: {new_book.id}) to Rack {rack.name}/Shelf {shelf.name}")
        logging_config.log_performance(
            api_logger, "Book creation operation", duration, correlation_id)

        return {"message": "Book added successfully", "book_id": new_book.id}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during book creation: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Book creation operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create book"
        )


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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin access with parameters
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) fetching books list")
    logging_config.log_api_operation(
        f"Books list request - skip={skip}, limit={limit}, search='{search}', status_filter='{status_filter}'", correlation_id=correlation_id)

    try:
        # Build base query for filtering
        logging_config.log_api_operation(
            "Building book query with filters", correlation_id=correlation_id)
        base_query = select(Book)

        if search:
            logging_config.log_api_operation(
                f"Applying search filter: '{search}'", correlation_id=correlation_id)
            base_query = base_query.where(
                (Book.title.contains(search)) |
                (Book.author.contains(search)) |
                (Book.isbn.contains(search))
            )

        if status_filter == "available":
            logging_config.log_api_operation(
                "Applying availability filter: available books only", correlation_id=correlation_id)
            base_query = base_query.where(Book.is_available == True)
        elif status_filter == "issued":
            logging_config.log_api_operation(
                "Applying availability filter: issued books only", correlation_id=correlation_id)
            base_query = base_query.where(Book.is_available == False)

        # Get total count
        query_start_time = time.time()
        total_books = len(session.exec(base_query).all())

        # Apply pagination
        paginated_query = base_query.offset(skip).limit(limit)
        books = session.exec(paginated_query).all()

        query_duration = time.time() - query_start_time
        logging_config.log_performance(
            api_logger, "Books database query", query_duration, correlation_id)

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

        total_duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Books list retrieved - {len(book_list)} books out of {total_books} total")
        logging_config.log_performance(
            api_logger, "Get books endpoint", total_duration, correlation_id)

        return {"books": book_list, "total": total_books}

    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Error fetching books: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Get books endpoint (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin book update attempt
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to update book ID: {book_id}")

    try:
        book = session.get(Book, book_id)
        if not book:
            api_logger.warning(
                f"[{correlation_id}] Book update failed - book not found: {book_id}")
            raise HTTPException(status_code=404, detail="Book not found")

        # Track changes for audit logging
        changes = []

        # Update fields if provided
        if book_data.isbn is not None and book_data.isbn != book.isbn:
            changes.append(f"isbn: '{book.isbn}' -> '{book_data.isbn}'")
            book.isbn = book_data.isbn
        if book_data.title is not None and book_data.title != book.title:
            changes.append(f"title: '{book.title}' -> '{book_data.title}'")
            book.title = book_data.title
        if book_data.author is not None and book_data.author != book.author:
            changes.append(f"author: '{book.author}' -> '{book_data.author}'")
            book.author = book_data.author
        if book_data.genre is not None and book_data.genre != book.genre:
            changes.append(f"genre: '{book.genre}' -> '{book_data.genre}'")
            book.genre = book_data.genre
        if book_data.rack_id is not None and book_data.rack_id != book.rack_id:
            changes.append(f"rack_id: {book.rack_id} -> {book_data.rack_id}")
            book.rack_id = book_data.rack_id
        if book_data.shelf_id is not None and book_data.shelf_id != book.shelf_id:
            changes.append(
                f"shelf_id: {book.shelf_id} -> {book_data.shelf_id}")
            book.shelf_id = book_data.shelf_id

        if not changes:
            api_logger.info(
                f"[{correlation_id}] No changes made to book {book_id} - all fields identical")
        else:
            logging_config.log_api_operation(
                f"Book update changes: {', '.join(changes)}", correlation_id=correlation_id)

        session.add(book)
        session.commit()
        session.refresh(book)

        duration = time.time() - start_time

        # Audit log for book update
        api_logger.info(
            f"[{correlation_id}] Book updated successfully - ID: {book_id}, Title: '{book.title}'")
        if changes:
            api_logger.info(
                f"[{correlation_id}] Inventory management audit - Admin {current_admin.name} updated book '{book.title}' (ID: {book.id}): {', '.join(changes)}")

        logging_config.log_performance(
            api_logger, "Book update operation", duration, correlation_id)

        return {"message": "Book updated successfully"}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during book update: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Book update operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update book"
        )


@router.delete("/books/{book_id}")
async def delete_book(
    book_id: int,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Delete a book"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin book deletion attempt
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to delete book ID: {book_id}")

    try:
        book = session.get(Book, book_id)
        if not book:
            api_logger.warning(
                f"[{correlation_id}] Book deletion failed - book not found: {book_id}")
            raise HTTPException(status_code=404, detail="Book not found")

        # Log book details before deletion for audit
        book_details = f"Title: '{book.title}', Author: {book.author}, ISBN: {book.isbn}"
        logging_config.log_api_operation(
            f"Attempting to delete book - {book_details}", correlation_id=correlation_id)

        if not book.is_available:
            api_logger.warning(
                f"[{correlation_id}] Book deletion blocked - book currently issued: {book_details}")
            raise HTTPException(
                status_code=400, detail="Cannot delete book that is currently issued")

        # Update shelf capacity
        shelf = session.get(Shelf, book.shelf_id)
        if shelf:
            logging_config.log_api_operation(
                f"Updating shelf capacity - {shelf.current_books} -> {shelf.current_books - 1}", correlation_id=correlation_id)
            shelf.current_books -= 1
            session.add(shelf)

        session.delete(book)
        session.commit()

        duration = time.time() - start_time

        # Audit log for book deletion
        api_logger.info(
            f"[{correlation_id}] Book deleted successfully - {book_details}")
        api_logger.info(
            f"[{correlation_id}] Inventory management audit - Admin {current_admin.name} deleted book '{book.title}' (ID: {book.id})")
        logging_config.log_performance(
            api_logger, "Book deletion operation", duration, correlation_id)

        return {"message": "Book deleted successfully"}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during book deletion: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Book deletion operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete book"
        )


@router.get("/books/search")
async def search_books(
    query: str,
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Search books by title, author, or ISBN"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin book search
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) performing book search")
    logging_config.log_api_operation(
        f"Book search request - query='{query}', skip={skip}, limit={limit}", correlation_id=correlation_id)

    try:
        if not query.strip():
            api_logger.warning(
                f"[{correlation_id}] Empty search query provided")
            return {"books": [], "total": 0}

        # Build search query
        logging_config.log_api_operation(
            f"Building search query for: '{query}'", correlation_id=correlation_id)
        search_query = select(Book).where(
            (Book.title.contains(query)) |
            (Book.author.contains(query)) |
            (Book.isbn.contains(query))
        )

        # Get total count
        query_start_time = time.time()
        total_books = len(session.exec(search_query).all())

        # Apply pagination
        paginated_query = search_query.offset(skip).limit(limit)
        books = session.exec(paginated_query).all()

        query_duration = time.time() - query_start_time
        logging_config.log_performance(
            api_logger, f"Book search query: '{query}'", query_duration, correlation_id)

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

        total_duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Book search completed - Found {len(book_list)} books out of {total_books} total for query '{query}'")
        logging_config.log_performance(
            api_logger, "Book search endpoint", total_duration, correlation_id)

        return {"books": book_list, "total": total_books}

    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Error searching books with query '{query}': {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Book search endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search books"
        )

# Rack and shelf management endpoints


@router.get("/racks")
async def get_racks(session: Session = Depends(get_session), current_admin: User = Depends(get_current_admin)):
    """Get all racks with their shelves"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin rack access
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) fetching racks with shelves")
    logging_config.log_api_operation(
        "Racks list request with shelves", correlation_id=correlation_id)

    try:
        query_start_time = time.time()
        racks = session.exec(select(Rack)).all()

        result = []
        for rack in racks:
            shelves = session.exec(select(Shelf).where(
                Shelf.rack_id == rack.id)).all()
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

        query_duration = time.time() - query_start_time
        total_duration = time.time() - start_time

        # Log rack statistics
        total_shelves = sum(len(rack["shelves"]) for rack in result)
        api_logger.info(
            f"[{correlation_id}] Racks retrieved - {len(result)} racks with {total_shelves} total shelves")
        logging_config.log_performance(
            api_logger, "Racks database query", query_duration, correlation_id)
        logging_config.log_performance(
            api_logger, "Get racks endpoint", total_duration, correlation_id)

        return {"racks": result, "total": len(result)}

    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Error fetching racks: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Get racks endpoint (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    # Log admin rack creation attempt
    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) creating new rack")
    logging_config.log_api_operation(
        f"Rack creation - Name: '{rack_data.name}', Description: '{rack_data.description}'", correlation_id=correlation_id)

    try:
        new_rack = Rack(
            name=rack_data.name,
            description=rack_data.description
        )

        session.add(new_rack)
        session.commit()
        session.refresh(new_rack)

        duration = time.time() - start_time

        # Audit log for rack creation
        api_logger.info(
            f"[{correlation_id}] Rack created successfully - ID: {new_rack.id}, Name: '{new_rack.name}'")
        api_logger.info(
            f"[{correlation_id}] Rack management audit - Admin {current_admin.name} created rack '{new_rack.name}' (ID: {new_rack.id})")
        logging_config.log_performance(
            api_logger, "Rack creation operation", duration, correlation_id)

        return {"message": "Rack created successfully", "rack_id": new_rack.id}

    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Error creating rack: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Rack creation operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create rack"
        )


@router.put("/racks/{rack_id}")
async def update_rack(
    rack_id: int,
    rack_data: RackUpdate,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Update a rack"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to update rack ID: {rack_id}")

    try:
        rack = session.get(Rack, rack_id)
        if not rack:
            api_logger.warning(
                f"[{correlation_id}] Rack update failed - rack not found: {rack_id}")
            raise HTTPException(status_code=404, detail="Rack not found")

        changes = []
        if rack_data.name is not None and rack_data.name != rack.name:
            changes.append(f"name: '{rack.name}' -> '{rack_data.name}'")
            rack.name = rack_data.name
        if rack_data.description is not None and rack_data.description != rack.description:
            changes.append(
                f"description: '{rack.description}' -> '{rack_data.description}'")
            rack.description = rack_data.description

        if not changes:
            api_logger.info(
                f"[{correlation_id}] No changes made to rack {rack_id} - all fields identical")
        else:
            logging_config.log_api_operation(
                f"Rack update changes: {', '.join(changes)}", correlation_id=correlation_id)

        session.add(rack)
        session.commit()

        duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Rack updated successfully - ID: {rack_id}, Name: '{rack.name}'")
        if changes:
            api_logger.info(
                f"[{correlation_id}] Rack management audit - Admin {current_admin.name} updated rack '{rack.name}' (ID: {rack_id}): {', '.join(changes)}")
        logging_config.log_performance(
            api_logger, "Rack update operation", duration, correlation_id)

        return {"message": "Rack updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during rack update: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Rack update operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update rack"
        )


@router.delete("/racks/{rack_id}")
async def delete_rack(
    rack_id: int,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Delete a rack"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to delete rack ID: {rack_id}")

    try:
        rack = session.get(Rack, rack_id)
        if not rack:
            api_logger.warning(
                f"[{correlation_id}] Rack deletion failed - rack not found: {rack_id}")
            raise HTTPException(status_code=404, detail="Rack not found")

        rack_details = f"Name: '{rack.name}', Description: '{rack.description}'"
        logging_config.log_api_operation(
            f"Attempting to delete rack - {rack_details}", correlation_id=correlation_id)

        # Check if rack has any books
        logging_config.log_api_operation(
            "Checking for books in rack", correlation_id=correlation_id)
        books_in_rack = session.exec(
            select(Book).where(Book.rack_id == rack_id)).all()
        if books_in_rack:
            api_logger.warning(
                f"[{correlation_id}] Rack deletion blocked - rack contains books.")
            raise HTTPException(
                status_code=400, detail="Cannot delete rack with books")

        # Delete associated shelves
        logging_config.log_api_operation(
            "Deleting associated shelves", correlation_id=correlation_id)
        shelves = session.exec(select(Shelf).where(
            Shelf.rack_id == rack_id)).all()
        for shelf in shelves:
            session.delete(shelf)

        session.delete(rack)
        session.commit()

        duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Rack deleted successfully - {rack_details}")
        api_logger.info(
            f"[{correlation_id}] Rack management audit - Admin {current_admin.name} deleted rack '{rack.name}' (ID: {rack_id})")
        logging_config.log_performance(
            api_logger, "Rack deletion operation", duration, correlation_id)

        return {"message": "Rack deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during rack deletion: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Rack deletion operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete rack"
        )


@router.post("/shelves")
async def create_shelf(
    shelf_data: ShelfCreate,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Create a new shelf"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) creating new shelf")
    logging_config.log_api_operation(
        f"Shelf creation - Name: '{shelf_data.name}', Rack ID: {shelf_data.rack_id}, Capacity: {shelf_data.capacity}", correlation_id=correlation_id)

    try:
        # Check if rack exists
        logging_config.log_api_operation(
            f"Validating rack existence for shelf creation - Rack ID: {shelf_data.rack_id}", correlation_id=correlation_id)
        rack = session.get(Rack, shelf_data.rack_id)
        if not rack:
            api_logger.warning(
                f"[{correlation_id}] Shelf creation failed - rack not found: {shelf_data.rack_id}")
            raise HTTPException(status_code=400, detail="Rack not found")

        new_shelf = Shelf(
            name=shelf_data.name,
            rack_id=shelf_data.rack_id,
            capacity=shelf_data.capacity
        )

        session.add(new_shelf)
        session.commit()
        session.refresh(new_shelf)

        duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Shelf created successfully - ID: {new_shelf.id}, Name: '{new_shelf.name}', Rack ID: {new_shelf.rack_id}")
        api_logger.info(
            f"[{correlation_id}] Shelf management audit - Admin {current_admin.name} created shelf '{new_shelf.name}' (ID: {new_shelf.id}) in Rack {rack.name}")
        logging_config.log_performance(
            api_logger, "Shelf creation operation", duration, correlation_id)

        return {"message": "Shelf created successfully", "shelf_id": new_shelf.id}

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during shelf creation: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Shelf creation operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create shelf"
        )


@router.put("/shelves/{shelf_id}")
async def update_shelf(
    shelf_id: int,
    shelf_data: ShelfUpdate,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Update a shelf"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to update shelf ID: {shelf_id}")

    try:
        shelf = session.get(Shelf, shelf_id)
        if not shelf:
            api_logger.warning(
                f"[{correlation_id}] Shelf update failed - shelf not found: {shelf_id}")
            raise HTTPException(status_code=404, detail="Shelf not found")

        changes = []
        if shelf_data.name is not None and shelf_data.name != shelf.name:
            changes.append(f"name: '{shelf.name}' -> '{shelf_data.name}'")
            shelf.name = shelf_data.name
        if shelf_data.rack_id is not None and shelf_data.rack_id != shelf.rack_id:
            changes.append(f"rack_id: {shelf.rack_id} -> {shelf_data.rack_id}")
            shelf.rack_id = shelf_data.rack_id
        if shelf_data.capacity is not None and shelf_data.capacity != shelf.capacity:
            logging_config.log_api_operation(
                f"Updating shelf capacity from {shelf.capacity} to {shelf_data.capacity}", correlation_id=correlation_id)
            if shelf_data.capacity < shelf.current_books:
                api_logger.warning(
                    f"[{correlation_id}] Shelf update failed - cannot reduce capacity below current book count: {shelf_data.capacity} < {shelf.current_books}")
                raise HTTPException(
                    status_code=400, detail="Cannot reduce capacity below current book count")
            changes.append(
                f"capacity: {shelf.capacity} -> {shelf_data.capacity}")
            shelf.capacity = shelf_data.capacity

        if not changes:
            api_logger.info(
                f"[{correlation_id}] No changes made to shelf {shelf_id} - all fields identical")
        else:
            logging_config.log_api_operation(
                f"Shelf update changes: {', '.join(changes)}", correlation_id=correlation_id)

        session.add(shelf)
        session.commit()

        duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Shelf updated successfully - ID: {shelf_id}, Name: '{shelf.name}'")
        if changes:
            api_logger.info(
                f"[{correlation_id}] Shelf management audit - Admin {current_admin.name} updated shelf '{shelf.name}' (ID: {shelf_id}): {', '.join(changes)}")
        logging_config.log_performance(
            api_logger, "Shelf update operation", duration, correlation_id)

        return {"message": "Shelf updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during shelf update: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Shelf update operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update shelf"
        )


@router.delete("/shelves/{shelf_id}")
async def delete_shelf(
    shelf_id: int,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Delete a shelf"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to delete shelf ID: {shelf_id}")

    try:
        shelf = session.get(Shelf, shelf_id)
        if not shelf:
            api_logger.warning(
                f"[{correlation_id}] Shelf deletion failed - shelf not found: {shelf_id}")
            raise HTTPException(status_code=404, detail="Shelf not found")

        shelf_details = f"Name: '{shelf.name}', Rack ID: {shelf.rack_id}, Capacity: {shelf.capacity}"
        logging_config.log_api_operation(
            f"Attempting to delete shelf - {shelf_details}", correlation_id=correlation_id)

        # Check if shelf has any books
        logging_config.log_api_operation(
            "Checking for books on shelf", correlation_id=correlation_id)
        books_in_shelf = session.exec(
            select(Book).where(Book.shelf_id == shelf_id)).all()
        if books_in_shelf:
            api_logger.warning(
                f"[{correlation_id}] Shelf deletion blocked - shelf contains books.")
            raise HTTPException(
                status_code=400, detail="Cannot delete shelf with books")

        session.delete(shelf)
        session.commit()

        duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Shelf deleted successfully - {shelf_details}")
        api_logger.info(
            f"[{correlation_id}] Shelf management audit - Admin {current_admin.name} deleted shelf '{shelf.name}' (ID: {shelf_id})")
        logging_config.log_performance(
            api_logger, "Shelf deletion operation", duration, correlation_id)

        return {"message": "Shelf deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during shelf deletion: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Shelf deletion operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete shelf"
        )


@router.get("/shelves")
async def get_shelves(
    rack_id: Optional[int] = None,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Get all shelves with optional rack_id filter"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) fetching shelves list")
    logging_config.log_api_operation(
        f"Shelves list request with rack_id filter: {rack_id}", correlation_id=correlation_id)

    try:
        query = select(Shelf)

        if rack_id is not None:
            logging_config.log_api_operation(
                f"Applying rack_id filter: {rack_id}", correlation_id=correlation_id)
            query = query.where(Shelf.rack_id == rack_id)

        query_start_time = time.time()
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

        query_duration = time.time() - query_start_time
        total_duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Retrieved {len(result)} shelves with rack_id filter: {rack_id}")
        logging_config.log_performance(
            api_logger, "Shelves database query", query_duration, correlation_id)
        logging_config.log_performance(
            api_logger, "Get shelves endpoint", total_duration, correlation_id)

        return {"shelves": result, "total": len(result)}

    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Error fetching shelves: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Get shelves endpoint (failed)", total_duration, correlation_id)
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
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) attempting to issue book ID: {issue_data.book_id} to user ID: {issue_data.user_id}")
    logging_config.log_api_operation(
        f"Book issue request - Book: {issue_data.book_id}, User: {issue_data.user_id}, Due Date: {issue_data.due_date.isoformat()}", correlation_id=correlation_id)

    try:
        # Check if book exists and is available
        logging_config.log_api_operation(
            f"Checking book availability for ID: {issue_data.book_id}", correlation_id=correlation_id)
        book = session.get(Book, issue_data.book_id)
        if not book:
            api_logger.warning(
                f"[{correlation_id}] Book issue failed - book not found: {issue_data.book_id}")
            raise HTTPException(status_code=404, detail="Book not found")

        if not book.is_available:
            api_logger.warning(
                f"[{correlation_id}] Book issue failed - book already issued: '{book.title}'")
            raise HTTPException(
                status_code=400, detail="Book is not available")

        # Check if user exists
        logging_config.log_api_operation(
            f"Checking user existence for ID: {issue_data.user_id}", correlation_id=correlation_id)
        user = session.get(User, issue_data.user_id)
        if not user:
            api_logger.warning(
                f"[{correlation_id}] Book issue failed - user not found: {issue_data.user_id}")
            raise HTTPException(status_code=404, detail="User not found")

        # Update book status
        logging_config.log_api_operation(
            f"Updating book status for '{book.title}' (ID: {book.id}) to issued", correlation_id=correlation_id)
        book.is_available = False
        book.issued_to = issue_data.user_id
        book.issued_date = datetime.now()
        book.return_date = issue_data.due_date

        # Create transaction record
        logging_config.log_api_operation(
            "Creating new transaction record", correlation_id=correlation_id)
        transaction = Transaction(
            book_id=book.id,
            user_id=user.id,
            book_title=book.title,
            book_author=book.author,
            book_isbn=book.isbn,
            issued_date=datetime.now(),
            due_date=issue_data.due_date,
            status="current"
        )

        session.add(book)
        session.add(transaction)
        session.commit()

        duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Book '{book.title}' (ID: {book.id}) issued successfully to user '{user.name}' (ID: {user.id})")
        logging_config.log_performance(
            api_logger, "Book issue operation", duration, correlation_id)

        return {"message": "Book issued successfully"}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        session.rollback()
        duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during book issue: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Book issue operation (failed)", duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing the book issue. Please try again."
        )


@router.post("/return-book")
async def return_book(
    return_data: ReturnBookRequest,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Return a book from a user with enhanced validation and error handling"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    api_logger.info(
        f"[{correlation_id}] Processing book return: book_id={return_data.book_id}, user_id={return_data.user_id}")
    logging_config.log_api_operation(
        f"Book return request - Book: {return_data.book_id}, User: {return_data.user_id}", correlation_id=correlation_id)

    try:
        # Check if book exists
        logging_config.log_api_operation(
            f"Checking book existence for ID: {return_data.book_id}", correlation_id=correlation_id)
        book = session.get(Book, return_data.book_id)
        if not book:
            api_logger.warning(
                f"[{correlation_id}] Book not found: {return_data.book_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Book not found"
            )

        # Check if book is currently issued
        logging_config.log_api_operation(
            f"Checking if book '{book.title}' (ID: {book.id}) is currently issued", correlation_id=correlation_id)
        if book.is_available:
            api_logger.warning(
                f"[{correlation_id}] Book {return_data.book_id} is not currently issued")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Book is not currently issued and cannot be returned"
            )

        # Verify user exists
        logging_config.log_api_operation(
            f"Verifying user existence for ID: {return_data.user_id}", correlation_id=correlation_id)
        user = session.get(User, return_data.user_id)
        if not user:
            api_logger.warning(
                f"[{correlation_id}] User not found: {return_data.user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Check if book is actually issued to this specific user
        logging_config.log_api_operation(
            f"Verifying book '{book.title}' (ID: {book.id}) is issued to user '{user.name}' (ID: {user.id})", correlation_id=correlation_id)
        if book.issued_to != return_data.user_id:
            api_logger.warning(
                f"[{correlation_id}] Book {return_data.book_id} is not issued to user {return_data.user_id}, issued to {book.issued_to}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Book '{book.title}' is not issued to user '{user.name}'. Please verify the correct user."
            )

        # Find the active transaction
        logging_config.log_api_operation(
            f"Finding active transaction for book {book.id} and user {user.id}", correlation_id=correlation_id)
        transaction = session.exec(
            select(Transaction).where(
                Transaction.book_id == book.id,
                Transaction.user_id == return_data.user_id,
                (Transaction.status == "current") | (
                    Transaction.status == "issued")
            )
        ).first()

        if not transaction:
            api_logger.error(
                f"[{correlation_id}] No active transaction found for book_id={book.id}, user_id={return_data.user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active transaction record found for book '{book.title}' and user '{user.name}'"
            )

        # Check if there are unpaid fines for this book-user combination
        logging_config.log_api_operation(
            f"Checking for unpaid fines for transaction {transaction.id}", correlation_id=correlation_id)
        existing_fine = session.exec(
            select(Fine).where(
                Fine.book_history_id == transaction.id,
                Fine.status == "pending"
            )
        ).first()

        if existing_fine:
            api_logger.warning(
                f"[{correlation_id}] Unpaid fine exists for transaction {transaction.id}: {existing_fine.fine_amount}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot return book '{book.title}'. User '{user.name}' has unpaid fine of ₹{existing_fine.fine_amount} for {existing_fine.days_overdue} overdue days. Please pay the fine first."
            )

        # Calculate the fine amount if the book is overdue
        return_date = datetime.now()
        is_overdue = return_date > book.return_date if book.return_date else False
        fine_amount = 0
        days_overdue = 0

        if is_overdue and book.return_date:
            days_overdue = (return_date - book.return_date).days
            fine_amount = days_overdue * 5  # 5 rupees per day
            api_logger.info(
                f"[{correlation_id}] Book is overdue by {days_overdue} days, fine amount: ₹{fine_amount} is paid by the user.")

        # Update book status
        logging_config.log_api_operation(
            f"Updating book '{book.title}' (ID: {book.id}) to available", correlation_id=correlation_id)
        book.is_available = True
        book.issued_to = None
        book.issued_date = None
        book.return_date = None

        # Update transaction record
        transaction.return_date = return_date
        transaction.status = "overdue" if is_overdue else "returned"
        transaction.days_overdue = days_overdue if is_overdue else None
        transaction.fine_amount = fine_amount if is_overdue else None

        api_logger.info(
            f"[{correlation_id}] Updated transaction {transaction.id} status to '{transaction.status}'")
        session.add(transaction)
        session.add(book)
        session.commit()

        total_duration = time.time() - start_time

        response = {
            "message": f"Book '{book.title}' returned successfully by {user.name}",
            "book_title": book.title,
            "user_name": user.name,
            "return_date": return_date.isoformat()
        }

        api_logger.info(
            f"[{correlation_id}] Book return completed successfully: {response}")
        logging_config.log_performance(
            api_logger, "Book return operation", total_duration, correlation_id)

        return response

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        session.rollback()
        total_duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Unexpected error during book return: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Book return operation (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing the book return. Please try again."
        )


@router.get("/transactions")
async def get_transactions(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin)
):
    """Get all transactions"""
    correlation_id = logging_config.get_correlation_id()
    start_time = time.time()

    api_logger.info(
        f"[{correlation_id}] Admin {current_admin.name} (ID: {current_admin.id}) fetching transactions list")
    logging_config.log_api_operation(
        f"Transactions list request - skip={skip}, limit={limit}, status_filter='{status_filter}'", correlation_id=correlation_id)

    try:
        query = select(Transaction)

        if status_filter and status_filter != "all":
            logging_config.log_api_operation(
                f"Applying status filter: '{status_filter}'", correlation_id=correlation_id)
            query = query.where(Transaction.status == status_filter)

        query_start_time = time.time()
        query = query.offset(skip).limit(limit).order_by(
            Transaction.created_at.desc())
        transactions = session.exec(query).all()

        query_duration = time.time() - query_start_time
        total_duration = time.time() - start_time

        api_logger.info(
            f"[{correlation_id}] Retrieved {len(transactions)} transactions.")
        logging_config.log_performance(
            api_logger, "Transactions database query", query_duration, correlation_id)
        logging_config.log_performance(
            api_logger, "Get transactions endpoint", total_duration, correlation_id)

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
    except Exception as e:
        total_duration = time.time() - start_time
        logging_config.log_error(
            api_logger, f"Error fetching transactions: {str(e)}", correlation_id=correlation_id)
        logging_config.log_performance(
            api_logger, "Get transactions endpoint (failed)", total_duration, correlation_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch transactions data"
        )
