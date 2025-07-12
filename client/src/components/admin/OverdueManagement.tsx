import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  IndianRupee,
  Search,
  Filter,
  BookOpen,
  CheckCircle,
  X,
  Eye,
  CreditCard,
  UserX,
  Clock,
  FileText,
  RefreshCw,
  Loader,
  Calculator,
} from 'lucide-react';
import {
  getOverdueBooks,
  getFines,
  calculateFines,
  payFine,
  waiveFine,
  getOverdueSummaryReport,
} from '../../utils/api';
import {
  OverdueBookResponse,
  FineResponse,
  PayFinePayload,
  WaiveFinePayload,
  OverdueSummaryReport,
  CalculateFinesPayload,
} from '../../types';
import { useAuth } from '../../context/AuthContext';

const OverdueManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'waived'>('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [showCalculateModal, setShowCalculateModal] = useState(false);
  const [selectedFine, setSelectedFine] = useState<FineResponse | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [finePerDay, setFinePerDay] = useState(10);

  const { user } = useAuth();
  const [overdueBooks, setOverdueBooks] = useState<OverdueBookResponse[]>([]);
  const [fines, setFines] = useState<FineResponse[]>([]);
  const [overdueStats, setOverdueStats] = useState<OverdueSummaryReport | null>(null);
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
  const [totalFines, setTotalFines] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const itemsPerPage = 20;
  const maxRetries = 3;

  // Filter fines with defensive checks
  const filteredFines = (fines || []).filter(fine => {
    if (!fine) return false;

    const userName = fine.user_name || '';
    const userUsn = fine.user_usn || '';
    const bookTitle = fine.book_title || '';
    const bookIsbn = fine.book_isbn || '';

    const matchesSearch =
      userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userUsn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bookTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bookIsbn.includes(searchTerm);

    const matchesFilter = filterStatus === 'all' || fine.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  // Paginate results with defensive checks
  const paginatedFines = filteredFines.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Statistics with defensive null/undefined checks
  const stats = useMemo(() => {
    const safeOverdueStats = overdueStats || {};
    const safeFines = fines || [];

    const totalAmount = safeFines.reduce((sum, f) => sum + (f?.fine_amount || 0), 0);
    const pendingAmount = safeOverdueStats.total_pending_fines || 0;
    const collectedAmount = safeOverdueStats.total_paid_fines || 0;
    const waivedAmount = totalAmount - pendingAmount - collectedAmount;

    return {
      totalFines: safeFines.length || 0,
      pendingFines: safeFines.filter(f => f?.status === 'pending').length || 0,
      paidFines: safeFines.filter(f => f?.status === 'paid').length || 0,
      waivedFines: safeFines.filter(f => f?.status === 'waived').length || 0,
      totalAmount: totalAmount,
      pendingAmount: pendingAmount,
      collectedAmount: collectedAmount,
      waivedAmount: waivedAmount,
      currentOverdue: safeOverdueStats.total_overdue_books || 0,
    };
  }, [overdueStats, fines]);

  // Enhanced fetch with retry mechanism and exponential backoff
  const fetchData = useCallback(
    async (retryAttempt = 0) => {
      if (!user) {
        setError('Authentication required. Please log in to access overdue management.');
        setIsLoading(false);
        return;
      }

      if (retryAttempt === 0) {
        setIsLoading(true);
        setIsRetrying(false);
      } else {
        setIsRetrying(true);
      }
      setError(null);

      try {
        const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
        if (!token) {
          throw new Error('Authentication token not found. Please log in again.');
        }

        // Implement timeout for requests
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        );

        const dataPromise = Promise.all([
          getOverdueBooks(token).catch(err => ({ overdue_books: [], error: err })),
          getFines(token, filterStatus === 'all' ? undefined : filterStatus).catch(err => ({
            fines: [],
            error: err,
          })),
          getOverdueSummaryReport(token).catch(err => ({ overdue_summary: null, error: err })),
        ]);

        const [overdueResponse, finesResponse, statsResponse] = (await Promise.race([
          dataPromise,
          timeout,
        ])) as any[];

        // Handle partial failures gracefully
        if (overdueResponse.error) {
          console.warn('Failed to fetch overdue books:', overdueResponse.error);
          showNotification('error', 'Some overdue book data may be unavailable');
        }
        if (finesResponse.error) {
          console.warn('Failed to fetch fines:', finesResponse.error);
          showNotification('error', 'Some fine data may be unavailable');
        }
        if (statsResponse.error) {
          console.warn('Failed to fetch stats:', statsResponse.error);
          showNotification('error', 'Statistics may be unavailable');
        }

        setOverdueBooks(overdueResponse.overdue_books || []);
        setFines(finesResponse.fines || []);
        setTotalFines(finesResponse.fines?.length || 0);
        setOverdueStats(statsResponse.overdue_summary || null);
        setRetryCount(0);
      } catch (err) {
        console.error(`Failed to fetch overdue data (attempt ${retryAttempt + 1}):`, err);

        if (retryAttempt < maxRetries) {
          const delay = Math.pow(2, retryAttempt) * 1000; // Exponential backoff
          showNotification('error', `Loading failed, retrying in ${delay / 1000} seconds...`);
          setTimeout(() => {
            setRetryCount(retryAttempt + 1);
            fetchData(retryAttempt + 1);
          }, delay);
          return;
        }

        // Handle different error types
        if (err instanceof Error) {
          if (err.message.includes('401') || err.message.includes('Authentication')) {
            setError('Authentication expired. Please log in again.');
          } else if (err.message.includes('403')) {
            setError('You do not have permission to access this data.');
          } else if (err.message.includes('timeout')) {
            setError('Request timed out. Please check your connection and try again.');
          } else if (err.message.includes('fetch')) {
            setError('Network error. Please check your internet connection.');
          } else {
            setError(err.message || 'Failed to load overdue data');
          }
        } else {
          setError('An unexpected error occurred. Please try again.');
        }
      } finally {
        setIsLoading(false);
        setIsRetrying(false);
      }
    },
    [user, filterStatus, refreshKey, maxRetries]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setRetryCount(0);
  };

  let searchTimeout: ReturnType<typeof setTimeout>;
  const handleSearch = useCallback((query: string) => {
    setSearchTerm(query);
    setCurrentPage(0);
  }, []);

  const validateWaiveForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!waiveReason?.trim()) {
      errors.reason = 'Reason is required for waiving a fine';
    } else if (waiveReason.trim().length < 5) {
      errors.reason = 'Reason must be at least 5 characters long';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-amber-600 bg-amber-100';
      case 'paid':
        return 'text-emerald-600 bg-emerald-100';
      case 'waived':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'paid':
        return <CheckCircle className="w-4 h-4" />;
      case 'waived':
        return <UserX className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const handleViewDetails = (fine: FineResponse) => {
    if (!fine) return;
    setSelectedFine(fine);
    setShowDetailsModal(true);
  };

  const handleMarkAsPaid = (fine: FineResponse) => {
    if (!fine) return;
    setSelectedFine(fine);
    setPaymentMethod('cash'); // Reset to default when opening
    setPaymentNotes(''); // Reset notes
    setShowPaymentModal(true);
  };

  const handleWaiveFine = (fine: FineResponse) => {
    if (!fine) return;
    setSelectedFine(fine);
    setFormErrors({});
    setWaiveReason('');
    setShowWaiveModal(true);
  };

  const confirmPayment = async () => {
    if (!selectedFine || !user) {
      showNotification('error', 'Invalid request. Please try again.');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const paymentData: PayFinePayload = {
        payment_method: paymentMethod,
        notes: paymentNotes.trim() || `Paid via ${paymentMethod} at library counter`,
      };

      await payFine(token, selectedFine.id, paymentData);
      showNotification(
        'success',
        `Fine of ₹${selectedFine.fine_amount} marked as paid successfully via ${paymentMethod}`
      );
      setShowPaymentModal(false);
      setSelectedFine(null);
      setPaymentMethod('cash'); // Reset state
      setPaymentNotes(''); // Reset state
      handleRefresh();
    } catch (err) {
      console.error('Failed to mark fine as paid:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark fine as paid';
      showNotification('error', errorMessage);
    } finally {
      setIsOperationLoading(false);
    }
  };

  const confirmWaive = async () => {
    if (!selectedFine || !user) {
      showNotification('error', 'Invalid request. Please try again.');
      return;
    }

    if (!validateWaiveForm()) return;

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const waiveData: WaiveFinePayload = {
        reason: waiveReason.trim(),
        notes: 'Waived by administrator',
      };

      await waiveFine(token, selectedFine.id, waiveData);
      showNotification('success', `Fine of ₹${selectedFine.fine_amount} waived successfully`);
      setWaiveReason('');
      setShowWaiveModal(false);
      setSelectedFine(null);
      setFormErrors({});
      handleRefresh();
    } catch (err) {
      console.error('Failed to waive fine:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to waive fine';
      showNotification('error', errorMessage);
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleCalculateFines = async () => {
    const FINE_PER_DAY = 5;
    if (!user) {
      showNotification('error', 'Authentication required');
      return;
    }

    if (FINE_PER_DAY <= 0) {
      showNotification('error', 'Fine per day must be greater than 0');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const calculateData: CalculateFinesPayload = {
        fine_per_day: FINE_PER_DAY,
      };

      const response = await calculateFines(token, calculateData);
      showNotification('success', response.message || 'Fines calculated successfully');
      setShowCalculateModal(false);
      setFinePerDay(10);
      handleRefresh();
    } catch (err) {
      console.error('Failed to calculate fines:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate fines';
      showNotification('error', errorMessage);
    } finally {
      setIsOperationLoading(false);
    }
  };

  // Enhanced loading state with skeleton screens
  if (isLoading && !isRetrying) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Overdue Books & Fines</h1>
          <p className="text-red-100">Loading overdue data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <div className="h-8 w-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="animate-pulse flex space-x-4">
                <div className="rounded-full bg-gray-200 h-12 w-12"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Enhanced error state with retry options
  if (error && !isRetrying) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Error Loading Overdue Data</h1>
          <p className="text-red-100 mb-4">{error}</p>
          <div className="flex space-x-3">
            <button
              onClick={handleRefresh}
              className="flex items-center px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show retry indicator
  if (isRetrying) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Retrying...</h1>
          <div className="flex items-center space-x-3">
            <Loader className="w-5 h-5 animate-spin" />
            <p className="text-amber-100">
              Attempting to reload data (attempt {retryCount + 1} of {maxRetries + 1})
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white relative">
        <h1 className="text-3xl font-bold mb-2">Overdue Books & Fines</h1>
        <p className="text-red-100">Manage overdue books, track fines, and process payments</p>
        <div className="absolute top-4 right-4 flex space-x-2">
          <button
            onClick={handleCalculateFines}
            disabled={isLoading || isOperationLoading}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors disabled:opacity-50"
            title="Calculate Fines"
          >
            <Calculator className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={isLoading || isOperationLoading}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw
              className={`w-4 h-4 text-white ${isLoading || isOperationLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current Overdue</p>
              <p className="text-3xl font-bold text-red-600">{stats.currentOverdue}</p>
              <p className="text-sm text-red-800 mt-1">Books overdue</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Fines</p>
              <p className="text-3xl font-bold text-amber-600">{stats.pendingFines}</p>
              <p className="text-sm text-amber-800 mt-1">
                ₹{stats.pendingAmount.toFixed(2)} pending
              </p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Collected Fines</p>
              <p className="text-3xl font-bold text-emerald-600">
                ₹{stats.collectedAmount.toFixed(2)}
              </p>
              <p className="text-sm text-emerald-800 mt-1">{stats.paidFines} payments</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <IndianRupee className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Waived Fines</p>
              <p className="text-3xl font-bold text-purple-600">{stats.waivedFines}</p>
              <p className="text-sm text-purple-800 mt-1">
                ₹{stats.waivedAmount.toFixed(2)} waived
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <UserX className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Current Overdue Books */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            Currently Overdue Books ({(overdueBooks || []).length})
          </h3>
        </div>

        {!overdueBooks || overdueBooks.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-gray-500">No books are currently overdue!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overdueBooks.map(book => {
              if (!book) return null;
              return (
                <div key={book.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <BookOpen className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">{book.days_overdue || 0}</div>
                      <div className="text-xs text-red-800">days overdue</div>
                    </div>
                  </div>

                  <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">
                    {book.book_title || 'Unknown Title'}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">
                    by {book.book_author || 'Unknown Author'}
                  </p>

                  <div className="space-y-1 text-xs text-gray-600">
                    <div>
                      User: {book.user_name || 'Unknown'} ({book.user_usn || 'N/A'})
                    </div>
                    <div>Due: {formatDate(book.due_date)}</div>
                    <div className="text-red-600 font-medium">Fine: ₹{book.fine_amount || 0}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                placeholder="Search by user name, USN, book title, or ISBN..."
                value={searchTerm}
                onChange={e => {
                  clearTimeout(searchTimeout);
                  const value = e.target.value;
                  searchTimeout = setTimeout(() => {
                    handleSearch(value);
                  }, 300);
                }}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Fines</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="waived">Waived</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Fines Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Fine Records ({filteredFines.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User & Book
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overdue Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fine Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedFines.map(fine => {
                if (!fine) return null;
                return (
                  <tr key={fine.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-red-500 to-orange-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {(fine.user_name || 'U')
                                .split(' ')
                                .map(n => n[0] || '')
                                .join('')
                                .substring(0, 2)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {fine.user_name || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-500">USN: {fine.user_usn || 'N/A'}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {fine.book_title || 'Unknown Book'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center space-x-1 text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span>{fine.days_overdue || 0} days overdue</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Due: {formatDate(fine.due_date)}
                        </div>
                        {fine.return_date && (
                          <div className="text-xs text-gray-500">
                            Returned: {formatDate(fine.return_date)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        ₹{fine.fine_amount || 0}
                      </div>
                      <div className="text-xs text-gray-500">₹{fine.fine_per_day || 0}/day</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(fine.status || 'unknown')}`}
                      >
                        {getStatusIcon(fine.status || 'unknown')}
                        <span className="capitalize">{fine.status || 'unknown'}</span>
                      </div>
                      {fine.paid_at && (
                        <div className="text-xs text-gray-500 mt-1">
                          Paid: {formatDate(fine.paid_at)}
                        </div>
                      )}
                      {fine.waived_at && (
                        <div className="text-xs text-gray-500 mt-1">
                          Waived: {formatDate(fine.waived_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleViewDetails(fine)}
                        disabled={isOperationLoading}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded disabled:opacity-50"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {fine.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleMarkAsPaid(fine)}
                            disabled={isOperationLoading}
                            className="text-emerald-600 hover:text-emerald-900 p-1 hover:bg-emerald-50 rounded disabled:opacity-50"
                            title="Mark as Paid"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleWaiveFine(fine)}
                            disabled={isOperationLoading}
                            className="text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-50 rounded disabled:opacity-50"
                            title="Waive Fine"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paginatedFines.length === 0 && filteredFines.length > 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No fine records found for this page.</p>
          </div>
        )}
        {filteredFines.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm || filterStatus !== 'all'
                ? 'No fine records found matching your criteria.'
                : 'No fine records available.'}
            </p>
            {(searchTerm || filterStatus !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {filteredFines.length > itemsPerPage && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {currentPage * itemsPerPage + 1} to{' '}
                {Math.min((currentPage + 1) * itemsPerPage, filteredFines.length)} of{' '}
                {filteredFines.length} fines
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-sm text-gray-700">
                  Page {currentPage + 1} of {Math.ceil(filteredFines.length / itemsPerPage)}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage(prev =>
                      Math.min(Math.ceil(filteredFines.length / itemsPerPage) - 1, prev + 1)
                    )
                  }
                  disabled={currentPage >= Math.ceil(filteredFines.length / itemsPerPage) - 1}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fine Details Modal */}
      {showDetailsModal && selectedFine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Fine Details</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">User Information</h4>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>{' '}
                    <span className="font-medium">{selectedFine.user_name || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">USN:</span>{' '}
                    <span className="font-medium">{selectedFine.user_usn || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Book Information</h4>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-gray-600">Title:</span>{' '}
                    <span className="font-medium">{selectedFine.book_title || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Author:</span>{' '}
                    <span className="font-medium">{selectedFine.book_author || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">ISBN:</span>{' '}
                    <span className="font-medium">{selectedFine.book_isbn || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Fine Details</h4>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-gray-600">Days Overdue:</span>{' '}
                    <span className="font-medium text-red-600">
                      {selectedFine.days_overdue || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Fine per Day:</span>{' '}
                    <span className="font-medium">₹{selectedFine.fine_per_day || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Fine:</span>{' '}
                    <span className="font-medium text-lg">₹{selectedFine.fine_amount || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span
                      className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedFine.status || 'unknown')}`}
                    >
                      {selectedFine.status || 'unknown'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Timeline</h4>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-gray-600">Issued:</span>{' '}
                    <span className="font-medium">{formatDate(selectedFine.issued_date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Due:</span>{' '}
                    <span className="font-medium">{formatDate(selectedFine.due_date)}</span>
                  </div>
                  {selectedFine.return_date && (
                    <div>
                      <span className="text-gray-600">Returned:</span>{' '}
                      <span className="font-medium">{formatDate(selectedFine.return_date)}</span>
                    </div>
                  )}
                  {selectedFine.paid_at && (
                    <div>
                      <span className="text-gray-600">Paid:</span>{' '}
                      <span className="font-medium">{formatDate(selectedFine.paid_at)}</span>
                    </div>
                  )}
                  {selectedFine.waived_at && (
                    <div>
                      <span className="text-gray-600">Waived:</span>{' '}
                      <span className="font-medium">{formatDate(selectedFine.waived_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedFine.notes && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-700">{selectedFine.notes}</p>
                </div>
              )}

              {selectedFine.status === 'paid' && selectedFine.paid_at && (
                <div className="bg-emerald-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Payment Information</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-600">Paid on:</span>{' '}
                      <span className="font-medium">{formatDate(selectedFine.paid_at)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Payment Method:</span>{' '}
                      <span className="font-medium capitalize">
                        {selectedFine.payment_method || 'N/A'}
                      </span>
                    </div>
                    {selectedFine.notes &&
                      selectedFine.notes !==
                        `Paid via ${selectedFine.payment_method} at library counter` && (
                        <div>
                          <span className="text-gray-600">Payment Notes:</span>{' '}
                          <span className="font-medium">{selectedFine.notes}</span>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {selectedFine.status === 'waived' && selectedFine.waived_at && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Waiver Information</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-600">Waived on:</span>{' '}
                      <span className="font-medium">{formatDate(selectedFine.waived_at)}</span>
                    </div>
                    {selectedFine.notes && selectedFine.notes !== 'Waived by administrator' && (
                      <div>
                        <span className="text-gray-600">Waive Notes:</span>{' '}
                        <span className="font-medium">{selectedFine.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showPaymentModal && selectedFine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-emerald-100 rounded-full mr-4">
                <CreditCard className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Confirm Payment</h3>
                <p className="text-gray-600">Mark this fine as paid</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">User:</span>{' '}
                  <span className="font-medium">{selectedFine.user_name || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Book:</span>{' '}
                  <span className="font-medium">{selectedFine.book_title || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Fine Amount:</span>{' '}
                  <span className="font-medium text-lg">₹{selectedFine.fine_amount || 0}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Notes (Optional)
              </label>
              <textarea
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                placeholder="Add any notes about this payment..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentMethod('cash');
                  setPaymentNotes('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmPayment}
                disabled={isOperationLoading}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Mark as Paid</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waive Fine Modal */}
      {showWaiveModal && selectedFine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-purple-100 rounded-full mr-4">
                <UserX className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Waive Fine</h3>
                <p className="text-gray-600">Waive this fine with reason</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">User:</span>{' '}
                  <span className="font-medium">{selectedFine.user_name || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Book:</span>{' '}
                  <span className="font-medium">{selectedFine.book_title || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Fine Amount:</span>{' '}
                  <span className="font-medium text-lg">₹{selectedFine.fine_amount || 0}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for waiving *
              </label>
              <textarea
                value={waiveReason}
                onChange={e => setWaiveReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Enter reason for waiving this fine (minimum 5 characters)..."
              />
              {formErrors.reason && (
                <p className="mt-1 text-red-500 text-xs">{formErrors.reason}</p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowWaiveModal(false);
                  setWaiveReason('');
                  setFormErrors({});
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmWaive}
                disabled={!waiveReason.trim() || isOperationLoading}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Waive Fine</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculate Fines Modal */}
      {showCalculateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-orange-100 rounded-full mr-4">
                <Calculator className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Calculate Fines</h3>
                <p className="text-gray-600">Calculate fines for all overdue books</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fine per day (₹) *
              </label>
              <input
                type="number"
                value={finePerDay}
                onChange={e => setFinePerDay(parseFloat(e.target.value) || 10)}
                min="0.5"
                max="1000"
                step="0.5"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter fine amount per day"
              />
              <p className="text-xs text-gray-500 mt-1">
                This will be applied to all newly calculated fines (₹0.5 - ₹1000)
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCalculateModal(false);
                  setFinePerDay(10);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCalculateFines}
                disabled={isOperationLoading || finePerDay <= 0}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isOperationLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Calculate Fines</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Notification with close button */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg max-w-md ${
            notification.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          <div className="flex items-center justify-between space-x-3">
            <div className="flex items-center space-x-2">
              {notification.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-white hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isOperationLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <Loader className="w-6 h-6 animate-spin text-red-600" />
            <span className="text-gray-700">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverdueManagement;
