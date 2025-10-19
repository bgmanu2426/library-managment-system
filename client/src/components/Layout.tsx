import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserDashboardStats, getFines, getCurrentBooks } from '../utils/api';
import { FineResponse, CurrentBookResponse, OverdueBookResponse } from '../types';
import {
  BookOpen,
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  User,
  LogOut,
  Menu,
  X,
  History,
  AlertTriangle,
  Loader2,
  Bell,
  Archive,
  Layers3,
  Key,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage }) => {
  const { user, logout, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      type: 'info' | 'warning' | 'error';
      title: string;
      description?: string;
      action?: { label: string; onClick: () => void };
    }>
  >([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate loading transition when page changes
    setPageLoading(true);
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentPage]);

  // Build notifications from API data
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || 'library_token';
    const fetchNotifications = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        if (isMounted) {
          setNotifications([]);
          setNotificationCount(0);
        }
        return;
      }

      setNotifLoading(true);
      setNotifError(null);
      try {
        const [stats, finesResult, currentBooksResult] = await Promise.all([
          getUserDashboardStats(token).catch(() => null),
          getFines(token, 'pending').catch(() => ({ fines: [] }) as { fines: FineResponse[] }),
          getCurrentBooks(token).catch(() => ({ books: [] })),
        ]);

        const items: Array<{
          id: string;
          type: 'info' | 'warning' | 'error';
          title: string;
          description?: string;
          action?: { label: string; onClick: () => void };
        }> = [];

        // Overdue summary
        const overdueCount = stats?.overdue_books_count || 0;
        if (overdueCount > 0) {
          items.push({
            id: 'overdue-summary',
            type: 'warning',
            title: `You have ${overdueCount} overdue book${overdueCount > 1 ? 's' : ''}`,
            description: 'Please return them or settle fines to avoid penalties.',
          });
        }

        // Overdue details (limit 3)
        const overdueList: OverdueBookResponse[] = Array.isArray(stats?.overdue_books)
          ? (stats?.overdue_books as OverdueBookResponse[])
          : [];
        overdueList.slice(0, 3).forEach((b: OverdueBookResponse, idx: number) => {
          const days = typeof b?.days_overdue === 'number' ? b.days_overdue : undefined;
          items.push({
            id: `overdue-${b?.book_isbn || b?.book_id || idx}`,
            type: 'warning',
            title: `Overdue: ${b?.book_title || 'Book'}`,
            description:
              days !== undefined ? `${days} day${days === 1 ? '' : 's'} overdue` : undefined,
          });
        });

        // Pending fines
        const finesArrayMaybe = (finesResult as { fines: FineResponse[] })?.fines;
        const fines: FineResponse[] = Array.isArray(finesArrayMaybe) ? finesArrayMaybe : [];
        if (fines.length > 0) {
          const total = fines.reduce(
            (sum: number, f: FineResponse) => sum + (f.fine_amount || 0),
            0
          );
          items.push({
            id: 'pending-fines',
            type: 'error',
            title: `You have ${fines.length} pending fine${fines.length > 1 ? 's' : ''}`,
            description: `Total due: ₹${total.toFixed(2)}`,
          });
        }

        // Due soon (within 3 days)
        const now = new Date();
        const soonThresholdMs = 3 * 24 * 60 * 60 * 1000;
        const currentBooks: CurrentBookResponse[] = Array.isArray(currentBooksResult?.books)
          ? (currentBooksResult.books as CurrentBookResponse[])
          : [];
        const dueSoon = currentBooks.filter((b: CurrentBookResponse) => {
          if (!b?.due_date) return false;
          const due = new Date(b.due_date);
          const diff = due.getTime() - now.getTime();
          return diff > 0 && diff <= soonThresholdMs;
        });
        if (dueSoon.length > 0) {
          items.push({
            id: 'due-soon',
            type: 'info',
            title: `${dueSoon.length} book${dueSoon.length > 1 ? 's are' : ' is'} due soon`,
            description: 'Return on time to avoid fines.',
          });
        }

        if (isMounted) {
          setNotifications(items);
          setNotificationCount(items.length);
        }
      } catch (err) {
        if (isMounted) {
          setNotifError(err instanceof Error ? err.message : 'Failed to load notifications');
        }
      } finally {
        if (isMounted) setNotifLoading(false);
      }
    };

    // Initial fetch
    fetchNotifications();
    // Refresh periodically
    const intervalId = window.setInterval(fetchNotifications, 60_000);

    return () => {
      isMounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (isNotificationsOpen && notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isNotificationsOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const adminMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'books', label: 'Books', icon: BookOpen },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'racks', label: 'Racks', icon: Archive },
    { id: 'shelves', label: 'Shelves', icon: Layers3 },
    { id: 'overdue', label: 'Overdue & Fines', icon: AlertTriangle },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'api-keys', label: 'API Keys', icon: Key },
  ];

  const userMenuItems = [
    { id: 'dashboard', label: 'Library', icon: BookOpen },
    { id: 'history', label: 'My Books', icon: History },
    { id: 'profile', label: 'My Profile', icon: User },
  ];

  const menuItems = user.role === 'admin' ? adminMenuItems : userMenuItems;

  const handleLogout = async () => {
    try {
      setPageLoading(true);
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setPageLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 w-64 md:w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between h-16 md:h-18 px-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-emerald-50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-lg shadow-md">
                <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-emerald-600">
                Library
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700 p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-5 border-b border-gray-200 bg-white shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                <span className="text-sm font-medium text-white">
                  {user.name
                    ?.split(' ')
                    .map(n => n?.[0])
                    .join('') || 'U'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize flex items-center">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-1.5 ${user.role === 'admin' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  ></span>
                  {user.role}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-thin">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-all duration-200 group text-base
                    ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm border-l-4 border-blue-500'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                    }
                  `}
                >
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'text-blue-600 scale-110' : 'text-gray-500 group-hover:text-gray-700 group-hover:scale-105'}`}
                  />
                  <span className={`font-medium ${isActive ? 'text-blue-700' : ''}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Logout Button - Always visible at bottom */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 group text-base"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 z-10">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center space-x-3 lg:hidden">
                <div className="p-1.5 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-lg shadow-sm">
                  <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-emerald-600">
                  Library
                </span>
              </div>
            </div>

            {/* Right side items */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors relative"
                  aria-haspopup="true"
                  aria-expanded={isNotificationsOpen}
                  onClick={() => setIsNotificationsOpen(v => !v)}
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 text-[10px] px-1 flex items-center justify-center bg-red-500 text-white rounded-full">
                      {notificationCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                      <span className="text-sm font-semibold text-gray-700">Notifications</span>
                      <button
                        className="text-xs text-blue-600 hover:underline disabled:text-gray-400"
                        disabled={notifications.length === 0}
                        onClick={() => {
                          setNotifications([]);
                          setNotificationCount(0);
                        }}
                      >
                        Mark all as read
                      </button>
                    </div>

                    <div className="max-h-80 overflow-auto">
                      {notifLoading && (
                        <div className="py-6 flex items-center justify-center text-gray-500 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
                        </div>
                      )}

                      {!notifLoading && notifError && (
                        <div className="p-4 text-sm text-red-600">{notifError}</div>
                      )}

                      {!notifLoading && !notifError && notifications.length === 0 && (
                        <div className="p-4 text-sm text-gray-500">You're all caught up.</div>
                      )}

                      {!notifLoading && !notifError && notifications.length > 0 && (
                        <ul className="divide-y divide-gray-100">
                          {notifications.map(n => (
                            <li key={n.id} className="p-3 hover:bg-gray-50">
                              <div className="flex items-start">
                                {(() => {
                                  const dotColor =
                                    n.type === 'error'
                                      ? 'bg-red-500'
                                      : n.type === 'warning'
                                        ? 'bg-amber-500'
                                        : 'bg-blue-500';
                                  return (
                                    <span
                                      className={`mt-1 mr-3 inline-block w-2 h-2 rounded-full ${dotColor}`}
                                    />
                                  );
                                })()}
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-800">{n.title}</p>
                                  {n.description && (
                                    <p className="text-xs text-gray-500 mt-0.5">{n.description}</p>
                                  )}
                                  {n.action && (
                                    <button
                                      className="mt-2 text-xs text-blue-600 hover:underline"
                                      onClick={n.action.onClick}
                                    >
                                      {n.action.label}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User info in header for larger screens */}
              <div className="hidden md:flex items-center space-x-3">
                <div className="w-9 h-9 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-xs font-medium text-white">
                    {user.name
                      ?.split(' ')
                      .map(n => n?.[0])
                      .join('') || 'U'}
                  </span>
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50 relative">
          {/* Loading overlay */}
          {pageLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center z-10 backdrop-blur-sm">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          )}

          {/* Page content */}
          <div className="bg-white shadow-sm rounded-lg p-4 md:p-6 border border-gray-100">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
