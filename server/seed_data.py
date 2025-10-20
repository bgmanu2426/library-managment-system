-- Active: 1760966742747@@127.0.0.1@3306
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from sqlmodel import Session

from database import create_db_and_tables, get_session_context
from models import User, Book, Rack, Shelf, Transaction, Fine
from auth import hash_password


def seed_admin_user(session: Session) -> bool:
    """Seed initial admin user"""
    try:
        # Check if admin already exists
        admin_email = "admin@lms.com"
        existing_admin = session.exec(User).filter(User.email == admin_email).first()
        
        if existing_admin:
            print(f"Admin user already exists: {admin_email}")
            return False
        
        # Create admin user
        admin_user = User(
            name="Administrator",
            usn="ADMIN001",
            email=admin_email,
            mobile="9999999999",
            address="Library Admin Office",
            role="admin",
            hashed_password=hash_password("admin@1234")
        )
        
        session.add(admin_user)
        session.commit()
        print(f"Created admin user: {admin_email}")
        return True
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
        session.rollback()
        return False


def seed_racks_and_shelves(session: Session) -> bool:
    """Seed racks and shelves data"""
    try:
        # Check if racks already exist
        existing_racks = session.exec(Rack).first()
        if existing_racks:
            print("Racks already exist, skipping rack seeding")
            return False
        
        # Define rack data
        racks_data = [
            {"name": "Computer Science", "description": "Programming, Algorithms, and Software Engineering"},
            {"name": "Mathematics", "description": "Pure and Applied Mathematics"},
            {"name": "Physics", "description": "Classical and Modern Physics"},
            {"name": "Literature", "description": "Fiction and Non-Fiction"}
        ]
        
        # Create racks
        created_racks = []
        for rack_data in racks_data:
            rack = Rack(
                name=rack_data["name"],
                description=rack_data["description"]
            )
            session.add(rack)
            session.flush()  # Get ID before commit
            created_racks.append(rack)
        
        # Define shelf data
        shelves_data = [
            # Computer Science shelves
            {"name": "Programming Fundamentals", "rack_idx": 0, "capacity": 50},
            {"name": "Data Structures", "rack_idx": 0, "capacity": 40},
            {"name": "Web Development", "rack_idx": 0, "capacity": 35},
            # Mathematics shelves
            {"name": "Calculus", "rack_idx": 1, "capacity": 30},
            {"name": "Linear Algebra", "rack_idx": 1, "capacity": 25},
            # Physics shelves (only if not minimal)
            {"name": "Quantum Physics", "rack_idx": 2, "capacity": 20},
            {"name": "Classical Mechanics", "rack_idx": 2, "capacity": 30},
            # Literature shelves (only if not minimal)
            {"name": "Modern Fiction", "rack_idx": 3, "capacity": 60},
            {"name": "Poetry", "rack_idx": 3, "capacity": 25}
        ]
        
        # Create shelves
        for shelf_data in shelves_data:
            if shelf_data["rack_idx"] < len(created_racks):
                shelf = Shelf(
                    name=shelf_data["name"],
                    rack_id=created_racks[shelf_data["rack_idx"]].id,
                    capacity=shelf_data["capacity"]
                )
                session.add(shelf)
        
        session.commit()
        print(f"Created {len(created_racks)} racks and shelves")
        return True
        
    except Exception as e:
        print(f"Error creating racks and shelves: {e}")
        session.rollback()
        return False


