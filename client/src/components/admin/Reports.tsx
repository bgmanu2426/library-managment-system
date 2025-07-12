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
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

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
      setError(null);

      try {
        const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
        if (!token) {
          throw new Error('Authentication token not found');
        }

        // Set date range based on custom selection
        const dateParams = getDateRangeParams();

        // Fetch all report types
        const [userActivity, bookCirculation, overdueSummary, inventoryStatus] = await Promise.all([
          getUserActivityReport(
            token,
            dateParams.start_date,
            dateParams.end_date,
            userIdFilter || undefined
          ),
          getBookCirculationReport(
            token,
            dateParams.start_date,
            dateParams.end_date,
            genreFilter || undefined
          ),
          getOverdueSummaryReport(token, dateParams.start_date, dateParams.end_date),
          getInventoryStatusReport(token),
        ]);

        setUserActivityData(userActivity.user_activity_report || []);
        setBookCirculationData(bookCirculation.book_circulation_report || []);
        setOverdueSummaryData(overdueSummary.overdue_summary);
        setInventoryStatusData(inventoryStatus);
      } catch (err) {
        console.error('Failed to fetch report data:', err);
        if (err instanceof Error && err.message.includes('401')) {
          setError('Authentication expired. Please log in again.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load report data');
        }
      } finally {
        setIsLoading(false);
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

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const validateDateRange = (): boolean => {
    if (customDateRange === 'custom') {
      const errors: { [key: string]: string } = {};

      if (!dateRange.start_date) {
        errors.start_date = 'Start date is required';
      }
      if (!dateRange.end_date) {
        errors.end_date = 'End date is required';
      }
      if (
        dateRange.start_date &&
        dateRange.end_date &&
        new Date(dateRange.start_date) > new Date(dateRange.end_date)
      ) {
        errors.date_range = 'Start date must be before end date';
      }

      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    }
    setFormErrors({});
    return true;
  };

  const handleExportExcel = async () => {
    if (!validateDateRange()) return;
    if (!auth.user) {
      showNotification('error', 'Authentication required');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
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

      showNotification('success', 'Excel report exported successfully');
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      if (err instanceof Error && err.message.includes('401')) {
        showNotification('error', 'Authentication expired. Please log in again.');
      } else {
        showNotification(
          'error',
          err instanceof Error ? err.message : 'Failed to export Excel report'
        );
      }
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!validateDateRange()) return;
    if (!auth.user) {
      showNotification('error', 'Authentication required');
      return;
    }

    setIsOperationLoading(true);
    try {
      const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      const dateParams = getDateRangeParams();

      const exportParams: Record<string, string> = {};
      if (dateParams.start_date) exportParams.start_date = dateParams.start_date;
      if (dateParams.end_date) exportParams.end_date = dateParams.end_date;
      if (userIdFilter && reportType === 'user-activity')
        exportParams.user_id = userIdFilter.toString();
      if (genreFilter && reportType === 'book-circulation') exportParams.genre = genreFilter;

      const blob = await exportReportPDF(token, reportType, exportParams);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showNotification('success', 'PDF report exported successfully');
    } catch (err) {
      console.error('Failed to export PDF report:', err);
      if (err instanceof Error && err.message.includes('401')) {
        showNotification('error', 'Authentication expired. Please log in again.');
      } else {
        showNotification(
          'error',
          err instanceof Error ? err.message : 'Failed to export PDF report'
        );
      }
    } finally {
      setIsOperationLoading(false);
    }
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
              </div>
            )}
            {/* Pagination for user activity report */}
            {userActivityData.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {Math.min(userActivityData.length, 20)} of {userActivityData.length} users
                </div>
                <div className="flex space-x-2">
                  <button className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    Previous
                  </button>
                  <button className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
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
                  <p className="text-sm font-medium text-gray-600">Overdue Books</p>
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
          <Loader className="w-8 h-8 animate-spin text-indigo-600" />
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
        <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
        <p className="text-indigo-100">Track library performance and generate detailed reports</p>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`absolute top-4 right-16 p-2 rounded-full transition-colors ${
            autoRefresh
              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title={autoRefresh ? 'Disable Auto-refresh' : 'Enable Auto-refresh'}
        >
          <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg p-6">
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
                  className="w-full pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
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
                  className="w-full pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
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
                    className={`w-full px-3 py-2 border ${formErrors.start_date ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'} rounded-lg focus:ring-2 focus:border-transparent`}
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
                    className={`w-full px-3 py-2 border ${formErrors.end_date ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'} rounded-lg focus:ring-2 focus:border-transparent`}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
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
                  placeholder="Filter by genre"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Search Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={`Search ${reportType.replace('-', ' ')} data...`}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  onChange={e => {
                    // Implement search logic based on report type
                    const searchTerm = e.target.value.toLowerCase();
                    if (reportType === 'user-activity') {
                      // Filter user activity data
                    } else if (reportType === 'book-circulation') {
                      // Filter book circulation data
                    }
                  }}
                />
              </div>
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
                  disabled={isOperationLoading}
                  className="flex items-center justify-center space-x-2 bg-emerald-600 text-white px-4 py-3 rounded-lg hover:bg-emerald-700 transition-all duration-200 disabled:opacity-50 shadow-md"
                >
                  {isOperationLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  <span>{isOperationLoading ? 'Generating...' : 'Export Excel'}</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isOperationLoading}
                  className="flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-all duration-200 disabled:opacity-50 shadow-md"
                >
                  {isOperationLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                  <span>{isOperationLoading ? 'Generating...' : 'Export PDF'}</span>
                </button>
              </div>
            </div>

            {/* Export Info */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Export Information</h4>
                  <p className="text-sm text-blue-700">
                    <strong>PDF:</strong> Comprehensive report with tables and visual analytics.
                    Perfect for presentations and formal documentation.
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>Excel:</strong> Raw data export for further analysis in spreadsheet
                    applications or data processing tools.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {renderReportContent()}

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
            <Loader className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-gray-700">Generating report...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
