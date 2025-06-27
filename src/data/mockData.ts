import { Book, Rack, Shelf, IssuedBook, BookHistory, Fine } from '../types';

export const mockRacks: Rack[] = [
  {
    id: '1',
    name: 'Computer Science',
    description: 'Programming, Algorithms, and Software Engineering',
    shelves: [],
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    name: 'Mathematics',
    description: 'Pure and Applied Mathematics',
    shelves: [],
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    name: 'Physics',
    description: 'Classical and Modern Physics',
    shelves: [],
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '4',
    name: 'Literature',
    description: 'Fiction and Non-Fiction',
    shelves: [],
    createdAt: '2024-01-01T00:00:00Z'
  }
];

export const mockShelves: Shelf[] = [
  { id: '1', name: 'Programming Fundamentals', rackId: '1', capacity: 50, currentBooks: 45, createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', name: 'Data Structures', rackId: '1', capacity: 40, currentBooks: 38, createdAt: '2024-01-01T00:00:00Z' },
  { id: '3', name: 'Web Development', rackId: '1', capacity: 35, currentBooks: 32, createdAt: '2024-01-01T00:00:00Z' },
  { id: '4', name: 'Calculus', rackId: '2', capacity: 30, currentBooks: 28, createdAt: '2024-01-01T00:00:00Z' },
  { id: '5', name: 'Linear Algebra', rackId: '2', capacity: 25, currentBooks: 25, createdAt: '2024-01-01T00:00:00Z' },
  { id: '6', name: 'Quantum Physics', rackId: '3', capacity: 20, currentBooks: 15, createdAt: '2024-01-01T00:00:00Z' },
  { id: '7', name: 'Classical Mechanics', rackId: '3', capacity: 30, currentBooks: 27, createdAt: '2024-01-01T00:00:00Z' },
  { id: '8', name: 'Modern Fiction', rackId: '4', capacity: 60, currentBooks: 55, createdAt: '2024-01-01T00:00:00Z' },
  { id: '9', name: 'Poetry', rackId: '4', capacity: 25, currentBooks: 20, createdAt: '2024-01-01T00:00:00Z' }
];

export const mockBooks: Book[] = [
  {
    id: '1',
    isbn: '978-0-13-601970-1',
    title: 'Introduction to Algorithms',
    author: 'Thomas H. Cormen',
    genre: 'Computer Science',
    rackId: '1',
    shelfId: '2',
    isAvailable: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    isbn: '978-0-596-52068-7',
    title: 'JavaScript: The Good Parts',
    author: 'Douglas Crockford',
    genre: 'Programming',
    rackId: '1',
    shelfId: '3',
    isAvailable: false,
    issuedTo: '2',
    issuedDate: '2024-01-20T00:00:00Z',
    returnDate: '2024-02-20T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    isbn: '978-0-321-35653-2',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    genre: 'Software Engineering',
    rackId: '1',
    shelfId: '1',
    isAvailable: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '4',
    isbn: '978-0-13-235088-4',
    title: 'Calculus and Analytic Geometry',
    author: 'George B. Thomas',
    genre: 'Mathematics',
    rackId: '2',
    shelfId: '4',
    isAvailable: false,
    issuedTo: '3',
    issuedDate: '2023-12-10T00:00:00Z',
    returnDate: '2024-01-10T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '5',
    isbn: '978-0-471-73881-9',
    title: 'Introduction to Linear Algebra',
    author: 'Gilbert Strang',
    genre: 'Mathematics',
    rackId: '2',
    shelfId: '5',
    isAvailable: false,
    issuedTo: '3',
    issuedDate: '2024-01-22T00:00:00Z',
    returnDate: '2024-02-22T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '6',
    isbn: '978-0-13-212227-5',
    title: 'Principles of Physics',
    author: 'David Halliday',
    genre: 'Physics',
    rackId: '3',
    shelfId: '7',
    isAvailable: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '7',
    isbn: '978-0-262-03384-8',
    title: 'Design Patterns',
    author: 'Gang of Four',
    genre: 'Software Engineering',
    rackId: '1',
    shelfId: '1',
    isAvailable: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '8',
    isbn: '978-0-201-63361-0',
    title: 'The Pragmatic Programmer',
    author: 'Andrew Hunt',
    genre: 'Programming',
    rackId: '1',
    shelfId: '1',
    isAvailable: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '9',
    isbn: '978-0-134-68570-4',
    title: 'Operating System Concepts',
    author: 'Abraham Silberschatz',
    genre: 'Computer Science',
    rackId: '1',
    shelfId: '2',
    isAvailable: false,
    issuedTo: '4',
    issuedDate: '2023-11-15T00:00:00Z',
    returnDate: '2023-12-15T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z'
  }
];

export const mockIssuedBooks: IssuedBook[] = [
  {
    id: '1',
    bookId: '2',
    userId: '2',
    issuedDate: '2024-01-20T00:00:00Z',
    dueDate: '2024-02-20T00:00:00Z',
    status: 'issued'
  },
  {
    id: '2',
    bookId: '5',
    userId: '3',
    issuedDate: '2024-01-22T00:00:00Z',
    dueDate: '2024-02-22T00:00:00Z',
    status: 'issued'
  },
  {
    id: '3',
    bookId: '4',
    userId: '3',
    issuedDate: '2023-12-10T00:00:00Z',
    dueDate: '2024-01-10T00:00:00Z',
    status: 'overdue'
  },
  {
    id: '4',
    bookId: '9',
    userId: '4',
    issuedDate: '2023-11-15T00:00:00Z',
    dueDate: '2023-12-15T00:00:00Z',
    status: 'overdue'
  }
];

// Mock book history data for demonstration
export const mockBookHistory: BookHistory[] = [
  // Current issues for John Doe (user id: 2)
  {
    id: '1',
    bookId: '2',
    userId: '2',
    bookTitle: 'JavaScript: The Good Parts',
    bookAuthor: 'Douglas Crockford',
    bookIsbn: '978-0-596-52068-7',
    issuedDate: '2024-01-20T00:00:00Z',
    dueDate: '2024-02-20T00:00:00Z',
    status: 'current'
  },
  // Past returns for John Doe
  {
    id: '2',
    bookId: '1',
    userId: '2',
    bookTitle: 'Introduction to Algorithms',
    bookAuthor: 'Thomas H. Cormen',
    bookIsbn: '978-0-13-601970-1',
    issuedDate: '2023-12-01T00:00:00Z',
    dueDate: '2024-01-01T00:00:00Z',
    returnDate: '2023-12-28T00:00:00Z',
    status: 'returned'
  },
  {
    id: '3',
    bookId: '3',
    userId: '2',
    bookTitle: 'Clean Code',
    bookAuthor: 'Robert C. Martin',
    bookIsbn: '978-0-321-35653-2',
    issuedDate: '2023-11-15T00:00:00Z',
    dueDate: '2023-12-15T00:00:00Z',
    returnDate: '2023-12-20T00:00:00Z',
    status: 'returned',
    daysOverdue: 5,
    fineAmount: 25
  },
  {
    id: '4',
    bookId: '7',
    userId: '2',
    bookTitle: 'Design Patterns',
    bookAuthor: 'Gang of Four',
    bookIsbn: '978-0-262-03384-8',
    issuedDate: '2023-10-10T00:00:00Z',
    dueDate: '2023-11-10T00:00:00Z',
    returnDate: '2023-11-08T00:00:00Z',
    status: 'returned'
  },
  {
    id: '5',
    bookId: '8',
    userId: '2',
    bookTitle: 'The Pragmatic Programmer',
    bookAuthor: 'Andrew Hunt',
    bookIsbn: '978-0-201-63361-0',
    issuedDate: '2023-09-05T00:00:00Z',
    dueDate: '2023-10-05T00:00:00Z',
    returnDate: '2023-10-03T00:00:00Z',
    status: 'returned'
  },
  // Current issues for Jane Smith (user id: 3)
  {
    id: '6',
    bookId: '5',
    userId: '3',
    bookTitle: 'Introduction to Linear Algebra',
    bookAuthor: 'Gilbert Strang',
    bookIsbn: '978-0-471-73881-9',
    issuedDate: '2024-01-22T00:00:00Z',
    dueDate: '2024-02-22T00:00:00Z',
    status: 'current'
  },
  // Overdue example for Jane Smith
  {
    id: '7',
    bookId: '4',
    userId: '3',
    bookTitle: 'Calculus and Analytic Geometry',
    bookAuthor: 'George B. Thomas',
    bookIsbn: '978-0-13-235088-4',
    issuedDate: '2023-12-10T00:00:00Z',
    dueDate: '2024-01-10T00:00:00Z',
    status: 'overdue',
    daysOverdue: 15,
    fineAmount: 75
  },
  // Overdue example for Alice Johnson (user id: 4)
  {
    id: '8',
    bookId: '9',
    userId: '4',
    bookTitle: 'Operating System Concepts',
    bookAuthor: 'Abraham Silberschatz',
    bookIsbn: '978-0-134-68570-4',
    issuedDate: '2023-11-15T00:00:00Z',
    dueDate: '2023-12-15T00:00:00Z',
    status: 'overdue',
    daysOverdue: 42,
    fineAmount: 210
  }
];

// Mock fines data
export const mockFines: Fine[] = [
  {
    id: '1',
    userId: '2',
    userName: 'John Doe',
    userUsn: 'CS21001',
    bookHistoryId: '3',
    bookTitle: 'Clean Code',
    bookAuthor: 'Robert C. Martin',
    bookIsbn: '978-0-321-35653-2',
    daysOverdue: 5,
    fineAmount: 25,
    finePerDay: 5,
    issuedDate: '2023-11-15T00:00:00Z',
    dueDate: '2023-12-15T00:00:00Z',
    returnDate: '2023-12-20T00:00:00Z',
    status: 'paid',
    createdAt: '2023-12-20T00:00:00Z',
    paidAt: '2023-12-21T00:00:00Z'
  },
  {
    id: '2',
    userId: '3',
    userName: 'Jane Smith',
    userUsn: 'CS21002',
    bookHistoryId: '7',
    bookTitle: 'Calculus and Analytic Geometry',
    bookAuthor: 'George B. Thomas',
    bookIsbn: '978-0-13-235088-4',
    daysOverdue: 15,
    fineAmount: 75,
    finePerDay: 5,
    issuedDate: '2023-12-10T00:00:00Z',
    dueDate: '2024-01-10T00:00:00Z',
    status: 'pending',
    createdAt: '2024-01-10T00:00:00Z'
  },
  {
    id: '3',
    userId: '4',
    userName: 'Alice Johnson',
    userUsn: 'CS21003',
    bookHistoryId: '8',
    bookTitle: 'Operating System Concepts',
    bookAuthor: 'Abraham Silberschatz',
    bookIsbn: '978-0-134-68570-4',
    daysOverdue: 42,
    fineAmount: 210,
    finePerDay: 5,
    issuedDate: '2023-11-15T00:00:00Z',
    dueDate: '2023-12-15T00:00:00Z',
    status: 'pending',
    createdAt: '2023-12-15T00:00:00Z'
  },
  {
    id: '4',
    userId: '2',
    userName: 'John Doe',
    userUsn: 'CS21001',
    bookHistoryId: '9',
    bookTitle: 'Database System Concepts',
    bookAuthor: 'Abraham Silberschatz',
    bookIsbn: '978-0-073-52332-1',
    daysOverdue: 3,
    fineAmount: 15,
    finePerDay: 5,
    issuedDate: '2023-08-10T00:00:00Z',
    dueDate: '2023-09-10T00:00:00Z',
    returnDate: '2023-09-13T00:00:00Z',
    status: 'waived',
    createdAt: '2023-09-13T00:00:00Z',
    waivedAt: '2023-09-14T00:00:00Z',
    waivedBy: '1',
    notes: 'First-time offender, waived as goodwill gesture'
  }
];

// Update shelves with rack references
mockRacks.forEach(rack => {
  rack.shelves = mockShelves.filter(shelf => shelf.rackId === rack.id);
});