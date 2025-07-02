import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  BookOpen,
  Star,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader,
  User,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import {
  getAvailableBooks,
  searchAvailableBooks,
  getCurrentBooks,
  getUserProfile,
  getUserRacks,
  getUserShelves,
  getBooksbyCategory,
  getUserDashboardStats
} from '../../utils/api';
import { Book, Rack, Shelf, User as UserType, BookResponse } from '../../types';
import { useAuth } from '../../context/AuthContext';

const UserDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRacks, setExpandedRacks] = useState<string[]>(['1']); // Computer Science expanded by default
  const [books, setBooks] = useState<BookResponse[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [currentBooks, setCurrentBooks] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [totalBooks, setTotalBooks] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchResults, setSearchResults] = useState<BookResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [categorizedBooks, setCategorizedBooks] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [overdueBooks, setOverdueBooks] = useState<any[]>([]);

  const { user } = useAuth();

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setError('Authentication required. Please log in to access the library.');
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

      const [booksResponse, racksResponse, shelvesResponse, currentBooksResponse, profileResponse, categorizedBooksResponse, dashboardStatsResponse] = await Promise.all([
        getAvailableBooks(token, page * limit, limit),
        getUserRacks(token),
        getUserShelves(token),
        getCurrentBooks(token),
        getUserProfile(token),
        getBooksbyCategory(token),
        getUserDashboardStats(token)
      ]);

      const fetchedBooks = booksResponse.books || [];

      if (page === 0) {
        setBooks(fetchedBooks);
      } else {
        setBooks(prev => [...prev, ...fetchedBooks]);
      }

      setTotalBooks(booksResponse.total || 0);
      setHasMore(fetchedBooks.length === limit);
      setRacks(racksResponse.racks || []);
      setShelves(shelvesResponse.shelves || []);
      setCurrentBooks(currentBooksResponse.books || []);
      setUserProfile(profileResponse || user);
      setCategorizedBooks(categorizedBooksResponse.categories || []);
      setDashboardStats(dashboardStatsResponse || null);
      setOverdueBooks(dashboardStatsResponse?.overdue_books || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      if (err instanceof Error && err.message.includes('401')) {
        setError('Authentication expired. Please log in again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, page, limit, refreshKey]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSearch = useCallback(async (query: string) => {
    if (!user) {
      showNotification('error', 'Authentication required');
      return;
    }

    if (!query.trim()) {
      setSearchResults([]);
      setPage(0); // Reset page to 0 to fetch initial books
      fetchDashboardData(); // Refetch all books
      return;
    }

    setIsSearching(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await searchAvailableBooks(token, query, 0, 50); // Fetch up to 50 results for search
      setSearchResults(response.books || []);
      showNotification('success', `Found ${response.books.length} books.`);
    } catch (err) {
      console.error('Search failed:', err);
      showNotification('error', 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [user, fetchDashboardData]);

  let searchTimeout: ReturnType<typeof setTimeout>;
  const handleSearchInput = (query: string) => {
    setSearchTerm(query);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      handleSearch(query);
    }, 300);
  };

  const loadMoreBooks = () => {
    // Only load more if not currently searching
    if (!searchTerm) {
      setPage(prevPage => prevPage + 1);
    }
  };

  const handleRefresh = () => {
    setSearchTerm(''); // Clear search term on refresh
    setSearchResults([]); // Clear search results
    setPage(0);
    setRefreshKey(prev => prev + 1);
  };

  const displayBooks = searchTerm ? searchResults : books;

  const getShelfForBook = (shelfId: number) => {
    return shelves.find(shelf => shelf.id === shelfId);
  };

  const getRackForBook = (rackId: number) => {
    return racks.find(rack => rack.id === rackId);
  };

  const getBooksForRack = (rackId: number) => {
    if (searchTerm && searchResults.length > 0) {
      return searchResults.filter(book =>
        book && typeof book.rack_id === 'number' && book.rack_id === rackId
      );
    }

    // First try to get books from categorized data which has proper rack associations
    const categoryData = categorizedBooks.find(cat => cat && cat.rack_id === rackId);
    if (categoryData && Array.isArray(categoryData.books)) {
      return categoryData.books.filter(book => book && book.rack_id === rackId);
    }

    // Fallback to regular books array with defensive checks
    return books.filter(book =>
      book && typeof book.rack_id === 'number' && book.rack_id === rackId
    );
  };

  const getRackStats = (rackId: number) => {
    // First try to get stats from categorized data which should have accurate statistics
    const categoryData = categorizedBooks.find(cat => cat && cat.rack_id === rackId);
    if (categoryData && categoryData.statistics) {
      return {
        total: categoryData.statistics.total || 0,
        available: categoryData.statistics.available || 0,
        issued: categoryData.statistics.issued || 0
      };
    }

    // Fallback to calculating from books array with defensive programming
    const allRackBooks = books.filter(book =>
      book && typeof book.rack_id === 'number' && book.rack_id === rackId
    );
    const availableBooks = allRackBooks.filter(book =>
      book && typeof book.is_available === 'boolean' && book.is_available
    );
    const issuedBooks = allRackBooks.filter(book =>
      book && typeof book.is_available === 'boolean' && !book.is_available
    );

    return {
      total: allRackBooks.length,
      available: availableBooks.length,
      issued: issuedBooks.length
    };
  };

  const toggleRackExpansion = (rackId: string) => {
    setExpandedRacks(prev =>
      prev.includes(rackId)
        ? prev.filter(id => id !== rackId)
        : [...prev, rackId]
    );
  };

  const renderStars = (rating: number = 4) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-2.5 h-2.5 md:w-3 md:h-3 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const BookCard: React.FC<{ book: BookResponse }> = ({ book }) => {
    if (!book || typeof book !== 'object') {
      return null;
    }

    const shelf = book.shelf_id && typeof book.shelf_id === 'number'
      ? getShelfForBook(book.shelf_id)
      : null;

    return (
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100 p-3 md:p-4 hover:shadow-md transition-all duration-200 hover:scale-105 cursor-pointer">
        {/* Book Icon */}
        <div className="flex justify-center mb-2 md:mb-3">
          <div className="relative">
            <div className="w-12 h-16 md:w-16 md:h-20 bg-gradient-to-b from-blue-400 to-blue-600 rounded-lg shadow-md flex items-center justify-center">
              <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            {/* Availability indicator */}
            <div className={`absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-white ${
              book.is_available ? 'bg-emerald-500' : 'bg-red-500'
            }`}></div>
          </div>
        </div>

        {/* Book Details */}
        <div className="text-center space-y-1 md:space-y-2">
          <h3 className="font-medium text-gray-900 text-xs md:text-sm line-clamp-2 min-h-[2rem] md:min-h-[2.5rem] leading-tight">
            {book.title || 'Unknown Title'}
          </h3>
          <p className="text-xs text-gray-600 truncate">{book.author || 'Unknown Author'}</p>
          <p className="text-xs text-gray-500 truncate">{book.genre || 'Unknown Genre'}</p>

          {/* Star Rating */}
          <div className="flex justify-center">
            {renderStars()}
          </div>

          {/* Location */}
          <div className="text-xs text-gray-500 truncate">
            {shelf?.name || 'Unknown Location'}
          </div>

          {/* Status */}
          <div className={`text-xs font-medium ${
            book.is_available ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {book.is_available ? 'Available' : 'Issued'}
          </div>
        </div>
      </div>
    );
  };

  // Skeleton loader for book cards
  const BookCardSkeleton = () => {
    return (
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100 p-3 md:p-4">
        <div className="flex justify-center mb-2 md:mb-3">
          <div className="w-12 h-16 md:w-16 md:h-20 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
        <div className="space-y-2 md:space-y-3">
          <div className="h-3 md:h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-2 md:h-3 bg-gray-200 rounded animate-pulse w-3/4 mx-auto"></div>
          <div className="flex justify-center">
            <div className="h-2 bg-gray-200 rounded animate-pulse w-16"></div>
          </div>
          <div className="h-2 bg-gray-200 rounded animate-pulse w-1/2 mx-auto"></div>
          <div className="h-2 bg-gray-200 rounded animate-pulse w-1/3 mx-auto"></div>
        </div>
      </div>
    );
  };

  // Loading skeleton for entire section
  if (isLoading && page === 0) {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-xl md:rounded-2xl p-6 md:p-8 text-white">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Library Dashboard</h1>
          <p className="text-blue-100 text-sm md:text-base">Loading library collection...</p>
        </div>

        {/* User Statistics Placeholder */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-lg p-4 md:p-6 animate-pulse">
              <div className="flex items-center">
                <div className="p-3 bg-gray-200 rounded-lg w-10 h-10"></div>
                <div className="ml-4 space-y-2 w-full">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search placeholder */}
        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-6">
          <div className="h-10 md:h-12 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>

        {/* Skeleton racks */}
        <div className="space-y-4 md:space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg md:rounded-xl shadow-lg overflow-hidden">
              <div className="h-24 md:h-28 bg-gray-200 animate-pulse"></div>
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
                  {[...Array(8)].map((_, j) => (
                    <BookCardSkeleton key={j} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="bg-gradient-to-r from-red-600 to-amber-600 rounded-xl md:rounded-2xl p-6 md:p-8 text-white">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Error Loading Books</h1>
          <p className="text-red-100 text-sm md:text-base">{error}</p>
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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-xl md:rounded-2xl p-6 md:p-8 text-white relative">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Library Dashboard</h1>
        <p className="text-blue-100 text-sm md:text-base">Discover and explore our vast collection of books</p>
        <button
          onClick={handleRefresh}
          className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          title="Refresh books"
        >
          <RefreshCw className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Overdue Books Warning */}
      {overdueBooks.length > 0 && (
        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg border-l-4 border-red-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-red-200 mr-3" />
              <div>
                <h3 className="text-lg font-semibold">Overdue Books Alert</h3>
                <p className="text-red-100 text-sm">
                  You have {overdueBooks.length} overdue book{overdueBooks.length > 1 ? 's' : ''} 
                  {dashboardStats?.total_fine_amount > 0 && ` with a total fine of ₹${dashboardStats.total_fine_amount}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{overdueBooks.length}</div>
              <div className="text-xs text-red-200">Overdue</div>
            </div>
          </div>
          
          {/* Overdue Books List */}
          <div className="mt-4 space-y-2">
            {overdueBooks.slice(0, 3).map((book) => (
              <div key={book.id} className="bg-red-600/30 rounded-lg p-3 text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{book.title}</div>
                    <div className="text-red-200 text-xs">Due: {new Date(book.due_date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-red-200">{book.days_overdue} days overdue</div>
                    {book.fine_amount > 0 && (
                      <div className="font-medium">₹{book.fine_amount}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {overdueBooks.length > 3 && (
              <div className="text-center text-red-200 text-xs">
                and {overdueBooks.length - 3} more overdue book{overdueBooks.length - 3 > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Statistics */}
      {(userProfile || dashboardStats) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <User className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs md:text-sm font-medium text-gray-600">Profile</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{userProfile?.name || user?.name}</p>
                <p className="text-xs text-gray-500">{userProfile?.usn || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs md:text-sm font-medium text-gray-600">Available Books</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">
                  {dashboardStats?.available_books_count || totalBooks}
                </p>
                <p className="text-xs text-gray-500">Ready to borrow</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Clock className="w-6 h-6 md:w-8 md:h-8 text-amber-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs md:text-sm font-medium text-gray-600">Borrowed Books</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">
                  {dashboardStats?.borrowed_books_count || currentBooks.length}
                </p>
                <p className="text-xs text-gray-500">Currently borrowed</p>
              </div>
            </div>
          </div>

          <div className={`rounded-lg shadow-lg p-4 md:p-6 ${
            overdueBooks.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-white'
          }`}>
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${
                overdueBooks.length > 0 ? 'bg-red-100' : 'bg-purple-100'
              }`}>
                <AlertTriangle className={`w-6 h-6 md:w-8 md:h-8 ${
                  overdueBooks.length > 0 ? 'text-red-600' : 'text-purple-600'
                }`} />
              </div>
              <div className="ml-4">
                <p className="text-xs md:text-sm font-medium text-gray-600">Overdue Books</p>
                <p className={`text-lg md:text-xl font-bold ${
                  overdueBooks.length > 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {dashboardStats?.overdue_books_count || 0}
                </p>
                <p className={`text-xs ${
                  overdueBooks.length > 0 ? 'text-red-500' : 'text-gray-500'
                }`}>
                  {dashboardStats?.total_fine_amount > 0 
                    ? `Fine: ₹${dashboardStats.total_fine_amount}` 
                    : 'No overdue books'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-6">
        <div className="relative">
          <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
          <input
            type="text"
            placeholder="Search by title, author, or ISBN..."
            value={searchTerm}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-10 md:pl-12 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Current Books Section */}
      {currentBooks.length > 0 && (
        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 text-amber-600 mr-2" />
              Your Current Books
            </h2>
            <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {currentBooks.length} book{currentBooks.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentBooks.map((book) => (
              <div key={book.id} className="bg-gray-50 rounded-lg p-4 border border-amber-200">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <BookOpen className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{book.title}</h3>
                    <p className="text-sm text-gray-600 truncate">{book.author}</p>
                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      <div>Due: {book.due_date ? new Date(book.due_date).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    {book.status === 'overdue' && (
                      <div className="bg-red-100 border border-red-200 rounded-lg p-2 mt-2">
                        <div className="text-red-700 font-medium flex items-center text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          OVERDUE - {book.days_overdue ? `${book.days_overdue} days` : 'Past due date'}
                        </div>
                        {book.fine_amount > 0 && (
                          <div className="text-red-600 font-bold text-sm mt-1">
                            Fine Amount: ₹{book.fine_amount}
                          </div>
                        )}
                        <div className="text-red-600 text-xs mt-1">
                          Please return immediately to avoid additional charges
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Books by Rack */}
      <div className="space-y-4 md:space-y-6">
        {racks.filter(rack => rack && typeof rack.id === 'number').map((rack) => {
          const rackBooks = getBooksForRack(rack.id);
          const rackStats = getRackStats(rack.id);
          const isExpanded = expandedRacks.includes(rack.id.toString());

          if (searchTerm && (!Array.isArray(rackBooks) || rackBooks.length === 0)) {
            return null; // Don't render rack if no books match search term
          }

          return (
            <div key={rack.id} className="bg-white rounded-lg md:rounded-xl shadow-lg overflow-hidden">
              {/* Rack Header */}
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
                onClick={() => toggleRackExpansion(rack.id.toString())}
              >
                <div className="flex items-center justify-between text-white">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg md:text-xl font-bold truncate">{rack.name}</h2>
                    <p className="text-blue-100 text-xs md:text-sm mt-1">{rack.description}</p>

                    {/* Book Statistics */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 text-xs md:text-sm">
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full"></div>
                        <span className="text-blue-200">Total: {rackStats.total}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-400 rounded-full"></div>
                        <span className="text-blue-200">Available: {rackStats.available}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-red-400 rounded-full"></div>
                        <span className="text-blue-200">Issued: {rackStats.issued}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expand/Collapse Icon */}
                  <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 md:w-6 md:h-6" />
                    ) : (
                      <ChevronDown className="w-5 h-5 md:w-6 md:h-6" />
                    )}
                  </div>
                </div>
              </div>

              {/* Books Grid */}
              {isExpanded && (
                <div className="p-4 md:p-6">
                  {rackBooks.length === 0 ? (
                    <div className="text-center py-6 md:py-8">
                      <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 text-sm md:text-base">No books found in this section.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
                      {rackBooks.map((book) => (
                        <BookCard key={book.id} book={book} />
                      ))}
                      {isLoading && page > 0 && [...Array(4)].map((_, i) => (
                        <BookCardSkeleton key={`skeleton-${i}`} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more button */}
      {hasMore && !searchTerm && ( // Only show load more if not searching
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMoreBooks}
            disabled={isLoading || isOperationLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
          >
            {isLoading && <Loader className="w-4 h-4 animate-spin" />}
            <span>Load More Books</span>
          </button>
        </div>
      )}

      {/* No Results */}
      {searchTerm && searchResults.length === 0 && !isSearching && (
        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-8 md:p-12 text-center">
          <BookOpen className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No books found</h3>
          <p className="text-gray-500 text-sm md:text-base">Try adjusting your search terms or browse by category.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSearchResults([]);
              fetchDashboardData();
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
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
    </div>
  );
};

export default UserDashboard;