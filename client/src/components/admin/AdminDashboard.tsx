import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  Package,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Loader,
} from 'lucide-react';
import { getDashboardStats, getRecentActivity, getInventoryStatusReport } from '../../utils/api';
import {
  DashboardStats,
  InventoryStatusReport,
  RecentActivity,
  ShelfUtilization,
} from '../../types';
import { useAuth } from '../../context/AuthContext';

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const AdminDashboard: React.FC = () => {
  // State management
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatusReport | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isShelfDataLoading, setIsShelfDataLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'checking'>('online');
  const { user } = useAuth();

  // Fetch dashboard data with enhanced error handling
  const fetchDashboardData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setIsShelfDataLoading(true);
      setError(null);
      setNetworkStatus('checking');

      try {
        if (!user) {
          throw new Error('Authentication required. Please log in to access the dashboard.');
        }

        const token = localStorage.getItem(import.meta.env.VITE_TOKEN_KEY || 'library_token');
        if (!token) {
          throw new Error('Authentication token not found. Please log in again.');
        }

        // Check network connectivity
        const isOnline = navigator.onLine;
        if (!isOnline) {
          setNetworkStatus('offline');
          throw new Error('No internet connection. Please check your network and try again.');
        }

        setNetworkStatus('online');

        // Fetch dashboard statistics with timeout
        const dashboardPromise = getDashboardStats(token);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 15000)
        );

        const dashboardStats = (await Promise.race([dashboardPromise, timeoutPromise])) as any;

        if (!dashboardStats) {
          throw new Error('Failed to fetch dashboard statistics. Please try again.');
        }
        setStats(dashboardStats);

        // Fetch inventory status report for shelf utilization with error handling
        try {
          const inventoryData = await getInventoryStatusReport(token);
          setInventoryStatus(inventoryData);
        } catch (inventoryError) {
          console.error('Failed to fetch inventory status report:', inventoryError);
          // Set fallback data to prevent UI crashes
          setInventoryStatus({
            total_books: dashboardStats.total_books || 0,
            available_books: dashboardStats.available_books || 0,
            issued_books: dashboardStats.issued_books || 0,
            total_racks: dashboardStats.total_racks || 0,
            total_shelves: dashboardStats.total_shelves || 0,
            shelf_utilization: [],
          });
        } finally {
          setIsShelfDataLoading(false);
        }

        // Fetch recent activity with error handling
        try {
          const activityResponse = await getRecentActivity(token);
          const activities = activityResponse.recent_activities || [];
          setRecentActivity(Array.isArray(activities) ? activities : []);
        } catch (activityError) {
          console.error('Failed to fetch recent activity:', activityError);
          setRecentActivity([]);
        }

        setLastRefreshTime(new Date());
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);

        // Enhanced error messaging
        if (err instanceof Error) {
          if (err.message.includes('timeout')) {
            setError('Request timed out. Please check your connection and try again.');
          } else if (err.message.includes('Authentication')) {
            setError('Authentication failed. Please log in again.');
          } else if (err.message.includes('network') || err.message.includes('fetch')) {
            setError('Network error. Please check your internet connection.');
            setNetworkStatus('offline');
          } else {
            setError(err.message || 'An error occurred while loading dashboard data');
          }
        } else {
          setError('An unexpected error occurred. Please try again.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    fetchDashboardData();

    // Set up auto-refresh interval if enabled
    let refreshInterval: number | undefined;
    if (autoRefresh) {
      refreshInterval = window.setInterval(() => {
        fetchDashboardData();
      }, 60000); // Refresh every minute
    }

    // Set up network status monitoring
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchDashboardData, refreshKey, autoRefresh]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    fetchDashboardData(true);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'issue':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'return':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'add':
        return <BookOpen className="w-4 h-4 text-blue-600" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Calendar className="w-4 h-4 text-gray-600" />;
    }
  };

  const getOverdueStatus = (overdueCount: number) => {
    if (overdueCount === 0)
      return { color: 'text-emerald-600', bgColor: 'bg-emerald-50', status: 'Good' };
    if (overdueCount <= 5)
      return { color: 'text-amber-600', bgColor: 'bg-amber-50', status: 'Warning' };
    return { color: 'text-red-600', bgColor: 'bg-red-50', status: 'Critical' };
  };

  const formatLastRefresh = () => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastRefreshTime.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return lastRefreshTime.toLocaleTimeString();
  };

  // Enhanced loading state with skeleton screens
  if (isLoading && !isRefreshing) {
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 p-2 sm:p-4 lg:p-0">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl lg:rounded-2xl p-4 sm:p-6 lg:p-8 text-white">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-purple-100 text-sm sm:text-base">Loading dashboard data...</p>
          <div className="mt-4 flex items-center space-x-2">
            <Loader className="w-4 h-4 animate-spin" />
            <span className="text-sm">Please wait...</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="bg-white rounded-lg lg:rounded-xl shadow-lg p-4 sm:p-6 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="p-2 sm:p-3 bg-gray-100 rounded-lg ml-2">
                  <div className="h-6 w-6 sm:h-8 sm:w-8 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4">
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {[...Array(2)].map((_, index) => (
            <div
              key={index}
              className="bg-white rounded-lg lg:rounded-xl shadow-lg p-4 sm:p-6 animate-pulse"
            >
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-40 mb-4"></div>
              <div className="space-y-3 sm:space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <div className="h-3 bg-gray-200 rounded w-24 flex-1 mr-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-8"></div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded w-full"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Enhanced error state with retry options
  if (error && !isRefreshing) {
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 p-2 sm:p-4 lg:p-0">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-xl lg:rounded-2xl p-4 sm:p-6 lg:p-8 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                Error Loading Dashboard
              </h1>
              <p className="text-red-100 text-sm sm:text-base mb-4">{error}</p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleRefresh}
                  className="flex items-center justify-center px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center justify-center px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </button>
              </div>
            </div>
            {networkStatus === 'offline' && (
              <div className="ml-4 p-2 bg-red-700 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 p-2 sm:p-4 lg:p-0">
        <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl lg:rounded-2xl p-4 sm:p-6 lg:p-8 text-white">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">Dashboard Data Missing</h1>
          <p className="text-yellow-100 text-sm sm:text-base">
            Unable to load dashboard data. Please try again.
          </p>
          <button
            onClick={handleRefresh}
            className="mt-4 flex items-center px-4 py-2 bg-white text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const overdueStatus = getOverdueStatus(stats.overdue_books || 0);

  return (
    <ErrorBoundary
      fallback={
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg m-2 sm:m-4 lg:m-0">
          <h3 className="font-bold">Dashboard Error</h3>
          <p>An unexpected error occurred. Please refresh the page.</p>
          <button
            onClick={handleRefresh}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Refresh
          </button>
        </div>
      }
    >
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 p-2 sm:p-4 lg:p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl lg:rounded-2xl p-4 sm:p-6 lg:p-8 text-white relative">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-purple-100 text-sm sm:text-base pr-16 sm:pr-20">
            Manage your library operations and track performance
          </p>

          {/* Status indicators */}
          <div className="mt-3 flex items-center space-x-4 text-xs sm:text-sm">
            <div className="flex items-center space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${networkStatus === 'online' ? 'bg-green-300' : networkStatus === 'offline' ? 'bg-red-300' : 'bg-yellow-300'}`}
              ></div>
              <span className="text-purple-100">
                {networkStatus === 'online'
                  ? 'Online'
                  : networkStatus === 'offline'
                    ? 'Offline'
                    : 'Checking...'}
              </span>
            </div>
            <div className="text-purple-100">Last updated: {formatLastRefresh()}</div>
          </div>

          {/* Control buttons */}
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex space-x-2">
            <div className="relative group">
              <button
                onClick={toggleAutoRefresh}
                className={`p-2 ${autoRefresh ? 'bg-white/40' : 'bg-white/20'} rounded-full hover:bg-white/30 transition-colors`}
                title={autoRefresh ? 'Auto-refresh enabled (1 min)' : 'Enable auto-refresh'}
              >
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </button>
              <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              </div>
            </div>
            <div className="relative group">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors disabled:opacity-50"
                title="Refresh Dashboard"
              >
                <RefreshCw
                  className={`w-3 h-3 sm:w-4 sm:h-4 text-white ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
              <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Refresh data
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {/* Total Books */}
          <div className="bg-white rounded-lg lg:rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Books</p>
                <p className="text-lg sm:text-xl lg:text-3xl font-bold text-gray-900">
                  {stats.total_books}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg ml-2">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 lg:w-8 lg:h-8 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 sm:mt-4 flex items-center">
              <span className="text-xs sm:text-sm text-gray-500">Total inventory</span>
            </div>
          </div>

          {/* Available Books */}
          <div className="bg-white rounded-lg lg:rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Available Books</p>
                <p className="text-lg sm:text-xl lg:text-3xl font-bold text-gray-900">
                  {stats.available_books}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-emerald-100 rounded-lg ml-2">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-8 lg:h-8 text-emerald-600" />
              </div>
            </div>
            <div className="mt-2 sm:mt-4">
              <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1">
                <span>Availability Rate</span>
                <span>{Math.round((stats.available_books / (stats.total_books || 1)) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                <div
                  className="bg-emerald-500 h-1.5 sm:h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.available_books / (stats.total_books || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Issued Books */}
          <div className="bg-white rounded-lg lg:rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Issued Books</p>
                <p className="text-lg sm:text-xl lg:text-3xl font-bold text-gray-900">
                  {stats.issued_books}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-amber-100 rounded-lg ml-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 lg:w-8 lg:h-8 text-amber-600" />
              </div>
            </div>
            <div className="mt-2 sm:mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-gray-500">Overdue books:</span>
                <div className="flex items-center space-x-1">
                  <span className={`text-xs sm:text-sm font-medium ${overdueStatus.color}`}>
                    {stats.overdue_books}
                  </span>
                  {stats.overdue_books > 0 && (
                    <div className="relative group">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {overdueStatus.status} - Action required
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Overdue Books - Enhanced with click-through */}
          <div
            className={`bg-white rounded-lg lg:rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-all cursor-pointer ${overdueStatus.bgColor} border-l-4 ${
              stats.overdue_books > 0 ? 'border-red-500' : 'border-emerald-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Overdue Books</p>
                <p className={`text-lg sm:text-xl lg:text-3xl font-bold ${overdueStatus.color}`}>
                  {stats.overdue_books}
                </p>
              </div>
              <div
                className={`p-2 sm:p-3 rounded-lg ml-2 ${
                  stats.overdue_books > 0 ? 'bg-red-100' : 'bg-emerald-100'
                }`}
              >
                {stats.overdue_books > 0 ? (
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-8 lg:h-8 text-red-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-8 lg:h-8 text-emerald-600" />
                )}
              </div>
            </div>
            <div className="mt-2 sm:mt-4 flex items-center justify-between">
              <span className={`text-xs sm:text-sm font-medium ${overdueStatus.color}`}>
                {overdueStatus.status}
              </span>
            </div>
            <div className="absolute top-2 right-2">
              <div className="relative group">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Library Utilization */}
          <div className="bg-white rounded-lg lg:rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900">
                Library Utilization
              </h3>
              <div className="relative group">
                <Package className="w-4 h-4 text-gray-400" />
                <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  Storage units: {stats.total_racks} racks, {stats.total_shelves} shelves
                </div>
              </div>
            </div>
            {isShelfDataLoading || isRefreshing ? (
              <div className="space-y-3 sm:space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2 animate-pulse">
                    <div className="flex justify-between">
                      <div className="h-3 bg-gray-200 rounded w-24 flex-1 mr-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-8"></div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {inventoryStatus &&
                inventoryStatus.shelf_utilization &&
                Array.isArray(inventoryStatus.shelf_utilization) &&
                inventoryStatus.shelf_utilization.length > 0 ? (
                  inventoryStatus.shelf_utilization.map((shelf: ShelfUtilization) => {
                    if (!shelf) return null;

                    const utilization = shelf.utilization_percentage || 0;
                    const shelfName = shelf.shelf_name || `Shelf ${shelf.shelf_id || 'Unknown'}`;

                    return (
                      <div key={shelf.shelf_id} className="space-y-2">
                        <div className="flex justify-between text-xs sm:text-sm">
                          <div className="relative group flex-1">
                            <span className="font-medium text-gray-700 truncate block pr-2">
                              {shelfName}
                            </span>
                            <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                              Capacity: {shelf.capacity || 0} books, Current:{' '}
                              {shelf.current_books || 0} books
                            </div>
                          </div>
                          <span className="text-gray-600 flex-shrink-0 ml-2">{utilization}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                          <div
                            className={`h-1.5 sm:h-2 rounded-full transition-all duration-500 ${
                              utilization > 90
                                ? 'bg-red-500'
                                : utilization > 75
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">
                      No shelf utilization data available
                    </p>
                    <button
                      onClick={handleRefresh}
                      className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Refresh data
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg lg:rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900">
                Recent Activity
              </h3>
              <div className="relative group">
                <RefreshCw
                  onClick={handleRefresh}
                  className={`w-4 h-4 text-gray-400 cursor-pointer ${isRefreshing ? 'animate-spin' : ''}`}
                />
                <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  Refresh activity log
                </div>
              </div>
            </div>
            {isRefreshing ? (
              <div className="space-y-3 sm:space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start space-x-3 animate-pulse">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-2 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {Array.isArray(recentActivity) && recentActivity.length > 0 ? (
                  recentActivity.map((activity, index) => (
                    <div key={activity.id ?? index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">{getActivityIcon(activity.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-gray-900 leading-relaxed">
                          {activity.details || ''}
                        </p>
                        {activity.timestamp && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(activity.timestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center">
                    <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">No recent activity to display</p>
                    <button
                      onClick={handleRefresh}
                      className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Refresh data
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AdminDashboard;