def seed_books(session: Session) -> bool:
    """Seed sample books data"""
    try:
        # Check if books already exist
        existing_books = session.exec(Book).first()
        if existing_books:
            print("Books already exist, skipping book seeding")
            return False
        
        # Get racks and shelves
        racks = session.exec(Rack).all()
        shelves = session.exec(Shelf).all()
        
        if not racks or not shelves:
            print("No racks or shelves found, cannot seed books")
            return False
        
        # Create shelf mapping
        shelf_map = {shelf.name: shelf for shelf in shelves}
        
        # Define book data
        books_data = [
            {
                "isbn": "978-0-13-601970-1",
                "title": "Introduction to Algorithms",
                "author": "Thomas H. Cormen",
                "genre": "Computer Science",
                "shelf_name": "Data Structures"
            },
            {
                "isbn": "978-0-596-52068-7",
                "title": "JavaScript: The Good Parts",
                "author": "Douglas Crockford",
                "genre": "Computer Science",
                "shelf_name": "Web Development"
            },
            {
                "isbn": "978-0-321-35653-2",
                "title": "Clean Code",
                "author": "Robert C. Martin",
                "genre": "Computer Science",
                "shelf_name": "Programming Fundamentals"
            },
            {
                "isbn": "978-0-13-235088-4",
                "title": "Calculus and Analytic Geometry",
                "author": "George B. Thomas",
                "genre": "Mathematics",
                "shelf_name": "Calculus"
            },
            {
                "isbn": "978-0-471-73881-9",
                "title": "Introduction to Linear Algebra",
                "author": "Gilbert Strang",
                "genre": "Mathematics",
                "shelf_name": "Linear Algebra"
            },
            {
                "isbn": "978-0-13-212227-5",
                "title": "Principles of Physics",
                "author": "David Halliday",
                "genre": "Physics",
                "shelf_name": "Classical Mechanics"
            },
            {
                "isbn": "978-0-486-61272-0",
                "title": "Discrete Mathematics and Its Applications",
                "author": "Kenneth H. Rosen",
                "genre": "Mathematics",
                "shelf_name": "Linear Algebra"
            },
            {
                "isbn": "978-0-201-88954-3",
                "title": "The C Programming Language",
                "author": "Brian W. Kernighan",
                "genre": "Computer Science",
                "shelf_name": "Programming Fundamentals"
            },
            {
                "isbn": "978-0-262-03384-8",
                "title": "Design Patterns",
                "author": "Gang of Four",
                "genre": "Computer Science",
                "shelf_name": "Programming Fundamentals"
            },
            {
                "isbn": "978-0-134-68570-4",
                "title": "Operating System Concepts",
                "author": "Abraham Silberschatz",
                "genre": "Computer Science",
                "shelf_name": "Data Structures"
            }
        ]
        
        # Create books
        created_books = 0
        for book_data in books_data:
            shelf = shelf_map.get(book_data["shelf_name"])
            if shelf:
                book = Book(
                    isbn=book_data["isbn"],
                    title=book_data["title"],
                    author=book_data["author"],
                    genre=book_data["genre"],
                    rack_id=shelf.rack_id,
                    shelf_id=shelf.id
                )
                session.add(book)
                
                # Update shelf current books count
                shelf.current_books += 1
                session.add(shelf)
                
                created_books += 1
        
        session.commit()
        print(f"Created {created_books} books")
        return True
        
    except Exception as e:
        print(f"Error creating books: {e}")
        session.rollback()
        return False


def seed_users(session: Session) -> bool:
    """Seed sample users data"""
    try:
        # Check if users already exist (excluding admin)
        existing_users = session.exec(User).filter(User.role == "user").first()
        if existing_users:
            print("Users already exist, skipping user seeding")
            return False
        
        # Define exact 2 users data
        users_data = [
            {
                "name": "User One",
                "usn": "1MS21CS001",
                "email": "one@one.com",
                "mobile": "9876543210",
                "address": "123 Main Street, Bangalore",
                "password": "one@1"
            },
            {
                "name": "User Two",
                "usn": "1MS21CS002",
                "email": "two@two.com",
                "mobile": "9876543211",
                "address": "456 Oak Avenue, Bangalore",
                "password": "two@2"
            }
        ]
        
        # Create users
        created_users = 0
        for user_data in users_data:
            user = User(
                name=user_data["name"],
                usn=user_data["usn"],
                email=user_data["email"],
                mobile=user_data["mobile"],
                address=user_data["address"],
                role="user",
                hashed_password=hash_password(user_data["password"])
            )
            session.add(user)
            created_users += 1
        
        session.commit()
        print(f"Created {created_users} users")
        return True
        
    except Exception as e:
        print(f"Error creating users: {e}")
        session.rollback()
        return False


