import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  Search,
  DollarSign,
  RefreshCw,
  Loader,
} from 'lucide-react';
import { getBookHistory } from '../../utils/api';
import { BookHistoryResponse } from '../../types';

const BookHistory: React.FC = () => {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<'all' | 'current' | 'returned' | 'overdue'>(
    'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [userHistory, setUserHistory] = useState<BookHistoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [limit] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    current: 0,
    returned: 0,
    overdue: 0,
    totalFines: 0,
  });

  useEffect(() => {
    const fetchBookHistory = async () => {
      if (!user) {
        setError('Authentication required. Please log in to access your book history.');
        setIsLoading(false);
        return;
      }

      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get user book history from API
        const response = await getBookHistory(
          token,
          page * limit,
          limit,
          filterStatus !== 'all' ? filterStatus : undefined
        );

        const transactions = response.history || [];

        // Update state based on whether we're loading more or fresh data
        if (page === 0) {
          setUserHistory(transactions);
        } else {
          setUserHistory(prev => [...prev, ...transactions]);
        }

        // Update pagination info
        setTotalRecords(response.total || 0);
        setHasMore(transactions.length === limit && (page + 1) * limit < (response.total || 0));

        // Calculate statistics from all transactions
        const allTransactions = page === 0 ? transactions : [...userHistory, ...transactions];

        // Get fresh stats by counting from the response data
        const statsData = {
          total: response.total || 0,
          current: allTransactions.filter(r => r.status === 'current').length,
          returned: allTransactions.filter(r => r.status === 'returned').length,
          overdue: allTransactions.filter(r => r.status === 'overdue').length,
          totalFines: allTransactions.reduce((sum, r) => sum + (r.fine_amount || 0), 0),
        };

        setStats(statsData);
      } catch (err) {
        console.error('Failed to fetch book history:', err);
        if (err instanceof Error && err.message.includes('401')) {
          setError('Authentication expired. Please log in again.');
        } else {
          setError(
            err instanceof Error ? err.message : 'An error occurred while loading your book history'
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookHistory();
  }, [user, page, limit, filterStatus, refreshKey, userHistory]);

  // Auto-refresh every 30 seconds for current books
  useEffect(() => {
    if (filterStatus === 'current' || filterStatus === 'overdue') {
      const interval = setInterval(() => {
        setRefreshKey(prev => prev + 1);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [filterStatus]);

  const handleSearch = useCallback(async () => {
    if (!user) return;

    const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await getBookHistory(
        token,
        0,
        limit * 5, // Get more results for search
        filterStatus !== 'all' ? filterStatus : undefined
      );

      // Filter results based on search term
      const filtered = (response.history || []).filter(
        record =>
          record.book_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.book_author.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.book_isbn.includes(searchTerm)
      );

      setUserHistory(filtered);
      setTotalRecords(filtered.length);
      setHasMore(false); // Disable pagination for search results
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, searchTerm, filterStatus, limit]);

  const handleFilterChange = (status: 'all' | 'current' | 'returned' | 'overdue') => {
    setFilterStatus(status);
    setPage(0); // Reset pagination when filter changes
    setSearchTerm(''); // Clear search when filter changes
    setRefreshKey(prev => prev + 1); // Trigger refresh
  };

  const loadMoreRecords = () => {
    setPage(prevPage => prevPage + 1);
  };

  const handleRefresh = () => {
    setPage(0);
    setSearchTerm('');
    setFilterStatus('all');
    setRefreshKey(prev => prev + 1);
  };

  if (!user) return null;

  // Filter and search client-side for current records, sorted by date
  const filteredHistory = userHistory
    .filter(record => {
      const matchesSearch = searchTerm
        ? record.book_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.book_author.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.book_isbn.includes(searchTerm)
        : true;

      return matchesSearch;
    })
    .sort((a, b) => {
      // Sort by issued_date in descending order (most recent first)
      const dateA = new Date(a.issued_date).getTime();
      const dateB = new Date(b.issued_date).getTime();
      return dateB - dateA;
    });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'current':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'returned':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <BookOpen className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current':
        return 'text-blue-600 bg-blue-100';
      case 'returned':
        return 'text-emerald-600 bg-emerald-100';
      case 'overdue':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';

    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysRemaining = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Skeleton loader for book records
  const BookRecordSkeleton = () => (
    <div className="p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-start space-x-4">
            {/* Book Icon Placeholder */}
            <div className="flex-shrink-0">
              <div className="w-12 h-16 bg-gray-200 rounded-lg"></div>
            </div>
            {/* Book Details Placeholder */}
            <div className="flex-1 min-w-0">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4 mb-4"></div>
              {/* Dates Placeholders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
        {/* Status Badge Placeholder */}
        <div className="flex-shrink-0 ml-4">
          <div className="h-8 bg-gray-200 rounded-full w-24"></div>
        </div>
      </div>
    </div>
  );

  // Loading state for the entire page
  if (isLoading && page === 0) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">My Book History</h1>
          <p className="text-indigo-100">Loading your borrowing history...</p>
        </div>

        {/* Statistics Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-10"></div>
                </div>
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters and Search Skeleton */}
        <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>

        {/* Book Records Skeleton */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="h-6 bg-gray-200 rounded w-48"></div>
          </div>
          <div className="divide-y divide-gray-200">
            {[...Array(3)].map((_, index) => (
              <BookRecordSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Error Loading Book History</h1>
          <p className="text-red-100 mb-4">{error}</p>
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
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white relative">
        <h1 className="text-3xl font-bold mb-2">My Book History</h1>
        <p className="text-indigo-100">Track your borrowing history and current issues</p>
        <button
          onClick={handleRefresh}
          className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          title="Refresh history"
        >
          <RefreshCw className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Books</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <BookOpen className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Currently Issued</p>
              <p className="text-2xl font-bold text-blue-600">{stats.current}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Returned</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.returned}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Fines</p>
              <p className="text-2xl font-bold text-amber-600">₹{stats.totalFines}</p>
            </div>
            <DollarSign className="w-8 h-8 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by book title, author, or ISBN..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.trim() === '') {
                    // Reset to original data when search is cleared
                    setPage(0);
                    setRefreshKey(prev => prev + 1);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!searchTerm.trim() || isLoading}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>

            {/* Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filterStatus}
                onChange={e =>
                  handleFilterChange(e.target.value as 'all' | 'current' | 'returned' | 'overdue')
                }
                className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Records</option>
                <option value="current">Currently Issued</option>
                <option value="returned">Returned</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Book Records ({filteredHistory.length} of {totalRecords})
          </h3>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No book records found matching your criteria.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {filteredHistory.map(record => (
                <div
                  key={record.id}
                  className="p-6 hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start space-x-4">
                        {/* Book Icon */}
                        <div className="flex-shrink-0">
                          <div className="w-12 h-16 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-lg shadow-sm flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-white" />
                          </div>
                        </div>

                        {/* Book Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-medium text-gray-900 mb-1">
                            {record.book_title}
                          </h4>
                          <p className="text-sm text-gray-600 mb-2">by {record.book_author}</p>
                          <p className="text-xs text-gray-500 mb-3">ISBN: {record.book_isbn}</p>

                          {/* Dates */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center space-x-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <div>
                                <span className="text-gray-500">Issued:</span>
                                <span className="ml-1 font-medium">
                                  {formatDate(record.issued_date)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <div>
                                <span className="text-gray-500">Due:</span>
                                <span className="ml-1 font-medium">
                                  {formatDate(record.due_date)}
                                </span>
                                {record.status === 'current' && (
                                  <span
                                    className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                      getDaysRemaining(record.due_date) < 0
                                        ? 'bg-red-100 text-red-800'
                                        : getDaysRemaining(record.due_date) <= 3
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {getDaysRemaining(record.due_date) < 0
                                      ? `${Math.abs(getDaysRemaining(record.due_date))} days overdue`
                                      : `${getDaysRemaining(record.due_date)} days left`}
                                  </span>
                                )}
                              </div>
                            </div>

                            {record.return_date && (
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-gray-400" />
                                <div>
                                  <span className="text-gray-500">Returned:</span>
                                  <span className="ml-1 font-medium">
                                    {formatDate(record.return_date)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Overdue info */}
                          {record.days_overdue && record.days_overdue > 0 && (
                            <div className="mt-3 flex items-center space-x-4 text-sm">
                              <div className="flex items-center space-x-1 text-red-600">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Overdue by {record.days_overdue} days</span>
                              </div>
                              {record.fine_amount && (
                                <div className="flex items-center space-x-1 text-amber-600">
                                  <DollarSign className="w-4 h-4" />
                                  <span>Fine: ₹{record.fine_amount}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex-shrink-0 ml-4">
                      <div
                        className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium ${getStatusColor(record.status)}`}
                      >
                        {getStatusIcon(record.status)}
                        <span className="capitalize">{record.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator for pagination */}
              {isLoading && page > 0 && (
                <div className="flex justify-center items-center p-6">
                  <Loader className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              )}
            </div>

            {/* Load more button */}
            {hasMore && !isLoading && (
              <div className="flex justify-center p-6 border-t border-gray-200">
                <button
                  onClick={loadMoreRecords}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
                >
                  <span>Load More Records</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Notification */}
      {error && (
        <div className="fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg bg-red-500 text-white">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookHistory;
