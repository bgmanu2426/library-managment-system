import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  IterationCw,
  Loader,
  Book,
  User,
  ArrowLeft,
  ArrowRight,
  Scan,
  AlertCircle,
} from 'lucide-react';
import {
  getBooks,
  getUsers,
  issueBook,
  returnBook,
  getRecentActivity,
  searchBooks,
  getRacks,
  getShelves,
  getBookByIsbn,
  getUserByUid,
  getUserIssuedBooks,
} from '../../utils/api';
import {
  Book as BookType,
  User as UserType,
  IssueBookPayload,
  ReturnBookPayload,
  RecentActivity,
} from '../../types';
import { useAuth } from '../../context/AuthContext';

const InventoryManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Issue form data
  const [issueData, setIssueData] = useState({
    bookId: '',
    userId: '',
    dueDate: '',
    isbn: '',
    userUid: '',
  });

  // Issue form additional state
  const [fetchedBook, setFetchedBook] = useState<BookType | null>(null);
  const [fetchedUser, setFetchedUser] = useState<UserType | null>(null);
  const [isbnFetchLoading, setIsbnFetchLoading] = useState(false);
  const [userUidFetchLoading, setUserUidFetchLoading] = useState(false);
  const [isbnFetchError, setIsbnFetchError] = useState<string | null>(null);
  const [userUidFetchError, setUserUidFetchError] = useState<string | null>(null);

  // Return form data
  const [returnData, setReturnData] = useState({
    bookId: '',
    userId: '',
    condition: 'good',
    notes: '',
    userUid: '',
  });

  // Return form additional state
  const [returnFetchedUser, setReturnFetchedUser] = useState<UserType | null>(null);
  const [returnUserUidFetchLoading, setReturnUserUidFetchLoading] = useState(false);
  const [returnUserUidFetchError, setReturnUserUidFetchError] = useState<string | null>(null);
  const [userIssuedBooks, setUserIssuedBooks] = useState<Array<{
    id: number;
    isbn: string;
    title: string;
    author: string;
    genre: string;
    issued_date: string;
    return_date: string;
    has_pending_fine: boolean;
    fine_amount: number;
  }>>([]);
  const [issuedBooksLoading, setIssuedBooksLoading] = useState(false);
  const [selectedReturnBook, setSelectedReturnBook] = useState<{
    id: number;
    title: string;
    has_pending_fine: boolean;
    fine_amount: number;
  } | null>(null);

  const { user } = useAuth();
  const [books, setBooks] = useState<BookType[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalBooks, setTotalBooks] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const itemsPerPage = 20;

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BookType[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) {
      setError('Authentication required. Please log in to access inventory management.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const [booksResponse, usersResponse, activityResponse] = await Promise.all([
        getBooks(token, currentPage * itemsPerPage, itemsPerPage),
        getUsers(token, 0, 1000),
        getRecentActivity(token),
        getRacks(token),
        getShelves(token),
      ]);

      // Handle proper response format from updated API for books
      if (booksResponse && typeof booksResponse === 'object' && !Array.isArray(usersResponse)) {
        setBooks(booksResponse.books || []);
        setTotalBooks(booksResponse.total || 0);
      } else if (Array.isArray(booksResponse)) {
        setBooks(booksResponse);
        setTotalBooks(booksResponse.length);
      } else {
        setBooks([]);
        setTotalBooks(0);
      }

      // Handle proper response format for users
      if (usersResponse && typeof usersResponse === 'object' && !Array.isArray(usersResponse)) {
        setUsers(usersResponse.users || []);
        setTotalUsers(usersResponse.total || 0);
      } else if (Array.isArray(usersResponse)) {
        setUsers(usersResponse);
        setTotalUsers(usersResponse.length);
      } else {
        setUsers([]);
        setTotalUsers(0);
      }

      // Handle proper response format for activity
      if (activityResponse && typeof activityResponse === 'object') {
        setRecentActivity(activityResponse.recent_activities || []);
      } else if (Array.isArray(activityResponse)) {
        setRecentActivity(activityResponse);
      } else {
        setRecentActivity([]);
      }
    } catch (err) {
      console.error('Failed to fetch inventory data:', err);
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('Authentication')) {
          setError('Authentication expired. Please log in again.');
        } else if (err.message.includes('403')) {
          setError('Access denied. Insufficient permissions.');
        } else if (err.message.includes('Network') || err.message.includes('fetch')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to load inventory data. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, currentPage, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setCurrentPage(0);
    setSearchTerm('');
    setSearchResults([]);
    setStatusFilter('all');
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await searchBooks(token, query, 0, 50);
      if (response && typeof response === 'object') {
        setSearchResults(response.books || []);
      } else if (Array.isArray(response)) {
        setSearchResults(response);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search failed:', err);
      if (err instanceof Error) {
        if (err.message.includes('401')) {
          showNotification('error', 'Authentication expired. Please log in again.');
        } else if (err.message.includes('Network')) {
          showNotification('error', 'Network error. Please check your connection.');
        } else {
          showNotification('error', 'Search failed. Please try again.');
        }
      } else {
        showNotification('error', 'Search failed. Please try again.');
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  const filteredBooks = (searchTerm ? searchResults : books).filter(book => {
    // Add null/undefined checks for book properties
    if (!book || typeof book !== 'object' || !book.id) return false;

    const matchesFilter =
      statusFilter === 'all' ||
      (statusFilter === 'available' && Boolean(book.is_available)) ||
      (statusFilter === 'issued' && !book.is_available);
    return matchesFilter;
  });

  const validateIssueForm = (): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};

    if (!issueData.bookId) errors.bookId = 'Book is required. Please fetch a book first.';
    if (!issueData.userId) errors.userId = 'User is required. Please fetch user via UID.';
    if (!issueData.dueDate) errors.dueDate = 'Due date is required';

    if (fetchedBook && !fetchedBook.is_available) {
      errors.bookId = 'Selected book is not available';
    }

    return errors;
  };

  // Fetch book by ISBN
  const handleFetchBookByIsbn = async () => {
    if (!issueData.isbn.trim()) {
      setIsbnFetchError('Please enter an ISBN number');
      return;
    }

    setIsbnFetchLoading(true);
    setIsbnFetchError(null);
    setFetchedBook(null);

    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const book = await getBookByIsbn(token, issueData.isbn.trim());
      setFetchedBook(book);
      setIssueData(prev => ({ ...prev, bookId: book.id.toString() }));
      
      if (!book.is_available) {
        setIsbnFetchError('This book is currently not available (already issued)');
      }
    } catch (err) {
      console.error('Failed to fetch book by ISBN:', err);
      if (err instanceof Error) {
        if (err.message.includes('404') || err.message.includes('not found')) {
          setIsbnFetchError('Book not found with this ISBN');
        } else {
          setIsbnFetchError(err.message);
        }
      } else {
        setIsbnFetchError('Failed to fetch book. Please try again.');
      }
      setFetchedBook(null);
      setIssueData(prev => ({ ...prev, bookId: '' }));
    } finally {
      setIsbnFetchLoading(false);
    }
  };

  // Fetch user by UID (for issue)
  const handleFetchUserByUid = async () => {
    if (!issueData.userUid.trim()) {
      setUserUidFetchError('Please enter a User UID or use fetch from scanner');
      return;
    }

    setUserUidFetchLoading(true);
    setUserUidFetchError(null);
    setFetchedUser(null);

    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const user = await getUserByUid(token, issueData.userUid.trim());
      setFetchedUser(user);
      setIssueData(prev => ({ ...prev, userId: user.id.toString() }));
    } catch (err) {
      console.error('Failed to fetch user by UID:', err);
      if (err instanceof Error) {
        if (err.message.includes('404') || err.message.includes('not found')) {
          setUserUidFetchError('User not found with this UID');
        } else {
          setUserUidFetchError(err.message);
        }
      } else {
        setUserUidFetchError('Failed to fetch user. Please try again.');
      }
      setFetchedUser(null);
      setIssueData(prev => ({ ...prev, userId: '' }));
    } finally {
      setUserUidFetchLoading(false);
    }
  };

  // Fetch latest RFID scan (for issue) - with polling
  const handleFetchLatestRfidScan = async () => {
    if (!user) {
      showNotification('error', 'Authentication required');
      return;
    }

    setUserUidFetchLoading(true);
    setUserUidFetchError(null);
    const maxAttempts = 20; // 20 attempts × 1 second = 20 seconds
    let attempts = 0;

    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      showNotification('success', 'Waiting for RFID scan. Please scan a card on the reader...');

      const pollInterval = setInterval(async () => {
        attempts++;

        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/scan-info/latest`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            throw new Error('Failed to fetch RFID scan');
          }

          const data = await response.json();

          if (data.available && data.uid) {
            // UID found!
            clearInterval(pollInterval);
            setUserUidFetchLoading(false);
            setIssueData(prev => ({ ...prev, userUid: data.uid }));
            showNotification('success', `UID captured: ${data.uid}`);

            // Auto-fetch user with the scanned UID
            try {
              const userResponse = await getUserByUid(token, data.uid);
              setFetchedUser(userResponse);
              setIssueData(prev => ({ ...prev, userId: userResponse.id.toString(), userUid: data.uid }));
            } catch (userErr) {
              console.error('Failed to fetch user by UID:', userErr);
              setUserUidFetchError('User not found with scanned UID');
            }
            return;
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setUserUidFetchLoading(false);
            setUserUidFetchError('No RFID scan detected. Please try again.');
            showNotification('error', 'No RFID scan detected. Please try again.');
          }
        } catch {
          clearInterval(pollInterval);
          setUserUidFetchLoading(false);
          setUserUidFetchError('Failed to fetch RFID scan');
          showNotification('error', 'Failed to fetch RFID scan');
        }
      }, 1000); // Poll every second
    } catch {
      setUserUidFetchLoading(false);
      setUserUidFetchError('Failed to initiate RFID fetch');
      showNotification('error', 'Failed to initiate RFID fetch');
    }
  };

  // Fetch user by UID for return modal - with polling
  const handleReturnFetchUserByUid = async () => {
    if (!user) {
      showNotification('error', 'Authentication required');
      return;
    }

    setReturnUserUidFetchLoading(true);
    setReturnUserUidFetchError(null);
    setReturnFetchedUser(null);
    setUserIssuedBooks([]);
    setSelectedReturnBook(null);
    const maxAttempts = 20; // 20 attempts × 1 second = 20 seconds
    let attempts = 0;

    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      showNotification('success', 'Waiting for RFID scan. Please scan a card on the reader...');

      const pollInterval = setInterval(async () => {
        attempts++;

        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/scan-info/latest`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            throw new Error('Failed to fetch RFID scan');
          }

          const data = await response.json();

          if (data.available && data.uid) {
            // UID found!
            clearInterval(pollInterval);
            setReturnData(prev => ({ ...prev, userUid: data.uid }));
            showNotification('success', `UID captured: ${data.uid}`);

            // Fetch user by UID
            try {
              const userResponse = await getUserByUid(token, data.uid);
              setReturnFetchedUser(userResponse);
              setReturnData(prev => ({ ...prev, userId: userResponse.id.toString(), userUid: data.uid }));

              // Fetch issued books for this user
              setIssuedBooksLoading(true);
              const issuedBooksResponse = await getUserIssuedBooks(token, userResponse.id);
              setUserIssuedBooks(issuedBooksResponse.issued_books);
              setIssuedBooksLoading(false);
            } catch (userErr) {
              console.error('Failed to fetch user by UID:', userErr);
              setReturnUserUidFetchError('User not found with scanned UID');
            }
            setReturnUserUidFetchLoading(false);
            return;
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setReturnUserUidFetchLoading(false);
            setReturnUserUidFetchError('No RFID scan detected. Please try again.');
            showNotification('error', 'No RFID scan detected. Please try again.');
          }
        } catch {
          clearInterval(pollInterval);
          setReturnUserUidFetchLoading(false);
          setIssuedBooksLoading(false);
          setReturnUserUidFetchError('Failed to fetch RFID scan');
          showNotification('error', 'Failed to fetch RFID scan');
        }
      }, 1000); // Poll every second
    } catch {
      setReturnUserUidFetchLoading(false);
      setReturnUserUidFetchError('Failed to initiate RFID fetch');
      showNotification('error', 'Failed to initiate RFID fetch');
    }
  };

  // Handle book selection for return
  const handleReturnBookSelection = (bookId: string) => {
    const selectedBook = userIssuedBooks.find(b => b.id.toString() === bookId);
    if (selectedBook) {
      setSelectedReturnBook({
        id: selectedBook.id,
        title: selectedBook.title,
        has_pending_fine: selectedBook.has_pending_fine,
        fine_amount: selectedBook.fine_amount,
      });
      setReturnData(prev => ({ ...prev, bookId }));
    } else {
      setSelectedReturnBook(null);
      setReturnData(prev => ({ ...prev, bookId: '' }));
    }
  };

  // Reset issue modal state
  const resetIssueModal = () => {
    setShowIssueModal(false);
    setFormErrors({});
    setIssueData({ bookId: '', userId: '', dueDate: '', isbn: '', userUid: '' });
    setFetchedBook(null);
    setFetchedUser(null);
    setIsbnFetchError(null);
    setUserUidFetchError(null);
  };

  // Reset return modal state
  const resetReturnModal = () => {
    setShowReturnModal(false);
    setFormErrors({});
    setReturnData({ bookId: '', userId: '', condition: 'good', notes: '', userUid: '' });
    setReturnFetchedUser(null);
    setUserIssuedBooks([]);
    setSelectedReturnBook(null);
    setReturnUserUidFetchError(null);
  };

  const validateReturnForm = (): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};

    if (!returnData.bookId) errors.bookId = 'Book selection is required';
    if (!returnData.userId) errors.userId = 'User is required. Please scan a user card.';
    if (!returnData.condition) errors.condition = 'Book condition is required';

    if (selectedReturnBook?.has_pending_fine) {
      errors.bookId = 'Please pay the outstanding fine before returning this book';
    }

    return errors;
  };

  const handleIssueBook = async () => {
    if (!user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const errors = validateIssueForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const issuePayload: IssueBookPayload = {
        book_id: parseInt(issueData.bookId),
        user_id: parseInt(issueData.userId),
        due_date: new Date(issueData.dueDate).toISOString(),
      };

      await issueBook(token, issuePayload);
      showNotification('success', 'Book issued successfully');
      resetIssueModal();
      handleRefresh();
    } catch (err) {
      console.error('Failed to issue book:', err);
      if (err instanceof Error) {
        if (err.message.includes('not available')) {
          showNotification('error', 'Selected book is not available for issue.');
        } else if (err.message.includes('not found')) {
          showNotification('error', 'Book or User not found.');
        } else if (err.message.includes('401')) {
          showNotification('error', 'Authentication expired. Please log in again.');
        } else if (err.message.includes('403')) {
          showNotification('error', 'Access denied. You do not have permission to issue books.');
        } else if (err.message.includes('Network')) {
          showNotification('error', 'Network error. Please check your connection and try again.');
        } else {
          showNotification('error', err.message);
        }
      } else {
        showNotification('error', 'Failed to issue book. Please try again.');
      }
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleReturnBook = async () => {
    if (!user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const errors = validateReturnForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const returnPayload: ReturnBookPayload = {
        book_id: parseInt(returnData.bookId),
        user_id: parseInt(returnData.userId),
        condition: returnData.condition,
        notes: returnData.notes,
      };

      const response = await returnBook(token, returnPayload);

      if (response) {
        showNotification('success', 'Book returned successfully');
      }

      resetReturnModal();
      handleRefresh();
    } catch (err) {
      console.error('Failed to return book:', err);
      if (err instanceof Error) {
        if (err.message.includes('not currently issued')) {
          showNotification('error', 'This book is not currently issued to this user.');
        } else if (err.message.includes('not found')) {
          showNotification('error', 'Book or User not found.');
        } else if (err.message.includes('401')) {
          showNotification('error', 'Authentication expired. Please log in again.');
        } else if (err.message.includes('403')) {
          showNotification('error', 'Access denied. You do not have permission to return books.');
        } else if (err.message.includes('Network')) {
          showNotification('error', 'Network error. Please check your connection and try again.');
        } else {
          showNotification('error', err.message);
        }
      } else {
        showNotification('error', 'Failed to return book. Please try again.');
      }
    } finally {
      setIsOperationLoading(false);
    }
  };

  let searchTimeout: ReturnType<typeof setTimeout>;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Inventory Management</h1>
          <p className="text-purple-100">Loading inventory data...</p>
        </div>
        <div className="flex justify-center items-center p-12">
          <Loader className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Error Loading Inventory</h1>
          <p className="text-red-100">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 flex items-center px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl md:rounded-2xl p-6 md:p-8 text-white relative">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Inventory Management</h1>
        <p className="text-purple-100 text-sm md:text-base">
          Issue and return books, manage library transactions
        </p>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Books</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{totalBooks}</p>
            </div>
            <Book className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Available</p>
              <p className="text-xl md:text-2xl font-bold text-emerald-600">
                {books.filter(book => book.is_available).length}
              </p>
            </div>
            <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Issued</p>
              <p className="text-xl md:text-2xl font-bold text-amber-600">
                {books.filter(book => !book.is_available).length}
              </p>
            </div>
            <Clock className="w-6 h-6 md:w-8 md:h-8 text-amber-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-xl md:text-2xl font-bold text-purple-600">{totalUsers}</p>
            </div>
            <User className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <button
          onClick={() => setShowIssueModal(true)}
          className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Issue Book</span>
        </button>
        <button
          onClick={() => setShowReturnModal(true)}
          className="flex items-center justify-center space-x-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <IterationCw className="w-5 h-5" />
          <span>Return Book</span>
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search books by title, author, or ISBN..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                  handleSearch(e.target.value);
                }, 300);
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Books</option>
                <option value="available">Available</option>
                <option value="issued">Issued</option>
              </select>
            </div>
          </div>
        </div>

        {/* Books List */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Book Details
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.isArray(filteredBooks)
                ? filteredBooks
                    .map(book => {
                      // Defensive checks for book object and required properties
                      if (!book || typeof book !== 'object' || !book.id) return null;

                      return (
                        <tr key={book.id} className="hover:bg-gray-50">
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                                <Book className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {book.title || 'Unknown Title'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {book.author || 'Unknown Author'}
                                </div>
                                <div className="text-xs text-gray-400">
                                  ISBN: {book.isbn || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div
                              className={`flex items-center space-x-2 ${
                                book.is_available ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              {book.is_available ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Clock className="w-4 h-4" />
                              )}
                              <span className="text-sm font-medium">
                                {book.is_available ? 'Available' : 'Issued'}
                              </span>
                            </div>
                            {!book.is_available && book.return_date && (
                              <div className="text-xs text-gray-500 mt-1">
                                Due: {new Date(book.return_date).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              {book.is_available ? (
                                <button
                                  onClick={() => {
                                    setIssueData(prev => ({ ...prev, bookId: book.id.toString() }));
                                    setShowIssueModal(true);
                                  }}
                                  disabled={isOperationLoading}
                                  className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded disabled:opacity-50"
                                  title="Issue Book"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setReturnData(prev => ({
                                      ...prev,
                                      bookId: book.id.toString(),
                                    }));
                                    setShowReturnModal(true);
                                  }}
                                  disabled={isOperationLoading}
                                  className="text-emerald-600 hover:text-emerald-900 p-1 hover:bg-emerald-50 rounded disabled:opacity-50"
                                  title="Return Book"
                                >
                                  <IterationCw className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                    .filter(Boolean)
                : []}
            </tbody>
          </table>
        </div>

        {filteredBooks.length === 0 && (
          <div className="text-center py-8 md:py-12">
            <Book className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-sm md:text-base">
              No books found matching your criteria.
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {!searchTerm && totalBooks > itemsPerPage && (
          <div className="px-4 md:px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {Math.min(currentPage * itemsPerPage + 1, totalBooks)} to{' '}
                {Math.min((currentPage + 1) * itemsPerPage, totalBooks)} of {totalBooks} books
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setCurrentPage(prev => Math.max(0, prev - 1));
                    setRefreshKey(prev => prev + 1);
                  }}
                  disabled={currentPage === 0 || isLoading}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <span className="px-3 py-2 text-sm text-gray-700 font-medium">
                  Page {currentPage + 1} of {Math.max(1, Math.ceil(totalBooks / itemsPerPage))}
                </span>
                <button
                  onClick={() => {
                    setCurrentPage(prev =>
                      Math.min(Math.ceil(totalBooks / itemsPerPage) - 1, prev + 1)
                    );
                    setRefreshKey(prev => prev + 1);
                  }}
                  disabled={currentPage >= Math.ceil(totalBooks / itemsPerPage) - 1 || isLoading}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <div
                key={activity.id || index}
                className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-shrink-0 mt-1">
                  {activity.type === 'issue' ? (
                    <Clock className="w-4 h-4 text-amber-600" />
                  ) : activity.type === 'return' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Book className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.details || activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.timestamp
                      ? new Date(activity.timestamp).toLocaleString()
                      : activity.time}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No recent activity to display</p>
          )}
        </div>
      </div>

      {/* Issue Book Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 md:p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Issue Book</h3>
              <button
                onClick={resetIssueModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              {/* ISBN Input with Fetch Button */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ISBN Number</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={issueData.isbn}
                    onChange={e => setIssueData({ ...issueData, isbn: e.target.value })}
                    placeholder="Enter ISBN number"
                    className={`flex-1 px-4 py-3 border ${isbnFetchError ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                  <button
                    onClick={handleFetchBookByIsbn}
                    disabled={isbnFetchLoading || !issueData.isbn.trim()}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isbnFetchLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span>Fetch</span>
                  </button>
                </div>
                {isbnFetchError && (
                  <p className="mt-1 text-red-500 text-xs flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {isbnFetchError}
                  </p>
                )}
              </div>

              {/* Book Details Display */}
              {fetchedBook && (
                <div className={`p-4 rounded-lg border ${fetchedBook.is_available ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start space-x-3">
                    <Book className={`w-5 h-5 mt-0.5 ${fetchedBook.is_available ? 'text-green-600' : 'text-red-600'}`} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{fetchedBook.title}</p>
                      <p className="text-sm text-gray-600">by {fetchedBook.author}</p>
                      <p className="text-xs text-gray-500">Genre: {fetchedBook.genre}</p>
                      <div className={`mt-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        fetchedBook.is_available 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {fetchedBook.is_available ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Available
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Not Available (Issued)
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* User UID Input - Only enabled when book is available */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User UID</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={issueData.userUid}
                    onChange={e => setIssueData({ ...issueData, userUid: e.target.value })}
                    placeholder="Enter User UID or scan card"
                    disabled={!fetchedBook?.is_available}
                    className={`flex-1 px-4 py-3 border ${userUidFetchError ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  />
                  <button
                    onClick={handleFetchUserByUid}
                    disabled={userUidFetchLoading || !fetchedBook?.is_available || !issueData.userUid.trim()}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                    title="Fetch by entered UID"
                  >
                    {userUidFetchLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleFetchLatestRfidScan}
                    disabled={userUidFetchLoading || !fetchedBook?.is_available}
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
                    title="Fetch from RFID Scanner"
                  >
                    {userUidFetchLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Scan className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {!fetchedBook?.is_available && fetchedBook && (
                  <p className="mt-1 text-amber-600 text-xs flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    User selection disabled until an available book is fetched
                  </p>
                )}
                {userUidFetchError && (
                  <p className="mt-1 text-red-500 text-xs flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {userUidFetchError}
                  </p>
                )}
              </div>

              {/* User Details Display */}
              {fetchedUser && (
                <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                  <div className="flex items-start space-x-3">
                    <User className="w-5 h-5 mt-0.5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{fetchedUser.name}</p>
                      <p className="text-sm text-gray-600">USN: {fetchedUser.usn}</p>
                      <p className="text-xs text-gray-500">Email: {fetchedUser.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={issueData.dueDate}
                  onChange={e => setIssueData({ ...issueData, dueDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  disabled={!fetchedBook?.is_available || !fetchedUser}
                  className={`w-full px-4 py-3 border ${formErrors.dueDate ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed`}
                />
                {formErrors.dueDate && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.dueDate}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={resetIssueModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueBook}
                disabled={isOperationLoading || !fetchedBook?.is_available || !fetchedUser || !issueData.dueDate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Issue Book</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Book Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 md:p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Return Book</h3>
              <button
                onClick={resetReturnModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Fetch User by RFID Scan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scan User Card</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={returnData.userUid}
                    onChange={e => setReturnData({ ...returnData, userUid: e.target.value })}
                    placeholder="User UID will appear after scan"
                    readOnly
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                  />
                  <button
                    onClick={handleReturnFetchUserByUid}
                    disabled={returnUserUidFetchLoading}
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
                    title="Fetch from RFID Scanner"
                  >
                    {returnUserUidFetchLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Scan className="w-4 h-4" />
                    )}
                    <span>Fetch</span>
                  </button>
                </div>
                {returnUserUidFetchError && (
                  <p className="mt-1 text-red-500 text-xs flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {returnUserUidFetchError}
                  </p>
                )}
              </div>

              {/* User Details Display */}
              {returnFetchedUser && (
                <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                  <div className="flex items-start space-x-3">
                    <User className="w-5 h-5 mt-0.5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{returnFetchedUser.name}</p>
                      <p className="text-sm text-gray-600">USN: {returnFetchedUser.usn}</p>
                      <p className="text-xs text-gray-500">Email: {returnFetchedUser.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Select Book from User's Issued Books */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Book to Return
                </label>
                {issuedBooksLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading issued books...</span>
                  </div>
                ) : userIssuedBooks.length > 0 ? (
                  <select
                    value={returnData.bookId}
                    onChange={e => handleReturnBookSelection(e.target.value)}
                    className={`w-full px-4 py-3 border ${formErrors.bookId ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                  >
                    <option value="">Select a book</option>
                    {userIssuedBooks.map(book => (
                      <option key={book.id} value={book.id.toString()}>
                        {book.title} - {book.author}
                        {book.has_pending_fine ? ` (Fine: ₹${book.fine_amount})` : ''}
                      </option>
                    ))}
                  </select>
                ) : returnFetchedUser ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No issued books found for this user
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Scan a user card to see their issued books
                  </div>
                )}
                {formErrors.bookId && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.bookId}</p>
                )}
              </div>

              {/* Fine Warning */}
              {selectedReturnBook?.has_pending_fine && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
                  <div className="flex">
                    <AlertTriangle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                      <p className="font-medium">Outstanding Fine</p>
                      <p className="mt-1">
                        This book has an outstanding fine of ₹{selectedReturnBook.fine_amount}. 
                        Please pay the fine before returning the book.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Book Condition */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Book Condition
                </label>
                <select
                  value={returnData.condition}
                  onChange={e => setReturnData({ ...returnData, condition: e.target.value })}
                  disabled={!selectedReturnBook || selectedReturnBook.has_pending_fine}
                  className={`w-full px-4 py-3 border ${formErrors.condition ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed`}
                >
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="damaged">Damaged</option>
                  <option value="lost">Lost</option>
                </select>
                {formErrors.condition && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.condition}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={returnData.notes}
                  onChange={e => setReturnData({ ...returnData, notes: e.target.value })}
                  rows={3}
                  disabled={!selectedReturnBook || selectedReturnBook.has_pending_fine}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Any additional notes about the book condition..."
                />
              </div>

              {/* Condition Warning */}
              {(returnData.condition === 'damaged' || returnData.condition === 'lost') && !selectedReturnBook?.has_pending_fine && (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg">
                  <div className="flex">
                    <AlertTriangle className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">Additional Action Required</p>
                      <p className="mt-1">
                        {returnData.condition === 'damaged'
                          ? 'This book is marked as damaged. Additional fees may apply.'
                          : 'This book is marked as lost. Replacement fees will be charged.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={resetReturnModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnBook}
                disabled={isOperationLoading || !selectedReturnBook || selectedReturnBook.has_pending_fine}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Return Book</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isOperationLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <Loader className="w-6 h-6 animate-spin text-purple-600" />
            <span className="text-gray-700">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;
