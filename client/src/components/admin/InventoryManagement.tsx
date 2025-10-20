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
  });

  // Return form data
  const [returnData, setReturnData] = useState({
    bookId: '',
    userId: '',
    condition: 'good',
    notes: '',
  });

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

    if (!issueData.bookId) errors.bookId = 'Book selection is required';
    if (!issueData.userId) errors.userId = 'User selection is required';
    if (!issueData.dueDate) errors.dueDate = 'Due date is required';

    const selectedBook = books.find(b => b.id.toString() === issueData.bookId);
    if (selectedBook && !selectedBook.is_available) {
      errors.bookId = 'Selected book is not available';
    }

    return errors;
  };

  const validateReturnForm = (): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};

    if (!returnData.bookId) errors.bookId = 'Book selection is required';
    if (!returnData.userId) errors.userId = 'User selection is required';
    if (!returnData.condition) errors.condition = 'Book condition is required';

    const selectedBook = books.find(b => b.id.toString() === returnData.bookId);
    if (selectedBook && selectedBook.is_available) {
      errors.bookId = 'Selected book is not currently issued';
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
      setIssueData({ bookId: '', userId: '', dueDate: '' });
      setFormErrors({});
      setShowIssueModal(false);
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

      setFormErrors({});
      setShowReturnModal(false);
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
          <div className="bg-white rounded-xl p-6 md:p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Issue Book</h3>
              <button
                onClick={() => {
                  setShowIssueModal(false);
                  setFormErrors({});
                  setIssueData({ bookId: '', userId: '', dueDate: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Book</label>
                <select
                  value={issueData.bookId}
                  onChange={e => setIssueData({ ...issueData, bookId: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.bookId ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  <option value="">Select a book</option>
                  {books
                    .filter(book => book.is_available)
                    .map(book => (
                      <option key={book.id} value={book.id.toString()}>
                        {book.title} - {book.author}
                      </option>
                    ))}
                </select>
                {formErrors.bookId && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.bookId}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select User</label>
                <select
                  value={issueData.userId}
                  onChange={e => setIssueData({ ...issueData, userId: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.userId ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  <option value="">Select a user</option>
                  {users
                    .filter(user => user.role === 'user')
                    .map(user => (
                      <option key={user.id} value={user.id.toString()}>
                        {user.name} ({user.usn})
                      </option>
                    ))}
                </select>
                {formErrors.userId && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.userId}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={issueData.dueDate}
                  onChange={e => setIssueData({ ...issueData, dueDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-3 border ${formErrors.dueDate ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
                {formErrors.dueDate && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.dueDate}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowIssueModal(false);
                  setFormErrors({});
                  setIssueData({ bookId: '', userId: '', dueDate: '' });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueBook}
                disabled={isOperationLoading}
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
          <div className="bg-white rounded-xl p-6 md:p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Return Book</h3>
              <button
                onClick={() => {
                  setShowReturnModal(false);
                  setFormErrors({});
                  setReturnData({ bookId: '', userId: '', condition: 'good', notes: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Book</label>
                <select
                  value={returnData.bookId}
                  onChange={e => setReturnData({ ...returnData, bookId: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.bookId ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                >
                  <option value="">Select a book</option>
                  {books
                    .filter(book => !book.is_available)
                    .map(book => (
                      <option key={book.id} value={book.id.toString()}>
                        {book.title} - {book.author}
                      </option>
                    ))}
                </select>
                {formErrors.bookId && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.bookId}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select User</label>
                <select
                  value={returnData.userId}
                  onChange={e => setReturnData({ ...returnData, userId: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.userId ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                >
                  <option value="">Select a user</option>
                  {users
                    .filter(user => user.role === 'user')
                    .map(user => (
                      <option key={user.id} value={user.id.toString()}>
                        {user.name} ({user.usn})
                      </option>
                    ))}
                </select>
                {formErrors.userId && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.userId}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Book Condition
                </label>
                <select
                  value={returnData.condition}
                  onChange={e => setReturnData({ ...returnData, condition: e.target.value })}
                  className={`w-full px-4 py-3 border ${formErrors.condition ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={returnData.notes}
                  onChange={e => setReturnData({ ...returnData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  placeholder="Any additional notes about the book condition..."
                />
              </div>
              {(returnData.condition === 'damaged' || returnData.condition === 'lost') && (
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
                onClick={() => {
                  setShowReturnModal(false);
                  setFormErrors({});
                  setReturnData({ bookId: '', userId: '', condition: 'good', notes: '' });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnBook}
                disabled={isOperationLoading}
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
