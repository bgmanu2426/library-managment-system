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
        existing_admin = session.query(User).filter(User.email == admin_email).first()
        
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


def seed_racks_and_shelves(session: Session, minimal: bool = False) -> bool:
    """Seed racks and shelves data"""
    try:
        # Check if racks already exist
        existing_racks = session.query(Rack).first()
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
        
        if minimal:
            racks_data = racks_data[:2]  # Only first 2 racks for minimal data
        
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
        
        if minimal:
            shelves_data = shelves_data[:5]  # Only first 5 shelves for minimal data
        
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


def seed_books(session: Session, minimal: bool = False) -> bool:
    """Seed sample books data"""
    try:
        # Check if books already exist
        existing_books = session.query(Book).first()
        if existing_books:
            print("Books already exist, skipping book seeding")
            return False
        
        # Get racks and shelves
        racks = session.query(Rack).all()
        shelves = session.query(Shelf).all()
        
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
                "isbn": "978-0-262-03384-8",
                "title": "Design Patterns",
                "author": "Gang of Four",
                "genre": "Computer Science",
                "shelf_name": "Programming Fundamentals"
            },
            {
                "isbn": "978-0-201-63361-0",
                "title": "The Pragmatic Programmer",
                "author": "Andrew Hunt",
                "genre": "Computer Science",
                "shelf_name": "Programming Fundamentals"
            },
            {
                "isbn": "978-0-134-68570-4",
                "title": "Operating System Concepts",
                "author": "Abraham Silberschatz",
                "genre": "Computer Science",
                "shelf_name": "Data Structures"
            },
            {
                "isbn": "978-0-201-88954-3",
                "title": "The C Programming Language",
                "author": "Brian W. Kernighan",
                "genre": "Computer Science",
                "shelf_name": "Programming Fundamentals"
            },
            {
                "isbn": "978-0-321-48681-3",
                "title": "Database System Concepts",
                "author": "Abraham Silberschatz",
                "genre": "Computer Science",
                "shelf_name": "Data Structures"
            },
            {
                "isbn": "978-0-13-394460-1",
                "title": "Computer Networks",
                "author": "Andrew S. Tanenbaum",
                "genre": "Computer Science",
                "shelf_name": "Data Structures"
            },
            {
                "isbn": "978-0-13-142267-6",
                "title": "Advanced Engineering Mathematics",
                "author": "Erwin Kreyszig",
                "genre": "Mathematics",
                "shelf_name": "Calculus"
            },
            {
                "isbn": "978-0-486-61272-0",
                "title": "Discrete Mathematics and Its Applications",
                "author": "Kenneth H. Rosen",
                "genre": "Mathematics",
                "shelf_name": "Linear Algebra"
            },
            {
                "isbn": "978-0-673-38259-2",
                "title": "Numerical Analysis",
                "author": "Richard L. Burden",
                "genre": "Mathematics",
                "shelf_name": "Calculus"
            }
        ]
        
        if minimal:
            books_data = books_data[:5]  # Only first 5 books for minimal data
        
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


def seed_users(session: Session, minimal: bool = False) -> bool:
    """Seed sample users data"""
    try:
        # Check if users already exist (excluding admin)
        existing_users = session.query(User).filter(User.role == "user").first()
        if existing_users:
            print("Users already exist, skipping user seeding")
            return False
        
        # Define user data
        users_data = [
            {
                "name": "John Doe",
                "usn": "1MS21CS001",
                "email": "john.doe@example.com",
                "mobile": "9876543210",
                "address": "123 Main Street, Bangalore",
                "password": "password123"
            },
            {
                "name": "Jane Smith",
                "usn": "1MS21CS002",
                "email": "jane.smith@example.com",
                "mobile": "9876543211",
                "address": "456 Oak Avenue, Bangalore",
                "password": "password123"
            },
            {
                "name": "Bob Johnson",
                "usn": "1MS21CS003",
                "email": "bob.johnson@example.com",
                "mobile": "9876543212",
                "address": "789 Pine Road, Bangalore",
                "password": "password123"
            },
            {
                "name": "Alice Brown",
                "usn": "1MS21CS004",
                "email": "alice.brown@example.com",
                "mobile": "9876543213",
                "address": "321 Elm Street, Bangalore",
                "password": "password123"
            },
            {
                "name": "Charlie Wilson",
                "usn": "1MS21CS005",
                "email": "charlie.wilson@example.com",
                "mobile": "9876543214",
                "address": "654 Cedar Lane, Bangalore",
                "password": "password123"
            }
        ]
        
        if minimal:
            users_data = users_data[:3]  # Only first 3 users for minimal data
        
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


