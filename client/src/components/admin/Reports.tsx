import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  FileText,
  Calendar,
  Users,
  BookOpen,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Award,
  Star,
  Target,
  Loader2,
  RefreshCw,
  Loader,
  Search,
  XCircle,
  Info,
} from 'lucide-react';
import {
  getUserActivityReport,
  getBookCirculationReport,
  getOverdueSummaryReport,
  getInventoryStatusReport,
  exportReportExcel,
  exportReportPDF,
} from '../../utils/api';
import {
  UserActivityReport,
  BookCirculationReport,
  OverdueSummaryReport,
  InventoryStatusReport,
} from '../../types';
import { useAuth } from '../../context/AuthContext';

const Reports: React.FC = () => {
  const auth = useAuth();

  // State management
  const [reportType, setReportType] = useState<
    'user-activity' | 'book-circulation' | 'overdue-summary' | 'inventory-status'
  >('user-activity');
  const [dateRange, setDateRange] = useState({
    start_date: '',
    end_date: '',
  });
  const [customDateRange, setCustomDateRange] = useState('last30days');
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [isReportGenerating, setIsReportGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    details?: string;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(3);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastFailedOperation, setLastFailedOperation] = useState<string | null>(null);

  // Report data state
  const [userActivityData, setUserActivityData] = useState<UserActivityReport[]>([]);
  const [bookCirculationData, setBookCirculationData] = useState<BookCirculationReport[]>([]);
  const [overdueSummaryData, setOverdueSummaryData] = useState<OverdueSummaryReport | null>(null);
  const [inventoryStatusData, setInventoryStatusData] = useState<InventoryStatusReport | null>(
    null
  );

  // Filter states
  const [userIdFilter, setUserIdFilter] = useState<number | ''>('');
  const [genreFilter, setGenreFilter] = useState('');

  useEffect(() => {
    const fetchReportData = async () => {
      if (!auth.user) {
        setError('Authentication required. Please log in to access reports.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setIsReportGenerating(true);
      setError(null);

      try {
        const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
        if (!token) {
          throw new Error('Authentication token not found');
        }

        // Validate form before making API calls
        if (!validateFormInputs()) {
          setIsLoading(false);
          setIsReportGenerating(false);
          return;
        }

        // Set date range based on custom selection
        const dateParams = getDateRangeParams();

        // Fetch all report types with enhanced error handling
        const [userActivity, bookCirculation, overdueSummary, inventoryStatus] = await Promise.all([
          getUserActivityReport(
            token,
            dateParams.start_date,
            dateParams.end_date,
            userIdFilter || undefined
          ).catch(handleReportError('User Activity Report')),
          getBookCirculationReport(
            token,
            dateParams.start_date,
            dateParams.end_date,
            genreFilter || undefined
          ).catch(handleReportError('Book Circulation Report')),
          getOverdueSummaryReport(token, dateParams.start_date, dateParams.end_date)
            .catch(handleReportError('Overdue Summary Report')),
          getInventoryStatusReport(token).catch(handleReportError('Inventory Status Report')),
        ]);

        setUserActivityData(userActivity?.user_activity_report || []);
        setBookCirculationData(bookCirculation?.book_circulation_report || []);
        setOverdueSummaryData(overdueSummary?.overdue_summary || null);
        setInventoryStatusData(inventoryStatus || null);

        // Reset retry count on successful fetch
        setRetryCount(0);
        setLastFailedOperation(null);
      } catch (err) {
        console.error('Failed to fetch report data:', err);
        handleFetchError(err);
      } finally {
        setIsLoading(false);
        setIsReportGenerating(false);
      }
    };

    fetchReportData();
  }, [auth.user, refreshKey, customDateRange, userIdFilter, genreFilter]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        handleRefresh();
      }, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  const handleReportError = (reportName: string) => (error: any) => {
    console.error(`Failed to fetch ${reportName}:`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('400') || error.message.includes('Bad Request')) {
        throw new Error(`${reportName} failed: Invalid parameters. Please check your date range and filter settings.`);
      } else if (error.message.includes('405') || error.message.includes('Method Not Allowed')) {
        throw new Error(`${reportName} temporarily unavailable. The report service may be under maintenance.`);
      }
    }
    
    throw error;
  };

  const handleFetchError = (err: any) => {
    if (err instanceof Error) {
      if (err.message.includes('401') || err.message.includes('Authentication')) {
        setError('Your session has expired. Please log in again to access reports.');
        showNotification('error', 'Authentication expired', 'Please refresh the page and log in again.');
      } else if (err.message.includes('403')) {
        setError('Access denied. You do not have permission to view reports.');
        showNotification('error', 'Access denied', 'Contact your administrator for report access permissions.');
      } else if (err.message.includes('400') || err.message.includes('Bad Request')) {
        setError('Invalid report parameters. Please check your date range and filter settings.');
        showNotification('error', 'Invalid parameters', 'Verify your date range is not too large and filters are properly formatted.');
      } else if (err.message.includes('405') || err.message.includes('Method Not Allowed')) {
        setError('Report service temporarily unavailable. Please try again later.');
        showNotification('error', 'Service unavailable', 'The report generation service may be under maintenance. Try refreshing the page.');
      } else if (err.message.includes('500')) {
        setError('Server error occurred while loading reports. Please try again in a few moments.');
        showNotification('error', 'Server error', 'The server encountered an issue. Wait a moment and try refreshing.');
      } else if (err.message.includes('timeout') || err.message.includes('network')) {
        setError('Network error. Please check your connection and try again.');
        showNotification('error', 'Network error', 'Check your internet connection and try again.');
      } else if (err.message.includes('Malformed URL') || err.message.includes('Invalid report request')) {
        setError('Invalid report request detected. Please refresh the page and try again.');
        showNotification('error', 'Invalid request', 'Please refresh the page to reset the report parameters.');
      } else {
        setError(err.message || 'Failed to load report data. Please refresh and try again.');
        showNotification('error', 'Report loading failed', err.message || 'An unexpected error occurred.');
      }
    } else {
      setError('An unexpected error occurred while loading reports.');
      showNotification('error', 'Unexpected error', 'Please refresh the page and try again.');
    }
  };

  const validateFormInputs = (): boolean => {
    const errors: { [key: string]: string } = {};

    // Validate custom date range
    if (customDateRange === 'custom') {
      if (!dateRange.start_date) {
        errors.start_date = 'Start date is required for custom range';
      }
      if (!dateRange.end_date) {
        errors.end_date = 'End date is required for custom range';
      }
      
      if (dateRange.start_date && dateRange.end_date) {
        const startDate = new Date(dateRange.start_date);
        const endDate = new Date(dateRange.end_date);
        const now = new Date();
        
        if (startDate > endDate) {
          errors.date_range = 'Start date must be before end date';
        } else if (startDate > now) {
          errors.start_date = 'Start date cannot be in the future';
        } else if (endDate > now) {
          errors.end_date = 'End date cannot be in the future';
        } else {
          // Check if date range is too large (more than 2 years)
          const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff > 730) {
            errors.date_range = 'Date range cannot exceed 2 years for performance reasons';
          }
        }
      }
    }

    // Validate user ID filter
    if (reportType === 'user-activity' && userIdFilter !== '') {
      if (typeof userIdFilter !== 'number' || userIdFilter <= 0) {
        errors.userIdFilter = 'User ID must be a positive number';
      }
    }

    // Validate genre filter
    if (reportType === 'book-circulation' && genreFilter.trim()) {
      if (genreFilter.length > 100) {
        errors.genreFilter = 'Genre name is too long (maximum 100 characters)';
      } else if (!/^[a-zA-Z0-9\s\-&.()]+$/.test(genreFilter)) {
        errors.genreFilter = 'Genre contains invalid characters';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getDateRangeParams = () => {
    const now = new Date();
    let startDate: string;
    let endDate = now.toISOString();

    switch (customDateRange) {
      case 'last7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'last30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'last3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'last6months':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'lastyear':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'custom':
        return {
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
        };
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    return { start_date: startDate, end_date: endDate };
  };

  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', message: string, details?: string) => {
    setNotification({ type, message, details });
    setTimeout(() => setNotification(null), 8000); // Increased timeout for detailed messages
  };

  const handleRefresh = () => {
    if (isLoading || isOperationLoading || isRetrying) {
      showNotification('warning', 'Operation in progress', 'Please wait for the current operation to complete.');
      return;
    }
    setRefreshKey(prev => prev + 1);
  };

  const handleRetryWithBackoff = async (operation: () => Promise<void>, operationName: string) => {
    if (retryCount >= maxRetries) {
      showNotification('error', `${operationName} failed after ${maxRetries} attempts`, 'Please check your connection and try again later.');
      setIsRetrying(false);
      setLastFailedOperation(operationName);
      return;
    }

    setIsRetrying(true);
    setLastFailedOperation(operationName);
    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
    
    showNotification('info', `Retrying ${operationName}...`, `Attempt ${retryCount + 1} of ${maxRetries}. Waiting ${delay / 1000} seconds.`);
    
    setTimeout(async () => {
      try {
        setRetryCount(prev => prev + 1);
        await operation();
        setRetryCount(0); // Reset on success
        setLastFailedOperation(null);
        showNotification('success', `${operationName} completed successfully`, 'The operation was completed after retry.');
        setIsRetrying(false);
      } catch (error) {
        console.error(`Retry ${retryCount + 1} failed for ${operationName}:`, error);
        if (retryCount + 1 < maxRetries) {
          await handleRetryWithBackoff(operation, operationName);
        } else {
          showNotification('error', `${operationName} failed after ${maxRetries} attempts`, 'Please try again later or contact support.');
          setIsRetrying(false);
          setLastFailedOperation(operationName);
        }
      }
    }, delay);
  };

  const handleExportExcel = async () => {
    if (!validateFormInputs()) {
      showNotification('error', 'Invalid form data', 'Please fix the form errors before exporting.');
      return;
    }
    
    if (!auth.user) {
      showNotification('error', 'Authentication required', 'Please log in to export reports.');
      return;
    }

    if (isOperationLoading || isRetrying) {
      showNotification('warning', 'Export in progress', 'Please wait for the current export to complete.');
      return;
    }

    const exportOperation = async () => {
      setIsOperationLoading(true);
      try {
        const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
        if (!token) {
          throw new Error('Authentication token not found. Please log in again.');
        }
        
        const dateParams = getDateRangeParams();
        const exportParams: Record<string, string> = {};
        if (dateParams.start_date) exportParams.start_date = dateParams.start_date;
        if (dateParams.end_date) exportParams.end_date = dateParams.end_date;
        if (userIdFilter && reportType === 'user-activity')
          exportParams.user_id = userIdFilter.toString();
        if (genreFilter && reportType === 'book-circulation') exportParams.genre = genreFilter;

        const blob = await exportReportExcel(token, reportType, exportParams);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showNotification('success', 'Excel report exported successfully', 'The report has been downloaded to your device.');
        setRetryCount(0); // Reset on success
        setLastFailedOperation(null);
      } catch (err) {
        console.error('Failed to export Excel report:', err);
        if (err instanceof Error) {
          if (err.message.includes('401') || err.message.includes('Authentication')) {
            showNotification('error', 'Authentication expired', 'Please log in again to export reports.');
          } else if (err.message.includes('403')) {
            showNotification('error', 'Access denied', 'You do not have permission to export reports.');
          } else if (err.message.includes('400') || err.message.includes('Bad Request')) {
            showNotification('error', 'Invalid export parameters', 'Please check your date range and filter settings, then try again.');
          } else if (err.message.includes('405') || err.message.includes('Method Not Allowed')) {
            showNotification('error', 'Export service unavailable', 'The export service may be under maintenance. Please try again later.');
          } else if (err.message.includes('500')) {
            showNotification('error', 'Server error during export', 'The server encountered an issue. Please try again in a few moments.');
          } else if (err.message.includes('timeout') || err.message.includes('network')) {
            showNotification('error', 'Network error during export', 'Please check your connection and try again.');
          } else if (err.message.includes('temporarily unavailable')) {
            showNotification('error', 'Export temporarily unavailable', err.message);
          } else if (err.message.includes('Malformed URL') || err.message.includes('Invalid')) {
            showNotification('error', 'Invalid export request', 'Please refresh the page and try again.');
          } else {
            showNotification('error', 'Export failed', err.message || 'An unexpected error occurred during export.');
          }
        } else {
          showNotification('error', 'Unexpected export error', 'An unknown error occurred during export.');
        }
        throw err; // Re-throw for retry logic
      } finally {
        setIsOperationLoading(false);
      }
    };

    try {
      await exportOperation();
    } catch (error: any) {
      // Only retry if it's not an authentication, permission, or validation error
      if (retryCount < maxRetries && !(error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('403') || 
        error.message.includes('400') ||
        error.message.includes('Invalid')
      ))) {
        await handleRetryWithBackoff(exportOperation, 'Excel export');
      } else {
        setIsRetrying(false);
        setLastFailedOperation('Excel export');
      }
    }
  };

  const handleExportPDF = async () => {
    showNotification('error', 'PDF export unavailable', 'PDF export is currently disabled due to system maintenance. Please use Excel export for comprehensive data analysis.');
    return;
  };

  const handleResetFilters = () => {
    setCustomDateRange('last30days');
    setDateRange({ start_date: '', end_date: '' });
    setUserIdFilter('');
    setGenreFilter('');
    setFormErrors({});
    showNotification('info', 'Filters reset', 'All filters have been reset to default values.');
  };

  const renderFormErrors = () => {
    const errorCount = Object.keys(formErrors).length;
    if (errorCount === 0) return null;

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-start space-x-3">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-red-800">
              {errorCount === 1 ? '1 validation error' : `${errorCount} validation errors found`}
            </h4>
            <ul className="mt-2 text-sm text-red-700 space-y-1">
              {Object.entries(formErrors).map(([field, error]) => (
                <li key={field}>• {error}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderReportContent = () => {
    switch (reportType) {
      case 'user-activity':
        return (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">User Activity Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Borrowed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Books
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Overdue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fines
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Activity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userActivityData.map(user => (
                    <tr key={user.user_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.user_name}</div>
                          <div className="text-sm text-gray-500">{user.user_usn}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.total_books_borrowed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.current_books}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${user.overdue_books > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
                        >
                          {user.overdue_books}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{user.total_fines}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_activity
                          ? new Date(user.last_activity).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {userActivityData.length === 0 && (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No user activity data found for the selected period.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Try adjusting your date range or removing filters.
                </p>
              </div>
            )}
            {/* Pagination for user activity report */}
            {userActivityData.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {Math.min(userActivityData.length, 20)} of {userActivityData.length} users
                </div>
                <div className="flex space-x-2">
                  <button className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50" disabled>
                    Previous
                  </button>
                  <button className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50" disabled>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'book-circulation':
        return (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Book Circulation Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Book
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Issues
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Borrowed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Issued
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookCirculationData.map(book => (
                    <tr key={book.book_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{book.book_title}</div>
                          <div className="text-sm text-gray-500">by {book.book_author}</div>
                          <div className="text-xs text-gray-400">{book.book_isbn}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {book.total_issues}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${book.current_status === 'Available' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
                        >
                          {book.current_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {book.total_days_borrowed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {book.last_issued
                          ? new Date(book.last_issued).toLocaleDateString()
                          : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bookCirculationData.length === 0 && (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No book circulation data found for the selected period.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Try adjusting your date range or removing the genre filter.
                </p>
              </div>
            )}
          </div>
        );

      case 'overdue-summary':
        return overdueSummaryData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-mediumtext-gray-600">Overdue Books</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {overdueSummaryData.total_overdue_books}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Clock className="w-8 h-8 text-amber-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Fines</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{overdueSummaryData.total_pending_fines}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Paid Fines</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{overdueSummaryData.total_paid_fines}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Overdue Days</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {overdueSummaryData.average_overdue_days}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null;

      case 'inventory-status':
        return inventoryStatusData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <BookOpen className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Books</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {inventoryStatusData.total_books}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Available</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {inventoryStatusData.available_books}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <Clock className="w-8 h-8 text-amber-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Issued</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {inventoryStatusData.issued_books}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Target className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Shelves</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {inventoryStatusData.total_shelves}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shelf Utilization</h3>
              <div className="space-y-4">
                {inventoryStatusData.shelf_utilization.map(shelf => (
                  <div key={shelf.shelf_id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">{shelf.shelf_name}</span>
                      <span className="text-gray-600">
                        {shelf.current_books}/{shelf.capacity} ({shelf.utilization_percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-1000 ease-out ${
                          shelf.utilization_percentage >= 90
                            ? 'bg-red-500'
                            : shelf.utilization_percentage >= 75
                               ? 'bg-amber-500'
                               : 'bg-green-500'
                        }`}
                        style={{ width: `${shelf.utilization_percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null;

      default:
        return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
          <p className="text-indigo-100">Loading report data...</p>
        </div>
        <div className="flex justify-center items-center p-12">
          <div className="flex flex-col items-center space-y-4">
            <Loader className="w-8 h-8 animate-spin text-indigo-600" />
            {isReportGenerating && (
              <p className="text-gray-600 text-sm">Generating reports, please wait...</p>
            )}
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
          <h1 className="text-3xl font-bold mb-2">Error Loading Reports</h1>
          <p className="text-red-100 mb-4">{error}</p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleRefresh}
              disabled={isRetrying || isLoading}
              className="px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? `Retrying... (${retryCount}/${maxRetries})` : 'Retry'}</span>
            </button>
            {error.includes('401') && (
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Reload Page
              </button>
            )}
            {(error.includes('400') || error.includes('Invalid')) && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
          {lastFailedOperation && (
            <div className="mt-4 p-3 bg-white/10 rounded-lg">
              <p className="text-sm text-red-100">
                Last failed operation: {lastFailedOperation}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white relative">
        <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
        <p className="text-indigo-100">Track library performance and generate detailed reports</p>
        <div className="absolute top-4 right-4 flex space-x-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            disabled={isLoading || isOperationLoading || isRetrying}
            className={`p-2 rounded-full transition-colors disabled:opacity-50 ${
              autoRefresh
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            title={autoRefresh ? 'Disable Auto-refresh' : 'Enable Auto-refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleRefresh}
            disabled={isLoading || isOperationLoading || isRetrying}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 text-white ${(isLoading || isRetrying) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        {renderFormErrors()}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Report Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Report Settings</h3>

            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
              <div className="relative">
                <BarChart3 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={reportType}
                  onChange={e => setReportType(e.target.value as any)}
                  disabled={isLoading || isOperationLoading || isRetrying}
                  className="w-full pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="user-activity">User Activity Report</option>
                  <option value="book-circulation">Book Circulation Report</option>
                  <option value="overdue-summary">Overdue Summary Report</option>
                  <option value="inventory-status">Inventory Status Report</option>
                </select>
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={customDateRange}
                  onChange={e => setCustomDateRange(e.target.value)}
                  disabled={isLoading || isOperationLoading || isRetrying}
                  className="w-full pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="last7days">Last 7 Days</option>
                  <option value="last30days">Last 30 Days</option>
                  <option value="last3months">Last 3 Months</option>
                  <option value="last6months">Last 6 Months</option>
                  <option value="lastyear">Last Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
            </div>

            {/* Custom Date Range */}
            {customDateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={dateRange.start_date.split('T')[0] || ''}
                    onChange={e =>
                      setDateRange(prev => ({
                        ...prev,
                        start_date: e.target.value ? new Date(e.target.value).toISOString() : '',
                      }))
                    }
                    disabled={isLoading || isOperationLoading || isRetrying}
                    className={`w-full px-3 py-2 border ${formErrors.start_date ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'} rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  {formErrors.start_date && (
                    <p className="mt-1 text-red-500 text-xs">{formErrors.start_date}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={dateRange.end_date.split('T')[0] || ''}
                    onChange={e =>
                      setDateRange(prev => ({
                        ...prev,
                        end_date: e.target.value ? new Date(e.target.value).toISOString() : '',
                      }))
                    }
                    disabled={isLoading || isOperationLoading || isRetrying}
                    className={`w-full px-3 py-2 border ${formErrors.end_date ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'} rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  {formErrors.end_date && (
                    <p className="mt-1 text-red-500 text-xs">{formErrors.end_date}</p>
                  )}
                </div>
                {formErrors.date_range && (
                  <div className="col-span-2">
                    <p className="text-red-500 text-xs">{formErrors.date_range}</p>
                  </div>
                )}
              </div>
            )}

            {/* Additional Filters */}
            {reportType === 'user-activity' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User ID Filter (Optional)
                </label>
                <input
                  type="number"
                  value={userIdFilter}
                  onChange={e => setUserIdFilter(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Filter by specific user ID"
                  disabled={isLoading || isOperationLoading || isRetrying}
                  className={`w-full px-3 py-2 border ${formErrors.userIdFilter ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'} rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {formErrors.userIdFilter && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.userIdFilter}</p>
                )}
              </div>
            )}

            {reportType === 'book-circulation' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Genre Filter (Optional)
                </label>
                <input
                  type="text"
                  value={genreFilter}
                  onChange={e => setGenreFilter(e.target.value)}
                  placeholder="Filter by genre (e.g., Fiction, Science)"
                  disabled={isLoading || isOperationLoading || isRetrying}
                  className={`w-full px-3 py-2 border ${formErrors.genreFilter ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'} rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {formErrors.genreFilter && (
                  <p className="mt-1 text-red-500 text-xs">{formErrors.genreFilter}</p>
                )}
              </div>
            )}

            {/* Reset Filters Button */}
            <div className="pt-4">
              <button
                onClick={handleResetFilters}
                disabled={isLoading || isOperationLoading || isRetrying}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Right column - Export Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Export Options</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Generate downloadable reports in your preferred format:
              </p>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={handleExportExcel}
                  disabled={isOperationLoading || isRetrying || isLoading || Object.keys(formErrors).length > 0}
                  className="flex items-center justify-center space-x-2 bg-emerald-600 text-white px-4 py-3 rounded-lg hover:bg-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {isOperationLoading || isRetrying ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  <span>{isOperationLoading || isRetrying ? 'Generating...' : 'Export Excel'}</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={true}
                  className="flex items-center justify-center space-x-2 bg-gray-400 text-white px-4 py-3 rounded-lg cursor-not-allowed transition-all duration-200 shadow-md opacity-50"
                  title="PDF export is temporarily unavailable due to system maintenance"
                >
                  <FileText className="w-5 h-5" />
                  <span>PDF Unavailable</span>
                </button>
              </div>
            </div>

            {/* Export Info */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Info className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Export Information</h4>
                  <p className="text-sm text-blue-700">
                    <strong>Excel:</strong> Comprehensive data export with proper formatting for analysis in spreadsheet applications. Includes all filtered data and calculations.
                  </p>
                  <p className="text-sm text-orange-700 mt-2">
                    <strong>PDF:</strong> Currently unavailable due to system maintenance. Use Excel export for complete data analysis and reporting needs.
                  </p>
                  {Object.keys(formErrors).length > 0 && (
                    <p className="text-sm text-red-700 mt-2">
                      <strong>Note:</strong> Please fix validation errors before exporting reports.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Retry Info */}
            {lastFailedOperation && (
              <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-amber-800">Recent Failure</h4>
                    <p className="text-sm text-amber-700">
                      {lastFailedOperation} failed. {retryCount > 0 && `Attempted ${retryCount} time(s).`}
                    </p>
                    {retryCount >= maxRetries && (
                      <p className="text-sm text-amber-700 mt-1">
                        Maximum retry attempts reached. Please check your connection and try again later.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Content */}
      {renderReportContent()}

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg ${
            notification.type === 'success' 
              ? 'bg-emerald-500 text-white' 
              : notification.type === 'warning'
                ? 'bg-amber-500 text-white'
                : notification.type === 'info'
                  ? 'bg-blue-500 text-white'
                  : 'bg-red-500 text-white'
          }`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : notification.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : notification.type === 'info' ? (
                <Info className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.message}</p>
              {notification.details && (
                <p className="text-sm opacity-90 mt-1">{notification.details}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {(isOperationLoading || isRetrying) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4 max-w-sm mx-4">
            <Loader className="w-8 h-8 animate-spin text-indigo-600" />
            <div className="text-center">
              <p className="text-gray-700 font-medium">
                {isRetrying ? `Retrying operation...` : 'Generating report...'}
              </p>
              {isRetrying && (
                <p className="text-sm text-gray-500 mt-1">
                  Attempt {retryCount} of {maxRetries}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Please wait, this may take a few moments
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;