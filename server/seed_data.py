from datetime import datetime, timedelta
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
            hashed_password=hash_password("admin@1234"),
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
            {
                "name": "Computer Science",
                "description": "Programming, Algorithms, and Software Engineering",
            },
            {"name": "Mathematics", "description": "Pure and Applied Mathematics"},
            {"name": "Physics", "description": "Classical and Modern Physics"},
            {"name": "Biology", "description": "Life Sciences and Biological Studies"},
        ]

        if minimal:
            racks_data = racks_data[:2]  # Only first 2 racks for minimal data

        # Create racks
        created_racks = []
        for rack_data in racks_data:
            rack = Rack(name=rack_data["name"], description=rack_data["description"])
            session.add(rack)
            session.flush()  # Get ID before commit
            created_racks.append(rack)
        # Define shelf data
        shelves_data = [
            # Computer Science shelves
            {"name": "Programming Fundamentals", "rack_idx": 0, "capacity": 50},
            {"name": "Data Structures", "rack_idx": 0, "capacity": 40},
            {"name": "Web Development", "rack_idx": 0, "capacity": 35},
            {"name": "Machine Learning", "rack_idx": 0, "capacity": 30},
            # Mathematics shelves
            {"name": "Calculus", "rack_idx": 1, "capacity": 30},
            {"name": "Linear Algebra", "rack_idx": 1, "capacity": 25},
            {"name": "Statistics", "rack_idx": 1, "capacity": 35},
            # Physics shelves
            {"name": "Quantum Physics", "rack_idx": 2, "capacity": 20},
            {"name": "Classical Mechanics", "rack_idx": 2, "capacity": 30},
            {"name": "Thermodynamics", "rack_idx": 2, "capacity": 25},
            # Biology shelves
            {"name": "Cell Biology", "rack_idx": 3, "capacity": 40},
            {"name": "Genetics", "rack_idx": 3, "capacity": 35},
            {"name": "Ecology", "rack_idx": 3, "capacity": 30},
        ]

        if minimal:
            shelves_data = shelves_data[:8]  # Only first 8 shelves for minimal data

        # Create shelves
        for shelf_data in shelves_data:
            if shelf_data["rack_idx"] < len(created_racks):
                shelf = Shelf(
                    name=shelf_data["name"],
                    rack_id=created_racks[shelf_data["rack_idx"]].id,
                    capacity=shelf_data["capacity"],
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
            # Computer Science books
            {
                "isbn": "978-0-13-601970-1",
                "title": "Introduction to Algorithms",
                "author": "Thomas H. Cormen",
                "genre": "Computer Science",
                "shelf_name": "Data Structures",
            },
            {
                "isbn": "978-0-596-52068-7",
                "title": "JavaScript: The Good Parts",
                "author": "Douglas Crockford",
                "genre": "Computer Science",
                "shelf_name": "Web Development",
            },
            {
                "isbn": "978-0-321-35653-2",
                "title": "Clean Code",
                "author": "Robert C. Martin",
                "genre": "Computer Science",
                "shelf_name": "Programming Fundamentals",
            },
            {
                "isbn": "978-0-262-03384-8",
                "title": "Design Patterns",
                "author": "Gang of Four",
                "genre": "Computer Science",
                "shelf_name": "Programming Fundamentals",
            },
            {
                "isbn": "978-0-201-63361-0",
                "title": "The Pragmatic Programmer",
                "author": "Andrew Hunt",
                "genre": "Computer Science",
                "shelf_name": "Programming Fundamentals",
            },
            {
                "isbn": "978-0-134-68570-4",
                "title": "Operating System Concepts",
                "author": "Abraham Silberschatz",
                "genre": "Computer Science",
                "shelf_name": "Data Structures",
            },
            {
                "isbn": "978-0-201-88954-3",
                "title": "The C Programming Language",
                "author": "Brian W. Kernighan",
                "genre": "Computer Science",
                "shelf_name": "Programming Fundamentals",
            },
            {
                "isbn": "978-0-321-48681-3",
                "title": "Database System Concepts",
                "author": "Abraham Silberschatz",
                "genre": "Computer Science",
                "shelf_name": "Data Structures",
            },
            {
                "isbn": "978-0-13-394460-1",
                "title": "Computer Networks",
                "author": "Andrew S. Tanenbaum",
                "genre": "Computer Science",
                "shelf_name": "Data Structures",
            },
            {
                "isbn": "978-0-262-03384-9",
                "title": "Pattern Recognition and Machine Learning",
                "author": "Christopher Bishop",
                "genre": "Computer Science",
                "shelf_name": "Machine Learning",
            },
            {
                "isbn": "978-0-596-52068-8",
                "title": "Hands-On Machine Learning",
                "author": "Aurélien Géron",
                "genre": "Computer Science",
                "shelf_name": "Machine Learning",
            },
            # Mathematics books
            {
                "isbn": "978-0-13-235088-4",
                "title": "Calculus and Analytic Geometry",
                "author": "George B. Thomas",
                "genre": "Mathematics",
                "shelf_name": "Calculus",
            },
            {
                "isbn": "978-0-471-73881-9",
                "title": "Introduction to Linear Algebra",
                "author": "Gilbert Strang",
                "genre": "Mathematics",
                "shelf_name": "Linear Algebra",
            },
            {
                "isbn": "978-0-13-142267-6",
                "title": "Advanced Engineering Mathematics",
                "author": "Erwin Kreyszig",
                "genre": "Mathematics",
                "shelf_name": "Calculus",
            },
            {
                "isbn": "978-0-486-61272-0",
                "title": "Discrete Mathematics and Its Applications",
                "author": "Kenneth H. Rosen",
                "genre": "Mathematics",
                "shelf_name": "Linear Algebra",
            },
            {
                "isbn": "978-0-673-38259-2",
                "title": "Numerical Analysis",
                "author": "Richard L. Burden",
                "genre": "Mathematics",
                "shelf_name": "Calculus",
            },
            {
                "isbn": "978-0-321-79433-8",
                "title": "Introduction to Probability and Statistics",
                "author": "William Mendenhall",
                "genre": "Mathematics",
                "shelf_name": "Statistics",
            },
            {
                "isbn": "978-0-387-98892-5",
                "title": "The Elements of Statistical Learning",
                "author": "Trevor Hastie",
                "genre": "Mathematics",
                "shelf_name": "Statistics",
            },
            # Physics books
            {
                "isbn": "978-0-13-212227-5",
                "title": "Principles of Physics",
                "author": "David Halliday",
                "genre": "Physics",
                "shelf_name": "Classical Mechanics",
            },
            {
                "isbn": "978-0-471-87462-3",
                "title": "Introduction to Quantum Mechanics",
                "author": "David J. Griffiths",
                "genre": "Physics",
                "shelf_name": "Quantum Physics",
            },
            {
                "isbn": "978-0-521-82955-6",
                "title": "Modern Physics",
                "author": "Randy Harris",
                "genre": "Physics",
                "shelf_name": "Quantum Physics",
            },
            {
                "isbn": "978-0-321-76508-9",
                "title": "Thermodynamics: An Engineering Approach",
                "author": "Yunus Cengel",
                "genre": "Physics",
                "shelf_name": "Thermodynamics",
            },
            {
                "isbn": "978-0-13-031825-7",
                "title": "University Physics with Modern Physics",
                "author": "Hugh Young",
                "genre": "Physics",
                "shelf_name": "Classical Mechanics",
            },
            # Biology books
            {
                "isbn": "978-0-321-83942-0",
                "title": "Campbell Biology",
                "author": "Jane B. Reece",
                "genre": "Biology",
                "shelf_name": "Cell Biology",
            },
            {
                "isbn": "978-0-321-83943-7",
                "title": "Molecular Biology of the Cell",
                "author": "Bruce Alberts",
                "genre": "Biology",
                "shelf_name": "Cell Biology",
            },
            {
                "isbn": "978-0-471-58914-8",
                "title": "Principles of Genetics",
                "author": "D. Peter Snustad",
                "genre": "Biology",
                "shelf_name": "Genetics",
            },
            {
                "isbn": "978-0-321-83944-4",
                "title": "Introduction to Genetic Analysis",
                "author": "Anthony Griffiths",
                "genre": "Biology",
                "shelf_name": "Genetics",
            },
            {
                "isbn": "978-0-878-93250-5",
                "title": "Ecology: Concepts and Applications",
                "author": "Manuel Molles",
                "genre": "Biology",
                "shelf_name": "Ecology",
            },
            {
                "isbn": "978-0-878-93251-2",
                "title": "Elements of Ecology",
                "author": "Thomas Smith",
                "genre": "Biology",
                "shelf_name": "Ecology",
            },
        ]

        if minimal:
            books_data = books_data[:10]  # Only first 10 books for minimal data

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
                    shelf_id=shelf.id,
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
                "name": "User One",
                "usn": "1MS21CS001",
                "email": "one@gmail.com",
                "mobile": "9876543210",
                "address": "123 Main Street, Bangalore",
                "password": "one@1",
            },
            {
                "name": "User Two",
                "usn": "1MS21CS002",
                "email": "two@gmail.com",
                "mobile": "9876543211",
                "address": "456 Oak Avenue, Bangalore",
                "password": "two@2",
            },
        ]
        if minimal:
            users_data = users_data[:2]  # Both users for minimal data

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
                hashed_password=hash_password(user_data["password"]),
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
        users = session.query(User).filter(User.role == "user").limit(2).all()
        books = session.query(Book).limit(8).all()

        if not users or not books:
            print("No users or books found, skipping transaction seeding")
            return False

        # Create sample transactions with some overdue books
        transactions_data = [
            # Current borrowings
            {
                "book_idx": 0,  # Introduction to Algorithms
                "user_idx": 0,  # User One
                "days_ago": 5,
                "due_days": 14,
                "status": "borrowed",
                "returned": False,
            },
            {
                "book_idx": 1,  # JavaScript: The Good Parts
                "user_idx": 1,  # User Two
                "days_ago": 3,
                "due_days": 14,
                "status": "borrowed",
                "returned": False,
            },
            # Overdue books
            {
                "book_idx": 2,  # Clean Code
                "user_idx": 0,  # User One
                "days_ago": 20,
                "due_days": 14,
                "status": "overdue",
                "returned": False,
            },
            {
                "book_idx": 3,  # Design Patterns
                "user_idx": 1,  # User Two
                "days_ago": 25,
                "due_days": 14,
                "status": "overdue",
                "returned": False,
            },
            # Returned books (history)
            {
                "book_idx": 4,  # The Pragmatic Programmer
                "user_idx": 0,  # User One
                "days_ago": 30,
                "due_days": 14,
                "status": "returned",
                "returned": True,
                "return_days_ago": 10,
            },
            {
                "book_idx": 5,  # Operating System Concepts
                "user_idx": 1,  # User Two
                "days_ago": 35,
                "due_days": 14,
                "status": "returned",
                "returned": True,
                "return_days_ago": 15,
            },
        ]
        if minimal:
            transactions_data = transactions_data[
                :3
            ]  # First 3 transactions for minimal

        created_transactions = 0
        for trans_data in transactions_data:
            if trans_data["book_idx"] < len(books) and trans_data["user_idx"] < len(
                users
            ):
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
                    status=trans_data["status"],
                )
                # Handle returned books
                if trans_data.get("returned", False):
                    return_date = datetime.utcnow() - timedelta(
                        days=trans_data.get("return_days_ago", 0)
                    )
                    transaction.return_date = return_date
                    transaction.status = "returned"
                    # Book is available for returned transactions
                    book.is_available = True
                    book.issued_to = None
                    book.issued_date = None
                    book.return_date = None
                else:
                    # Book is not available for current/overdue transactions
                    book.is_available = False
                    book.issued_to = user.id
                    book.issued_date = issued_date
                    book.return_date = due_date

                # Handle overdue books
                if trans_data["status"] == "overdue":
                    days_overdue = (datetime.utcnow() - due_date).days
                    fine_amount = days_overdue * 5.0  # Rs. 5 per day
                    transaction.days_overdue = days_overdue
                    transaction.fine_amount = fine_amount

                session.add(book)
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
        print("\n" + "=" * 50)
        print("DATABASE SEEDED SUCCESSFULLY!")
        print("=" * 50)
        print("Admin Login:")
        print("  Email: admin@lms.com")
        print("  Password: admin@1234")
        print("\nUser Logins:")
        print("  Email: one@gmail.com")
        print("  Password: one@1")
        print("  Email: two@gmail.com")
        print("  Password: two@2")
        print("=" * 50)

    except Exception as e:
        print(f"Error initializing database: {e}")
        sys.exit(1)