def seed_sample_transactions(session: Session) -> bool:
    """Seed sample transactions with specific scenarios"""
    try:
        # Check if transactions already exist
        existing_transactions = session.exec(Transaction).first()
        if existing_transactions:
            print("Transactions already exist, skipping transaction seeding")
            return False
        
        # Get users and books
        users = session.exec(User).filter(User.role == "user").all()
        books = session.exec(Book).all()
        
        if len(users) < 2 or len(books) < 10:
            print("Not enough users or books found, skipping transaction seeding")
            return False
        
        # Create specific transaction scenarios
        # 3 books currently issued (within due date)
        current_transactions = [
            {
                "book_idx": 0,
                "user_idx": 0,
                "days_ago": 5,
                "due_days": 30,
                "status": "current"
            },
            {
                "book_idx": 1,
                "user_idx": 1,
                "days_ago": 10,
                "due_days": 30,
                "status": "current"
            },
            {
                "book_idx": 2,
                "user_idx": 0,
                "days_ago": 15,
                "due_days": 30,
                "status": "current"
            }
        ]
        
        # 3 books overdue (past due date with calculated fines)
        overdue_transactions = [
            {
                "book_idx": 3,
                "user_idx": 1,
                "days_ago": 45,
                "due_days": 30,
                "status": "overdue"
            },
            {
                "book_idx": 4,
                "user_idx": 0,
                "days_ago": 50,
                "due_days": 30,
                "status": "overdue"
            },
            {
                "book_idx": 5,
                "user_idx": 1,
                "days_ago": 40,
                "due_days": 30,
                "status": "overdue"
            }
        ]
        
        # Combine all transactions
        all_transactions = current_transactions + overdue_transactions
        
        created_transactions = 0
        for trans_data in all_transactions:
            book = books[trans_data["book_idx"]]
            user = users[trans_data["user_idx"]]
            
            issued_date = datetime.now() - timedelta(days=trans_data["days_ago"])
            due_date = issued_date + timedelta(days=trans_data["due_days"])
            
            transaction = Transaction(
                book_id=book.id,
                user_id=user.id,
                book_title=book.title,
                book_author=book.author,
                book_isbn=book.isbn,
                issued_date=issued_date,
                due_date=due_date,
                status=trans_data["status"]
            )
            
            # Update book status (mark as not available)
            book.is_available = False
            book.issued_to = user.id
            book.issued_date = issued_date
            book.return_date = due_date
            session.add(book)
            
            # Handle overdue transactions
            if trans_data["status"] == "overdue":
                days_overdue = (datetime.now() - due_date).days
                fine_amount = days_overdue * 5.0
                transaction.days_overdue = days_overdue
                transaction.fine_amount = fine_amount
            
            session.add(transaction)
            created_transactions += 1
        
        session.commit()
        print(f"Created {created_transactions} sample transactions (3 current, 3 overdue, 4 books available)")
        return True
        
    except Exception as e:
        print(f"Error creating sample transactions: {e}")
        session.rollback()
        return False


def clear_existing_data(session: Session):
    """Clear existing database data to ensure clean state"""
    try:
        # Delete in reverse order of dependencies
        session.exec(Fine).delete()
        session.exec(Transaction).delete()
        session.exec(Book).delete()
        session.exec(Shelf).delete()
        session.exec(Rack).delete()
        session.exec(User).filter(User.role == "user").delete()
        session.commit()
        print("Cleared existing database data")
    except Exception as e:
        print(f"Error clearing existing data: {e}")
        session.rollback()


def initialize_database():
    """Initialize database and seed with data"""
    print("Initializing database...")
    
    # Create database and tables
    create_db_and_tables()
    print("Database tables created")
    
    # Seed data
    with get_session_context() as session:
        print("Clearing existing data and seeding database...")
        
        # Clear existing data
        clear_existing_data(session)
        
        # Seed admin user
        seed_admin_user(session)
        
        # Seed racks and shelves
        seed_racks_and_shelves(session)
        
        # Seed books
        seed_books(session)
        
        # Seed users
        seed_users(session)
        
        # Seed sample transactions
        seed_sample_transactions(session)
    
    print("Database initialization completed!")


if __name__ == "__main__":
    try:
        initialize_database()
        print("\n" + "="*50)
        print("DATABASE SEEDED SUCCESSFULLY!")
        print("="*50)
        print("Admin Login:")
        print("  Email: admin@lms.com")
        print("  Password: admin@1234")
        print("\nUser Login Options:")
        print("  Email: one@one.com")
        print("  Password: one@1")
        print("  Email: two@two.com")
        print("  Password: two@2")
        print("="*50)
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        import sys
        sys.exit(1)