def seed_sample_transactions(session: Session, minimal: bool = False) -> bool:
    """Seed some sample transactions for demonstration"""
    try:
        # Check if transactions already exist
        existing_transactions = session.query(Transaction).first()
        if existing_transactions:
            print("Transactions already exist, skipping transaction seeding")
            return False
        
        # Get some users and books
        users = session.query(User).filter(User.role == "user").limit(3).all()
        books = session.query(Book).limit(5).all()
        
        if not users or not books:
            print("No users or books found, skipping transaction seeding")
            return False
        
        # Create sample transactions
        transactions_data = [
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
                "days_ago": 45,
                "due_days": 30,
                "status": "overdue",
                "returned": False
            }
        ]
        
        if minimal:
            transactions_data = transactions_data[:2]
        
        created_transactions = 0
        for trans_data in transactions_data:
            if (trans_data["book_idx"] < len(books) and 
                trans_data["user_idx"] < len(users)):
                
                book = books[trans_data["book_idx"]]
                user = users[trans_data["user_idx"]]
                
                issued_date = datetime.utcnow() - timedelta(days=trans_data["days_ago"])
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
                
                # Update book status
                if trans_data.get("returned", True) == False:
                    book.is_available = False
                    book.issued_to = user.id
                    book.issued_date = issued_date
                    book.return_date = due_date
                    session.add(book)
                
                # Handle overdue
                if trans_data["status"] == "overdue":
                    days_overdue = (datetime.utcnow() - due_date).days
                    fine_amount = days_overdue * 5.0
                    transaction.days_overdue = days_overdue
                    transaction.fine_amount = fine_amount
                
                session.add(transaction)
                created_transactions += 1
        
        session.commit()
        print(f"Created {created_transactions} sample transactions")
        return True
        
    except Exception as e:
        print(f"Error creating sample transactions: {e}")
        session.rollback()
        return False


def initialize_database(minimal_data: bool = False):
    """Initialize database and seed with data"""
    print("Initializing database...")
    
    # Create database and tables
    create_db_and_tables()
    print("Database tables created")
    
    # Seed data
    with get_session_context() as session:
        print(f"Seeding database with {'minimal' if minimal_data else 'full'} data...")
        
        # Seed admin user
        seed_admin_user(session)
        
        # Seed racks and shelves
        seed_racks_and_shelves(session, minimal=minimal_data)
        
        # Seed books
        seed_books(session, minimal=minimal_data)
        
        # Seed users
        seed_users(session, minimal=minimal_data)
        
        # Seed sample transactions (only for full data)
        if not minimal_data:
            seed_sample_transactions(session, minimal=minimal_data)
    
    print("Database initialization completed!")


if __name__ == "__main__":
    import sys
    
    # Check for minimal flag
    minimal = "--minimal" in sys.argv
    
    try:
        initialize_database(minimal_data=minimal)
        print("\n" + "="*50)
        print("DATABASE SEEDED SUCCESSFULLY!")
        print("="*50)
        print("Admin Login:")
        print("  Email: admin@lms.com")
        print("  Password: admin@1234")
        print("\nSample User Login:")
        print("  Email: john.doe@example.com")
        print("  Password: password123")
        print("="*50)
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        sys.exit(1)