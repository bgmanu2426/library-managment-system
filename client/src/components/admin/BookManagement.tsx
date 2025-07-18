import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Edit3,
  Trash2,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  RotateCcw,
  User,
  RefreshCw,
  Loader,
  DollarSign,
} from 'lucide-react';
import {
  getBooks,
  createBook,
  updateBook,
  deleteBook,
  searchBooks,
  getRacks,
  getShelves,
  getUsers,
  issueBook,
  returnBook,
  getFines,
} from '../../utils/api';
import {
  Book,
  Rack,
  Shelf,
  BookCreatePayload,
  BookUpdatePayload,
  User as AppUser,
  IssueBookPayload,
  ReturnBookPayload,
} from '../../types';
import { useAuth } from '../../context/AuthContext';

const BookManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'issued'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    isbn: '',
    genre: '',
    rackId: '',
    shelfId: '',
  });
  const [issueData, setIssueData] = useState({
    isbn: '',
    userUsn: '',
    dueDate: '',
  });
  const [returnData, setReturnData] = useState({
    isbn: '',
    userUsn: '',
    condition: 'good' as 'good' | 'damaged' | 'lost',
    notes: '',
  });

  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
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
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [fineStatusCache, setFineStatusCache] = useState<{ [bookId: number]: boolean }>({});
  const [isCheckingFines, setIsCheckingFines] = useState(false);

  const getRackName = (rackId: number) => {
    return racks.find(rack => rack.id === rackId)?.name || 'Unknown';
  };

  const getShelfName = (shelfId: number) => {
    return shelves.find(shelf => shelf.id === shelfId)?.name || 'Unknown';
  };

  const getAvailableShelves = (rackId: number) => {
    return shelves.filter(shelf => shelf.rack_id === rackId);
  };

  const checkBookHasPendingFines = useCallback(
    async (bookId: number): Promise<boolean> => {
      // Check cache first
      if (fineStatusCache[bookId] !== undefined) {
        return fineStatusCache[bookId];
      }

      try {
        const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
        if (!token) return false;

        const response = await getFines(token, 'pending');
        const bookInState = books.find(b => b.id === bookId);
        const hasPendingFines = response.fines.some(
          fine => bookInState && fine.book_isbn === bookInState.isbn
        );

        // Update cache
        setFineStatusCache(prev => ({ ...prev, [bookId]: hasPendingFines }));
        return hasPendingFines;
      } catch (error) {
        console.error('Error checking fine status:', error);
        return false;
      }
    },
    [fineStatusCache, books]
  );

  const checkMultipleBooksFineStatus = useCallback(
    async (bookIds: number[]) => {
      if (bookIds.length === 0) return;

      setIsCheckingFines(true);
      try {
        const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
        if (!token) return;

        const response = await getFines(token, 'pending');
        const newFineStatusCache: { [bookId: number]: boolean } = {};

        bookIds.forEach(bookId => {
          const book = books.find(b => b.id === bookId);
          if (book) {
            const hasPendingFines = response.fines.some(fine => fine.book_isbn === book.isbn);
            newFineStatusCache[book.id] = hasPendingFines;
          }
        });

        setFineStatusCache(prev => ({ ...prev, ...newFineStatusCache }));
      } catch (error) {
        console.error('Error checking multiple books fine status:', error);
      } finally {
        setIsCheckingFines(false);
      }
    },
    [books]
  );

  const getStatusIcon = (isAvailable: boolean) => {
    return isAvailable ? (
      <CheckCircle className="w-4 h-4 text-emerald-600" />
    ) : (
      <Clock className="w-4 h-4 text-amber-600" />
    );
  };

  const getStatusColor = (isAvailable: boolean) => {
    return isAvailable ? 'text-emerald-600' : 'text-amber-600';
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setCurrentPage(0); // Reset to first page on refresh
    setSearchTerm(''); // Clear search term on refresh
    setFilterStatus('all'); // Reset filter status on refresh
    setFineStatusCache({}); // Clear fine status cache on refresh
  };

  const fetchData = useCallback(async () => {
    if (!user) {
      setError('Authentication required');
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

      const [booksResponse, racksResponse, shelvesResponse, usersResponse] = await Promise.all([
        getBooks(token, currentPage * itemsPerPage, itemsPerPage),
        getRacks(token),
        getShelves(token),
        getUsers(token, 0, 1000),
      ]);

      // Handle proper response format from updated API
      if (booksResponse && typeof booksResponse === 'object') {
        setBooks(booksResponse.books || []);
        setTotalBooks(booksResponse.total || 0);
      } else {
        setBooks([]);
        setTotalBooks(0);
      }

      if (racksResponse && typeof racksResponse === 'object') {
        setRacks(racksResponse.racks || []);
      } else {
        setRacks([]);
      }

      if (shelvesResponse && typeof shelvesResponse === 'object') {
        setShelves(shelvesResponse.shelves || []);
      } else {
        setShelves([]);
      }

      if (usersResponse && typeof usersResponse === 'object') {
        setUsers(usersResponse.users || []);
        setTotalUsers(usersResponse.total || 0);
      } else {
        setUsers([]);
        setTotalUsers(0);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
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
        setError('Failed to load data. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, currentPage, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (books.length > 0) {
      const issuedBookIds = books.filter(book => !book.is_available).map(book => book.id);
      if (issuedBookIds.length > 0) {
        checkMultipleBooksFineStatus(issuedBookIds);
      }
    }
  }, [books, checkMultipleBooksFineStatus]);

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

  const filteredBooks = useMemo(() => {
    // Ensure we have valid arrays to work with
    const sourceBooks = searchTerm
      ? Array.isArray(searchResults)
        ? searchResults
        : []
      : Array.isArray(books)
        ? books
        : [];

    return sourceBooks.filter(book => {
      // Add null/undefined checks for book properties
      if (!book || typeof book !== 'object') return false;

      const matchesFilter =
        filterStatus === 'all' ||
        (filterStatus === 'available' && Boolean(book.is_available)) ||
        (filterStatus === 'issued' && !Boolean(book.is_available));
      return matchesFilter;
    });
  }, [searchTerm, searchResults, books, filterStatus]);

  const validateBookForm = (
    bookData: BookCreatePayload | BookUpdatePayload
  ): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};

    if (!bookData.title?.trim()) {
      errors.title = 'Title is required';
    } else if (bookData.title.trim().length < 2) {
      errors.title = 'Title must be at least 2 characters long';
    }

    if (!bookData.author?.trim()) {
      errors.author = 'Author is required';
    } else if (bookData.author.trim().length < 2) {
      errors.author = 'Author must be at least 2 characters long';
    }

    if ('isbn' in bookData && !bookData.isbn?.trim()) {
      errors.isbn = 'ISBN is required';
    } else if (
      'isbn' in bookData &&
      bookData.isbn &&
      !/^[\d\-X]+$/.test(bookData.isbn.replace(/\s/g, ''))
    ) {
      errors.isbn = 'Please enter a valid ISBN (digits, hyphens, and X only)';
    }

    if (!bookData.genre?.trim()) {
      errors.genre = 'Genre is required';
    }

    if (!bookData.rack_id || bookData.rack_id === 0) {
      errors.rack_id = 'Rack selection is required';
    }

    if (!bookData.shelf_id || bookData.shelf_id === 0) {
      errors.shelf_id = 'Shelf selection is required';
    }

    return errors;
  };

  const handleAddBook = async () => {
    if (!user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const bookData: BookCreatePayload = {
      title: newBook.title.trim(),
      author: newBook.author.trim(),
      isbn: newBook.isbn.trim(),
      genre: newBook.genre.trim(),
      rack_id: parseInt(newBook.rackId),
      shelf_id: parseInt(newBook.shelfId),
    };

    const errors = validateBookForm(bookData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await createBook(token, bookData);
      showNotification('success', 'Book added successfully');
      setNewBook({
        title: '',
        author: '',
        isbn: '',
        genre: '',
        rackId: '',
        shelfId: '',
      });
      setFormErrors({});
      setShowAddModal(false);
      handleRefresh();
    } catch (err) {
      console.error('Failed to add book:', err);
      if (err instanceof Error) {
        if (err.message.includes('already exists')) {
          showNotification('error', 'A book with this ISBN already exists.');
        } else if (err.message.includes('full capacity')) {
          showNotification(
            'error',
            'Selected shelf is at full capacity. Please choose another shelf.'
          );
        } else if (err.message.includes('401')) {
          showNotification('error', 'Authentication expired. Please log in again.');
        } else if (err.message.includes('403')) {
          showNotification('error', 'Access denied. You do not have permission to add books.');
        } else if (err.message.includes('Network')) {
          showNotification('error', 'Network error. Please check your connection and try again.');
        } else {
          showNotification('error', err.message);
        }
      } else {
        showNotification('error', 'Failed to add book. Please try again.');
      }
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleEditBook = (book: Book) => {
    setSelectedBook({ ...book });
    setFormErrors({}); // Clear previous errors
    setShowEditModal(true);
  };

  const handleUpdateBook = async () => {
    if (!selectedBook || !user) {
      showNotification('error', 'Authentication required');
      return;
    }

    const bookData: BookUpdatePayload = {
      title: selectedBook.title.trim(),
      author: selectedBook.author.trim(),
      genre: selectedBook.genre.trim(),
      rack_id: selectedBook.rack_id,
      shelf_id: selectedBook.shelf_id,
    };

    const errors = validateBookForm(bookData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await updateBook(token, selectedBook.id, bookData);
      showNotification('success', 'Book updated successfully');
      setShowEditModal(false);
      setSelectedBook(null);
      setFormErrors({});
      handleRefresh();
    } catch (err) {
      console.error('Failed to update book:', err);
      if (err instanceof Error) {
        if (err.message.includes('not found')) {
          showNotification('error', 'Book not found. Please refresh and try again.');
        } else if (err.message.includes('401')) {
          showNotification('error', 'Authentication expired. Please log in again.');
        } else if (err.message.includes('403')) {
          showNotification('error', 'Access denied. You do not have permission to update books.');
        } else if (err.message.includes('Network')) {
          showNotification('error', 'Network error. Please check your connection and try again.');
        } else {
          showNotification('error', err.message);
        }
      } else {
        showNotification('error', 'Failed to update book. Please try again.');
      }
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleDeleteBook = (book: Book) => {
    setSelectedBook(book);
    setShowDeleteModal(true);
  };

  const confirmDeleteBook = async () => {
    if (!selectedBook || !user) {
      showNotification('error', 'Authentication required');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await deleteBook(token, selectedBook.id);
      showNotification('success', 'Book deleted successfully');
      setShowDeleteModal(false);
      setSelectedBook(null);
      handleRefresh();
    } catch (err) {
      console.error('Failed to delete book:', err);
      if (err instanceof Error) {
        if (err.message.includes('not found')) {
          showNotification('error', 'Book not found. Please refresh and try again.');
        } else if (err.message.includes('currently issued')) {
          showNotification(
            'error',
            'Cannot delete book that is currently issued. Please return the book first.'
          );
        } else if (err.message.includes('401')) {
          showNotification('error', 'Authentication expired. Please log in again.');
        } else if (err.message.includes('403')) {
          showNotification('error', 'Access denied. You do not have permission to delete books.');
        } else if (err.message.includes('Network')) {
          showNotification('error', 'Network error. Please check your connection and try again.');
        } else {
          showNotification('error', err.message);
        }
      } else {
        showNotification('error', 'Failed to delete book. Please try again.');
      }
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleReturnBook = (book: Book) => {
    setSelectedBook(book);
    setReturnData({
      isbn: book.isbn,
      userUsn: '',
      condition: 'good',
      notes: '',
    });
    setShowReturnModal(true);
  };

  const confirmReturnBook = async () => {
    if (!selectedBook || !user) {
      showNotification('error', 'Authentication required');
      return;
    }

    if (!returnData.userUsn.trim()) {
      showNotification('error', 'Student USN is required');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const payload: ReturnBookPayload = {
        book_id: selectedBook.id,
        user_id: users.find(u => u.usn === returnData.userUsn)?.id,
        isbn: returnData.isbn,
        user_usn: returnData.userUsn,
        condition: returnData.condition,
        notes: returnData.notes,
      };

      const response = await returnBook(token, payload);

      // Handle enhanced success response with detailed information
      let successMessage = response.message;
      if (response.fine_amount && response.days_overdue) {
        successMessage += ` A fine of ₹${response.fine_amount} has been applied for ${response.days_overdue} overdue days.`;
      }

      showNotification('success', successMessage);
      setShowReturnModal(false);
      setSelectedBook(null);
      setReturnData({
        isbn: '',
        userUsn: '',
        condition: 'good',
        notes: '',
      });
      // Clear fine status cache for this book
      setFineStatusCache(prev => {
        const updated = { ...prev };
        delete updated[selectedBook.id];
        return updated;
      });
      handleRefresh();
    } catch (err) {
      console.error('Failed to return book:', err);
      if (err instanceof Error) {
        // Handle specific error scenarios from enhanced backend
        if (
          err.message.includes('not issued to user') ||
          err.message.includes('not issued to this user')
        ) {
          showNotification(
            'error',
            'This book is not issued to the specified user. Please verify the correct user USN.'
          );
        } else if (err.message.includes('unpaid fine') || err.message.includes('pending fine')) {
          showNotification(
            'error',
            'Cannot return this book. Please pay the pending fine first before returning the book.'
          );
        } else if (err.message.includes('not currently issued')) {
          showNotification('error', 'This book is not currently issued and cannot be returned.');
        } else if (err.message.includes('book not found')) {
          showNotification('error', 'Book not found. Please refresh and try again.');
        } else if (err.message.includes('user not found')) {
          showNotification('error', 'User not found. Please verify the USN and try again.');
        } else if (err.message.includes('No active transaction')) {
          showNotification(
            'error',
            'No active transaction found for this book and user combination.'
          );
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

  const handleIssueBook = async () => {
    if (!user) {
      showNotification('error', 'Authentication required');
      return;
    }

    if (!issueData.isbn.trim() || !issueData.userUsn.trim() || !issueData.dueDate) {
      showNotification('error', 'All fields are required for book issue');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const payload: IssueBookPayload = {
        isbn: issueData.isbn.trim(),
        user_usn: issueData.userUsn.trim(),
        due_date: issueData.dueDate,
      };

      await issueBook(token, payload);
      showNotification('success', 'Book issued successfully');
      setIssueData({
        isbn: '',
        userUsn: '',
        dueDate: '',
      });
      setShowIssueModal(false);
      handleRefresh();
    } catch (err) {
      console.error('Failed to issue book:', err);
      if (err instanceof Error) {
        if (err.message.includes('not available')) {
          showNotification('error', 'This book is not available for issue.');
        } else if (err.message.includes('user not found')) {
          showNotification('error', 'User not found. Please verify the USN.');
        } else if (err.message.includes('book not found')) {
          showNotification('error', 'Book not found. Please verify the ISBN.');
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

  let searchTimeout: ReturnType<typeof setTimeout>;

  if (isLoading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl md:rounded-2xl p-6 md:p-8 text-white">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Book Management</h1>
          <p className="text-emerald-100 text-sm md:text-base">Loading book data...</p>
        </div>
        <div className="flex justify-center items-center p-12">
          <Loader className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-xl md:rounded-2xl p-6 md:p-8 text-white">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Error Loading Books</h1>
          <p className="text-red-100 text-sm md:text-base mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl md:rounded-2xl p-6 md:p-8 text-white relative">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Book Management</h1>
        <p className="text-emerald-100 text-sm md:text-base">
          Manage your library's book collection and inventory
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

      {/* Controls */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
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
                className="w-full pl-9 md:pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>

            {/* Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as 'all' | 'available' | 'issued')}
                className="pl-9 md:pl-10 pr-8 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none bg-white text-sm md:text-base"
              >
                <option value="all">All Books</option>
                <option value="available">Available</option>
                <option value="issued">Issued</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => {
                setShowAddModal(true);
                setFormErrors({});
                setNewBook({ title: '', author: '', isbn: '', genre: '', rackId: '', shelfId: '' });
              }}
              className="flex items-center justify-center space-x-2 bg-emerald-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-lg hover:bg-emerald-700 transition-colors duration-200 text-sm md:text-base"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              <span>Add Book</span>
            </button>
            <button
              onClick={() => {
                setShowIssueModal(true);
                setIssueData({ isbn: '', userUsn: '', dueDate: '' });
              }}
              className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm md:text-base"
            >
              <User className="w-4 h-4 md:w-5 md:h-5" />
              <span>Issue Book</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Books</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {isOperationLoading ? <Loader className="w-6 h-6 animate-spin" /> : totalBooks || 0}
              </p>
            </div>
            <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Available</p>
              <p className="text-xl md:text-2xl font-bold text-emerald-600">
                {isOperationLoading ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : Array.isArray(books) ? (
                  books.filter(book => book && book.is_available).length
                ) : (
                  0
                )}
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
                {isOperationLoading ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : Array.isArray(books) ? (
                  books.filter(book => book && !book.is_available).length
                ) : (
                  0
                )}
              </p>
            </div>
            <Clock className="w-6 h-6 md:w-8 md:h-8 text-amber-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Racks</p>
              <p className="text-xl md:text-2xl font-bold text-purple-600">
                {isOperationLoading ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : Array.isArray(racks) ? (
                  racks.length
                ) : (
                  0
                )}
              </p>
            </div>
            <Package className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Books Table */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-200">
          <h3 className="text-base md:text-lg font-semibold text-gray-900">
            Books ({Array.isArray(filteredBooks) ? filteredBooks.length : 0})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Book Details
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ISBN
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBooks
                .map(book => {
                  // Defensive checks for book object and required properties
                  if (!book || typeof book !== 'object' || !book.id) return null;

                  return (
                    <tr key={book.id} className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {book.title || 'Unknown Title'}
                          </div>
                          <div className="text-sm text-gray-500">
                            by {book.author || 'Unknown Author'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {book.genre || 'Unknown Genre'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {book.rack_id ? getRackName(book.rack_id) : 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {book.shelf_id ? getShelfName(book.shelf_id) : 'Unknown'}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div
                          className={`flex items-center space-x-2 ${getStatusColor(Boolean(book.is_available))}`}
                        >
                          {getStatusIcon(Boolean(book.is_available))}
                          <span className="text-sm font-medium">
                            {book.is_available ? 'Available' : 'Issued'}
                          </span>
                          {!book.is_available && fineStatusCache[book.id] && (
                            <div className="relative group">
                              <DollarSign
                                className="w-4 h-4 text-red-500"
                                title="Has pending fines"
                              />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-red-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                Pending fines
                              </div>
                            </div>
                          )}
                          {!book.is_available && isCheckingFines && (
                            <Loader className="w-3 h-3 animate-spin text-gray-400" />
                          )}
                        </div>
                        {!book.is_available && book.return_date && (
                          <div className="text-xs text-gray-500 mt-1">
                            Due: {new Date(book.return_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {book.isbn || 'N/A'}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-1 md:space-x-2">
                          <button
                            onClick={() => handleEditBook(book)}
                            disabled={isOperationLoading}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded disabled:opacity-50"
                            title="Edit Book"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBook(book)}
                            disabled={isOperationLoading}
                            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Delete Book"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {!book.is_available && !fineStatusCache[book.id] && (
                            <button
                              onClick={() => handleReturnBook(book)}
                              disabled={isOperationLoading || isCheckingFines}
                              className="text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-50 rounded disabled:opacity-50"
                              title="Return Book"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {!book.is_available && fineStatusCache[book.id] && (
                            <div className="relative group">
                              <button
                                disabled
                                className="text-gray-400 p-1 cursor-not-allowed"
                                title="Cannot return - pending fines"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-red-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                Pay fine first
                              </div>
                            </div>
                          )}
                          {book.is_available && (
                            <button
                              onClick={() => {
                                setIssueData({ isbn: book.isbn, userUsn: '', dueDate: '' });
                                setShowIssueModal(true);
                              }}
                              disabled={isOperationLoading}
                              className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded disabled:opacity-50"
                              title="Issue Book"
                            >
                              <User className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
                .filter(Boolean)}
            </tbody>
          </table>
        </div>

        {filteredBooks.length === 0 && (
          <div className="text-center py-8 md:py-12">
            <BookOpen className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-4" />
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
                Showing {Math.min(currentPage * itemsPerPage + 1, totalBooks || 0)} to{' '}
                {Math.min((currentPage + 1) * itemsPerPage, totalBooks || 0)} of {totalBooks || 0}{' '}
                books
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setCurrentPage(prev => Math.max(0, prev - 1));
                    setRefreshKey(prev => prev + 1);
                  }}
                  disabled={currentPage === 0 || isLoading}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
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
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Return Book Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg md:text-xl font-bold text-gray-900">Return Book</h3>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            {selectedBook && (
              <div className="bg-purple-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-purple-900 mb-2">Book Information</h4>
                <div className="space-y-1 text-sm text-purple-800">
                  <div>
                    <span className="font-medium">Title:</span> {selectedBook.title}
                  </div>
                  <div>
                    <span className="font-medium">Author:</span> {selectedBook.author}
                  </div>
                  <div>
                    <span className="font-medium">ISBN:</span> {selectedBook.isbn}
                  </div>
                  {selectedBook.return_date && (
                    <div>
                      <span className="font-medium">Due Date:</span>{' '}
                      {new Date(selectedBook.return_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Book ISBN</label>
                <input
                  type="text"
                  value={returnData.isbn}
                  onChange={e => setReturnData({ ...returnData, isbn: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm md:text-base"
                  placeholder="Enter book ISBN"
                  disabled={!!selectedBook}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student USN</label>
                <input
                  type="text"
                  value={returnData.userUsn}
                  onChange={e => setReturnData({ ...returnData, userUsn: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm md:text-base"
                  placeholder="Enter student USN"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Book Condition
                </label>
                <select
                  value={returnData.condition}
                  onChange={e =>
                    setReturnData({
                      ...returnData,
                      condition: e.target.value as 'good' | 'damaged' | 'lost',
                    })
                  }
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm md:text-base"
                >
                  <option value="good">Good Condition</option>
                  <option value="damaged">Damaged</option>
                  <option value="lost">Lost</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={returnData.notes}
                  onChange={e => setReturnData({ ...returnData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm md:text-base"
                  placeholder="Any additional notes about the return..."
                />
              </div>

              {returnData.condition !== 'good' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
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

            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
              <button
                onClick={() => setShowReturnModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmReturnBook}
                disabled={isOperationLoading}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm md:text-base disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Process Return</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg md:text-xl font-bold text-gray-900">Add New Book</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={newBook.title}
                  onChange={e => setNewBook({ ...newBook, title: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                  placeholder="Enter book title"
                />
                {formErrors.title && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.title}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                <input
                  type="text"
                  value={newBook.author}
                  onChange={e => setNewBook({ ...newBook, author: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                  placeholder="Enter author name"
                />
                {formErrors.author && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.author}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ISBN</label>
                <input
                  type="text"
                  value={newBook.isbn}
                  onChange={e => setNewBook({ ...newBook, isbn: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                  placeholder="Enter ISBN"
                />
                {formErrors.isbn && <p className="mt-1 text-red-500 text-xs">{formErrors.isbn}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                <input
                  type="text"
                  value={newBook.genre}
                  onChange={e => setNewBook({ ...newBook, genre: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                  placeholder="Enter genre"
                />
                {formErrors.genre && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.genre}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rack</label>
                <select
                  value={newBook.rackId}
                  onChange={e => setNewBook({ ...newBook, rackId: e.target.value, shelfId: '' })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                >
                  <option value="">Select a rack</option>
                  {racks.map(rack => (
                    <option key={rack.id} value={rack.id.toString()}>
                      {rack.name}
                    </option>
                  ))}
                </select>
                {formErrors.rack_id && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.rack_id}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shelf</label>
                <select
                  value={newBook.shelfId}
                  onChange={e => setNewBook({ ...newBook, shelfId: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                  disabled={!newBook.rackId}
                >
                  <option value="">Select a shelf</option>
                  {newBook.rackId &&
                    getAvailableShelves(parseInt(newBook.rackId)).map(shelf => (
                      <option key={shelf.id} value={shelf.id.toString()}>
                        {shelf.name} ({shelf.current_books}/{shelf.capacity})
                      </option>
                    ))}
                </select>
                {formErrors.shelf_id && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.shelf_id}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBook}
                disabled={isOperationLoading}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm md:text-base disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Add Book</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {showEditModal && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg md:text-xl font-bold text-gray-900">Edit Book</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={selectedBook.title}
                  onChange={e => setSelectedBook({ ...selectedBook, title: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                />
                {formErrors.title && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.title}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                <input
                  type="text"
                  value={selectedBook.author}
                  onChange={e => setSelectedBook({ ...selectedBook, author: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                />
                {formErrors.author && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.author}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ISBN</label>
                <input
                  type="text"
                  value={selectedBook.isbn}
                  disabled
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 text-sm md:text-base"
                />
                <p className="text-xs text-gray-500 mt-1">ISBN cannot be modified</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                <input
                  type="text"
                  value={selectedBook.genre}
                  onChange={e => setSelectedBook({ ...selectedBook, genre: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                />
                {formErrors.genre && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.genre}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rack</label>
                <select
                  value={selectedBook.rack_id.toString()}
                  onChange={e =>
                    setSelectedBook({
                      ...selectedBook,
                      rack_id: parseInt(e.target.value),
                      shelf_id: 0,
                    })
                  }
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                >
                  <option value="">Select a rack</option>
                  {racks.map(rack => (
                    <option key={rack.id} value={rack.id.toString()}>
                      {rack.name}
                    </option>
                  ))}
                </select>
                {formErrors.rack_id && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.rack_id}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shelf</label>
                <select
                  value={selectedBook.shelf_id.toString()}
                  onChange={e =>
                    setSelectedBook({ ...selectedBook, shelf_id: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm md:text-base"
                  disabled={!selectedBook.rack_id}
                >
                  <option value="">Select a shelf</option>
                  {selectedBook.rack_id &&
                    getAvailableShelves(selectedBook.rack_id).map(shelf => (
                      <option key={shelf.id} value={shelf.id.toString()}>
                        {shelf.name} ({shelf.current_books}/{shelf.capacity})
                      </option>
                    ))}
                </select>
                {formErrors.shelf_id && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.shelf_id}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBook}
                disabled={isOperationLoading}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm md:text-base disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Update Book</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Book Modal */}
      {showDeleteModal && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 md:p-8 max-w-md w-full">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-red-100 rounded-full mr-4">
                <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900">Delete Book</h3>
                <p className="text-gray-600 text-sm md:text-base">This action cannot be undone</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <strong>{selectedBook.title}</strong>?
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Author: {selectedBook.author} • ISBN: {selectedBook.isbn}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteBook}
                disabled={isOperationLoading}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm md:text-base disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Delete Book</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Book Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 md:p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg md:text-xl font-bold text-gray-900">Issue Book</h3>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Book ISBN</label>
                <input
                  type="text"
                  value={issueData.isbn}
                  onChange={e => setIssueData({ ...issueData, isbn: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
                  placeholder="Enter book ISBN"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student USN</label>
                <input
                  type="text"
                  value={issueData.userUsn}
                  onChange={e => setIssueData({ ...issueData, userUsn: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
                  placeholder="Enter student USN"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={issueData.dueDate}
                  onChange={e => setIssueData({ ...issueData, dueDate: e.target.value })}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
              <button
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueBook}
                disabled={isOperationLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm md:text-base disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Issue Book</span>
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
              <RotateCcw className="w-5 h-5" />
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
            <Loader className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-gray-700">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookManagement;
