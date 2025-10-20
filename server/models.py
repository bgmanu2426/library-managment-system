from sqlmodel import SQLModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    usn: str = Field(unique=True)
    email: str = Field(unique=True)
    mobile: str
    address: str
    role: str = Field(default="user")  # admin or user
    user_uid: Optional[str] = Field(default=None, unique=True, index=True)  # RFID card UID
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.now)


class Rack(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: str
    created_at: datetime = Field(default_factory=datetime.now)


class Shelf(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    rack_id: int = Field(foreign_key="rack.id")
    capacity: int
    current_books: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.now)


class Book(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    isbn: str = Field(unique=True)
    title: str
    author: str
    genre: str
    rack_id: int = Field(foreign_key="rack.id")
    shelf_id: int = Field(foreign_key="shelf.id")
    is_available: bool = Field(default=True)
    issued_to: Optional[int] = Field(default=None, foreign_key="user.id")
    issued_date: Optional[datetime] = Field(default=None)
    return_date: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)


class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    book_id: int = Field(foreign_key="book.id")
    user_id: int = Field(foreign_key="user.id")
    book_title: str
    book_author: str
    book_isbn: str
    issued_date: datetime
    due_date: datetime
    return_date: Optional[datetime] = Field(default=None)
    status: str = Field(default="current")  # current, returned, overdue
    days_overdue: Optional[int] = Field(default=None)
    fine_amount: Optional[float] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)


class Fine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    user_name: str
    user_usn: str
    book_history_id: int = Field(foreign_key="transaction.id")
    book_title: str
    book_author: str
    book_isbn: str
    days_overdue: int
    fine_amount: float
    fine_per_day: float = Field(default=5.0)
    issued_date: datetime
    due_date: datetime
    return_date: Optional[datetime] = Field(default=None)
    status: str = Field(default="pending")  # pending, paid, waived
    created_at: datetime = Field(default_factory=datetime.now)
    paid_at: Optional[datetime] = Field(default=None)
    waived_at: Optional[datetime] = Field(default=None)
    waived_by: Optional[int] = Field(default=None, foreign_key="user.id")
    notes: Optional[str] = Field(default=None)


class APIKey(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True)  # The actual API key
    name: str  # Friendly name for the API key
    user_id: int = Field(foreign_key="user.id")  # User who owns this API key
    prefix: str  # First 8 characters for display (e.g., "lms_1234...")
    last_used_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)
    is_active: bool = Field(default=True)


class LoginResponse(SQLModel):
    access_token: str
    token_type: str
    user: Dict[str, Any] = Field(description="User information dictionary containing id, name, email, and role")


class TokenVerifyResponse(SQLModel):
    valid: bool
    user: Optional[Dict[str, Any]] = Field(default=None, description="User information dictionary containing id, name, email, and role")